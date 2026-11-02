"""Analytics and Predictive Risk Schemas."""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class StudentCourseAnalyticsOut(BaseModel):
    student_id: str
    student_name: str
    student_roll: str
    course_offering_id: str
    course_code: str
    course_name: str
    planned_classes: int
    conducted_classes: int
    remaining_classes: int
    present_count: int
    late_count: int
    absent_count: int
    excused_count: int
    penalty_count: int
    effective_presents: int
    current_percentage: float
    max_possible_percentage: float
    is_eligible: bool
    can_reach_60: bool
    min_classes_needed: int
    risk_level: str  # SAFE, WARNING, HIGH_RISK, CRITICAL
    is_50_percent_milestone: bool


class CourseSummaryAnalyticsOut(BaseModel):
    course_offering_id: str
    course_code: str
    course_name: str
    total_enrolled: int
    conducted_classes: int
    planned_classes: int
    average_attendance_percentage: float
    eligible_count: int
    at_risk_count: int
    critical_debarred_count: int
    students: List[StudentCourseAnalyticsOut]


class DepartmentRiskDistributionOut(BaseModel):
    department_id: str
    department_code: str
    total_students: int
    safe_count: int
    warning_count: int
    high_risk_count: int
    critical_count: int
    overall_average_percentage: float
