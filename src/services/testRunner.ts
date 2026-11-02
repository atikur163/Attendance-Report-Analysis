/**
 * Automated Verification & Testing Suite for University Attendance Rules
 * Validates all 24 critical requirements from Section 42 of the specification.
 */

import {
  calculateLatePenalties,
  computeStudentCourseAnalytics,
  determineAttendanceStatus,
} from './attendanceEngine';
import { db } from './db';
import { AttendanceRecord, CourseOffering } from '../types';

export interface TestResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

export function runAllAutomatedTests(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  function assert(category: string, name: string, condition: boolean, expected: string, actual: string) {
    results.push({
      id: 'test-' + (results.length + 1),
      category,
      name,
      passed: condition,
      expected,
      actual,
    });
  }

  // 1. Normal Attendance Rule & 20-Minute Late Threshold (Section 17)
  const arrival15 = determineAttendanceStatus(15);
  assert(
    'Attendance Status',
    'Student arriving at 15 minutes (< 20 min threshold) must be PRESENT',
    arrival15 === 'PRESENT',
    'PRESENT',
    arrival15
  );

  const arrival20 = determineAttendanceStatus(20);
  assert(
    'Attendance Status',
    'Student arriving at exactly 20 minutes (>= 20 min threshold) must be LATE',
    arrival20 === 'LATE',
    'LATE',
    arrival20
  );

  const arrival35 = determineAttendanceStatus(35);
  assert(
    'Attendance Status',
    'Student arriving at 35 minutes must be LATE',
    arrival35 === 'LATE',
    'LATE',
    arrival35
  );

  // 2. Three Consecutive Late Penalty Rule (Section 19)
  const threeLateRecords: AttendanceRecord[] = [
    { id: '1', sessionId: 's1', courseOfferingId: 'co-1', studentId: 'stu-1', timestamp: '2026-10-01T10:00:00Z', method: 'QR', status: 'LATE', minutesLate: 22 },
    { id: '2', sessionId: 's2', courseOfferingId: 'co-1', studentId: 'stu-1', timestamp: '2026-10-03T10:00:00Z', method: 'QR', status: 'LATE', minutesLate: 25 },
    { id: '3', sessionId: 's3', courseOfferingId: 'co-1', studentId: 'stu-1', timestamp: '2026-10-05T10:00:00Z', method: 'QR', status: 'LATE', minutesLate: 21 },
  ];
  const penResult1 = calculateLatePenalties(threeLateRecords);
  assert(
    'Late Penalty',
    '3 consecutive LATE records must generate exactly 1 Attendance Penalty',
    penResult1.penaltyCount === 1 && penResult1.lateCount === 3,
    'Penalty Count: 1, Late Count: 3',
    `Penalty Count: ${penResult1.penaltyCount}, Late Count: ${penResult1.lateCount}`
  );

  // Non-consecutive lates (broken by a PRESENT)
  const nonConsecutiveRecords: AttendanceRecord[] = [
    { id: '1', sessionId: 's1', courseOfferingId: 'co-1', studentId: 'stu-1', timestamp: '2026-10-01T10:00:00Z', method: 'QR', status: 'LATE', minutesLate: 22 },
    { id: '2', sessionId: 's2', courseOfferingId: 'co-1', studentId: 'stu-1', timestamp: '2026-10-03T10:00:00Z', method: 'QR', status: 'PRESENT', minutesLate: 5 },
    { id: '3', sessionId: 's3', courseOfferingId: 'co-1', studentId: 'stu-1', timestamp: '2026-10-05T10:00:00Z', method: 'QR', status: 'LATE', minutesLate: 21 },
    { id: '4', sessionId: 's4', courseOfferingId: 'co-1', studentId: 'stu-1', timestamp: '2026-10-07T10:00:00Z', method: 'QR', status: 'LATE', minutesLate: 24 },
  ];
  const penResult2 = calculateLatePenalties(nonConsecutiveRecords);
  assert(
    'Late Penalty',
    '2 lates followed by present followed by 2 lates must NOT trigger 3-consecutive penalty',
    penResult2.penaltyCount === 0 && penResult2.consecutiveLateCount === 2,
    'Penalty Count: 0, Consecutive Streak: 2',
    `Penalty Count: ${penResult2.penaltyCount}, Consecutive Streak: ${penResult2.consecutiveLateCount}`
  );

  // 3. Centralized Attendance Percentage & 60% Exam Eligibility (Section 20 & 21)
  const mockOffering: CourseOffering = {
    id: 'co-test',
    courseId: 'c-test',
    departmentId: 'dept-cse',
    academicSessionId: 'sess-1',
    year: 1,
    semester: 1,
    batchId: 'batch-test',
    section: 'A',
    plannedClasses: 35,
    conductedClasses: 20,
    status: 'ACTIVE',
  };

  // 12 effective presents out of 20 conducted = 60.0% exactly -> MUST BE ELIGIBLE
  const recordsExact60: AttendanceRecord[] = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `p-${i}`,
      sessionId: `s-${i}`,
      courseOfferingId: 'co-test',
      studentId: 'stu-test',
      timestamp: `2026-10-${i + 1 < 10 ? '0' : ''}${i + 1}T10:00:00Z`,
      method: 'QR' as const,
      status: 'PRESENT' as const,
      minutesLate: 5,
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `a-${i}`,
      sessionId: `s-${i + 12}`,
      courseOfferingId: 'co-test',
      studentId: 'stu-test',
      timestamp: `2026-10-${i + 13}T10:00:00Z`,
      method: 'QR' as const,
      status: 'ABSENT' as const,
      minutesLate: 60,
    })),
  ];

  const analytics60 = computeStudentCourseAnalytics({
    studentId: 'stu-test',
    studentName: 'Test Student',
    studentRoll: 'ROLL-60',
    courseOffering: mockOffering,
    courseCode: 'CSE-101',
    courseName: 'Test Course',
    credit: 3.0,
    courseType: 'THEORY',
    records: recordsExact60,
  });

  assert(
    'Exam Eligibility',
    'Student with exactly 60.0% attendance MUST be marked Exam Eligible (Section 21)',
    analytics60.attendancePercentage === 60.0 && analytics60.examEligible === true,
    '60.0% & Eligible = true',
    `${analytics60.attendancePercentage}% & Eligible = ${analytics60.examEligible}`
  );

  // 11 presents out of 20 conducted = 55.0% -> NOT ELIGIBLE
  const records55: AttendanceRecord[] = [
    ...Array.from({ length: 11 }, (_, i) => ({
      id: `p-${i}`,
      sessionId: `s-${i}`,
      courseOfferingId: 'co-test',
      studentId: 'stu-test',
      timestamp: `2026-10-${i + 1}T10:00:00Z`,
      method: 'QR' as const,
      status: 'PRESENT' as const,
      minutesLate: 5,
    })),
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `a-${i}`,
      sessionId: `s-${i + 11}`,
      courseOfferingId: 'co-test',
      studentId: 'stu-test',
      timestamp: `2026-10-${i + 12}T10:00:00Z`,
      method: 'QR' as const,
      status: 'ABSENT' as const,
      minutesLate: 60,
    })),
  ];

  const analytics55 = computeStudentCourseAnalytics({
    studentId: 'stu-test',
    studentName: 'Test Student',
    studentRoll: 'ROLL-55',
    courseOffering: mockOffering,
    courseCode: 'CSE-101',
    courseName: 'Test Course',
    credit: 3.0,
    courseType: 'THEORY',
    records: records55,
  });

  assert(
    'Exam Eligibility',
    'Student with 55.0% attendance (<60%) must be Exam Ineligible',
    analytics55.attendancePercentage === 55.0 && analytics55.examEligible === false,
    '55.0% & Eligible = false',
    `${analytics55.attendancePercentage}% & Eligible = ${analytics55.examEligible}`
  );

  // 4. Maximum Possible Attendance & Recoverability (Section 23)
  // Planned = 35, Conducted = 24, Effective Present = 13, Remaining = 11
  // Max possible = (13 + 11) / 35 * 100 = 68.57%
  const offeringSection23: CourseOffering = {
    id: 'co-sec23',
    courseId: 'c-test',
    departmentId: 'dept-cse',
    academicSessionId: 'sess-1',
    year: 1,
    semester: 1,
    batchId: 'batch-test',
    section: 'A',
    plannedClasses: 35,
    conductedClasses: 24,
    status: 'ACTIVE',
  };
  const recordsSec23: AttendanceRecord[] = [
    ...Array.from({ length: 13 }, (_, i) => ({
      id: `p-${i}`,
      sessionId: `s-${i}`,
      courseOfferingId: 'co-sec23',
      studentId: 'stu-sec23',
      timestamp: `2026-09-${i + 1}T10:00:00Z`,
      method: 'QR' as const,
      status: 'PRESENT' as const,
      minutesLate: 2,
    })),
    ...Array.from({ length: 11 }, (_, i) => ({
      id: `a-${i}`,
      sessionId: `s-${i + 13}`,
      courseOfferingId: 'co-sec23',
      studentId: 'stu-sec23',
      timestamp: `2026-10-${i + 1}T10:00:00Z`,
      method: 'QR' as const,
      status: 'ABSENT' as const,
      minutesLate: 60,
    })),
  ];

  const analyticsSec23 = computeStudentCourseAnalytics({
    studentId: 'stu-sec23',
    studentName: 'Prompt Example Student',
    studentRoll: 'ROLL-SEC23',
    courseOffering: offeringSection23,
    courseCode: 'CSE-101',
    courseName: 'Test Course',
    credit: 3.0,
    courseType: 'THEORY',
    records: recordsSec23,
  });

  assert(
    'Projections',
    'Planned 35, Conducted 24, Present 13, Remaining 11 -> Max Possible Attendance must be 68.57%',
    analyticsSec23.maximumPossibleAttendance === 68.57,
    '68.57%',
    `${analyticsSec23.maximumPossibleAttendance}%`
  );

  assert(
    'Recoverability',
    'Max Possible Attendance 68.57% is >= 60% so student is Recoverable',
    analyticsSec23.isRecoverable === true,
    'true',
    String(analyticsSec23.isRecoverable)
  );

  // Critical / Not Recoverable Test:
  // Planned = 35, Conducted = 30, Effective Present = 8, Remaining = 5
  // Max possible = (8 + 5) / 35 = 13/35 = 37.14% (< 60%) -> NOT RECOVERABLE
  const offeringCritical: CourseOffering = {
    ...offeringSection23,
    conductedClasses: 30,
  };
  const recordsCritical: AttendanceRecord[] = [
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `p-${i}`,
      sessionId: `s-${i}`,
      courseOfferingId: 'co-crit',
      studentId: 'stu-crit',
      timestamp: `2026-09-${i + 1}T10:00:00Z`,
      method: 'QR' as const,
      status: 'PRESENT' as const,
      minutesLate: 2,
    })),
    ...Array.from({ length: 22 }, (_, i) => ({
      id: `a-${i}`,
      sessionId: `s-${i + 8}`,
      courseOfferingId: 'co-crit',
      studentId: 'stu-crit',
      timestamp: `2026-10-${i + 1}T10:00:00Z`,
      method: 'QR' as const,
      status: 'ABSENT' as const,
      minutesLate: 60,
    })),
  ];

  const analyticsCritical = computeStudentCourseAnalytics({
    studentId: 'stu-crit',
    studentName: 'Critical Student',
    studentRoll: 'ROLL-CRIT',
    courseOffering: offeringCritical,
    courseCode: 'CSE-101',
    courseName: 'Test Course',
    credit: 3.0,
    courseType: 'THEORY',
    records: recordsCritical,
  });

  assert(
    'Risk Analysis',
    'Student who cannot reach 60% even with 100% attendance must be CRITICAL and isRecoverable=false',
    analyticsCritical.riskLevel === 'CRITICAL' && analyticsCritical.isRecoverable === false,
    'riskLevel: CRITICAL, isRecoverable: false',
    `riskLevel: ${analyticsCritical.riskLevel}, isRecoverable: ${analyticsCritical.isRecoverable}`
  );

  // 5. Teacher Assignment Constraints (Section 10)
  // Rule: Max ONE regular/theory course in a specific semester + batch!
  const teacherCheck = db.canAssignTeacherToOffering('tch-01', 'co-1103'); // co-1103 is another THEORY course in Batch 2026 where tch-01 already has co-1101
  assert(
    'Teacher Assignment Policy',
    'Teacher cannot be assigned two regular/theory courses in same semester+batch (Section 10)',
    teacherCheck.allowed === false,
    'allowed: false',
    `allowed: ${teacherCheck.allowed} (${teacherCheck.reason || ''})`
  );

  // 6. Student Enrollment Separation (Section 8)
  // Student in Batch 2026 (Year 1 Sem 1) cannot be enrolled in Year 2 Sem 1 course offering
  const crossEnrollCheck = db.enrollStudent('stu-01', 'co-2101');
  assert(
    'Academic Structure Separation',
    'Student in Year 1 cannot be enrolled in Year 2 Course Offering (Section 8)',
    crossEnrollCheck.success === false,
    'success: false',
    `success: ${crossEnrollCheck.success} (${crossEnrollCheck.message})`
  );

  // Cross-Department Enrollment Isolation Check
  // Student stu-01 (ICT) cannot be enrolled into CSE offering co-1101 even though both are Year 1 Sem 1
  const crossDeptCheck = db.enrollStudent('stu-01', 'co-1101');
  assert(
    'Department Cohort Isolation',
    'ICT student cannot be enrolled in CSE course offering (Department Mismatch)',
    crossDeptCheck.success === false && crossDeptCheck.message.includes('Department Mismatch'),
    'success: false (Department Mismatch)',
    `success: ${crossDeptCheck.success} (${crossDeptCheck.message})`
  );

  // 7. Duplicate Attendance Prevention (Section 14)
  const dupCheck = db.recordStudentAttendance({
    sessionId: 'sess-today-active',
    studentId: 'stu-01',
    method: 'QR',
    minutesLate: 5,
  });
  if (dupCheck.success) {
    const secondScan = db.recordStudentAttendance({
      sessionId: 'sess-today-active',
      studentId: 'stu-01',
      method: 'QR',
      minutesLate: 6,
    });
    assert(
      'Duplicate Prevention',
      'Scanning QR a second time in same session must be rejected with Duplicate notice',
      secondScan.success === false,
      'success: false',
      `success: ${secondScan.success} (${secondScan.message})`
    );
  }

  // 8. 50% Course Milestone & 60% Exam Eligibility Early Warning Suite (Prompt Requirements 1 & 2)
  const scheduledOffering: CourseOffering = {
    id: 'co-milestone-test',
    courseId: 'c-1101',
    departmentId: 'dept-cse',
    academicSessionId: 'sess-test',
    year: 1,
    semester: 1,
    batchId: 'batch-2026',
    section: 'A',
    plannedClasses: 35,
    conductedClasses: 18, // 18 of 35 is >= 50% milestone (35 * 0.5 = 17.5 -> 17)
    status: 'ACTIVE',
  };

  // Case A: Student Below 60%, but CAN STILL REACH 60% with remaining classes
  // Total Scheduled: 35. Target = ceil(35 * 0.6) = 21 presents needed.
  // Classes held: 18. Attended: 9. Current rate = (9 / 18) = 50.0% (< 60%).
  // Remaining: 35 - 18 = 17 classes.
  // Min additional needed = 21 - 9 = 12 classes.
  // 12 <= 17 remaining, so CAN STILL REACH 60% (Max possible: (9 + 17) / 35 = 74.29%).
  const recordsCaseA: AttendanceRecord[] = [
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `rec-caseA-p-${i}`,
      sessionId: `s-a-${i}`,
      courseOfferingId: 'co-milestone-test',
      studentId: 'stu-case-a',
      timestamp: '2026-10-01T10:00:00Z',
      method: 'QR' as const,
      status: 'PRESENT' as const,
      minutesLate: 5,
    })),
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `rec-caseA-ab-${i}`,
      sessionId: `s-a-ab-${i}`,
      courseOfferingId: 'co-milestone-test',
      studentId: 'stu-case-a',
      timestamp: '2026-10-02T10:00:00Z',
      method: 'QR' as const,
      status: 'ABSENT' as const,
      minutesLate: 60,
    })),
  ];

  const analyticsCaseA = computeStudentCourseAnalytics({
    studentId: 'stu-case-a',
    studentName: 'Case A Student',
    studentRoll: 'ROLL-CASE-A',
    courseOffering: scheduledOffering,
    courseCode: 'CSE-1101',
    courseName: 'Structured Programming',
    credit: 3.0,
    courseType: 'THEORY',
    records: recordsCaseA,
  });

  assert(
    '60% Early Warning Rule',
    'Detects 50% Course Milestone reached (18 of 35 classes held)',
    analyticsCaseA.isHalfwayMilestone === true,
    'isHalfwayMilestone: true',
    `isHalfwayMilestone: ${analyticsCaseA.isHalfwayMilestone}`
  );

  assert(
    '60% Early Warning Rule',
    'Student Case A: Current attendance below 60% (50.0%)',
    analyticsCaseA.attendancePercentage === 50.0 && analyticsCaseA.examEligible === false,
    '50.0% & examEligible: false',
    `${analyticsCaseA.attendancePercentage}% & examEligible: ${analyticsCaseA.examEligible}`
  );

  assert(
    '60% Early Warning Rule',
    'Student Case A: Correct min additional classes needed (12 of 17 remaining)',
    analyticsCaseA.minAdditionalClassesToPass === 12 && analyticsCaseA.remainingClasses === 17,
    'minAdditional: 12, remaining: 17',
    `minAdditional: ${analyticsCaseA.minAdditionalClassesToPass}, remaining: ${analyticsCaseA.remainingClasses}`
  );

  assert(
    '60% Early Warning Rule',
    'Student Case A: Reaching 60% is mathematically possible (canReach60 = true)',
    analyticsCaseA.canReach60 === true && analyticsCaseA.projectedExamStatus === 'AT_RISK',
    'canReach60: true, status: AT_RISK',
    `canReach60: ${analyticsCaseA.canReach60}, status: ${analyticsCaseA.projectedExamStatus}`
  );

  // Case B: Student Below 60%, and MATHEMATICALLY UNABLE to reach 60%
  // Total Scheduled: 35. Target: 21 presents needed.
  // Held: 18. Attended: 3. Current rate = (3 / 18) = 16.67%.
  // Remaining: 17 classes.
  // Max possible presents = 3 + 17 = 20. Max possible attendance = 20 / 35 = 57.14% (< 60.0%).
  // Min additional needed = 21 - 3 = 18. But only 17 remaining!
  // Therefore, canReach60 = false, projectedExamStatus = 'PROJECTED_INELIGIBLE'.
  const recordsCaseB: AttendanceRecord[] = [
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `rec-caseB-p-${i}`,
      sessionId: `s-b-${i}`,
      courseOfferingId: 'co-milestone-test',
      studentId: 'stu-case-b',
      timestamp: '2026-10-01T10:00:00Z',
      method: 'QR' as const,
      status: 'PRESENT' as const,
      minutesLate: 5,
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `rec-caseB-ab-${i}`,
      sessionId: `s-b-ab-${i}`,
      courseOfferingId: 'co-milestone-test',
      studentId: 'stu-case-b',
      timestamp: '2026-10-02T10:00:00Z',
      method: 'QR' as const,
      status: 'ABSENT' as const,
      minutesLate: 60,
    })),
  ];

  const analyticsCaseB = computeStudentCourseAnalytics({
    studentId: 'stu-case-b',
    studentName: 'Case B Student',
    studentRoll: 'ROLL-CASE-B',
    courseOffering: scheduledOffering,
    courseCode: 'CSE-1101',
    courseName: 'Structured Programming',
    credit: 3.0,
    courseType: 'THEORY',
    records: recordsCaseB,
  });

  assert(
    '60% Early Warning Rule',
    'Student Case B: Mathematically unable to reach 60% even if attending 100% of remaining classes',
    analyticsCaseB.canReach60 === false && analyticsCaseB.isMathematicallyImpossible === true,
    'canReach60: false, isMathematicallyImpossible: true',
    `canReach60: ${analyticsCaseB.canReach60}, isMathematicallyImpossible: ${analyticsCaseB.isMathematicallyImpossible}`
  );

  assert(
    '60% Early Warning Rule',
    'Student Case B: Correctly classified as PROJECTED_INELIGIBLE (Max possible 57.14% < 60%)',
    analyticsCaseB.projectedExamStatus === 'PROJECTED_INELIGIBLE' && analyticsCaseB.maximumPossibleAttendance < 60.0,
    'PROJECTED_INELIGIBLE & Max < 60.0%',
    `${analyticsCaseB.projectedExamStatus} & Max ${analyticsCaseB.maximumPossibleAttendance}%`
  );

  // Case C: Student AT OR ABOVE 60%, but at risk if they miss future classes
  // Total Scheduled: 35. Target: 21 presents.
  // Held: 18. Attended: 11. Current rate = 11 / 18 = 61.11% (currently eligible).
  // Remaining: 17. Min additional needed = 21 - 11 = 10 classes.
  // If student misses more than 7 of the 17 remaining classes, they fall below 60%.
  // Early warning category: AT_OR_ABOVE_60_AT_RISK.
  const recordsCaseC: AttendanceRecord[] = [
    ...Array.from({ length: 11 }, (_, i) => ({
      id: `rec-caseC-p-${i}`,
      sessionId: `s-c-${i}`,
      courseOfferingId: 'co-milestone-test',
      studentId: 'stu-case-c',
      timestamp: '2026-10-01T10:00:00Z',
      method: 'QR' as const,
      status: 'PRESENT' as const,
      minutesLate: 5,
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `rec-caseC-ab-${i}`,
      sessionId: `s-c-ab-${i}`,
      courseOfferingId: 'co-milestone-test',
      studentId: 'stu-case-c',
      timestamp: '2026-10-02T10:00:00Z',
      method: 'QR' as const,
      status: 'ABSENT' as const,
      minutesLate: 60,
    })),
  ];

  const analyticsCaseC = computeStudentCourseAnalytics({
    studentId: 'stu-case-c',
    studentName: 'Case C Student',
    studentRoll: 'ROLL-CASE-C',
    courseOffering: scheduledOffering,
    courseCode: 'CSE-1101',
    courseName: 'Structured Programming',
    credit: 3.0,
    courseType: 'THEORY',
    records: recordsCaseC,
  });

  assert(
    '60% Early Warning Rule',
    'Student Case C: Current attendance >= 60% (61.11%) but flagged AT_OR_ABOVE_60_AT_RISK',
    analyticsCaseC.attendancePercentage === 61.11 && analyticsCaseC.earlyWarningCategory === 'AT_OR_ABOVE_60_AT_RISK',
    '61.11% & AT_OR_ABOVE_60_AT_RISK',
    `${analyticsCaseC.attendancePercentage}% & ${analyticsCaseC.earlyWarningCategory}`
  );

  // 14. Edge Case: Zero Classes Conducted (Course not started yet)
  const zeroOffering: CourseOffering = {
    id: 'co-zero-test',
    courseId: 'c-zero',
    departmentId: 'dept-cse',
    academicSessionId: 'sess-1',
    year: 1,
    semester: 1,
    batchId: 'batch-test',
    section: 'A',
    plannedClasses: 35,
    conductedClasses: 0,
    status: 'ACTIVE',
  };
  const zeroAnalytics = computeStudentCourseAnalytics({
    studentId: 'stu-zero',
    studentName: 'Zero Student',
    studentRoll: 'ROLL-ZERO',
    courseOffering: zeroOffering,
    courseCode: 'CSE-1101',
    courseName: 'Structured Programming',
    credit: 3.0,
    courseType: 'THEORY',
    records: [],
  });
  assert(
    'Edge Case - Zero Classes',
    'Course with zero classes held must not throw division-by-zero and require 21 future classes',
    zeroAnalytics.conductedClasses === 0 && zeroAnalytics.minAdditionalClassesToPass === 21 && zeroAnalytics.canReach60 === true,
    'Conducted: 0, Min Needed: 21, Can Reach: true',
    `Conducted: ${zeroAnalytics.conductedClasses}, Min Needed: ${zeroAnalytics.minAdditionalClassesToPass}, Can Reach: ${zeroAnalytics.canReach60}`
  );

  // 15. Edge Case: Duplicate Records for the Same Session
  const duplicateRecords: AttendanceRecord[] = [
    {
      id: 'rec-dup-1',
      sessionId: 'sess-dup-101',
      courseOfferingId: 'co-dup-test',
      studentId: 'stu-dup',
      timestamp: '2026-10-01T10:00:00Z',
      method: 'QR',
      status: 'PRESENT',
      minutesLate: 5,
    },
    {
      id: 'rec-dup-2',
      sessionId: 'sess-dup-101', // Identical sessionId
      courseOfferingId: 'co-dup-test',
      studentId: 'stu-dup',
      timestamp: '2026-10-01T10:01:00Z',
      method: 'QR',
      status: 'PRESENT',
      minutesLate: 6,
    },
  ];
  const dupOffering: CourseOffering = {
    id: 'co-dup-test',
    courseId: 'c-dup',
    departmentId: 'dept-cse',
    academicSessionId: 'sess-1',
    year: 1,
    semester: 1,
    batchId: 'batch-test',
    section: 'A',
    plannedClasses: 35,
    conductedClasses: 1,
    status: 'ACTIVE',
  };
  const dupAnalytics = computeStudentCourseAnalytics({
    studentId: 'stu-dup',
    studentName: 'Dup Student',
    studentRoll: 'ROLL-DUP',
    courseOffering: dupOffering,
    courseCode: 'CSE-1101',
    courseName: 'Structured Programming',
    credit: 3.0,
    courseType: 'THEORY',
    records: duplicateRecords,
  });
  assert(
    'Edge Case - Duplicate Session Records',
    'Multiple check-ins for the same sessionId must deduplicate to exactly 1 present',
    dupAnalytics.effectivePresentCount === 1,
    'Effective Presents: 1',
    `Effective Presents: ${dupAnalytics.effectivePresentCount}`
  );

  // 16. Identity Mapping: Authenticated Teacher Must Resolve Strictly to Their Own Profile
  const nargisTeacher = db.findTeacher('nargisakter@mbstu.ac.bd');
  assert(
    'Identity Mapping',
    'Prof. Nargis Akter email must resolve strictly to TCH-103 and never Dr. Ahsan Habib (TCH-101)',
    Boolean(nargisTeacher && nargisTeacher.teacherId === 'TCH-103' && nargisTeacher.id !== 'tch-01'),
    'TeacherId: TCH-103, ID != tch-01',
    `TeacherId: ${nargisTeacher?.teacherId}, ID: ${nargisTeacher?.id}`
  );

  // 17. Unassigned/Nonexistent Profile Fallback Prevention
  const nonexistentTeacher = db.findTeacher('unknown.faculty@mbstu.ac.bd');
  assert(
    'Identity Mapping',
    'Nonexistent teacher email must return undefined and never fall back to another teacher',
    nonexistentTeacher === undefined,
    'undefined',
    String(nonexistentTeacher)
  );

  // 18. Manual Attendance Correction: Status change, isManuallyEdited flag, and Audit Log
  const initialRecords = db.getAttendanceRecords();
  const testTargetRecord = initialRecords[0];
  if (testTargetRecord) {
    const originalStatus = testTargetRecord.status;
    const newStatus = originalStatus === 'PRESENT' ? 'LATE' : 'PRESENT';
    const correctionRes = db.correctAttendance({
      attendanceRecordId: testTargetRecord.id,
      newStatus,
      changedBy: 'Dr. Ahsan Habib',
      reason: 'Student arrived during review and was present',
      userRole: 'ADMIN',
    });

    assert(
      'Manual Attendance Correction',
      'Teacher/Admin manual attendance correction updates record and sets isManuallyEdited flag',
      correctionRes.success === true &&
      testTargetRecord.isManuallyEdited === true &&
      testTargetRecord.status === newStatus,
      'Success: true, isManuallyEdited: true',
      `Success: ${correctionRes.success}, isManuallyEdited: ${testTargetRecord.isManuallyEdited}`
    );

    const auditFound = db.getAttendanceCorrections().some(a => a.attendanceId === testTargetRecord.id);
    assert(
      'Manual Attendance Correction',
      'Correction generates a verifiable audit log entry with author and reason',
      auditFound === true,
      'Audit log recorded: true',
      `Audit log recorded: ${auditFound}`
    );

    // Revert back
    db.correctAttendance({
      attendanceRecordId: testTargetRecord.id,
      newStatus: originalStatus,
      changedBy: 'Dr. Ahsan Habib',
      reason: 'Reverting test correction',
      userRole: 'ADMIN',
    });
  }

  // 19. Unauthorized Faculty Attendance Correction Rejection
  const unauthRes = db.correctAttendance({
    courseOfferingId: 'offering-cse-401',
    sessionId: 'sess-cse401-01',
    studentId: 'stu-01',
    newStatus: 'PRESENT',
    changedBy: 'unauthorized_teacher@mbstu.ac.bd',
    teacherId: 'tch-unauthorized-random',
    reason: 'Trying to edit without course assignment',
    userRole: 'TEACHER',
  });
  assert(
    'Manual Attendance Correction',
    'Faculty not assigned to the course must be denied permission to correct attendance',
    unauthRes.success === false,
    'Success: false (Unauthorized)',
    `Success: ${unauthRes.success} (${unauthRes.message})`
  );

  // 20. Hardware Attendance: Unknown Credential Rejection
  const testDevice = db.getHardwareDevices().find(d => d.deviceId === 'DEV-R304-RFID');
  const validDevKey = testDevice?.apiKey || 'mbstu-r304-key-2026';

  const unknownScanRes = db.processHardwareScan({
    deviceId: 'DEV-R304-RFID',
    credentialId: 'UNKNOWN-RFID-HEX-FFFF',
    credentialType: 'RFID',
    timestamp: new Date().toISOString(),
    apiKey: validDevKey,
  });
  assert(
    'Hardware Attendance Module',
    'Unknown RFID card or fingerprint template must be rejected with UNKNOWN_CREDENTIAL',
    unknownScanRes.status === 'UNKNOWN_CREDENTIAL' && unknownScanRes.success === false,
    'Status: UNKNOWN_CREDENTIAL',
    `Status: ${unknownScanRes.status}`
  );

  // 21. Hardware Attendance: Device Security Token Validation
  const unauthorizedDeviceScan = db.processHardwareScan({
    deviceId: 'DEV-R304-RFID',
    credentialId: 'RFID-CS-2023-0101',
    credentialType: 'RFID',
    timestamp: new Date().toISOString(),
    apiKey: 'WRONG_UNAUTHORIZED_TOKEN',
  });
  assert(
    'Hardware Attendance Module',
    'Device scan with invalid API key must be blocked with UNAUTHORIZED status',
    unauthorizedDeviceScan.status === 'UNAUTHORIZED' && unauthorizedDeviceScan.success === false,
    'Status: UNAUTHORIZED',
    `Status: ${unauthorizedDeviceScan.status}`
  );

  // 22. Hardware Attendance: Biometric Student Link & Source Tagging
  const testStudent = db.getStudents()[0];
  const testOffering = db.getCourseOfferings().find(
    o => o.departmentId === testStudent?.departmentId && o.year === testStudent?.year && o.semester === testStudent?.semester
  ) || db.getCourseOfferings()[0];

  if (testStudent && testOffering) {
    db.linkStudentBiometrics({
      studentId: testStudent.id,
      rfidCardUid: 'RFID-UNITTEST-CARD-001',
      fingerprintTemplateId: 'FP-TMPL-UNITTEST-001',
    });

    // Ensure student is actively enrolled
    db.adminOverrideEnrollment({
      studentId: testStudent.id,
      courseOfferingId: testOffering.id,
      action: 'FORCE_ENROLL',
      adminName: 'Admin',
      reason: 'Hardware test setup',
    });

    // Create an active test session for this offering
    const activeTestSession = db.startAttendanceSession({
      courseOfferingId: testOffering.id,
      teacherId: 'tch-01',
      attendanceMethod: 'QR',
      notes: 'Active session for hardware scan testing',
    });

    // First scan -> SUCCESS
    const scan1 = db.processHardwareScan({
      deviceId: 'DEV-R304-RFID',
      credentialId: 'RFID-UNITTEST-CARD-001',
      credentialType: 'RFID',
      timestamp: new Date().toISOString(),
      apiKey: validDevKey,
    });

    assert(
      'Hardware Attendance Module',
      'Valid RFID scan must record attendance with source "rfid"',
      scan1.success === true && scan1.record?.source === 'rfid',
      'Success: true, source: rfid',
      `Success: ${scan1.success}, source: ${scan1.record?.source}`
    );

    // 23. Hardware Attendance: Duplicate Scan Prevention
    const duplicateScan = db.processHardwareScan({
      deviceId: 'DEV-R304-RFID',
      credentialId: 'RFID-UNITTEST-CARD-001',
      credentialType: 'RFID',
      timestamp: new Date().toISOString(),
      apiKey: validDevKey,
    });

    assert(
      'Hardware Attendance Module',
      'Subsequent tap of same card in same session must be blocked as DUPLICATE',
      duplicateScan.status === 'DUPLICATE' && duplicateScan.success === false,
      'Status: DUPLICATE',
      `Status: ${duplicateScan.status}`
    );

    // Clean up test session
    db.closeAttendanceSession(activeTestSession.id);
  }

  // 24. Teacher-Managed Class Count: Adjustment & Validation
  const sampleOffering = db.getCourseOfferings()[0];
  if (sampleOffering) {
    const scheduled = sampleOffering.plannedClasses || 35;
    const initialConducted = sampleOffering.conductedClasses || 10;

    // Over-scheduled rejection
    const overScheduledRes = db.adjustConductedClasses({
      courseOfferingId: sampleOffering.id,
      newConductedCount: scheduled + 5,
      changedBy: 'Faculty Teacher',
      reason: 'Invalid count exceeding scheduled',
      userRole: 'ADMIN',
    });
    assert(
      'Class Count Management',
      'Conducted classes count cannot exceed total scheduled classes',
      overScheduledRes.success === false,
      'Success: false (Exceeds scheduled)',
      `Success: ${overScheduledRes.success}`
    );

    // Negative count rejection
    const negativeRes = db.adjustConductedClasses({
      courseOfferingId: sampleOffering.id,
      newConductedCount: -2,
      changedBy: 'Faculty Teacher',
      reason: 'Negative count test',
      userRole: 'ADMIN',
    });
    assert(
      'Class Count Management',
      'Conducted classes count cannot be negative',
      negativeRes.success === false,
      'Success: false (Negative)',
      `Success: ${negativeRes.success}`
    );

    // Valid adjustment
    const validAdjustRes = db.adjustConductedClasses({
      courseOfferingId: sampleOffering.id,
      newConductedCount: 15,
      changedBy: 'Dr. Ahsan Habib',
      reason: 'Official lecture tally verification after midterm review',
      userRole: 'ADMIN',
    });
    assert(
      'Class Count Management',
      'Valid conducted count adjustment persists and logs to ClassCountAudit',
      validAdjustRes.success === true && sampleOffering.conductedClasses === 15,
      'Conducted: 15',
      `Conducted: ${sampleOffering.conductedClasses}`
    );

    // Attendance percentage calculation uses Conducted Classes (not scheduled)
    const recalculatedAnalytics = computeStudentCourseAnalytics({
      studentId: 'stu-test-calc',
      studentName: 'Calc Student',
      studentRoll: 'ROLL-CALC',
      courseOffering: sampleOffering,
      courseCode: 'CSE-101',
      courseName: 'Test Calc',
      credit: 3,
      courseType: 'THEORY',
      records: [
        { id: 'r1', sessionId: 's1', courseOfferingId: sampleOffering.id, studentId: 'stu-test-calc', timestamp: '', method: 'QR', status: 'PRESENT', minutesLate: 0 },
        { id: 'r2', sessionId: 's2', courseOfferingId: sampleOffering.id, studentId: 'stu-test-calc', timestamp: '', method: 'QR', status: 'PRESENT', minutesLate: 0 },
        { id: 'r3', sessionId: 's3', courseOfferingId: sampleOffering.id, studentId: 'stu-test-calc', timestamp: '', method: 'QR', status: 'PRESENT', minutesLate: 0 },
      ],
    });
    // 3 attended / 15 conducted * 100 = 20.0% (If it used scheduled 35, it would be 8.5%)
    assert(
      'Class Count Management',
      'Attendance percentage strictly uses Conducted Classes (3 / 15 = 20.0%)',
      recalculatedAnalytics.attendancePercentage === 20.0,
      'Attendance %: 20.0%',
      `Attendance %: ${recalculatedAnalytics.attendancePercentage}%`
    );

    // Restore initial conducted count
    db.adjustConductedClasses({
      courseOfferingId: sampleOffering.id,
      newConductedCount: initialConducted,
      changedBy: 'Admin',
      reason: 'Reverting test adjustment',
      userRole: 'ADMIN',
    });
  }

  // 25. Self-Enrollment: Closed Window Rejection
  const windowObj = db.getActiveEnrollmentWindow();
  if (windowObj) {
    db.updateEnrollmentWindow(windowObj.id, { isOpen: false });
    const closedWindowEnrollRes = db.enrollStudentSelf({
      studentId: 'stu-01',
      courseOfferingId: 'offering-cse-101',
    });
    assert(
      'Student Self-Enrollment',
      'Self-enrollment must be blocked when academic registration window is closed',
      closedWindowEnrollRes.success === false,
      'Success: false (Window closed)',
      `Success: ${closedWindowEnrollRes.success} (${closedWindowEnrollRes.message})`
    );

    // Re-open window
    db.updateEnrollmentWindow(windowObj.id, { isOpen: true });
  }

  // 26. Self-Enrollment: Program Isolation
  const cseStudent = db.getStudents().find(s => s.departmentId === 'dept-cse');
  const eeeOffering = db.getCourseOfferings().find(o => o.departmentId === 'dept-eee');
  if (cseStudent && eeeOffering) {
    const crossDeptEnrollRes = db.enrollStudentSelf({
      studentId: cseStudent.id,
      courseOfferingId: eeeOffering.id,
    });
    assert(
      'Student Self-Enrollment',
      'Students cannot self-enroll in courses of another department or academic program',
      crossDeptEnrollRes.success === false,
      'Success: false (Department Mismatch)',
      `Success: ${crossDeptEnrollRes.success}`
    );
  }

  // 27. Self-Enrollment: Drop Course Preserves Prior Attendance History
  const sampleStudent = db.getStudents()[0];
  const dropTestOffering = db.getCourseOfferings()[0];
  if (sampleStudent && dropTestOffering) {
    // Ensure student is actively enrolled
    db.adminOverrideEnrollment({
      studentId: sampleStudent.id,
      courseOfferingId: dropTestOffering.id,
      action: 'FORCE_ENROLL',
      adminName: 'Admin',
      reason: 'Setup test enrollment',
    });

    // Create an attendance record
    const attendanceRecordId = 'rec-preserve-test-' + Date.now();
    const testRecord: AttendanceRecord = {
      id: attendanceRecordId,
      sessionId: 'sess-preserve-test',
      courseOfferingId: dropTestOffering.id,
      studentId: sampleStudent.id,
      timestamp: new Date().toISOString(),
      method: 'MANUAL',
      status: 'PRESENT',
      minutesLate: 0,
    };
    db.getState().attendanceRecords.push(testRecord);

    // Student drops course
    const dropRes = db.dropStudentCourse({
      studentId: sampleStudent.id,
      courseOfferingId: dropTestOffering.id,
      reason: 'Course load adjustment',
    });

    // Check enrollment status is DROPPED
    const enrollment = db.getStudentEnrollments().find(
      e => e.studentId === sampleStudent.id && e.courseOfferingId === dropTestOffering.id
    );

    // Check attendance record still exists in system
    const recordPreserved = db.getAttendanceRecords().some(r => r.id === attendanceRecordId);

    assert(
      'Student Self-Enrollment',
      'Dropping a course marks enrollment as DROPPED and strictly preserves past attendance history',
      dropRes.success === true && enrollment?.status === 'DROPPED' && recordPreserved === true,
      'Status: DROPPED, Record Preserved: true',
      `Status: ${enrollment?.status}, Record Preserved: ${recordPreserved}`
    );
  }
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
  };
}
