"""Attendance Business Logic & Session Operations Service."""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.core.firebase import get_firestore_db
from app.core.logging import logger
from app.utils.calculations import determine_attendance_status, calculate_late_penalties


class AttendanceService:
    def __init__(self):
        self.db = get_firestore_db()

    def _get_collection(self, name: str) -> List[Dict[str, Any]]:
        if not self.db:
            return []
        try:
            docs = self.db.collection(name).stream()
            return [{**d.to_dict(), "id": d.id} for d in docs]
        except Exception as e:
            logger.error("Error reading Firestore collection %s: %s", name, e)
            return []

    def record_attendance(
        self,
        session_id: str,
        student_id: str,
        method: str = "QR",
        minutes_late: int = 0,
        source: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Records student attendance with duplicate prevention and late calculation."""
        if not self.db:
            raise RuntimeError("Database connection unavailable.")

        # Check session exists and is active
        session_ref = self.db.collection("attendance_sessions").document(session_id)
        session_snap = session_ref.get()
        if not session_snap.exists:
            return {"success": False, "message": "Attendance session not found."}

        session_data = session_snap.to_dict()
        if session_data.get("status") != "ACTIVE" and not method.startswith("MANUAL"):
            return {"success": False, "message": "Attendance session is closed."}

        course_offering_id = session_data.get("courseOfferingId")

        # Verify enrollment
        enrollments = self.db.collection("student_enrollments") \
            .where("studentId", "==", student_id) \
            .where("courseOfferingId", "==", course_offering_id) \
            .where("status", "==", "ENROLLED").limit(1).get()

        if not enrollments:
            return {"success": False, "message": "Student is not enrolled in this course offering."}

        # Check duplicate
        existing = self.db.collection("attendance_records") \
            .where("sessionId", "==", session_id) \
            .where("studentId", "==", student_id).limit(1).get()

        if existing:
            rec = existing[0].to_dict()
            return {
                "success": False,
                "message": f"Attendance already recorded as {rec.get('status')}.",
                "record": rec,
                "status": rec.get("status")
            }

        status = determine_attendance_status(minutes_late)
        record_id = f"rec-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        record_data = {
            "id": record_id,
            "sessionId": session_id,
            "courseOfferingId": course_offering_id,
            "studentId": student_id,
            "timestamp": now_iso,
            "method": method,
            "source": source or method.lower(),
            "status": status,
            "minutesLate": minutes_late,
            "notes": notes or f"Marked via {method}"
        }

        self.db.collection("attendance_records").document(record_id).set(record_data)

        return {
            "success": True,
            "message": f"Attendance marked {status} successfully.",
            "record": record_data,
            "status": status
        }

    def correct_attendance(
        self,
        new_status: str,
        changed_by: str,
        reason: str,
        attendance_record_id: Optional[str] = None,
        session_id: Optional[str] = None,
        student_id: Optional[str] = None,
        course_offering_id: Optional[str] = None,
        user_role: Optional[str] = None,
        teacher_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Applies manual correction with verifiable audit trail."""
        if not self.db:
            raise RuntimeError("Database unavailable.")

        record_ref = None
        record_data = None

        if attendance_record_id:
            record_ref = self.db.collection("attendance_records").document(attendance_record_id)
            snap = record_ref.get()
            if snap.exists:
                record_data = snap.to_dict()

        if not record_data and session_id and student_id:
            matches = self.db.collection("attendance_records") \
                .where("sessionId", "==", session_id) \
                .where("studentId", "==", student_id).limit(1).get()
            if matches:
                record_ref = matches[0].reference
                record_data = matches[0].to_dict()

        now_iso = datetime.now(timezone.utc).isoformat()

        if record_data and record_ref:
            old_status = record_data.get("status")
            record_data["status"] = new_status
            record_data["isManuallyEdited"] = True
            record_data["lastEditedBy"] = changed_by
            record_data["lastEditedAt"] = now_iso
            record_ref.set(record_data)
        else:
            # Create new corrected record
            rec_id = f"rec-corr-{int(datetime.now(timezone.utc).timestamp())}"
            record_data = {
                "id": rec_id,
                "sessionId": session_id or "sess-manual-corr",
                "courseOfferingId": course_offering_id or "co-unknown",
                "studentId": student_id,
                "timestamp": now_iso,
                "method": "MANUAL",
                "status": new_status,
                "minutesLate": 0,
                "isManuallyEdited": True,
                "notes": f"Created via manual correction: {reason}"
            }
            self.db.collection("attendance_records").document(rec_id).set(record_data)
            old_status = "NONE"

        # Write audit log
        audit_id = f"aud-{uuid.uuid4().hex[:8]}"
        audit_data = {
            "id": audit_id,
            "attendanceRecordId": record_data.get("id"),
            "courseOfferingId": record_data.get("courseOfferingId"),
            "studentId": record_data.get("studentId"),
            "oldStatus": old_status,
            "newStatus": new_status,
            "changedBy": changed_by,
            "reason": reason,
            "timestamp": now_iso
        }
        self.db.collection("attendance_corrections").document(audit_id).set(audit_data)

        return {
            "success": True,
            "message": f"Attendance updated to {new_status} successfully.",
            "record": record_data,
            "audit": audit_data
        }

    def process_hardware_scan(
        self,
        device_id: str,
        credential_id: str,
        credential_type: str = "RFID",
        api_key: Optional[str] = None,
        timestamp: Optional[str] = None
    ) -> Dict[str, Any]:
        """Processes hardware card tap or fingerprint scan from IoT gateway."""
        if not self.db:
            return {"success": False, "status": "DATABASE_OFFLINE", "message": "Database offline."}

        scan_time = timestamp or datetime.now(timezone.utc).isoformat()

        # 1. Device lookup & authentication
        dev_docs = self.db.collection("hardware_devices").where("deviceId", "==", device_id).limit(1).get()
        if not dev_docs:
            return {"success": False, "status": "UNAUTHORIZED", "message": f"Device {device_id} not registered."}

        device = dev_docs[0].to_dict()
        if device.get("status") != "ACTIVE":
            return {"success": False, "status": "UNAUTHORIZED", "message": "Device is deactivated."}

        if api_key and device.get("apiKey") and api_key != device.get("apiKey"):
            return {"success": False, "status": "UNAUTHORIZED", "message": "Invalid device API key."}

        # 2. Identify student
        cred_field = "rfidCardUid" if credential_type == "RFID" else "fingerprintTemplateId"
        student_docs = self.db.collection("students").where(cred_field, "==", credential_id).limit(1).get()
        if not student_docs:
            return {"success": False, "status": "UNKNOWN_CREDENTIAL", "message": f"Unknown {credential_type} credential."}

        student = student_docs[0].to_dict()

        # 3. Resolve active session: prioritize sessions student is enrolled in
        enrolled_co_ids = [
            d.to_dict().get("courseOfferingId")
            for d in self.db.collection("student_enrollments")
            .where("studentId", "==", student["id"])
            .where("status", "==", "ENROLLED").stream()
        ]

        active_sessions = [
            d.to_dict() for d in self.db.collection("attendance_sessions")
            .where("status", "==", "ACTIVE").stream()
        ]

        target_session = None
        for s in active_sessions:
            if s.get("courseOfferingId") in enrolled_co_ids:
                target_session = s
                break

        if not target_session and active_sessions:
            # Fallback to any active session in the room
            target_session = active_sessions[0]

        if not target_session:
            return {"success": False, "status": "OUT_OF_WINDOW", "message": "No active class session running."}

        if target_session.get("courseOfferingId") not in enrolled_co_ids:
            return {"success": False, "status": "NOT_ENROLLED", "message": "Student is not enrolled in this course offering."}

        # 4. Check duplicate
        existing = self.db.collection("attendance_records") \
            .where("sessionId", "==", target_session["id"]) \
            .where("studentId", "==", student["id"]).limit(1).get()

        if existing:
            rec = existing[0].to_dict()
            return {
                "success": False,
                "status": "DUPLICATE",
                "message": f"Attendance already recorded ({rec.get('status')}).",
                "record": rec
            }

        # 5. Record
        record_res = self.record_attendance(
            session_id=target_session["id"],
            student_id=student["id"],
            method=credential_type,
            minutes_late=0,
            source=credential_type.lower(),
            notes=f"Scanned via hardware terminal {device.get('name')} [{device.get('room')}]"
        )

        return {
            "success": True,
            "status": "SUCCESS",
            "message": f"Attendance recorded for {student.get('name')}.",
            "record": record_res.get("record")
        }


attendance_service = AttendanceService()
