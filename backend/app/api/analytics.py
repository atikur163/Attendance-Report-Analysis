"""Analytics & Risk Classification API Router."""
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_student, require_teacher, AuthUser
from app.services.analytics_service import analytics_service
from app.schemas.analytics import CourseSummaryAnalyticsOut, DepartmentRiskDistributionOut

router = APIRouter(prefix="/analytics", tags=["Analytics & Risk Projections"])


@router.get("/course/{course_offering_id}", response_model=CourseSummaryAnalyticsOut)
async def get_course_analytics(course_offering_id: str, user: AuthUser = Depends(require_teacher)):
    """Computes course-wide attendance distribution, eligibility, and risk tiers."""
    data = analytics_service.get_course_analytics(course_offering_id)
    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error"])
    return data


@router.get("/student/{student_id}")
async def get_student_analytics(student_id: str, user: AuthUser = Depends(require_student)):
    """Computes semester attendance summary and exam recoverability for a student."""
    if user.is_student and user.student_id and user.student_id != student_id:
        raise HTTPException(status_code=403, detail="Cannot access analytics of another student.")
    data = analytics_service.get_student_overall_analytics(student_id)
    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error"])
    return data


@router.get("/department/{department_id}", response_model=DepartmentRiskDistributionOut)
async def get_department_risk(department_id: str, user: AuthUser = Depends(require_teacher)):
    """Computes department-wide risk distribution and average percentages."""
    data = analytics_service.get_department_risk_distribution(department_id)
    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error"])
    return data
