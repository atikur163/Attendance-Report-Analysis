"""Unit Tests for Analytics & Milestone Calculations."""
import pytest
from app.utils.calculations import compute_student_course_analytics


def test_50_percent_milestone_detection():
    # 35 planned, 18 held -> Milestone reached (18 >= 35 * 0.5)
    records = [{"timestamp": f"2026-09-{i:02d}", "status": "PRESENT"} for i in range(1, 10)]
    stats = compute_student_course_analytics(
        planned_classes=35,
        conducted_classes=18,
        records=records
    )
    assert stats["is_50_percent_milestone"] is True
    # 9 / 18 = 50.0%
    assert stats["current_percentage"] == 50.0
    # Minimum additional classes needed: ceil(0.6 * 35) = 21. 21 - 9 = 12 needed.
    assert stats["min_classes_needed"] == 12


def test_critical_irrecoverable_classification():
    # 35 planned, 25 held, 5 presents. Remaining: 10. Max possible = 15 / 35 = 42.86% < 60%
    records = [{"timestamp": f"2026-09-{i:02d}", "status": "PRESENT"} for i in range(1, 6)]
    stats = compute_student_course_analytics(
        planned_classes=35,
        conducted_classes=25,
        records=records
    )
    assert stats["can_reach_60"] is False
    assert stats["risk_level"] == "CRITICAL"
