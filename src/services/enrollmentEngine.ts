/**
 * Centralized University Course Enrollment & Eligibility Validation Engine
 * Authoritative single source of truth for academic enrollment rules,
 * cross-department isolation, cohort matching, and duplicate prevention.
 */

import { Student, CourseOffering, Course, StudentEnrollment, Department, Batch } from '../types';

export type IneligibilityCode =
  | 'ELIGIBLE'
  | 'ALREADY_ENROLLED'
  | 'DEPARTMENT_MISMATCH'
  | 'BATCH_MISMATCH'
  | 'LEVEL_MISMATCH'
  | 'INACTIVE_STUDENT'
  | 'INACTIVE_OFFERING';

export interface EnrollmentEligibilityResult {
  eligible: boolean;
  code: IneligibilityCode;
  reason?: string;
}

export interface EligibilityOptions {
  allowCrossBatch?: boolean; // When true, permits students from other batches of the SAME department (e.g. retakes/improvements)
}

/**
 * Validates whether a student is eligible to enroll in a specific course offering.
 * Enforces:
 * 1. Active student account status
 * 2. Active course offering status
 * 3. Prevention of duplicate enrollments
 * 4. Department compatibility (Student dept must match course offering dept)
 * 5. Cohort batch compatibility (or authorized cross-batch/retake exception)
 * 6. Academic level (Year & Semester) compatibility
 */
export function checkStudentCourseEligibility(
  student: Student,
  offering: CourseOffering,
  course?: Course,
  enrollments: StudentEnrollment[] = [],
  departments: Department[] = [],
  batches: Batch[] = [],
  options: EligibilityOptions = {}
): EnrollmentEligibilityResult {
  // 1. Student Status
  if (student.status !== 'ACTIVE') {
    return {
      eligible: false,
      code: 'INACTIVE_STUDENT',
      reason: `Student account is inactive (${student.status}). Active enrollment requires an active account status.`,
    };
  }

  // 2. Course Offering Status
  if (offering.status !== 'ACTIVE') {
    return {
      eligible: false,
      code: 'INACTIVE_OFFERING',
      reason: `Course offering is currently marked as ${offering.status}. New enrollments are closed.`,
    };
  }

  // 3. Duplicate Enrollment Check
  const alreadyEnrolled = enrollments.some(
    e => e.studentId === student.id && e.courseOfferingId === offering.id && e.status === 'ENROLLED'
  );
  if (alreadyEnrolled) {
    return {
      eligible: false,
      code: 'ALREADY_ENROLLED',
      reason: `Student is already enrolled in this course offering.`,
    };
  }

  // 4. Department Compatibility Check
  const offeringDeptId = offering.departmentId || course?.departmentId;
  if (offeringDeptId && student.departmentId !== offeringDeptId) {
    const studentDept = departments.find(d => d.id === student.departmentId);
    const offeringDept = departments.find(d => d.id === offeringDeptId);
    const studentDeptCode = studentDept ? studentDept.code : student.departmentId;
    const offeringDeptCode = offeringDept ? offeringDept.code : offeringDeptId;

    return {
      eligible: false,
      code: 'DEPARTMENT_MISMATCH',
      reason: `Department Mismatch: Student belongs to ${studentDeptCode}, but this course is offered by ${offeringDeptCode}. Cross-department enrollment is restricted.`,
    };
  }

  // 5. Batch & Cohort Compatibility Check
  if (offering.batchId && student.batchId !== offering.batchId) {
    if (!options.allowCrossBatch) {
      const studentBatch = batches.find(b => b.id === student.batchId);
      const offeringBatch = batches.find(b => b.id === offering.batchId);
      const studentBatchName = studentBatch ? studentBatch.name : student.batchId;
      const offeringBatchName = offeringBatch ? offeringBatch.name : offering.batchId;

      return {
        eligible: false,
        code: 'BATCH_MISMATCH',
        reason: `Batch Mismatch: Student is in ${studentBatchName}, but offering is scheduled for ${offeringBatchName}. (Enable Cross-Batch/Retake mode if authorized).`,
      };
    }
  }

  // 6. Academic Year and Semester Compatibility Check
  if (!options.allowCrossBatch) {
    if (student.year !== offering.year || student.semester !== offering.semester) {
      return {
        eligible: false,
        code: 'LEVEL_MISMATCH',
        reason: `Level Mismatch: Student is at Year ${student.year} Sem ${student.semester}, but course offering is designed for Year ${offering.year} Sem ${offering.semester}.`,
      };
    }
  }

  return {
    eligible: true,
    code: 'ELIGIBLE',
    reason: 'Student meets all academic department, batch, and level eligibility criteria.',
  };
}

/**
 * Filter and categorize all students for an offering.
 */
export function getOfferingEnrollmentBreakdown(params: {
  offering: CourseOffering;
  course?: Course;
  students: Student[];
  enrollments: StudentEnrollment[];
  departments: Department[];
  batches: Batch[];
  options?: EligibilityOptions;
}): {
  enrolledStudents: Student[];
  eligibleStudents: Student[];
  ineligibleEvaluations: Array<{ student: Student; evaluation: EnrollmentEligibilityResult }>;
  totalInDepartment: number;
  totalInCohort: number;
} {
  const { offering, course, students, enrollments, departments, batches, options = {} } = params;

  const currentOfferingEnrollments = enrollments.filter(
    e => e.courseOfferingId === offering.id && e.status === 'ENROLLED'
  );
  const enrolledStudentIds = new Set(currentOfferingEnrollments.map(e => e.studentId));

  const enrolledStudents = students.filter(s => enrolledStudentIds.has(s.id));
  const eligibleStudents: Student[] = [];
  const ineligibleEvaluations: Array<{ student: Student; evaluation: EnrollmentEligibilityResult }> = [];

  const offeringDeptId = offering.departmentId || course?.departmentId;

  let totalInDepartment = 0;
  let totalInCohort = 0;

  for (const s of students) {
    if (s.departmentId === offeringDeptId) {
      totalInDepartment++;
      if (s.batchId === offering.batchId) {
        totalInCohort++;
      }
    }

    if (enrolledStudentIds.has(s.id)) {
      continue; // Already counted in enrolledStudents
    }

    const evaluation = checkStudentCourseEligibility(
      s,
      offering,
      course,
      enrollments,
      departments,
      batches,
      options
    );

    if (evaluation.eligible) {
      eligibleStudents.push(s);
    } else {
      ineligibleEvaluations.push({ student: s, evaluation });
    }
  }

  return {
    enrolledStudents,
    eligibleStudents,
    ineligibleEvaluations,
    totalInDepartment,
    totalInCohort,
  };
}
