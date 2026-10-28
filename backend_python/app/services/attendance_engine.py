"""
Centralized Python Attendance & Risk Analytics Engine
Implements:
- 20-minute late threshold (configurable)
- Three consecutive late penalty rule (3 late = 1 penalty, original records preserved)
- Centralized attendance percentage: Effective Present / Conducted * 100
- 60% exam eligibility (>= 60.0% eligible, < 60.0% not eligible)
- Maximum possible attendance projection
- Required future attendance to reach 60%
- Risk classification (SAFE, WARNING, HIGH_RISK, CRITICAL)
"""
import math
from typing import List, Dict, Any

def determine_attendance_status(arrival_minutes: int, late_threshold: int = 20) -> str:
    """Returns 'PRESENT' if arrival_minutes < late_threshold, else 'LATE'."""
    return 'PRESENT' if arrival_minutes < late_threshold else 'LATE'

def calculate_consecutive_late_penalties(records: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Evaluates 3 consecutive LATE records for same course offering.
    3 consecutive LATE = 1 Attendance Penalty.
    Original records are never altered.
    """
    sorted_records = sorted(records, key=lambda r: r.get('timestamp', ''))
    late_count = 0
    current_consecutive = 0
    penalty_count = 0

    for r in sorted_records:
        st = r.get('status')
        if st == 'LATE':
            late_count += 1
            current_consecutive += 1
            if current_consecutive == 3:
                penalty_count += 1
                current_consecutive = 0
        elif st in ('PRESENT', 'ABSENT'):
            current_consecutive = 0

    return {
        'late_count': late_count,
        'consecutive_late_count': current_consecutive,
        'penalty_count': penalty_count
    }

def compute_course_attendance_analytics(
    planned_classes: int,
    conducted_classes: int,
    records: List[Dict[str, Any]],
    late_threshold: int = 20,
    exam_threshold: float = 60.0,
    three_late_penalty_enabled: bool = True
) -> Dict[str, Any]:
    """
    Centralized attendance metrics computation.
    """
    conducted = conducted_classes or len(records)
    remaining = max(0, planned_classes - conducted)

    present_count = sum(1 for r in records if r.get('status') == 'PRESENT')
    absent_count = sum(1 for r in records if r.get('status') == 'ABSENT')

    penalties = calculate_consecutive_late_penalties(records)
    late_count = penalties['late_count']
    penalty_count = penalties['penalty_count'] if three_late_penalty_enabled else 0

    effective_present = max(0, present_count + late_count - penalty_count)
    
    attendance_percentage = round((effective_present / conducted * 100), 2) if conducted > 0 else 100.0
    exam_eligible = attendance_percentage >= exam_threshold

    # Maximum Possible Attendance
    max_possible_presents = effective_present + remaining
    max_possible_attendance = round((max_possible_presents / planned_classes * 100), 2) if planned_classes > 0 else 100.0

    # Required Future Attendance to reach 60%
    target_presents_needed = math.ceil((exam_threshold / 100.0) * planned_classes)
    required_future = max(0, target_presents_needed - effective_present)

    # Recoverability Check
    is_recoverable = max_possible_attendance >= exam_threshold

    # Risk level
    if not is_recoverable or attendance_percentage < exam_threshold:
        risk_level = 'CRITICAL'
    elif 60.0 <= attendance_percentage < 65.0:
        risk_level = 'HIGH_RISK'
    elif 65.0 <= attendance_percentage < 75.0:
        risk_level = 'WARNING'
    else:
        risk_level = 'SAFE'

    return {
        'planned_classes': planned_classes,
        'conducted_classes': conducted,
        'remaining_classes': remaining,
        'present_count': present_count,
        'late_count': late_count,
        'absent_count': absent_count,
        'consecutive_late_count': penalties['consecutive_late_count'],
        'penalty_count': penalty_count,
        'effective_present': effective_present,
        'attendance_percentage': attendance_percentage,
        'exam_eligible': exam_eligible,
        'maximum_possible_attendance': max_possible_attendance,
        'required_future_attendance': required_future,
        'is_recoverable': is_recoverable,
        'risk_level': risk_level
    }
