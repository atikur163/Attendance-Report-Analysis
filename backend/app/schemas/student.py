"""Student Domain Schemas."""
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class StudentBase(BaseModel):
    studentId: str = Field(..., description="University Roll / Registration (e.g. CSE-26001)")
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    departmentId: str
    batchId: str
    year: int = Field(..., ge=1, le=5)
    semester: int = Field(..., ge=1, le=2)
    rfidCardUid: Optional[str] = None
    fingerprintTemplateId: Optional[str] = None
    photoUrl: Optional[str] = None
    status: str = Field(default="ACTIVE")


class StudentCreate(StudentBase):
    id: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    departmentId: Optional[str] = None
    batchId: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    rfidCardUid: Optional[str] = None
    fingerprintTemplateId: Optional[str] = None
    photoUrl: Optional[str] = None
    status: Optional[str] = None
    authUid: Optional[str] = None


class StudentBiometricsLink(BaseModel):
    studentId: str
    rfidCardUid: Optional[str] = None
    fingerprintTemplateId: Optional[str] = None


class StudentOut(StudentBase):
    id: str
    authUid: Optional[str] = None

    class Config:
        from_attributes = True
