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

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
  };
}
