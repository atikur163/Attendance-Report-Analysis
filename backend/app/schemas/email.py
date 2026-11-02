"""Email Notification Schemas."""
from typing import Optional
from pydantic import BaseModel, EmailStr


class EmailSendRequest(BaseModel):
    to: EmailStr
    recipientName: Optional[str] = None
    recipientRole: Optional[str] = "STUDENT"
    type: Optional[str] = "SYSTEM_ALERT"
    subject: str
    text: Optional[str] = None
    html: Optional[str] = None
    dedupKey: Optional[str] = None


class EmailLogOut(BaseModel):
    id: str
    recipientEmail: str
    recipientName: str
    recipientRole: str
    type: str
    subject: str
    body: str
    dedupKey: str
    status: str
    sentAt: str
    error: Optional[str] = None


class WarningTestDispatch(BaseModel):
    to: Optional[EmailStr] = None
    studentName: Optional[str] = None
    studentRoll: Optional[str] = None
    courseCode: Optional[str] = None
    courseName: Optional[str] = None
