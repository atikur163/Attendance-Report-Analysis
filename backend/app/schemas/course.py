"""Curriculum & Academic Structure Schemas."""
from typing import Optional, List
from pydantic import BaseModel, Field


class DepartmentSchema(BaseModel):
    id: str
    code: str
    name: str
    building: str


class AcademicSessionSchema(BaseModel):
    id: str
    name: str
    isCurrent: bool = False


class BatchSchema(BaseModel):
    id: str
    name: str
    startYear: int
    departmentId: str
    currentYear: int
    currentSemester: int


class CourseBase(BaseModel):
    code: str = Field(..., description="e.g. CSE-1101")
    name: str
    credit: float
    type: str = Field(default="THEORY", description="THEORY or LAB")
    departmentId: str
    year: int
    semester: int
    status: str = "ACTIVE"
    prerequisiteCourseIds: Optional[List[str]] = Field(default_factory=list)


class CourseCreate(CourseBase):
    id: Optional[str] = None


class CourseOut(CourseBase):
    id: str


class CourseOfferingBase(BaseModel):
    courseId: str
    departmentId: str
    academicSessionId: str
    year: int
    semester: int
    batchId: str
    section: str = "A"
    plannedClasses: int = 35
    conductedClasses: int = 0
    status: str = "ACTIVE"
    capacity: Optional[int] = 60


class CourseOfferingCreate(CourseOfferingBase):
    id: Optional[str] = None


class CourseOfferingOut(CourseOfferingBase):
    id: str


class RoutineEntryBase(BaseModel):
    courseOfferingId: str
    teacherId: str
    dayOfWeek: str = Field(..., description="Sunday, Monday, Tuesday, Wednesday, Thursday")
    startTime: str = Field(..., description="e.g. 10:00 AM")
    endTime: str = Field(..., description="e.g. 11:00 AM")
    room: str = Field(..., description="e.g. Room 304")
    building: str = "Academic Complex 2"


class RoutineEntryCreate(RoutineEntryBase):
    id: Optional[str] = None


class RoutineEntryOut(RoutineEntryBase):
    id: str
