/**
 * Centralized Attendance & Risk Analytics Engine
 * Single Source of Truth for all attendance metrics, penalty calculations,
 * exam eligibility, and risk determinations.
 */

import {
  AttendanceRecord,
  AttendanceStatus,
  CourseOffering,
  RiskLevel,
  StudentCourseAnalytics,
  SystemSettings,
} from '../types';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  lateThresholdMinutes: 20,
  examEligibilityThreshold: 60.0,
  threeLatePenaltyEnabled: true,
  teacherReminderTiming: '15_MIN_BEFORE',
  allowDynamicQRScan: true,
  faceMatchThreshold: 0.72,
};

/**
 * Calculates consecutive late penalties for an ordered chronological list of attendance records.
 * Rule: 3 consecutive LATE records for the same course = 1 Attendance Penalty.
 * Original records are never altered.
 */
export function calculateLatePenalties(records: AttendanceRecord[]): {
  lateCount: number;
  consecutiveLateCount: number;
  penaltyCount: number;
} {
  let lateCount = 0;
  let currentConsecutive = 0;
  let penaltyCount = 0;

  // Sort chronological
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const rec of sorted) {
    if (rec.status === 'LATE') {
      lateCount++;
      currentConsecutive++;
      if (currentConsecutive === 3) {
        penaltyCount++;
        currentConsecutive = 0; // Reset streak after penalty assessed
      }
    } else if (rec.status === 'PRESENT') {
      currentConsecutive = 0; // Reset consecutive streak on present
    } else if (rec.status === 'ABSENT') {
      currentConsecutive = 0; // Reset consecutive streak on absent
    }
  }

  return {
    lateCount,
    consecutiveLateCount: currentConsecutive,
    penaltyCount,
  };
}

/**
 * Calculates attendance status for a student scanning at a given time relative to session start.
 */
export function determineAttendanceStatus(
  arrivalMinutes: number,
  settings: SystemSettings = DEFAULT_SYSTEM_SETTINGS
): AttendanceStatus {
  if (arrivalMinutes < settings.lateThresholdMinutes) {
    return 'PRESENT';
  }
  return 'LATE';
}

/**
 * Computes complete analytics for a student in a course offering.
 * Centralizes formula: Attendance % = (Effective Present / Conducted) * 100
 */
export function computeStudentCourseAnalytics(params: {
  studentId: string;
  studentName: string;
  studentRoll: string;
  courseOffering: CourseOffering;
  courseCode: string;
  courseName: string;
  credit: number;
  courseType: 'THEORY' | 'LAB';
  records: AttendanceRecord[];
  settings?: SystemSettings;
}): StudentCourseAnalytics {
  const {
    studentId,
    studentName,
    studentRoll,
    courseOffering,
    courseCode,
    courseName,
    credit,
    courseType,
    records,
    settings = DEFAULT_SYSTEM_SETTINGS,
  } = params;

  const planned = courseOffering.plannedClasses || 35;
  const conducted = courseOffering.conductedClasses || records.length || 0;
  const remaining = Math.max(0, planned - conducted);

  let presentCount = 0;
  let absentCount = 0;

  for (const r of records) {
    if (r.status === 'PRESENT') presentCount++;
    else if (r.status === 'ABSENT') absentCount++;
  }

  const { lateCount, consecutiveLateCount, penaltyCount } = calculateLatePenalties(records);

  // Effective Attendance: Present + Late minus penalties
  // If penalty enabled: each 3-late penalty deducts 1 class from effective attendance
  const effectivePresentCount = Math.max(
    0,
    presentCount + lateCount - (settings.threeLatePenaltyEnabled ? penaltyCount : 0)
  );

  // Percentage calculation
  const attendancePercentage =
    conducted > 0
      ? Number(((effectivePresentCount / conducted) * 100).toFixed(2))
      : 100.0; // If no class conducted yet, default to 100%

  // Exam Eligibility (Exact rule: >= 60.0% is eligible)
  const examEligible = attendancePercentage >= settings.examEligibilityThreshold;

  // Maximum Possible Attendance Calculation:
  // If student attends every remaining class: (effectivePresentCount + remaining) / planned * 100
  const maxPossiblePresents = effectivePresentCount + remaining;
  const maximumPossibleAttendance =
    planned > 0
      ? Number(((maxPossiblePresents / planned) * 100).toFixed(2))
      : 100.0;

  // Required future attendance to reach 60% of planned classes:
  // Minimum effective presents needed overall to achieve threshold:
  const targetPresentsNeeded = Math.ceil(
    (settings.examEligibilityThreshold / 100) * planned
  );
  const requiredFutureAttendance = Math.max(
    0,
    targetPresentsNeeded - effectivePresentCount
  );

  // Recoverability Check:
  // If required future classes exceeds remaining classes, student CANNOT reach 60% even with 100% future attendance
  const isRecoverable = maximumPossibleAttendance >= settings.examEligibilityThreshold;

  // Risk Classification
  let riskLevel: RiskLevel = 'SAFE';

  if (!isRecoverable || attendancePercentage < settings.examEligibilityThreshold) {
    riskLevel = 'CRITICAL';
  } else if (attendancePercentage >= 60.0 && attendancePercentage < 65.0) {
    riskLevel = 'HIGH_RISK';
  } else if (attendancePercentage >= 65.0 && attendancePercentage < 75.0) {
    riskLevel = 'WARNING';
  } else {
    riskLevel = 'SAFE';
  }

  return {
    studentId,
    studentName,
    studentRoll,
    courseOfferingId: courseOffering.id,
    courseCode,
    courseName,
    credit,
    courseType,
    plannedClasses: planned,
    conductedClasses: conducted,
    remainingClasses: remaining,
    presentCount,
    lateCount,
    absentCount,
    consecutiveLateCount,
    penaltyCount,
    effectivePresentCount,
    attendancePercentage,
    examEligible,
    maximumPossibleAttendance,
    requiredFutureAttendance,
    consecutiveClassesToReach60: requiredFutureAttendance,
    isRecoverable,
    riskLevel,
  };
}
