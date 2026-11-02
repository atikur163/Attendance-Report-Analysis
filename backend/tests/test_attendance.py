"""Unit Tests for Attendance Business Logic and Statutory Regulations."""
import pytest
from app.utils.calculations import (
    determine_attendance_status,
    calculate_late_penalties,
    compute_student_course_analytics
)


def test_determine_attendance_status():
    # 20-Minute Late Threshold
    assert determine_attendance_status(15, threshold=20) == "PRESENT"
    assert determine_attendance_status(19, threshold=20) == "PRESENT"
    assert determine_attendance_status(20, threshold=20) == "LATE"
    assert determine_attendance_status(35, threshold=20) == "LATE"


def test_calculate_late_penalties_3_consecutive():
    # 3 consecutive lates generate 1 penalty
    records = [
        {"timestamp": "2026-09-01T10:00:00Z", "status": "LATE"},
        {"timestamp": "2026-09-02T10:00:00Z", "status": "LATE"},
        {"timestamp": "2026-09-03T10:00:00Z", "status": "LATE"},
    ]
    assert calculate_late_penalties(records) == 1

    # Interrupted sequence (LATE, LATE, PRESENT, LATE, LATE) does not trigger 3-consecutive penalty
    records_interrupted = [
        {"timestamp": "2026-09-01T10:00:00Z", "status": "LATE"},
        {"timestamp": "2026-09-02T10:00:00Z", "status": "LATE"},
        {"timestamp": "2026-09-03T10:00:00Z", "status": "PRESENT"},
        {"timestamp": "2026-09-04T10:00:00Z", "status": "LATE"},
        {"timestamp": "2026-09-05T10:00:00Z", "status": "LATE"},
    ]
    assert calculate_late_penalties(records_interrupted) == 0


def test_60_percent_exam_eligibility_and_recoverability():
    # Planned 35, Conducted 24, 13 Attended, 11 Remaining
    records = [{"timestamp": f"2026-09-{i:02d}", "status": "PRESENT"} for i in range(1, 14)]
    stats = compute_student_course_analytics(
        planned_classes=35,
        conducted_classes=24,
        records=records,
        exam_threshold=60.0
    )

    # 13 / 24 = 54.17% (Currently Ineligible)
    assert stats["is_eligible"] is False
    assert stats["current_percentage"] == 54.17

    # Max possible: (13 + 11) / 35 = 68.57% (>= 60%, so recoverable)
    assert stats["max_possible_percentage"] == 68.57
    assert stats["can_reach_60"] is True
    assert stats["risk_level"] == "HIGH_RISK"
