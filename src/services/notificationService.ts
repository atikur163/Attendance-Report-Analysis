/**
 * University Notification & Real Email Dispatch Engine
 * Communicates with server-side SMTP email gateway (/api/email/send)
 * and records real delivery confirmations, failures, and configuration notices in Cloud Firestore.
 */

import { computeStudentCourseAnalytics } from './attendanceEngine';
import { db } from './db';
import { Course, CourseOffering, EmailLog, RoutineEntry, Student, Teacher } from '../types';

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
   * Automatic Student Attendance Warning Email (< 60%)
   * Formula: Required Classes = Math.max(0, Math.ceil((0.60 * Total Held - Attended) / 0.40))
   */
  public static async scanAndSendStudentRiskWarnings(): Promise<{ warningsSent: number; details: string[] }> {
    const students = db.getStudents();
    const enrollments = db.getStudentEnrollments();
    const offerings = db.getCourseOfferings();
    const courses = db.getCourses();
    const records = db.getAttendanceRecords();
    const settings = db.getSettings();

    let warningsSent = 0;
    const details: string[] = [];

    for (const student of students) {
      const studentEnrs = enrollments.filter(e => e.studentId === student.id && e.status === 'ENROLLED');

      for (const enr of studentEnrs) {
        const offering = offerings.find(o => o.id === enr.courseOfferingId);
        if (!offering) continue;
        const course = courses.find(c => c.id === offering.courseId);
        if (!course) continue;

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

        // Trigger warning if attendance < 60% and at least 1 class has been held
        const totalHeld = analytics.conductedClasses;
        const attended = analytics.presentCount;
        const isBelowThreshold = analytics.attendancePercentage < 60.0 && totalHeld > 0;

        if (isBelowThreshold) {
          // Exact formula requested: Required Classes = max(0, ceil((0.60 * Total Held - Attended) / 0.40))
          const requiredToRecover = Math.max(
            0,
            Math.ceil((0.60 * totalHeld - attended) / 0.40)
          );

          const dedupKey = `RISK_WARN_${student.id}_${offering.id}_${analytics.attendancePercentage}_${totalHeld}`;

          const subject = `⚠️ URGENT ATTENDANCE WARNING (<60%): ${course.code} - Exam Ineligibility Notice`;
          const text = `Dear ${student.name} (Roll / ID: ${student.studentId}),\n\nThis is an official university academic attendance notification regarding your course:\n\nCourse: ${course.code} - ${course.name}\nDepartment: Computer Science and Engineering\n\nCurrent Attendance: ${analytics.attendancePercentage.toFixed(1)}%\nMandatory Exam Eligibility Threshold: 60.0%\n\nAcademic Breakdown:\n• Total Classes Held: ${totalHeld}\n• Classes Attended: ${attended} (Present: ${analytics.presentCount}, Late: ${analytics.lateCount})\n• Classes Missed: ${analytics.absentCount}\n• Mandatory Next Consecutive Classes Required to Reach 60%: ${requiredToRecover}\n• Examination Eligibility Status: NOT ELIGIBLE AT CURRENT ATTENDANCE\n\nImportant University Regulation:\nUnder university academic policy, any student whose final course attendance falls below 60.0% is disqualified from sitting for the semester final examinations.\n\nPlease attend all upcoming lectures without fail and consult your course teacher or academic advisor immediately.\n\nBest regards,\nOffice of Academic Affairs & Examination Control\nMawlana Bhashani Science and Technology University`;

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
            details.push(`Warning sent to ${student.name} (${student.studentId}) for ${course.code}: ${analytics.attendancePercentage.toFixed(1)}%`);
          } else {
            details.push(`Warning queued for ${student.name} for ${course.code} (${result.status})`);
          }
        }
      }
    }

    return { warningsSent, details };
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
