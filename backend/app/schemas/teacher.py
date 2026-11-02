"""Teacher Domain Schemas."""
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class TeacherBase(BaseModel):
    teacherId: str = Field(..., description="Teacher Institutional ID (e.g. TCH-101)")
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    departmentId: str
    designation: str = "Assistant Professor"
    phone: Optional[str] = None
    authorizedCourseIds: Optional[List[str]] = Field(default_factory=list)
    status: str = Field(default="ACTIVE")


class TeacherCreate(TeacherBase):
    id: Optional[str] = None


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    departmentId: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    authorizedCourseIds: Optional[List[str]] = None
    status: Optional[str] = None
    authUid: Optional[str] = None


class TeacherOut(TeacherBase):
    id: str
    authUid: Optional[str] = None

    class Config:
        from_attributes = True
