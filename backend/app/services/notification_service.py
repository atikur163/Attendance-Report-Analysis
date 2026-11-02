"""Outbound Email Notification Service using Python SMTP."""
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, List, Optional
from app.config import settings
from app.core.firebase import get_firestore_db
from app.core.logging import logger


class NotificationService:
    def __init__(self):
        self.db = get_firestore_db()
        self.memory_logs: List[Dict[str, Any]] = []

    def format_smtp_error(self, err: Exception) -> str:
        msg = str(err)
        if "535" in msg or "badcredentials" in msg.lower() or "username and password not accepted" in msg.lower():
            return (
                "Gmail/SMTP Authentication Error (535): Username and password not accepted. "
                "For Google/Gmail accounts, generate and use a 16-character App Password "
                "(Google Account > Security > 2-Step Verification > App passwords). "
                "Verify SMTP_USER matches your full email address."
            )
        if "timed out" in msg.lower() or "refused" in msg.lower():
            return f"SMTP Connection Failed: Unable to reach {settings.SMTP_HOST}:{settings.SMTP_PORT}. Check host and firewall."
        return msg

    def send_email(
        self,
        to_email: str,
        subject: str,
        text_content: Optional[str] = None,
        html_content: Optional[str] = None,
        recipient_name: Optional[str] = None,
        recipient_role: str = "STUDENT",
        email_type: str = "ATTENDANCE_WARNING",
        dedup_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Dispatches an email via SMTP and stores audit log."""
        key = dedup_key or f"EMAIL-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Check deduplication
        existing = [l for l in self.memory_logs if l.get("dedupKey") == key and l.get("status") == "SENT"]
        if existing:
            return {
                "success": True,
                "status": "SENT",
                "message": "Email already delivered (deduplicated).",
                "log": existing[0]
            }

        # Check SMTP configuration
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS:
            config_log = {
                "id": f"em-{int(datetime.now(timezone.utc).timestamp())}",
                "recipientEmail": to_email,
                "recipientName": recipient_name or to_email,
                "recipientRole": recipient_role,
                "type": email_type,
                "subject": subject,
                "body": text_content or html_content or "",
                "dedupKey": key,
                "status": "CONFIG_REQUIRED",
                "sentAt": now_iso,
                "error": "SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured in server environment."
            }
            self.memory_logs.insert(0, config_log)
            if self.db:
                self.db.collection("email_logs").document(config_log["id"]).set(config_log)
            return {
                "success": False,
                "status": "CONFIG_REQUIRED",
                "message": "SMTP credentials pending in environment secrets.",
                "log": config_log
            }

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"\"UniAttend MBSTU\" <{settings.EMAIL_FROM or settings.SMTP_USER}>"
        msg["To"] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        if html_content:
            msg.attach(MIMEText(html_content, "html"))
        elif text_content:
            msg.attach(MIMEText(f"<pre style='font-family:sans-serif;'>{text_content}</pre>", "html"))

        try:
            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                server.starttls()

            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(settings.EMAIL_FROM or settings.SMTP_USER, [to_email], msg.as_string())
            server.quit()

            success_log = {
                "id": f"em-{int(datetime.now(timezone.utc).timestamp())}",
                "recipientEmail": to_email,
                "recipientName": recipient_name or to_email,
                "recipientRole": recipient_role,
                "type": email_type,
                "subject": subject,
                "body": text_content or html_content or "",
                "dedupKey": key,
                "status": "SENT",
                "sentAt": now_iso
            }
            self.memory_logs.insert(0, success_log)
            if self.db:
                self.db.collection("email_logs").document(success_log["id"]).set(success_log)

            logger.info("Email delivered to %s (Subject: %s)", to_email, subject)
            return {
                "success": True,
                "status": "SENT",
                "message": f"Email successfully delivered to {to_email}",
                "log": success_log
            }
        except Exception as e:
            friendly_err = self.format_smtp_error(e)
            failed_log = {
                "id": f"em-{int(datetime.now(timezone.utc).timestamp())}",
                "recipientEmail": to_email,
                "recipientName": recipient_name or to_email,
                "recipientRole": recipient_role,
                "type": email_type,
                "subject": subject,
                "body": text_content or "",
                "dedupKey": key,
                "status": "CONFIG_REQUIRED" if "535" in friendly_err else "FAILED",
                "sentAt": now_iso,
                "error": friendly_err
            }
            self.memory_logs.insert(0, failed_log)
            if self.db:
                self.db.collection("email_logs").document(failed_log["id"]).set(failed_log)

            logger.error("Failed to send email to %s: %s", to_email, friendly_err)
            return {
                "success": False,
                "status": failed_log["status"],
                "error": friendly_err,
                "message": friendly_err,
                "log": failed_log
            }

    def verify_smtp_connection(self) -> Dict[str, Any]:
        """Performs a live SMTP handshake test."""
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASS:
            return {
                "success": False,
                "configured": False,
                "message": "SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured."
            }
        try:
            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.quit()
            return {
                "success": True,
                "configured": True,
                "host": settings.SMTP_HOST,
                "port": settings.SMTP_PORT,
                "user": settings.SMTP_USER,
                "message": "SMTP connection verified successfully. Ready to deliver emails."
            }
        except Exception as e:
            friendly = self.format_smtp_error(e)
            return {
                "success": False,
                "configured": True,
                "error": friendly,
                "message": friendly
            }


notification_service = NotificationService()
