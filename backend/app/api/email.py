"""Email Service and SMTP Diagnostic API Endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from app.config import settings
from app.core.security import require_teacher, require_admin, AuthUser
from app.services.notification_service import notification_service
from app.schemas.email import EmailSendRequest, WarningTestDispatch

router = APIRouter(prefix="/email", tags=["Email & SMTP Gateway"])


@router.get("/status")
async def get_email_status():
    """Checks SMTP configuration and current queue count."""
    host = settings.SMTP_HOST
    user = settings.SMTP_USER
    is_configured = bool(host and user and settings.SMTP_PASS)

    logs = notification_service.memory_logs
    total_sent = sum(1 for l in logs if l.get("status") == "SENT")

    return {
        "configured": is_configured,
        "authError": None,
        "host": host or "Not configured",
        "sender": settings.EMAIL_FROM or user or "Not configured",
        "totalSent": total_sent,
        "totalLogs": len(logs),
        "instructions": (
            "SMTP email service is active and ready to deliver real emails."
            if is_configured else
            "To enable real outbound SMTP delivery, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM in your environment secrets or .env file."
        )
    }


@router.post("/send")
async def send_email(data: EmailSendRequest):
    """Sends real outbound email via SMTP with deduplication."""
    result = notification_service.send_email(
        to_email=data.to,
        subject=data.subject,
        text_content=data.text,
        html_content=data.html,
        recipient_name=data.recipientName,
        recipient_role=data.recipientRole,
        email_type=data.type,
        dedup_key=data.dedupKey
    )
    return result


@router.get("/logs")
async def get_email_logs():
    return {"logs": notification_service.memory_logs}


@router.post("/retry")
async def retry_email(payload: dict):
    log_id = payload.get("logId")
    logs = notification_service.memory_logs
    target = next((l for l in logs if l.get("id") == log_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Email log not found.")

    res = notification_service.send_email(
        to_email=target["recipientEmail"],
        subject=target["subject"],
        text_content=target["body"],
        recipient_name=target.get("recipientName"),
        recipient_role=target.get("recipientRole", "STUDENT"),
        email_type=target.get("type", "RETRY")
    )
    return res


@router.get("/verify-smtp")
async def verify_smtp():
    """Performs direct live SMTP handshake verification."""
    return notification_service.verify_smtp_connection()


@router.post("/test-warning-delivery")
async def test_warning_delivery(payload: WarningTestDispatch):
    """Generates and delivers official 50% midpoint warning email template."""
    target_email = payload.to or "sabbirstudy2002@gmail.com"
    student_name = payload.studentName or "Sabbir Hossain"
    student_roll = payload.studentRoll or "CSE-26003"
    course_code = payload.courseCode or "CSE-1101"
    course_name = payload.courseName or "Structured Programming Language"

    subject = f"⚠️ [50% MIDPOINT EARLY WARNING] {course_code}: 60% Attendance Exam Risk Notice - {student_roll}"
    text_content = f"""Dear {student_name} (Roll / ID: {student_roll}),

This is an official university academic attendance notification from the Office of Academic Affairs regarding your course:

Course: {course_code} - {course_name}
Department: Computer Science and Engineering
Academic Milestone: 50% Course Progress Milestone Reached

============================================================
ACADEMIC ATTENDANCE & EXAMINATION ELIGIBILITY METRICS:
============================================================
1. Total Classes Held So Far: 22
2. Number of Classes Attended: 11 (Present: 11, Late: 0, Penalties: 0)
3. Current Attendance Percentage: 50.0%
4. Total Classes Scheduled for Entire Course: 35
5. Remaining Classes to be Conducted: 13
6. Minimum Additional Classes You Must Attend to Reach 60%: 10
7. Mathematical Possibility to Reach 60%: YES - ATTAINABLE
• Mathematical Feasibility: POSSIBLE (You can reach 60% by attending at least 10 of the 13 remaining classes).
8. Examination Eligibility Status: CURRENTLY INELIGIBLE (<60%) - AT SEVERE RISK (ACTION REQUIRED)
============================================================

MANDATORY UNIVERSITY REGULATION:
Under university regulations, every student must maintain at least 60.0% attendance in each course to be eligible to sit for the semester final examinations. Students who fail to reach 60% are strictly barred from the exams.

URGENT ACTION REQUIRED: You must attend at least 10 more classes without unexcused absences to ensure your exam eligibility.

Best regards,
Office of Academic Affairs & Controller of Examinations
Mawlana Bhashani Science and Technology University (MBSTU)"""

    html_content = f"""<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px 16px; border-radius: 8px; font-weight: bold; margin-bottom: 20px;">
          ⚠️ Official University Academic Notice: 50% Course Progress Milestone Reached
        </div>
        <h2 style="color: #0f172a; margin-top: 0;">Examination Attendance Eligibility Warning</h2>
        <p>Dear <strong>{student_name}</strong> (Student Roll: <code>{student_roll}</code>),</p>
        <p>This is an automated early-warning notice regarding your current attendance status in <strong>{course_code}: {course_name}</strong>.</p>
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; font-size: 13px; color: #1e3a8a; margin-top: 16px;">
          <strong>Action Required:</strong> You must attend at least 10 out of the 13 remaining lectures to achieve the mandatory 60.0% threshold. Failure to do so will result in debarment from the final semester examinations.
        </div>
      </div>"""

    return notification_service.send_email(
        to_email=target_email,
        subject=subject,
        text_content=text_content,
        html_content=html_content,
        recipient_name=student_name,
        recipient_role="STUDENT",
        email_type="ATTENDANCE_WARNING"
    )
