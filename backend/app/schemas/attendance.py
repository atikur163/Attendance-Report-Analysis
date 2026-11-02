"""Attendance Session, Check-in Record, and Correction Schemas."""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AttendanceSessionStart(BaseModel):
    courseOfferingId: str
    teacherId: str
    routineEntryId: Optional[str] = None
    attendanceMethod: str = Field(default="QR", description="QR, FACE, RFID, FINGERPRINT, MANUAL")
    notes: Optional[str] = None


class AttendanceSessionOut(BaseModel):
    id: str
    courseOfferingId: str
    teacherId: str
    routineEntryId: Optional[str] = None
    date: str
    startTime: str
    endTime: str
    attendanceMethod: str
    status: str = "ACTIVE"
    currentToken: Optional[str] = None
    tokenExpiresAt: Optional[str] = None
    allowSelfCheckIn: bool = True
    notes: Optional[str] = None
    createdAt: str


class AttendanceCheckIn(BaseModel):
    sessionId: str
    studentId: str
    method: str = Field(default="QR", description="QR, FACE, RFID, FINGERPRINT, APP, MANUAL")
    minutesLate: int = 0
    token: Optional[str] = None
    notes: Optional[str] = None


class AttendanceRecordOut(BaseModel):
    id: str
    sessionId: str
    courseOfferingId: str
    studentId: str
    timestamp: str
    method: str
    source: Optional[str] = None
    status: str = Field(..., description="PRESENT, LATE, ABSENT, EXCUSED")
    minutesLate: int = 0
    isManuallyEdited: Optional[bool] = False
    notes: Optional[str] = None


class AttendanceCorrectionRequest(BaseModel):
    attendanceRecordId: Optional[str] = None
    sessionId: Optional[str] = None
    studentId: Optional[str] = None
    courseOfferingId: Optional[str] = None
    newStatus: str = Field(..., description="PRESENT, LATE, ABSENT, EXCUSED")
    changedBy: str
    reason: str = Field(..., min_length=3)
    userRole: Optional[str] = None
    teacherId: Optional[str] = None


class SingleStudentUpdateItem(BaseModel):
    studentId: str
    newStatus: str
    attendanceRecordId: Optional[str] = None
    reason: Optional[str] = None


class BulkAttendanceCorrectionRequest(BaseModel):
    courseOfferingId: str
    sessionId: Optional[str] = None
    updates: List[SingleStudentUpdateItem]
    changedBy: str
    reason: str
    userRole: Optional[str] = None
    teacherId: Optional[str] = None


class ClassCountAdjustRequest(BaseModel):
    courseOfferingId: str
    newConductedCount: int = Field(..., ge=0)
    changedBy: str
    reason: str = Field(..., min_length=3)
    userRole: Optional[str] = None
    teacherId: Optional[str] = None


class SessionCancelRequest(BaseModel):
    sessionId: str
    changedBy: str
    reason: str = Field(..., min_length=3)
    userRole: Optional[str] = None
    teacherId: Optional[str] = None
