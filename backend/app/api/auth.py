"""Authentication & Profile Endpoints."""
from fastapi import APIRouter, Depends
from app.core.security import get_current_user, AuthUser

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me")
async def get_current_user_profile(user: AuthUser = Depends(get_current_user)):
    return {
        "uid": user.uid,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "is_admin": user.is_admin,
        "is_teacher": user.is_teacher,
        "is_student": user.is_student,
        "teacher_id": user.teacher_id,
        "student_id": user.student_id
    }
