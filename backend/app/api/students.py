"""Student Management Endpoints."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import require_admin, require_teacher, require_student, AuthUser
from app.core.firebase import get_firestore_db
from app.schemas.student import StudentCreate, StudentUpdate, StudentOut, StudentBiometricsLink
from app.schemas.common import APIResponse

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=List[StudentOut])
async def list_students(
    department_id: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    user: AuthUser = Depends(require_student)
):
    db = get_firestore_db()
    if not db:
        return []
    query_ref = db.collection("students")
    if department_id:
        query_ref = query_ref.where("departmentId", "==", department_id)
    if batch_id:
        query_ref = query_ref.where("batchId", "==", batch_id)
    if year:
        query_ref = query_ref.where("year", "==", year)
    if semester:
        query_ref = query_ref.where("semester", "==", semester)

    docs = query_ref.stream()
    return [{**d.to_dict(), "id": d.id} for d in docs]


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(student_id: str, user: AuthUser = Depends(require_student)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc = db.collection("students").document(student_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")
    return {**doc.to_dict(), "id": doc.id}


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
async def create_student(data: StudentCreate, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    new_id = data.id or f"stu-{uuid.uuid4().hex[:6]}"
    doc_data = {**data.model_dump(), "id": new_id}
    db.collection("students").document(new_id).set(doc_data)
    return doc_data


@router.put("/{student_id}", response_model=StudentOut)
async def update_student(student_id: str, data: StudentUpdate, user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc_ref = db.collection("students").document(student_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    doc_ref.update(update_fields)
    updated = {**doc.to_dict(), **update_fields, "id": student_id}
    return updated


@router.delete("/{student_id}")
async def delete_student(student_id: str, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    db.collection("students").document(student_id).delete()
    return {"success": True, "message": f"Student {student_id} deleted."}


@router.post("/link-biometrics")
async def link_student_biometrics(data: StudentBiometricsLink, user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc_ref = db.collection("students").document(data.studentId)
    doc = doc_ref.get()
    if not doc.exists:
        # Check by studentId roll
        matches = db.collection("students").where("studentId", "==", data.studentId).limit(1).get()
        if not matches:
            raise HTTPException(status_code=404, detail="Student record not found.")
        doc_ref = matches[0].reference

    updates = {}
    if data.rfidCardUid:
        updates["rfidCardUid"] = data.rfidCardUid.strip()
    if data.fingerprintTemplateId:
        updates["fingerprintTemplateId"] = data.fingerprintTemplateId.strip()

    doc_ref.update(updates)
    return {"success": True, "message": "Biometric identifiers linked successfully.", "updates": updates}
