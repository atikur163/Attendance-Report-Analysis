/**
 * University Notification & Real Email Dispatch Engine
 * Communicates with server-side SMTP email gateway (/api/email/send)
 * and records real delivery confirmations, failures, and configuration notices in Cloud Firestore.
 */

import { computeStudentCourseAnalytics } from './attendanceEngine';
import { db } from './db';
import { Course, CourseOffering, EmailLog, RoutineEntry, Student, Teacher, StudentCourseAnalytics } from '../types';

export interface EmailDispatchResult {
  success: boolean;
  status: 'SENT' | 'FAILED' | 'CONFIG_REQUIRED';
  message: string;
  error?: string;
}

export class NotificationService {
  /**
   * Dispatches email via secure server-side SMTP endpoint
   */
  private static async dispatchServerEmail(payload: {
    to: string;
    recipientName: string;
    recipientRole: 'TEACHER' | 'STUDENT' | 'ADMIN';
    type: 'CLASS_REMINDER' | 'ATTENDANCE_WARNING' | 'SYSTEM_ALERT' | 'ACCOUNT_CREATED' | 'ROUTINE_CHANGED';
    subject: string;
    text: string;
    html?: string;
    dedupKey: string;
    courseOfferingId?: string;
  }): Promise<EmailDispatchResult> {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      const status: 'SENT' | 'FAILED' | 'CONFIG_REQUIRED' =
        data.status === 'SENT' ? 'SENT' : data.status === 'CONFIG_REQUIRED' ? 'CONFIG_REQUIRED' : 'FAILED';

      // Log in local DB / Cloud Firestore
      db.addEmailLog({
        recipientEmail: payload.to,
        recipientName: payload.recipientName,
        recipientRole: payload.recipientRole,
        type: payload.type,
        courseOfferingId: payload.courseOfferingId,
        subject: payload.subject,
        body: payload.text,
        dedupKey: payload.dedupKey,
        status,
        error: data.error || (status === 'CONFIG_REQUIRED' ? data.message : undefined),
      });

      return {
        success: data.success === true,
        status,
        message: data.message || (data.success ? 'Email delivered successfully' : 'Failed to deliver email'),
        error: data.error,
      };
    } catch (err: any) {
      console.warn('Backend email API unreachable, logging state locally:', err);
      const fallbackNotice: EmailDispatchResult = {
        success: false,
        status: 'CONFIG_REQUIRED',
        message: 'Email service deferred: Backend SMTP credentials pending in .env',
        error: err.message,
      };

      db.addEmailLog({
        recipientEmail: payload.to,
        recipientName: payload.recipientName,
        recipientRole: payload.recipientRole,
        type: payload.type,
        courseOfferingId: payload.courseOfferingId,
        subject: payload.subject,
        body: payload.text,
        dedupKey: payload.dedupKey,
        status: 'CONFIG_REQUIRED',
        error: err.message,
      });

      return fallbackNotice;
    }
  }

  /**
   * Automatic Teacher Account Notification Email
   * Dispatches teacher account credentials, ID, assigned courses, and routine schedule
   */
  public static async sendTeacherAccountCreatedEmail(params: {
    teacher: Teacher;
    temporaryPassword: string;
    assignedCourses: Course[];
    routineEntries: RoutineEntry[];
  }): Promise<EmailDispatchResult> {
    const { teacher, temporaryPassword, assignedCourses, routineEntries } = params;
    const appUrl = window.location.origin;

    const courseListText =
      assignedCourses.length > 0
        ? assignedCourses.map(c => `• ${c.code}: ${c.name} (${c.type}, ${c.credit} Credits)`).join('\n')
        : '• No courses currently assigned. Course offerings will be assigned by the administrator.';

    const scheduleText =
      routineEntries.length > 0
        ? routineEntries
            .map(r => `• ${r.dayOfWeek}: ${r.startTime} - ${r.endTime} | Room ${r.room} (${r.building})`)
            .join('\n')
        : '• Class timetable has not been published yet. You will receive an automated schedule notification as soon as the routine is finalized.';

    const subject = `Welcome to UniAttend MBSTU - Faculty Account Credentials for ${teacher.name}`;
    const text = `Dear ${teacher.name},\n\nYour faculty account has been created in the University Attendance and Analytics System (UniAttend).\n\nAccount Credentials & Profile:\n• Faculty ID / Code: ${teacher.teacherId}\n• Designation: ${teacher.designation}\n• Registered Email: ${teacher.email}\n• Temporary Password: ${temporaryPassword}\n• Access Portal: ${appUrl}\n\nImportant Security Notice:\nYou will be required to change your temporary password upon your first successful login.\n\nAssigned Courses:\n${courseListText}\n\nClass Schedule:\n${scheduleText}\n\nIf you have any questions, please reach out to the Department Administration.\n\nBest regards,\nOffice of Academic Affairs & Registrar\nMawlana Bhashani Science and Technology University`;

    const dedupKey = `ACC_CREATE_TCH_${teacher.id}_${Date.now()}`;

    return this.dispatchServerEmail({
      to: teacher.email,
      recipientName: teacher.name,
      recipientRole: 'TEACHER',
      type: 'ACCOUNT_CREATED',
      subject,
      text,
      dedupKey,
    });
  }

  /**
   * Automatic Student Account Notification Email
   */
  public static async sendStudentAccountCreatedEmail(params: {
    student: Student;
    temporaryPassword: string;
    departmentName: string;
    batchName: string;
  }): Promise<EmailDispatchResult> {
    const { student, temporaryPassword, departmentName, batchName } = params;
    const appUrl = window.location.origin;

    const subject = `UniAttend MBSTU - Student Account Setup for ${student.name} (${student.studentId})`;
    const text = `Dear ${student.name},\n\nYour official student attendance account is now registered in the Mawlana Bhashani Science and Technology University Attendance System.\n\nAccount Details:\n• Student Roll / ID: ${student.studentId}\n• Department: ${departmentName}\n• Batch: ${batchName}\n• Year ${student.year}, Semester ${student.semester}, Section ${student.section}\n• Registered Email: ${student.email}\n• Temporary Password: ${temporaryPassword}\n• Access Portal: ${appUrl}\n\nSecurity Notice:\nYou are required to update your temporary password after logging in for the first time.\nPlease register your biometric face profile or use your student QR pass for lecture attendances.\n\nBest regards,\nOffice of the Registrar\nMBSTU`;

    const dedupKey = `ACC_CREATE_STU_${student.id}_${Date.now()}`;

    return this.dispatchServerEmail({
      to: student.email,
      recipientName: student.name,
      recipientRole: 'STUDENT',
      type: 'ACCOUNT_CREATED',
      subject,
      text,
      dedupKey,
    });
  }

  /**
   * Routine Schedule Change / Reschedule Notification
   */
  public static async sendRoutineChangedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    recipientRole: 'TEACHER' | 'STUDENT';
    courseCode: string;
    courseName: string;
    oldSchedule: string;
    newSchedule: string;
    notes?: string;
  }): Promise<EmailDispatchResult> {
    const { recipientEmail, recipientName, recipientRole, courseCode, courseName, oldSchedule, newSchedule, notes } =
      params;

    const subject = `Routine Update Notice: ${courseCode} (${courseName})`;
    const text = `Dear ${recipientName},\n\nPlease be advised that the class timetable for ${courseCode} (${courseName}) has been updated by the academic administration.\n\nSchedule Details:\n• Previous Schedule: ${oldSchedule}\n• New Updated Schedule: ${newSchedule}\n${notes ? `• Note: ${notes}\n` : ''}\nPlease refer to your dashboard for your latest timetable.\n\nBest regards,\nOffice of Academic Affairs\nUniAttend MBSTU`;

    const dedupKey = `ROUTINE_CHG_${recipientEmail}_${Date.now()}`;

    return this.dispatchServerEmail({
      to: recipientEmail,
      recipientName,
      recipientRole,
      type: 'ROUTINE_CHANGED',
      subject,
      text,
      dedupKey,
    });
  }

  /**
   * Automatic Teacher Class Reminder (10 Minutes Before Class)
   */
  public static async triggerTeacherClassReminders(): Promise<{ sentCount: number; messages: string[] }> {
    const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()) as
      | 'Sunday'
      | 'Monday'
      | 'Tuesday'
      | 'Wednesday'
      | 'Thursday'
      | 'Friday'
      | 'Saturday';

    const routines = db.getRoutines().filter(r => r.dayOfWeek === todayName);
    const teachers = db.getTeachers();
    const offerings = db.getCourseOfferings();
    const courses = db.getCourses();
    const enrollments = db.getStudentEnrollments();
    const todayStr = new Date().toISOString().split('T')[0];

    let sentCount = 0;
    const messages: string[] = [];

    for (const routine of routines) {
      const teacher = teachers.find(t => t.id === routine.teacherId);
      const offering = offerings.find(o => o.id === routine.courseOfferingId);
      const course = offering ? courses.find(c => c.id === offering.courseId) : undefined;

      if (!teacher || !offering || !course) continue;

      const enrolledCount = enrollments.filter(
        e => e.courseOfferingId === offering.id && e.status === 'ENROLLED'
      ).length;

      const dedupKey = `REMINDER-${teacher.id}-${offering.id}-${todayStr}-${routine.startTime}`;

      const subject = `[Class in 10 Min] Reminder: ${course.code} (${course.name}) at ${routine.startTime}`;
      const text = `Dear ${teacher.name},\n\nYour upcoming lecture is scheduled to start in 10 minutes:\n\n• Course: ${course.code} - ${course.name}\n• Time: ${routine.startTime} - ${routine.endTime}\n• Venue: Room ${routine.room} (${routine.building})\n• Enrolled Cohort: ${enrolledCount} students\n\nYou can launch the attendance session (Dynamic Rolling QR Code or Biometric Face Recognition) directly in your faculty dashboard:\n${window.location.origin}\n\nHave a great lecture!\n\nBest regards,\nAcademic Scheduling Office\nUniAttend MBSTU`;

      const result = await this.dispatchServerEmail({
        to: teacher.email,
        recipientName: teacher.name,
        recipientRole: 'TEACHER',
        type: 'CLASS_REMINDER',
        courseOfferingId: offering.id,
        subject,
        text,
        dedupKey,
      });

      if (result.status === 'SENT') {
        sentCount++;
        messages.push(`Delivered reminder to ${teacher.name} for ${course.code} (${routine.startTime})`);
      } else if (result.status === 'CONFIG_REQUIRED') {
        messages.push(`Reminder queued for ${teacher.name} (SMTP setup pending)`);
      }
    }

    return { sentCount, messages };
  }

  /**
   * Generates official notification email text containing all 8 required metrics
   */
  public static buildEarlyWarningEmailText(params: {
    student: Student;
    departmentName: string;
    course: Course;
    analytics: ReturnType<typeof computeStudentCourseAnalytics>;
    isMilestone50?: boolean;
  }): { subject: string; text: string } {
    const { student, departmentName, course, analytics, isMilestone50 } = params;

    const totalHeld = analytics.conductedClasses;
    const attended = analytics.effectivePresentCount;
    const currentRate = analytics.attendancePercentage.toFixed(1);
    const totalScheduled = analytics.plannedClasses;
    const remaining = analytics.remainingClasses;
    const minNeeded = analytics.minAdditionalClassesToPass;
    const isPossible = analytics.canReach60;
    const status = analytics.projectedExamStatus;

    const prefix = isMilestone50 ? '⚠️ [50% MIDPOINT EARLY WARNING]' : '⚠️ [ATTENDANCE WARNING]';

    const subject = `${prefix} ${course.code}: ${
      status === 'PROJECTED_INELIGIBLE'
        ? 'Mathematically Ineligible for Examination'
        : '60% Attendance Exam Risk Notice'
    } - ${student.studentId}`;

    let feasibilityExplanation = '';
    if (!isPossible) {
      feasibilityExplanation = `• Mathematical Feasibility: IMPOSSIBLE (Even if you attend 100% of all ${remaining} remaining classes, your maximum possible attendance will only be ${analytics.maximumPossibleAttendance}%, which is below the mandatory 60.0% threshold).`;
    } else if (minNeeded > 0) {
      feasibilityExplanation = `• Mathematical Feasibility: POSSIBLE (You can reach 60% by attending at least ${minNeeded} of the ${remaining} remaining classes).`;
    } else {
      feasibilityExplanation = `• Mathematical Feasibility: SECURED (You have already satisfied the minimum required attendances for this course).`;
    }

    let statusDescription = '';
    if (status === 'PROJECTED_INELIGIBLE') {
      statusDescription = 'PROJECTED INELIGIBLE / STRICTLY BARRED FROM FINAL EXAM';
    } else if (status === 'AT_RISK') {
      statusDescription = analytics.attendancePercentage < 60
        ? 'CURRENTLY INELIGIBLE (<60%) - AT SEVERE RISK (ACTION REQUIRED)'
        : 'AT RISK - Attendance buffer is low, missing upcoming classes will cause exam disqualification';
    } else {
      statusDescription = 'ELIGIBLE (Currently on track for examination)';
    }

    const text = `Dear ${student.name} (Roll / ID: ${student.studentId}),

This is an official university academic attendance notification from the Office of Academic Affairs regarding your course:

Course: ${course.code} - ${course.name}
Department: ${departmentName}
Academic Milestone: ${isMilestone50 ? '50% Course Progress Milestone Reached' : 'Mid-Semester Attendance Review'}

============================================================
ACADEMIC ATTENDANCE & EXAMINATION ELIGIBILITY METRICS:
============================================================
1. Total Classes Held So Far: ${totalHeld}
2. Number of Classes Attended: ${attended} (Present: ${analytics.presentCount}, Late: ${analytics.lateCount}, Penalties: ${analytics.penaltyCount})
3. Current Attendance Percentage: ${currentRate}%
4. Total Classes Scheduled for Entire Course: ${totalScheduled}
5. Remaining Classes to be Conducted: ${remaining}
6. Minimum Additional Classes You Must Attend to Reach 60%: ${minNeeded}
7. Mathematical Possibility to Reach 60%: ${isPossible ? 'YES - ATTAINABLE' : 'NO - MATHEMATICALLY BARRED'}
${feasibilityExplanation}
8. Examination Eligibility Status: ${statusDescription}
============================================================

MANDATORY UNIVERSITY REGULATION:
Under university regulations, every student must maintain at least 60.0% attendance in each course to be eligible to sit for the semester final examinations. Students who fail to reach 60% are strictly barred from the exams.

${
  !isPossible
    ? 'CRITICAL ADVISORY: You have become mathematically unable to reach 60% attendance in this course. You must contact your course teacher, head of department, or academic advisor immediately regarding academic probation policies.'
    : minNeeded > 0
    ? `URGENT ACTION REQUIRED: You must attend at least ${minNeeded} more classes without unexcused absences to ensure your exam eligibility. Please attend all upcoming sessions.`
    : 'Keep up your consistent attendance to maintain your exam eligibility.'
}

Best regards,
Office of Academic Affairs & Controller of Examinations
Mawlana Bhashani Science and Technology University (MBSTU)`;

    return { subject, text };
  }

  /**
   * Automatic Student Attendance Warning Email (< 60% or At Risk)
   */
  public static async scanAndSendStudentRiskWarnings(): Promise<{ warningsSent: number; details: string[] }> {
    return this.triggerHalfwayCourseEarlyWarnings();
  }

  /**
   * Trigger Early Warning Inspection for Courses After ~50% of Classes Have Been Held (Section 2)
   * Also covers any course offering or specific offering passed as argument.
   */
  public static async triggerHalfwayCourseEarlyWarnings(targetOfferingId?: string): Promise<{
    warningsSent: number;
    inspectedCount: number;
    atRiskCount: number;
    ineligibleCount: number;
    details: string[];
  }> {
    const students = db.getStudents();
    const enrollments = db.getStudentEnrollments();
    const offerings = db.getCourseOfferings();
    const courses = db.getCourses();
    const records = db.getAttendanceRecords();
    const departments = db.getDepartments();
    const settings = db.getSettings();

    let warningsSent = 0;
    let inspectedCount = 0;
    let atRiskCount = 0;
    let ineligibleCount = 0;
    const details: string[] = [];

    // Filter target offerings
    const relevantOfferings = targetOfferingId
      ? offerings.filter(o => o.id === targetOfferingId)
      : offerings;

    for (const offering of relevantOfferings) {
      const course = courses.find(c => c.id === offering.courseId);
      if (!course) continue;

      const isHalfway = offering.conductedClasses >= Math.floor((offering.plannedClasses || 35) * 0.50);

      // We inspect offerings if explicitly targeted, or if they have reached approx 50% milestone, or have held classes
      if (!targetOfferingId && !isHalfway && offering.conductedClasses < 1) {
        continue;
      }

      const offeringEnrollments = enrollments.filter(
        e => e.courseOfferingId === offering.id && e.status === 'ENROLLED'
      );

      for (const enr of offeringEnrollments) {
        const student = students.find(s => s.id === enr.studentId);
        if (!student) continue;

        inspectedCount++;

        const courseRecords = records.filter(
          r => r.courseOfferingId === offering.id && r.studentId === student.id
        );

        const analytics = computeStudentCourseAnalytics({
          studentId: student.id,
          studentName: student.name,
          studentRoll: student.studentId,
          courseOffering: offering,
          courseCode: course.code,
          courseName: course.name,
          credit: course.credit,
          courseType: course.type,
          records: courseRecords,
          settings,
        });

        const isBelow60 = analytics.attendancePercentage < 60.0;
        const isBarred = !analytics.canReach60;
        const isAtRisk = analytics.projectedExamStatus === 'AT_RISK';

        if (isBarred) ineligibleCount++;
        else if (isAtRisk || isBelow60) atRiskCount++;

        // Send warning if student is below 60%, at risk, or mathematically barred
        if (isBelow60 || isBarred || isAtRisk) {
          const dept = departments.find(d => d.id === student.departmentId);
          const deptName = dept?.name || 'Academic Department';

          const { subject, text } = this.buildEarlyWarningEmailText({
            student,
            departmentName: deptName,
            course,
            analytics,
            isMilestone50: isHalfway,
          });

          const dedupKey = `EARLY_WARN_${student.id}_${offering.id}_${analytics.conductedClasses}_${analytics.attendancePercentage.toFixed(0)}`;

          const result = await this.dispatchServerEmail({
            to: student.email,
            recipientName: student.name,
            recipientRole: 'STUDENT',
            type: 'ATTENDANCE_WARNING',
            courseOfferingId: offering.id,
            subject,
            text,
            dedupKey,
          });

          if (result.status === 'SENT') {
            warningsSent++;
            details.push(
              `Delivered warning to ${student.name} (${student.studentId}) for ${course.code}: ${analytics.attendancePercentage.toFixed(1)}% (${analytics.projectedExamStatus})`
            );
          } else {
            details.push(
              `Warning queued for ${student.name} for ${course.code} (${result.status}: ${analytics.attendancePercentage.toFixed(1)}%)`
            );
          }
        }
      }
    }

    return {
      warningsSent,
      inspectedCount,
      atRiskCount,
      ineligibleCount,
      details,
    };
  }

  /**
   * Send early warning notice to a single student for a specific course offering
   */
  public static async sendIndividualEarlyWarning(
    target: string | StudentCourseAnalytics,
    courseOfferingId?: string
  ): Promise<EmailDispatchResult> {
    const sId = typeof target === 'string' ? target : target.studentId;
    const offId = typeof target === 'string' ? (courseOfferingId || '') : target.courseOfferingId;

    const student = db.getStudents().find(s => s.id === sId);
    const offering = db.getCourseOfferings().find(o => o.id === offId);
    if (!student || !offering) {
      return { success: false, status: 'FAILED', message: 'Student or course offering not found' };
    }

    const course = db.getCourses().find(c => c.id === offering.courseId);
    if (!course) {
      return { success: false, status: 'FAILED', message: 'Course details not found' };
    }

    const records = db
      .getAttendanceRecords()
      .filter(r => r.courseOfferingId === offering.id && r.studentId === student.id);
    const settings = db.getSettings();
    const dept = db.getDepartments().find(d => d.id === student.departmentId);

    const analytics = computeStudentCourseAnalytics({
      studentId: student.id,
      studentName: student.name,
      studentRoll: student.studentId,
      courseOffering: offering,
      courseCode: course.code,
      courseName: course.name,
      credit: course.credit,
      courseType: course.type,
      records,
      settings,
    });

    const isHalfway = offering.conductedClasses >= Math.floor((offering.plannedClasses || 35) * 0.50);

    const { subject, text } = this.buildEarlyWarningEmailText({
      student,
      departmentName: dept?.name || 'Department of Computer Science and Engineering',
      course,
      analytics,
      isMilestone50: isHalfway,
    });

    const dedupKey = `SINGLE_WARN_${student.id}_${offering.id}_${Date.now()}`;

    return this.dispatchServerEmail({
      to: student.email,
      recipientName: student.name,
      recipientRole: 'STUDENT',
      type: 'ATTENDANCE_WARNING',
      courseOfferingId: offering.id,
      subject,
      text,
      dedupKey,
    });
  }

  /**
   * Retry single email dispatch from log ID
   */
  public static async retryEmail(emailLogId: string): Promise<EmailDispatchResult> {
    const log = db.getEmailLogs().find(l => l.id === emailLogId);
    if (!log) {
      return { success: false, status: 'FAILED', message: 'Email log not found.' };
    }

    try {
      const response = await fetch('/api/email/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: emailLogId }),
      });

      const data = await response.json();
      if (data.success && data.status === 'SENT') {
        db.updateEmailLog(emailLogId, { status: 'SENT', error: undefined, sentAt: new Date().toISOString() });
        return { success: true, status: 'SENT', message: `Delivered to ${log.recipientEmail}` };
      } else {
        return { success: false, status: data.status || 'FAILED', message: data.message || 'Retry failed' };
      }
    } catch (err: any) {
      return { success: false, status: 'FAILED', message: err.message };
    }
  }
}
