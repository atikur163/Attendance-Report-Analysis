"""
Unit Tests for University Attendance Platform Business Rules
Tests:
- 20-minute late threshold
- Three consecutive late penalty rule
- Exact 60.0% exam eligibility
- Maximum possible attendance & recoverability
- Critical non-recoverable status
"""
import unittest
import sys
import os

# Add app directory to sys.path directly to test services without needing web framework installed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app')))

from services.attendance_engine import (
    determine_attendance_status,
    calculate_consecutive_late_penalties,
    compute_course_attendance_analytics
)

class TestUniversityAttendanceRules(unittest.TestCase):

    def test_20_minute_late_threshold(self):
        """Rule 17: Arrival before 20m is PRESENT; at or after 20m is LATE."""
        self.assertEqual(determine_attendance_status(15, late_threshold=20), 'PRESENT')
        self.assertEqual(determine_attendance_status(20, late_threshold=20), 'LATE')
        self.assertEqual(determine_attendance_status(25, late_threshold=20), 'LATE')

    def test_three_consecutive_late_penalty(self):
        """Rule 19: 3 consecutive LATE records = 1 penalty. Original records preserved."""
        records = [
            {'status': 'LATE', 'timestamp': '2026-10-01T10:00:00'},
            {'status': 'LATE', 'timestamp': '2026-10-03T10:00:00'},
            {'status': 'LATE', 'timestamp': '2026-10-05T10:00:00'},
        ]
        res = calculate_consecutive_late_penalties(records)
        self.assertEqual(res['penalty_count'], 1)
        self.assertEqual(res['late_count'], 3)
        self.assertEqual(res['consecutive_late_count'], 0)

    def test_consecutive_late_streak_reset_by_present(self):
        """Lates interrupted by a PRESENT must reset streak."""
        records = [
            {'status': 'LATE', 'timestamp': '2026-10-01T10:00:00'},
            {'status': 'PRESENT', 'timestamp': '2026-10-03T10:00:00'},
            {'status': 'LATE', 'timestamp': '2026-10-05T10:00:00'},
            {'status': 'LATE', 'timestamp': '2026-10-07T10:00:00'},
        ]
        res = calculate_consecutive_late_penalties(records)
        self.assertEqual(res['penalty_count'], 0)
        self.assertEqual(res['consecutive_late_count'], 2)

    def test_exact_60_percent_exam_eligibility(self):
        """Rule 21: Exactly 60.0% MUST be considered eligible."""
        records = (
            [{'status': 'PRESENT', 'timestamp': f'2026-10-{i:02d}'} for i in range(1, 13)] +
            [{'status': 'ABSENT', 'timestamp': f'2026-10-{i+12:02d}'} for i in range(1, 9)]
        )
        res = compute_course_attendance_analytics(
            planned_classes=35,
            conducted_classes=20,
            records=records
        )
        self.assertEqual(res['attendance_percentage'], 60.0)
        self.assertTrue(res['exam_eligible'])

    def test_below_60_percent_ineligible(self):
        """Below 60% must be ineligible."""
        records = (
            [{'status': 'PRESENT', 'timestamp': f'2026-10-{i:02d}'} for i in range(1, 12)] +
            [{'status': 'ABSENT', 'timestamp': f'2026-10-{i+11:02d}'} for i in range(1, 10)]
        )
        res = compute_course_attendance_analytics(
            planned_classes=35,
            conducted_classes=20,
            records=records
        )
        self.assertEqual(res['attendance_percentage'], 55.0)
        self.assertFalse(res['exam_eligible'])

    def test_maximum_possible_attendance_prompt_example(self):
        """Rule 23: Planned=35, Conducted=24, Present=13, Remaining=11 -> 68.57% max possible."""
        records = (
            [{'status': 'PRESENT', 'timestamp': f'2026-09-{i:02d}'} for i in range(1, 14)] +
            [{'status': 'ABSENT', 'timestamp': f'2026-10-{i:02d}'} for i in range(1, 12)]
        )
        res = compute_course_attendance_analytics(
            planned_classes=35,
            conducted_classes=24,
            records=records
        )
        self.assertEqual(res['maximum_possible_attendance'], 68.57)
        self.assertTrue(res['is_recoverable'])

    def test_critical_not_recoverable(self):
        """Student who cannot reach 60% even with perfect future attendance."""
        records = (
            [{'status': 'PRESENT', 'timestamp': f'2026-09-{i:02d}'} for i in range(1, 9)] +
            [{'status': 'ABSENT', 'timestamp': f'2026-10-{i:02d}'} for i in range(1, 23)]
        )
        res = compute_course_attendance_analytics(
            planned_classes=35,
            conducted_classes=30,
            records=records
        )
        self.assertFalse(res['is_recoverable'])
        self.assertEqual(res['risk_level'], 'CRITICAL')

if __name__ == '__main__':
    unittest.main()
