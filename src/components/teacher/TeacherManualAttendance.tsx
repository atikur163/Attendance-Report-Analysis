import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Check,
  X,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Users,
  Save,
  Send,
  BookOpen,
  Filter,
} from 'lucide-react';
import { db } from '../../services/db';
import { NotificationService } from '../../services/notificationService';
import { computeStudentCourseAnalytics } from '../../services/attendanceEngine';
import { CourseOffering, Course, Teacher, Student, AttendanceStatus, AttendanceRecord, AttendanceSession } from '../../types';

interface TeacherManualAttendanceProps {
  teacher: Teacher;
  offerings: CourseOffering[];
  courses: Course[];
  students: Student[];
  onRefresh: () => void;
}

export const TeacherManualAttendance: React.FC<TeacherManualAttendanceProps> = ({
  teacher,
  offerings,
  courses,
  students,
  onRefresh,
}) => {
  // Only course offerings assigned to this teacher
  const teacherAssignments = db.getTeacherAssignments().filter(ta => ta.teacherId === teacher.id);
  const teacherOfferingIds = new Set(teacherAssignments.map(ta => ta.courseOfferingId));
  const authorizedOfferings = offerings.filter(o => teacherOfferingIds.has(o.id));

  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(
    authorizedOfferings[0]?.id || offerings[0]?.id || ''
  );
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [sessionTime, setSessionTime] = useState<string>('10:00 AM');
  const [sessionNotes, setSessionNotes] = useState<string>('Manual roll-call attendance');

  // Enrolled students for selected offering
  const enrollments = db.getStudentEnrollments().filter(
    e => e.courseOfferingId === selectedOfferingId && e.status === 'ENROLLED'
  );
  const enrolledStudentIds = new Set(enrollments.map(e => e.studentId));
  const enrolledStudents = students.filter(s => enrolledStudentIds.has(s.id));

  // Attendance map: studentId -> 'PRESENT' | 'ABSENT' | 'LATE'
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize or reset attendance map when offering changes
  useEffect(() => {
    const initialMap: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(st => {
      initialMap[st.id] = 'PRESENT'; // default to present for fast roll call
    });
    setAttendanceMap(initialMap);
  }, [selectedOfferingId, enrolledStudents.length]);

  const selectedOffering = offerings.find(o => o.id === selectedOfferingId);
  const selectedCourse = selectedOffering ? courses.find(c => c.id === selectedOffering.courseId) : null;
  const records = db.getAttendanceRecords();
  const settings = db.getSettings();

  const handleMark = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(st => {
      updated[st.id] = status;
    });
    setAttendanceMap(updated);
  };

  // Quick summary counts
  const presentCount = Object.values(attendanceMap).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(attendanceMap).filter(s => s === 'ABSENT').length;
  const lateCount = Object.values(attendanceMap).filter(s => s === 'LATE').length;
  const totalCount = enrolledStudents.length;

  const handleSubmitAttendance = async () => {
    if (!selectedOffering || totalCount === 0) {
      setSubmitError('No enrolled students available for this course offering.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const recordsToRecord = enrolledStudents.map(st => {
        const stStatus = attendanceMap[st.id] || 'ABSENT';
        return {
          studentId: st.id,
          status: stStatus as AttendanceStatus,
          minutesLate: stStatus === 'LATE' ? settings.lateThresholdMinutes + 5 : 0,
          notes: `Marked manually by ${teacher.name}`,
        };
      });

      // 1. Record session, student records, and increment conducted classes in DB & Firestore
      const { session } = db.recordManualSessionAttendance({
        courseOfferingId: selectedOffering.id,
        teacherId: teacher.id,
        date: sessionDate,
        startTime: sessionTime,
        notes: sessionNotes,
        records: recordsToRecord,
      });

      // 2. Trigger automated < 60% warning evaluation (safely captured)
      let warningInfo = '';
      try {
        const warningRes = await NotificationService.scanAndSendStudentRiskWarnings();
        if (warningRes.warningsSent > 0) {
          warningInfo = ` (${warningRes.warningsSent} risk warning email(s) dispatched)`;
        }
      } catch (warnErr) {
        console.warn('Risk warnings scan notice:', warnErr);
      }

      setSubmitSuccess(
        `Manual attendance recorded for ${totalCount} students (${presentCount} Present, ${absentCount} Absent, ${lateCount} Late). Conducted classes updated to ${selectedOffering.conductedClasses}!${warningInfo}`
      );

      onRefresh();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit manual attendance.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSubmitSuccess(null);
      }, 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration & Selection Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <UserCheck className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-900 text-base">Direct Manual Attendance Sheet</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant check (✓ Present) and cross (✗ Absent) roll-call marking with real-time recalculation
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleMarkAll('PRESENT')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              Mark All Present
            </button>
            <button
              onClick={() => handleMarkAll('ABSENT')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
            >
              Mark All Absent
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Course Offering
            </label>
            <select
              value={selectedOfferingId}
              onChange={e => setSelectedOfferingId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {authorizedOfferings.map(o => {
                const crs = courses.find(c => c.id === o.courseId);
                return (
                  <option key={o.id} value={o.id}>
                    {crs?.code} - {crs?.name} (Sec {o.section})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lecture Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Time Slot
            </label>
            <input
              type="text"
              value={sessionTime}
              onChange={e => setSessionTime(e.target.value)}
              placeholder="e.g. 10:00 AM"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Live Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[11px] text-slate-500 block">Total Cohort</span>
            <span className="text-xl font-black text-slate-900">{totalCount}</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <span className="text-[11px] text-emerald-700 block font-semibold">Marked Present (✓)</span>
            <span className="text-xl font-black text-emerald-800">{presentCount}</span>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
            <span className="text-[11px] text-rose-700 block font-semibold">Marked Absent (✗)</span>
            <span className="text-xl font-black text-rose-800">{absentCount}</span>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <span className="text-[11px] text-amber-700 block font-semibold">Marked Late (⏱)</span>
            <span className="text-xl font-black text-amber-800">{lateCount}</span>
          </div>
        </div>

        {submitError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}
      </div>

      {/* Student Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Enrolled Student Roster ({selectedCourse?.code || 'Selected Course'})
            </h4>
            <p className="text-xs text-slate-500">
              Select status button per student or use batch actions above
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">{enrolledStudents.length} Students</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Roll / Student ID</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Current Attendance %</th>
                <th className="py-3 px-4">Eligibility</th>
                <th className="py-3 px-4 text-center">Status Selection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrolledStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No students currently enrolled in this course offering.
                  </td>
                </tr>
              ) : (
                enrolledStudents.map(st => {
                  const currentStatus = attendanceMap[st.id] || 'PRESENT';

                  // Compute current attendance percentage
                  const studentRecords = records.filter(
                    r => r.courseOfferingId === selectedOfferingId && r.studentId === st.id
                  );
                  const analytics = selectedOffering && selectedCourse
                    ? computeStudentCourseAnalytics({
                        studentId: st.id,
                        studentName: st.name,
                        studentRoll: st.studentId,
                        courseOffering: selectedOffering,
                        courseCode: selectedCourse.code,
                        courseName: selectedCourse.name,
                        credit: selectedCourse.credit,
                        courseType: selectedCourse.type,
                        records: studentRecords,
                        settings,
                      })
                    : null;

                  const isAtRisk = (analytics?.attendancePercentage || 0) < 60.0;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-extrabold font-mono text-indigo-700">
                        {st.studentId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{st.name}</div>
                        <div className="text-[10px] text-slate-400">{st.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            isAtRisk
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {analytics ? analytics.attendancePercentage.toFixed(1) + '%' : '100%'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isAtRisk
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isAtRisk ? 'WARNING (<60%)' : 'ELIGIBLE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleMark(st.id, 'PRESENT')}
                            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'PRESENT'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMark(st.id, 'ABSENT')}
                            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMark(st.id, 'LATE')}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              currentStatus === 'LATE'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Late</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Submit Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Total attendance to record: <strong>{totalCount} students</strong> &bull; Present: <strong className="text-emerald-700">{presentCount}</strong> &bull; Absent: <strong className="text-rose-700">{absentCount}</strong>
          </div>

          <button
            onClick={handleSubmitAttendance}
            disabled={isSubmitting || totalCount === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Recording & Re-evaluating...' : 'Submit Class Attendance'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
