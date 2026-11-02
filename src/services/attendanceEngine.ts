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
    } else if (rec.status === 'PRESENT' || rec.status === 'EXCUSED') {
      currentConsecutive = 0; // Reset consecutive streak on present or excused
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
 * Centralizes formula: Attendance % = (Effective Classes Attended / Conducted Classes) * 100
 * As required:
 * - Each course keeps a Total Scheduled Classes count and a Total Conducted Classes count.
 * - Every attendance percentage and report must be calculated using Conducted Classes, not scheduled classes.
 * - Validation: conducted count can never exceed scheduled count or go below 0.
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

  // Strict scheduled vs conducted validation
  const totalScheduled = Math.max(0, courseOffering.plannedClasses || 35);
  // Conducted classes directly from courseOffering (capped at totalScheduled and >= 0)
  const conducted = Math.min(
    totalScheduled,
    Math.max(0, typeof courseOffering.conductedClasses === 'number' ? courseOffering.conductedClasses : records.length)
  );
  const remaining = Math.max(0, totalScheduled - conducted);

  // Deduplicate records by sessionId so multiple check-in logs for the same session never inflate counts
  const uniqueRecordsMap = new Map<string, AttendanceRecord>();
  for (const r of records) {
    const key = r.sessionId ? `${r.sessionId}_${r.studentId}` : r.id;
    const existing = uniqueRecordsMap.get(key);
    // Keep most favorable status if duplicates exist
    if (!existing || (existing.status === 'ABSENT' && r.status !== 'ABSENT')) {
      uniqueRecordsMap.set(key, r);
    }
  }
  const cleanRecords = Array.from(uniqueRecordsMap.values());

  let presentCount = 0;
  let absentCount = 0;
  let excusedCount = 0;

  for (const r of cleanRecords) {
    if (r.status === 'PRESENT') presentCount++;
    else if (r.status === 'EXCUSED') excusedCount++;
    else if (r.status === 'ABSENT') absentCount++;
  }

  const { lateCount, consecutiveLateCount, penaltyCount } = calculateLatePenalties(cleanRecords);

  // Effective Attendance: Present + Late + Excused minus late penalties
  // If penalty enabled: each 3-late penalty deducts 1 class from effective attendance
  const effectivePresentCount = Math.max(
    0,
    presentCount + lateCount + excusedCount - (settings.threeLatePenaltyEnabled ? penaltyCount : 0)
  );

  // Current Attendance Percentage calculation:
  // Formula: attendance % = classes attended / conducted classes × 100
  const attendancePercentage =
    conducted > 0
      ? Number(((effectivePresentCount / conducted) * 100).toFixed(2))
      : 100.0; // If no class conducted yet, default to 100%

  // Current Exam Eligibility based on classes held so far (threshold default 60.0%)
  const examEligible = attendancePercentage >= settings.examEligibilityThreshold;

  // Maximum Possible Attendance Calculation (if student attends all remaining classes)
  const maxPossiblePresents = effectivePresentCount + remaining;
  const maximumPossibleAttendance =
    totalScheduled > 0
      ? Number(((maxPossiblePresents / totalScheduled) * 100).toFixed(2))
      : 100.0;

  // Target presents needed out of total scheduled classes to reach 60%
  const targetPresentsNeeded = Math.ceil(
    (settings.examEligibilityThreshold / 100) * totalScheduled
  );

  // Minimum additional classes student must attend to reach 60%
  const minAdditionalClassesToPass = Math.max(
    0,
    targetPresentsNeeded - effectivePresentCount
  );
  const requiredFutureAttendance = minAdditionalClassesToPass;

  // Mathematical Possibility & Recoverability Check:
  // Can the student reach 60%? Yes, if min additional needed <= remaining classes
  const canReach60 = maximumPossibleAttendance >= settings.examEligibilityThreshold;
  const isRecoverable = canReach60;
  const isMathematicallyImpossible = !canReach60;

  // 50% Course Milestone Check
  const courseProgressPercentage =
    totalScheduled > 0
      ? Number(((conducted / totalScheduled) * 100).toFixed(1))
      : 0;
  const isHalfwayMilestone = conducted >= Math.floor(totalScheduled * 0.50);

  // Early Warning & Projected Exam Status Classification
  let projectedExamStatus: 'ELIGIBLE' | 'AT_RISK' | 'PROJECTED_INELIGIBLE' = 'ELIGIBLE';
  let earlyWarningCategory:
    | 'BELOW_60_CAN_REACH'
    | 'BELOW_60_CANNOT_REACH'
    | 'AT_OR_ABOVE_60_SAFE'
    | 'AT_OR_ABOVE_60_AT_RISK' = 'AT_OR_ABOVE_60_SAFE';
  let riskLevel: RiskLevel = 'SAFE';

  if (isMathematicallyImpossible) {
    // Mathematically unable to reach 60% even with 100% future attendance
    projectedExamStatus = 'PROJECTED_INELIGIBLE';
    earlyWarningCategory = 'BELOW_60_CANNOT_REACH';
    riskLevel = 'CRITICAL';
  } else if (attendancePercentage < settings.examEligibilityThreshold) {
    // Currently below 60%, but CAN still reach 60% if attends remaining classes
    projectedExamStatus = 'AT_RISK';
    earlyWarningCategory = 'BELOW_60_CAN_REACH';
    riskLevel = 'CRITICAL';
  } else {
    // Currently >= 60%
    // Check if at risk of falling below 60% (needs to attend remaining classes or buffer is tight)
    const maxFutureAbsencesAllowed = remaining - minAdditionalClassesToPass;
    const isAtRisk =
      minAdditionalClassesToPass > 0 &&
      (attendancePercentage < 75.0 || maxFutureAbsencesAllowed < Math.ceil(remaining * 0.35));

    if (isAtRisk) {
      projectedExamStatus = 'AT_RISK';
      earlyWarningCategory = 'AT_OR_ABOVE_60_AT_RISK';
      riskLevel = attendancePercentage < 65.0 ? 'HIGH_RISK' : 'WARNING';
    } else {
      projectedExamStatus = 'ELIGIBLE';
      earlyWarningCategory = 'AT_OR_ABOVE_60_SAFE';
      riskLevel = 'SAFE';
    }
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
    plannedClasses: totalScheduled,
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
    minAdditionalClassesToPass,
    consecutiveClassesToReach60: requiredFutureAttendance,
    isRecoverable,
    canReach60,
    isMathematicallyImpossible,
    isHalfwayMilestone,
    courseProgressPercentage,
    projectedExamStatus,
    earlyWarningCategory,
    riskLevel,
  };
}
