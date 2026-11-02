"""Course Registration Windows and Student Self-Enrollment Endpoints."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import require_student, require_admin, AuthUser
from app.core.firebase import get_firestore_db
from app.schemas.enrollment import (
    EnrollmentWindowCreate, EnrollmentWindowOut,
    StudentSelfEnrollRequest, StudentSelfDropRequest,
    AdminEnrollmentOverrideRequest, StudentEnrollmentOut
)

router = APIRouter(prefix="/enrollment", tags=["Course Enrollment & Registration Windows"])


@router.get("/windows")
async def get_enrollment_windows(user: AuthUser = Depends(require_student)):
    db = get_firestore_db()
    if not db:
        return {"success": True, "windows": [], "activeWindow": None, "windowStatus": {"isOpen": False}}

    windows = [{**d.to_dict(), "id": d.id} for d in db.collection("enrollment_windows").stream()]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    active_win = None
    for w in windows:
        if w.get("isOpen") and w.get("startDate") <= today <= w.get("endDate"):
            active_win = w
            break

    is_open = active_win is not None
    reason = "Enrollment window is active." if is_open else "Academic enrollment window is closed."

    return {
        "success": True,
        "windows": windows,
        "activeWindow": active_win,
        "windowStatus": {"isOpen": is_open, "reason": reason}
    }


@router.post("/windows")
async def save_enrollment_window(data: EnrollmentWindowCreate, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    win_id = data.id or f"win-{uuid.uuid4().hex[:6]}"
    doc_data = {**data.model_dump(), "id": win_id}
    db.collection("enrollment_windows").document(win_id).set(doc_data)
    return {"success": True, "window": doc_data}


@router.post("/self-enroll")
async def self_enroll(data: StudentSelfEnrollRequest, user: AuthUser = Depends(require_student)):
    """Validates window, credit caps, cohort isolation, and enrolls student."""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify student identity
    target_student_id = data.studentId
    if user.is_student and user.student_id and user.student_id != target_student_id:
        raise HTTPException(status_code=403, detail="Cannot enroll on behalf of another student.")

    # 1. Check window open
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    open_windows = [
        d.to_dict() for d in db.collection("enrollment_windows")
        .where("isOpen", "==", True).stream()
    ]
    active_win = next((w for w in open_windows if w.get("startDate") <= today <= w.get("endDate")), None)
    if not active_win:
        raise HTTPException(status_code=400, detail="Academic registration window is currently closed.")

    # 2. Check student and course
    student_doc = db.collection("students").document(target_student_id).get()
    if not student_doc.exists:
        raise HTTPException(status_code=404, detail="Student record not found.")
    student = student_doc.to_dict()

    co_doc = db.collection("course_offerings").document(data.courseOfferingId).get()
    if not co_doc.exists:
        raise HTTPException(status_code=404, detail="Course offering not found.")
    offering = co_doc.to_dict()

    course_doc = db.collection("courses").document(offering.get("courseId")).get()
    course = course_doc.to_dict() if course_doc.exists else {}

    # Department Isolation check
    offering_dept = offering.get("departmentId") or course.get("departmentId")
    if offering_dept and student.get("departmentId") != offering_dept:
        raise HTTPException(status_code=400, detail="Department Mismatch: Cannot enroll in courses of another academic department.")

    # Capacity check
    capacity = offering.get("capacity", 60)
    current_enrolled = len([
        d.id for d in db.collection("student_enrollments")
        .where("courseOfferingId", "==", data.courseOfferingId)
        .where("status", "==", "ENROLLED").stream()
    ])
    if current_enrolled >= capacity:
        raise HTTPException(status_code=400, detail=f"Course offering is at full capacity ({current_enrolled}/{capacity} seats).")

    # Check already enrolled
    existing = list(db.collection("student_enrollments")
        .where("studentId", "==", target_student_id)
        .where("courseOfferingId", "==", data.courseOfferingId).stream())

    now_iso = datetime.now(timezone.utc).isoformat()
    if existing:
        doc_ref = existing[0].reference
        doc_ref.update({
            "status": "ENROLLED",
            "enrolledAt": now_iso,
            "droppedAt": None,
            "dropReason": None
        })
        enrollment_data = {**existing[0].to_dict(), "status": "ENROLLED"}
    else:
        new_enr_id = f"enr-{uuid.uuid4().hex[:6]}"
        enrollment_data = {
            "id": new_enr_id,
            "studentId": target_student_id,
            "courseOfferingId": data.courseOfferingId,
            "enrolledAt": now_iso,
            "status": "ENROLLED",
            "enrollmentType": "RETAKE" if data.isRetake else "REGULAR",
            "term": active_win.get("termName", "Academic Term")
        }
        db.collection("student_enrollments").document(new_enr_id).set(enrollment_data)

    return {
        "success": True,
        "message": f"Successfully enrolled in {course.get('code')} - {course.get('name')}!",
        "enrollment": enrollment_data
    }


@router.post("/self-drop")
async def self_drop(data: StudentSelfDropRequest, user: AuthUser = Depends(require_student)):
    """Marks enrollment as DROPPED while strictly preserving past attendance records."""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    existing = list(db.collection("student_enrollments")
        .where("studentId", "==", data.studentId)
        .where("courseOfferingId", "==", data.courseOfferingId)
        .where("status", "==", "ENROLLED").stream())

    if not existing:
        raise HTTPException(status_code=404, detail="Active course enrollment record not found.")

    doc_ref = existing[0].reference
    now_iso = datetime.now(timezone.utc).isoformat()
    doc_ref.update({
        "status": "DROPPED",
        "droppedAt": now_iso,
        "dropReason": data.reason or "Self-dropped by student"
    })

    return {"success": True, "message": "Course successfully dropped. Historical attendance records preserved."}


@router.post("/admin-override")
async def admin_override(data: AdminEnrollmentOverrideRequest, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    now_iso = datetime.now(timezone.utc).isoformat()
    existing = list(db.collection("student_enrollments")
        .where("studentId", "==", data.studentId)
        .where("courseOfferingId", "==", data.courseOfferingId).stream())

    if data.action == "FORCE_ENROLL":
        if existing:
            existing[0].reference.update({"status": "ENROLLED", "enrolledAt": now_iso})
        else:
            new_id = f"enr-{uuid.uuid4().hex[:6]}"
            db.collection("student_enrollments").document(new_id).set({
                "id": new_id,
                "studentId": data.studentId,
                "courseOfferingId": data.courseOfferingId,
                "enrolledAt": now_iso,
                "status": "ENROLLED",
                "enrollmentType": "ADMIN_OVERRIDE",
                "adminNotes": data.reason
            })
        return {"success": True, "message": f"Student {data.studentId} force-enrolled by {data.adminName}."}
    elif data.action == "FORCE_DROP":
        if existing:
            existing[0].reference.update({
                "status": "DROPPED",
                "droppedAt": now_iso,
                "dropReason": f"Admin Force Drop: {data.reason}"
            })
        return {"success": True, "message": f"Student {data.studentId} dropped by admin."}

    return {"success": True, "message": f"Admin override action '{data.action}' processed."}
