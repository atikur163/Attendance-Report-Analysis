"""Curriculum, Department, Course, Offering, and Routine Endpoints."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import require_admin, require_teacher, require_student, AuthUser
from app.core.firebase import get_firestore_db
from app.schemas.course import (
    DepartmentSchema, AcademicSessionSchema, BatchSchema,
    CourseCreate, CourseOut, CourseOfferingCreate, CourseOfferingOut,
    RoutineEntryCreate, RoutineEntryOut
)

router = APIRouter(tags=["Curriculum & Timetables"])


@router.get("/departments", response_model=List[DepartmentSchema])
async def list_departments(user: AuthUser = Depends(require_student)):
    db = get_firestore_db()
    if not db:
        return []
    return [{**d.to_dict(), "id": d.id} for d in db.collection("departments").stream()]


@router.get("/academic-sessions", response_model=List[AcademicSessionSchema])
async def list_academic_sessions(user: AuthUser = Depends(require_student)):
    db = get_firestore_db()
    if not db:
        return []
    return [{**d.to_dict(), "id": d.id} for d in db.collection("academic_sessions").stream()]


@router.get("/batches", response_model=List[BatchSchema])
async def list_batches(department_id: Optional[str] = None, user: AuthUser = Depends(require_student)):
    db = get_firestore_db()
    if not db:
        return []
    ref = db.collection("batches")
    if department_id:
        ref = ref.where("departmentId", "==", department_id)
    return [{**d.to_dict(), "id": d.id} for d in ref.stream()]


@router.get("/courses", response_model=List[CourseOut])
async def list_courses(department_id: Optional[str] = None, user: AuthUser = Depends(require_student)):
    db = get_firestore_db()
    if not db:
        return []
    ref = db.collection("courses")
    if department_id:
        ref = ref.where("departmentId", "==", department_id)
    return [{**d.to_dict(), "id": d.id} for d in ref.stream()]


@router.post("/courses", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(data: CourseCreate, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    new_id = data.id or f"crs-{uuid.uuid4().hex[:6]}"
    doc_data = {**data.model_dump(), "id": new_id}
    db.collection("courses").document(new_id).set(doc_data)
    return doc_data


@router.get("/course-offerings", response_model=List[CourseOfferingOut])
async def list_course_offerings(
    department_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user: AuthUser = Depends(require_student)
):
    db = get_firestore_db()
    if not db:
        return []
    ref = db.collection("course_offerings")
    if department_id:
        ref = ref.where("departmentId", "==", department_id)
    if session_id:
        ref = ref.where("academicSessionId", "==", session_id)
    return [{**d.to_dict(), "id": d.id} for d in ref.stream()]


@router.post("/course-offerings", response_model=CourseOfferingOut, status_code=status.HTTP_201_CREATED)
async def create_course_offering(data: CourseOfferingCreate, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    new_id = data.id or f"co-{uuid.uuid4().hex[:6]}"
    doc_data = {**data.model_dump(), "id": new_id}
    db.collection("course_offerings").document(new_id).set(doc_data)
    return doc_data


@router.get("/routines", response_model=List[RoutineEntryOut])
async def list_routines(
    course_offering_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    room: Optional[str] = None,
    user: AuthUser = Depends(require_student)
):
    db = get_firestore_db()
    if not db:
        return []
    ref = db.collection("routines")
    if course_offering_id:
        ref = ref.where("courseOfferingId", "==", course_offering_id)
    if teacher_id:
        ref = ref.where("teacherId", "==", teacher_id)
    if room:
        ref = ref.where("room", "==", room)
    return [{**d.to_dict(), "id": d.id} for d in ref.stream()]


@router.post("/routines", response_model=RoutineEntryOut, status_code=status.HTTP_201_CREATED)
async def create_routine(data: RoutineEntryCreate, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    new_id = data.id or f"rt-{uuid.uuid4().hex[:6]}"
    doc_data = {**data.model_dump(), "id": new_id}
    db.collection("routines").document(new_id).set(doc_data)
    return doc_data
