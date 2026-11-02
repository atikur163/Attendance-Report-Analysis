"""Teacher Management Endpoints."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import require_admin, require_teacher, AuthUser
from app.core.firebase import get_firestore_db
from app.schemas.teacher import TeacherCreate, TeacherUpdate, TeacherOut

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get("", response_model=List[TeacherOut])
async def list_teachers(department_id: Optional[str] = Query(None), user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        return []
    query_ref = db.collection("teachers")
    if department_id:
        query_ref = query_ref.where("departmentId", "==", department_id)
    docs = query_ref.stream()
    return [{**d.to_dict(), "id": d.id} for d in docs]


@router.get("/{teacher_id}", response_model=TeacherOut)
async def get_teacher(teacher_id: str, user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc = db.collection("teachers").document(teacher_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return {**doc.to_dict(), "id": doc.id}


@router.post("", response_model=TeacherOut, status_code=status.HTTP_201_CREATED)
async def create_teacher(data: TeacherCreate, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    new_id = data.id or f"tch-{uuid.uuid4().hex[:6]}"
    doc_data = {**data.model_dump(), "id": new_id}
    db.collection("teachers").document(new_id).set(doc_data)
    return doc_data


@router.put("/{teacher_id}", response_model=TeacherOut)
async def update_teacher(teacher_id: str, data: TeacherUpdate, user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc_ref = db.collection("teachers").document(teacher_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Teacher not found")

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    doc_ref.update(update_fields)
    return {**doc.to_dict(), **update_fields, "id": teacher_id}


@router.delete("/{teacher_id}")
async def delete_teacher(teacher_id: str, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    db.collection("teachers").document(teacher_id).delete()
    return {"success": True, "message": f"Teacher {teacher_id} deleted."}
