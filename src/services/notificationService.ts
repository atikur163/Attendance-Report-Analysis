/**
 * University Notification & Email Engine
 * Handles automatic teacher routine reminders, student attendance risk warnings,
 * and deduplication logging.
 */

import { computeStudentCourseAnalytics } from './attendanceEngine';
import { db } from './db';

export class NotificationService {
  /**
   * Evaluates routine schedule and sends automated reminder emails to teachers for upcoming/today's classes.
   */
  public static triggerTeacherClassReminders(): { sentCount: number; messages: string[] } {
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
    const settings = db.getSettings();
    const todayStr = new Date().toISOString().split('T')[0];

    let sentCount = 0;
    const messages: string[] = [];

    for (const routine of routines) {
      const teacher = teachers.find(t => t.id === routine.teacherId);
      const offering = offerings.find(o => o.id === routine.courseOfferingId);
      const course = offering ? courses.find(c => c.id === offering.courseId) : undefined;

      if (!teacher || !offering || !course) continue;

      const dedupKey = `REMINDER-${teacher.id}-${offering.id}-${todayStr}-${routine.startTime}`;
      const timingLabel =
        settings.teacherReminderTiming === '15_MIN_BEFORE'
          ? '15 minutes before class'
          : settings.teacherReminderTiming === '30_MIN_BEFORE'
          ? '30 minutes before class'
          : 'at class time';

      const emailSubject = `Upcoming Class Reminder: ${course.code} (${course.name}) at ${routine.startTime}`;
      const emailBody = `Dear ${teacher.name},\n\nThis is an automated reminder that your ${course.name} (${course.code}) class is scheduled today (${todayName}) at ${routine.startTime} in ${routine.room} (${routine.building}).\n\nNotification rule: ${timingLabel}.\nYou can now launch the attendance session (Dynamic QR or Face Recognition) in your Teacher Dashboard.\n\nBest regards,\nOffice of the Registrar & Academic Scheduling\nUniAttend Management System`;

      const added = db.addEmailLog({
        recipientEmail: teacher.email,
        recipientName: teacher.name,
        recipientRole: 'TEACHER',
        type: 'CLASS_REMINDER',
        courseOfferingId: offering.id,
        subject: emailSubject,
        body: emailBody,
        dedupKey,
        status: 'SENT',
      });

      if (added) {
        sentCount++;
        messages.push(`Sent reminder to ${teacher.name} for ${course.code} at ${routine.startTime}`);
      }
    }

    return { sentCount, messages };
  }

  /**
   * Scans all students and course offerings.
   * If a student enters WARNING, HIGH_RISK, or CRITICAL, automatically generates and logs a warning email.
   * Deduplicates by studentId + courseOfferingId + riskLevel so student isn't spammed for the same state.
   */
  public static scanAndSendStudentRiskWarnings(): { warningsSent: number; details: string[] } {
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

        // Trigger warning if in risk condition
        if (analytics.riskLevel !== 'SAFE' && analytics.conductedClasses > 0) {
          const dedupKey = `RISK_WARN-${student.id}-${offering.id}-${analytics.riskLevel}`;

          const urgencyTag =
            analytics.riskLevel === 'CRITICAL'
              ? 'CRITICAL ATTENDANCE ALERT - EXAM INELIGIBILITY'
              : analytics.riskLevel === 'HIGH_RISK'
              ? 'HIGH ATTENDANCE RISK WARNING'
              : 'ATTENDANCE WARNING NOTICE';

          const subject = `${urgencyTag}: ${course.code} (${analytics.attendancePercentage}%)`;
          const body = `Dear ${student.name} (Roll: ${student.studentId}),\n\nThis is an official university academic attendance notification regarding your course:\n\nCourse: ${course.code} - ${course.name}\nDepartment: Computer Science and Engineering\n\nCurrent Attendance: ${analytics.attendancePercentage}%\nMandatory Exam Eligibility Threshold: ${settings.examEligibilityThreshold}%\nExam Eligibility Status: ${analytics.examEligible ? 'ELIGIBLE (AT RISK)' : 'NOT ELIGIBLE (CRITICAL)'}\n\nAcademic Breakdown:\n- Planned Classes: ${analytics.plannedClasses}\n- Conducted Classes: ${analytics.conductedClasses}\n- Effective Present: ${analytics.effectivePresentCount} (Presents: ${analytics.presentCount}, Lates: ${analytics.lateCount}, Penalties: ${analytics.penaltyCount})\n- Remaining Classes: ${analytics.remainingClasses}\n- Minimum Future Classes Required: ${analytics.requiredFutureAttendance}\n- Maximum Possible Attendance: ${analytics.maximumPossibleAttendance}%\n- Recoverability Status: ${analytics.isRecoverable ? 'RECOVERABLE with regular attendance' : 'NOT RECOVERABLE (Cannot reach 60% even with 100% attendance)'}\n\nImportant Academic Rule:\nUnder university regulations, students must maintain at least 60% attendance to be eligible for semester final examinations. ${analytics.penaltyCount > 0 ? `Note that you have accumulated ${analytics.penaltyCount} penalty deduction(s) due to consecutive late attendances.` : ''}\n\nPlease consult your course instructor or academic advisor immediately.\n\nBest regards,\nOffice of Academic Affairs\nUniAttend Management System`;

          const added = db.addEmailLog({
            recipientEmail: student.email,
            recipientName: student.name,
            recipientRole: 'STUDENT',
            type: 'ATTENDANCE_WARNING',
            courseOfferingId: offering.id,
            subject,
            body,
            dedupKey,
            status: 'SENT',
          });

          if (added) {
            warningsSent++;
            details.push(
              `Warning sent to ${student.name} (${student.studentId}) for ${course.code}: ${analytics.riskLevel}`
            );
          }
        }
      }
    }

    return { warningsSent, details };
  }
}
