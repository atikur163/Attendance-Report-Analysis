"""University Attendance Business Rules and Mathematical Engine."""
import math
from typing import List, Dict, Any, Optional
from app.config import settings


def determine_attendance_status(minutes_late: int, threshold: Optional[int] = None) -> str:
    """
    Statutory 20-minute threshold rule (MBSTU Section 17):
    Arrival within 20 minutes -> PRESENT
    Arrival past 20 minutes   -> LATE
    """
    limit = threshold if threshold is not None else settings.LATE_THRESHOLD_MINUTES
    return "PRESENT" if minutes_late < limit else "LATE"


def calculate_late_penalties(records: List[Dict[str, Any]], penalty_enabled: Optional[bool] = None) -> int:
    """
    Statutory 3-Consecutive Late Penalty Rule (Section 18):
    Every 3 consecutive LATE marks deduct 1 attendance point.
    A PRESENT or EXCUSED mark resets the consecutive counter.
    """
    enabled = penalty_enabled if penalty_enabled is not None else settings.THREE_LATE_PENALTY_ENABLED
    if not enabled:
        return 0

    sorted_records = sorted(records, key=lambda r: r.get("timestamp", ""))
    penalties = 0
    consecutive_lates = 0

    for rec in sorted_records:
        status = rec.get("status", "ABSENT")
        if status == "LATE":
            consecutive_lates += 1
            if consecutive_lates == 3:
                penalties += 1
                consecutive_lates = 0
        elif status in ("PRESENT", "EXCUSED"):
            consecutive_lates = 0
        # ABSENT does not reset consecutive lates or count as late

    return penalties


def compute_student_course_analytics(
    planned_classes: int,
    conducted_classes: int,
    records: List[Dict[str, Any]],
    late_threshold: Optional[int] = None,
    exam_threshold: Optional[float] = None
) -> Dict[str, Any]:
    """
    Computes full statutory analytics, risk tiers, and recoverability projections.
    """
    req_threshold = exam_threshold if exam_threshold is not None else settings.EXAM_ELIGIBILITY_PERCENTAGE

    total_planned = max(1, planned_classes)
    total_conducted = max(0, conducted_classes)

    presents = sum(1 for r in records if r.get("status") == "PRESENT")
    lates = sum(1 for r in records if r.get("status") == "LATE")
    excused = sum(1 for r in records if r.get("status") == "EXCUSED")
    absents = sum(1 for r in records if r.get("status") == "ABSENT")

    penalties = calculate_late_penalties(records)
    effective_presents = max(0, (presents + lates) - penalties)

    # Current attendance rate
    current_percentage = round((effective_presents / total_conducted * 100), 2) if total_conducted > 0 else 0.0

    # Remaining and projections
    remaining_classes = max(0, total_planned - total_conducted)
    max_possible_presents = effective_presents + remaining_classes
    max_possible_percentage = round((max_possible_presents / total_planned * 100), 2)

    # Examination eligibility (Section 21)
    is_eligible = current_percentage >= req_threshold

    # Minimum future classes needed to reach 60%
    target_count = math.ceil((req_threshold / 100.0) * total_planned)
    needed_additional = max(0, target_count - effective_presents)

    can_reach_60 = max_possible_percentage >= req_threshold

    # Risk level classification
    if current_percentage >= 75.0:
        risk_level = "SAFE"
    elif current_percentage >= req_threshold:
        risk_level = "WARNING"
    elif can_reach_60:
        risk_level = "HIGH_RISK"
    else:
        risk_level = "CRITICAL"

    # 50% Midpoint milestone analysis
    is_50_percent_milestone = total_conducted >= math.ceil(total_planned * 0.5)

    return {
        "planned_classes": total_planned,
        "conducted_classes": total_conducted,
        "remaining_classes": remaining_classes,
        "present_count": presents,
        "late_count": lates,
        "absent_count": absents,
        "excused_count": excused,
        "penalty_count": penalties,
        "effective_presents": effective_presents,
        "current_percentage": current_percentage,
        "max_possible_percentage": max_possible_percentage,
        "is_eligible": is_eligible,
        "can_reach_60": can_reach_60,
        "min_classes_needed": needed_additional,
        "risk_level": risk_level,
        "is_50_percent_milestone": is_50_percent_milestone,
    }
