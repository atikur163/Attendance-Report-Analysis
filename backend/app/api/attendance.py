"""Attendance Session and Check-in Endpoints."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import require_teacher, require_student, require_admin, AuthUser
from app.core.firebase import get_firestore_db
from app.services.attendance_service import attendance_service
from app.schemas.attendance import (
    AttendanceSessionStart, AttendanceSessionOut,
    AttendanceCheckIn, AttendanceRecordOut,
    AttendanceCorrectionRequest, BulkAttendanceCorrectionRequest,
    ClassCountAdjustRequest, SessionCancelRequest
)

router = APIRouter(tags=["Attendance Operations"])


@router.post("/attendance/sessions/start", response_model=AttendanceSessionOut)
async def start_attendance_session(data: AttendanceSessionStart, user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    now = datetime.now(timezone.utc)
    token = f"UNI-QR-{uuid.uuid4().hex[:8].upper()}"
    new_id = f"sess-{int(now.timestamp())}"

    session_data = {
        "id": new_id,
        "courseOfferingId": data.courseOfferingId,
        "teacherId": data.teacherId or user.teacher_id or user.uid,
        "routineEntryId": data.routineEntryId,
        "date": now.strftime("%Y-%m-%d"),
        "startTime": now.strftime("%I:%M %p"),
        "endTime": (now.replace(hour=(now.hour + 1) % 24)).strftime("%I:%M %p"),
        "attendanceMethod": data.attendanceMethod,
        "status": "ACTIVE",
        "currentToken": token,
        "tokenExpiresAt": datetime.fromtimestamp(now.timestamp() + 15 * 60, timezone.utc).isoformat(),
        "allowSelfCheckIn": True,
        "notes": data.notes or "Live lecture attendance session",
        "createdAt": now.isoformat()
    }

    db.collection("attendance_sessions").document(new_id).set(session_data)

    # Increment conducted classes on course offering
    co_ref = db.collection("course_offerings").document(data.courseOfferingId)
    co_snap = co_ref.get()
    if co_snap.exists:
        conducted = (co_snap.to_dict().get("conductedClasses") or 0) + 1
        co_ref.update({"conductedClasses": conducted})

    return session_data


@router.post("/attendance/sessions/{session_id}/close")
async def close_attendance_session(session_id: str, user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    ref = db.collection("attendance_sessions").document(session_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Session not found")
    ref.update({"status": "CLOSED", "currentToken": None})
    return {"success": True, "message": f"Session {session_id} successfully closed."}


@router.get("/attendance/sessions/active", response_model=List[AttendanceSessionOut])
async def list_active_sessions(course_offering_id: Optional[str] = None, user: AuthUser = Depends(require_student)):
    db = get_firestore_db()
    if not db:
        return []
    ref = db.collection("attendance_sessions").where("status", "==", "ACTIVE")
    if course_offering_id:
        ref = ref.where("courseOfferingId", "==", course_offering_id)
    return [{**d.to_dict(), "id": d.id} for d in ref.stream()]


@router.post("/attendance/record")
async def record_attendance(data: AttendanceCheckIn, user: AuthUser = Depends(require_student)):
    # Students can only record for themselves unless teacher/admin
    target_student_id = data.studentId
    if user.is_student and user.student_id and user.student_id != target_student_id:
        raise HTTPException(status_code=403, detail="Cannot check in for another student.")

    result = attendance_service.record_attendance(
        session_id=data.sessionId,
        student_id=target_student_id,
        method=data.method,
        minutes_late=data.minutesLate,
        notes=data.notes
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.post("/attendance/correct")
async def correct_attendance(data: AttendanceCorrectionRequest, user: AuthUser = Depends(require_teacher)):
    """Matches existing Express POST /api/attendance/correct endpoint."""
    result = attendance_service.correct_attendance(
        new_status=data.newStatus,
        changed_by=data.changedBy or user.name,
        reason=data.reason,
        attendance_record_id=data.attendanceRecordId,
        session_id=data.sessionId,
        student_id=data.studentId,
        course_offering_id=data.courseOfferingId,
        user_role=data.userRole or user.role,
        teacher_id=data.teacherId or user.teacher_id
    )
    return result


@router.post("/attendance/bulk-correct")
async def bulk_correct_attendance(data: BulkAttendanceCorrectionRequest, user: AuthUser = Depends(require_teacher)):
    """Matches existing Express POST /api/attendance/bulk-correct endpoint."""
    updated_count = 0
    audits = []
    for item in data.updates:
        res = attendance_service.correct_attendance(
            new_status=item.newStatus,
            changed_by=data.changedBy or user.name,
            reason=item.reason or data.reason,
            attendance_record_id=item.attendanceRecordId,
            session_id=data.sessionId,
            student_id=item.studentId,
            course_offering_id=data.courseOfferingId,
            user_role=data.userRole or user.role,
            teacher_id=data.teacherId or user.teacher_id
        )
        if res.get("success") and res.get("audit"):
            audits.append(res["audit"])
            updated_count += 1

    return {
        "success": True,
        "message": f"Bulk correction applied to {updated_count} student record(s).",
        "updatedCount": updated_count,
        "audits": audits
    }


@router.post("/classes/adjust-count")
async def adjust_conducted_classes(data: ClassCountAdjustRequest, user: AuthUser = Depends(require_teacher)):
    """Matches existing Express POST /api/classes/adjust-count endpoint."""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    co_ref = db.collection("course_offerings").document(data.courseOfferingId)
    snap = co_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Course offering not found")

    offering = snap.to_dict()
    planned = offering.get("plannedClasses", 35)
    if data.newConductedCount > planned:
        raise HTTPException(
            status_code=400,
            detail=f"Conducted classes ({data.newConductedCount}) cannot exceed planned scheduled classes ({planned})."
        )

    old_count = offering.get("conductedClasses", 0)
    co_ref.update({"conductedClasses": data.newConductedCount})

    audit_id = f"cca-{int(datetime.now(timezone.utc).timestamp())}"
    audit_data = {
        "id": audit_id,
        "courseOfferingId": data.courseOfferingId,
        "changedBy": data.changedBy or user.name,
        "oldConducted": old_count,
        "newConducted": data.newConductedCount,
        "scheduledTotal": planned,
        "reason": data.reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    db.collection("class_count_audits").document(audit_id).set(audit_data)

    return {
        "success": True,
        "message": f"Conducted classes updated from {old_count} to {data.newConductedCount}.",
        "audit": audit_data
    }


@router.post("/classes/cancel-session")
async def cancel_session(data: SessionCancelRequest, user: AuthUser = Depends(require_teacher)):
    """Matches existing Express POST /api/classes/cancel-session endpoint."""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    sess_ref = db.collection("attendance_sessions").document(data.sessionId)
    snap = sess_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Session not found")

    sess = snap.to_dict()
    sess_ref.update({
        "status": "CANCELLED",
        "cancellationReason": data.reason,
        "cancelledBy": data.changedBy or user.name
    })

    # Decrement conducted classes if session had already incremented it
    co_id = sess.get("courseOfferingId")
    if co_id:
        co_ref = db.collection("course_offerings").document(co_id)
        co_snap = co_ref.get()
        if co_snap.exists:
            current_held = max(0, (co_snap.to_dict().get("conductedClasses") or 1) - 1)
            co_ref.update({"conductedClasses": current_held})

    return {"success": True, "message": f"Session {data.sessionId} cancelled."}
