"""Authentication, Authorization, and Security Dependencies."""
from typing import Optional, List
from fastapi import HTTPException, Security, status, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.firebase import verify_firebase_token, get_firestore_db
from app.config import settings
from app.core.logging import logger

security_bearer = HTTPBearer(auto_error=False)

# Bootstrap Root University Administrators
BOOTSTRAP_ADMIN_EMAILS = {
    "rtrv572@gmail.com",
    "it24026@mbstu.ac.bd",
    "sabbirstudy2002@gmail.com",
}


class AuthUser:
    def __init__(self, uid: str, email: str, role: str, name: Optional[str] = None, teacher_id: Optional[str] = None, student_id: Optional[str] = None):
        self.uid = uid
        self.email = email.lower().strip()
        self.role = role.upper()
        self.name = name or email
        self.teacher_id = teacher_id
        self.student_id = student_id

    @property
    def is_admin(self) -> bool:
        return self.role == "ADMIN" or self.email in BOOTSTRAP_ADMIN_EMAILS

    @property
    def is_teacher(self) -> bool:
        return self.is_admin or self.role == "TEACHER"

    @property
    def is_student(self) -> bool:
        return self.role == "STUDENT"


async def get_current_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
) -> AuthUser:
    """Validates Firebase Bearer token and resolves user role from Firestore."""
    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.credentials
    try:
        decoded = verify_firebase_token(token)
    except Exception as e:
        # Development bypass for local testing or unauthenticated dev environment
        if settings.ENVIRONMENT == "development" and token.startswith("dev-token-"):
            role_hint = token.replace("dev-token-", "").upper()
            return AuthUser(
                uid="dev-user-01",
                email="admin@mbstu.ac.bd",
                role=role_hint if role_hint in ("ADMIN", "TEACHER", "STUDENT") else "ADMIN",
                name="Development Test User"
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid = decoded.get("uid")
    email = decoded.get("email", "").lower().strip()

    # Bootstrap root admin check
    if email in BOOTSTRAP_ADMIN_EMAILS:
        return AuthUser(uid=uid, email=email, role="ADMIN", name=decoded.get("name", "University Administrator"))

    # Resolve role from Firestore /users/{uid}
    db = get_firestore_db()
    role = "STUDENT"
    teacher_id = None
    student_id = None
    name = decoded.get("name", email)

    if db:
        try:
            doc_ref = db.collection("users").document(uid).get()
            if doc_ref.exists:
                data = doc_ref.to_dict() or {}
                role = data.get("role", "STUDENT").upper()
                name = data.get("displayName", name)
                teacher_id = data.get("teacherId")
                student_id = data.get("studentId")
        except Exception as err:
            logger.warning("Could not query Firestore for user %s: %s", uid, err)

    return AuthUser(uid=uid, email=email, role=role, name=name, teacher_id=teacher_id, student_id=student_id)


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [r.upper() for r in allowed_roles]

    def __call__(self, user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if user.is_admin:
            return user
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Required roles {self.allowed_roles}, but user has role '{user.role}'."
            )
        return user


require_admin = RoleChecker(["ADMIN"])
require_teacher = RoleChecker(["ADMIN", "TEACHER"])
require_student = RoleChecker(["ADMIN", "TEACHER", "STUDENT"])


def verify_hardware_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> str:
    """Verifies IoT device authentication key from request headers."""
    api_key = x_api_key
    if not api_key and authorization:
        if authorization.lower().startswith("bearer "):
            api_key = authorization[7:].strip()
        else:
            api_key = authorization.strip()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hardware API key required (X-API-Key or Authorization header)."
        )
    return api_key
