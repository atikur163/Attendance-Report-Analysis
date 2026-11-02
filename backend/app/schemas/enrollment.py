"""Student Course Registration & Enrollment Window Schemas."""
from typing import Optional
from pydantic import BaseModel, Field


class EnrollmentWindowBase(BaseModel):
    academicSessionId: str
    termName: str
    startDate: str
    endDate: str
    isOpen: bool = True
    allowRetake: bool = True
    maxCreditsPerSemester: float = 25.0
    requireRetakeApproval: bool = False


class EnrollmentWindowCreate(EnrollmentWindowBase):
    id: Optional[str] = None


class EnrollmentWindowOut(EnrollmentWindowBase):
    id: str


class StudentSelfEnrollRequest(BaseModel):
    studentId: str
    courseOfferingId: str
    isRetake: bool = False


class StudentSelfDropRequest(BaseModel):
    studentId: str
    courseOfferingId: str
    reason: Optional[str] = "Course load adjustment"


class AdminEnrollmentOverrideRequest(BaseModel):
    studentId: str
    courseOfferingId: str
    action: str = Field(..., description="FORCE_ENROLL, FORCE_DROP, APPROVE_RETAKE")
    adminName: str
    reason: str
    isRetake: bool = False


class StudentEnrollmentOut(BaseModel):
    id: str
    studentId: str
    courseOfferingId: str
    enrolledAt: str
    status: str = Field(default="ENROLLED", description="ENROLLED, DROPPED, COMPLETED")
    droppedAt: Optional[str] = None
    dropReason: Optional[str] = None
    enrollmentType: str = "REGULAR"
    retakeStatus: Optional[str] = None
    term: Optional[str] = None
