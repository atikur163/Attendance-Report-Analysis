import React, { useState, useEffect, useMemo } from 'react';
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
  Edit2,
  History,
  ShieldCheck,
  Info,
  CheckSquare,
  Square,
  Search,
} from 'lucide-react';
import { db } from '../../services/db';
import { NotificationService } from '../../services/notificationService';
import { computeStudentCourseAnalytics } from '../../services/attendanceEngine';
import {
  CourseOffering,
  Course,
  Teacher,
  Student,
  AttendanceStatus,
  AttendanceRecord,
  AttendanceSession,
  AttendanceCorrectionAudit,
} from '../../types';

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
  // Helper to match teacher identity across both unique entity ID and teacherId code
  const teacherIdMatches = (tid?: string) =>
    Boolean(tid && teacher && (tid === teacher.id || tid === teacher.teacherId));

  const teacherAssignments = db.getTeacherAssignments().filter(ta => teacherIdMatches(ta.teacherId));
  const routines = db.getRoutines().filter(r => teacherIdMatches(r.teacherId));

  const teacherOfferingIds = new Set<string>();
  teacherAssignments.forEach(ta => teacherOfferingIds.add(ta.courseOfferingId));
  routines.forEach(r => {
    if (r.courseOfferingId) teacherOfferingIds.add(r.courseOfferingId);
  });
  if (teacher.authorizedCourseIds?.length) {
    offerings.forEach(o => {
      if (teacher.authorizedCourseIds.includes(o.courseId)) {
        teacherOfferingIds.add(o.id);
      }
    });
  }

  const authorizedOfferings = offerings.filter(o => teacherOfferingIds.has(o.id));

  // Main Mode: Take New Roll Call vs. Correct Past Attendance vs. View Audit Trail
  const [activeMode, setActiveMode] = useState<'roll_call' | 'correction' | 'audits'>('roll_call');

  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(
    authorizedOfferings[0]?.id || offerings[0]?.id || ''
  );

  // New Roll Call Form State
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [sessionTime, setSessionTime] = useState<string>('10:00 AM');
  const [sessionNotes, setSessionNotes] = useState<string>('Manual roll-call attendance');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Correction Mode State
  const [selectedSessionId, setSelectedSessionId] = useState<string>('ALL');
  const [correctionSearch, setCorrectionSearch] = useState('');
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<{
    student: Student;
    record?: AttendanceRecord;
  } | null>(null);
  const [editTargetStatus, setEditTargetStatus] = useState<AttendanceStatus>('PRESENT');
  const [editReason, setEditReason] = useState('Attended lecture, verified in person');
  const [correctionMsg, setCorrectionMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Bulk Edit State
  const [selectedStudentIdsForBulk, setSelectedStudentIdsForBulk] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('PRESENT');
  const [bulkReason, setBulkReason] = useState('Bulk attendance correction by instructor');

  // Enrolled students for selected offering
  const enrollments = db.getStudentEnrollments().filter(
    e => e.courseOfferingId === selectedOfferingId && e.status === 'ENROLLED'
  );
  const enrolledStudentIds = useMemo(() => new Set(enrollments.map(e => e.studentId)), [enrollments]);
  const enrolledStudents = useMemo(() => students.filter(s => enrolledStudentIds.has(s.id)), [students, enrolledStudentIds]);

  // Sessions for this offering
  const offeringSessions = useMemo(() => {
    return db.getAttendanceSessions().filter(s => s.courseOfferingId === selectedOfferingId);
  }, [selectedOfferingId]);

  // All attendance records for this offering
  const offeringRecords = useMemo(() => {
    return db.getAttendanceRecords().filter(r => r.courseOfferingId === selectedOfferingId);
  }, [selectedOfferingId]);

  // Correction audits for this offering
  const offeringAudits = useMemo(() => {
    return db.getAttendanceCorrections().filter(a => a.courseOfferingId === selectedOfferingId);
  }, [selectedOfferingId]);

  // Initialize or reset attendance map when offering changes
  useEffect(() => {
    const initialMap: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(st => {
      initialMap[st.id] = 'PRESENT';
    });
    setAttendanceMap(initialMap);
    setSelectedStudentIdsForBulk(new Set());
  }, [selectedOfferingId, enrolledStudents.length]);

  const selectedOffering = offerings.find(o => o.id === selectedOfferingId);
  const selectedCourse = selectedOffering ? courses.find(c => c.id === selectedOffering.courseId) : null;
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

  // Quick summary counts for roll call
  const presentCount = Object.values(attendanceMap).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(attendanceMap).filter(s => s === 'ABSENT').length;
  const lateCount = Object.values(attendanceMap).filter(s => s === 'LATE').length;
  const totalCount = enrolledStudents.length;

  // Submit New Roll Call
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

      const { session } = db.recordManualSessionAttendance({
        courseOfferingId: selectedOffering.id,
        teacherId: teacher.id,
        date: sessionDate,
        startTime: sessionTime,
        notes: sessionNotes,
        records: recordsToRecord,
      });

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
        `Manual attendance recorded for ${totalCount} students (${presentCount} Present, ${absentCount} Absent, ${lateCount} Late). Conducted count updated to ${selectedOffering.conductedClasses}!${warningInfo}`
      );

      onRefresh();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit manual attendance.');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitSuccess(null), 5000);
    }
  };

  // Submit Single Manual Correction
  const handleApplySingleCorrection = () => {
    if (!selectedStudentForEdit || !selectedOffering) return;

    const res = db.correctAttendance({
      attendanceRecordId: selectedStudentForEdit.record?.id,
      sessionId: selectedSessionId !== 'ALL' ? selectedSessionId : selectedStudentForEdit.record?.sessionId,
      studentId: selectedStudentForEdit.student.id,
      courseOfferingId: selectedOffering.id,
      newStatus: editTargetStatus,
      changedBy: `${teacher.name} (${teacher.teacherId})`,
      reason: editReason,
      userRole: 'TEACHER',
      teacherId: teacher.id,
    });

    if (res.success) {
      setCorrectionMsg({ success: true, text: res.message });
      setSelectedStudentForEdit(null);
      onRefresh();
      setTimeout(() => setCorrectionMsg(null), 4000);
    } else {
      setCorrectionMsg({ success: false, text: res.message });
    }
  };

  // Submit Bulk Correction
  const handleApplyBulkCorrection = () => {
    if (selectedStudentIdsForBulk.size === 0 || !selectedOffering) return;

    const updates = Array.from(selectedStudentIdsForBulk).map(stId => {
      const rec = offeringRecords.find(
        r => r.studentId === stId && (selectedSessionId === 'ALL' || r.sessionId === selectedSessionId)
      );
      return {
        studentId: stId,
        attendanceRecordId: rec?.id,
        newStatus: bulkStatus,
        reason: bulkReason,
      };
    });

    const res = db.bulkCorrectAttendance({
      courseOfferingId: selectedOffering.id,
      sessionId: selectedSessionId !== 'ALL' ? selectedSessionId : undefined,
      updates,
      changedBy: `${teacher.name} (${teacher.teacherId})`,
      reason: bulkReason,
      userRole: 'TEACHER',
      teacherId: teacher.id,
    });

    if (res.success) {
      setCorrectionMsg({ success: true, text: res.message });
      setSelectedStudentIdsForBulk(new Set());
      onRefresh();
      setTimeout(() => setCorrectionMsg(null), 4000);
    } else {
      setCorrectionMsg({ success: false, text: res.message });
    }
  };

  const toggleSelectStudentForBulk = (stId: string) => {
    setSelectedStudentIdsForBulk(prev => {
      const next = new Set(prev);
      if (next.has(stId)) next.delete(stId);
      else next.add(stId);
      return next;
    });
  };

  const handleSelectAllBulk = () => {
    if (selectedStudentIdsForBulk.size === enrolledStudents.length) {
      setSelectedStudentIdsForBulk(new Set());
    } else {
      setSelectedStudentIdsForBulk(new Set(enrolledStudents.map(s => s.id)));
    }
  };

  // Filtered enrolled students for correction view
  const filteredStudentsForCorrection = enrolledStudents.filter(st => {
    const q = correctionSearch.toLowerCase();
    return st.name.toLowerCase().includes(q) || st.studentId.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs: Roll Call vs Manual Correction vs Audit Trail */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1.5">
        <button
          onClick={() => setActiveMode('roll_call')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
            activeMode === 'roll_call'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Take New Class Roll Call</span>
        </button>
        <button
          onClick={() => setActiveMode('correction')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
            activeMode === 'correction'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Edit2 className="w-4 h-4" />
          <span>Manual Attendance Correction (Past Sessions)</span>
        </button>
        <button
          onClick={() => setActiveMode('audits')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
            activeMode === 'audits'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Correction Audit Trail ({offeringAudits.length})</span>
        </button>
      </div>

      {/* Offering Selector Card (Common across modes) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Active Assigned Course Offering
          </label>
          <select
            value={selectedOfferingId}
            onChange={e => setSelectedOfferingId(e.target.value)}
            className="w-full md:w-96 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {authorizedOfferings.map(o => {
              const crs = courses.find(c => c.id === o.courseId);
              return (
                <option key={o.id} value={o.id}>
                  {crs?.code} - {crs?.name} (Sec {o.section} • Year {o.year} Sem {o.semester})
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center min-w-[100px]">
            <span className="text-[10px] text-slate-500 block">Scheduled</span>
            <span className="font-extrabold text-slate-900 text-base">{selectedOffering?.plannedClasses || 35}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-center min-w-[100px]">
            <span className="text-[10px] text-indigo-700 block font-semibold">Conducted</span>
            <span className="font-extrabold text-indigo-900 text-base">{selectedOffering?.conductedClasses || 0}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center min-w-[100px]">
            <span className="text-[10px] text-emerald-700 block font-semibold">Enrolled Cohort</span>
            <span className="font-extrabold text-emerald-900 text-base">{enrolledStudents.length}</span>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {submitSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}
      {submitError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}
      {correctionMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
            correctionMsg.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {correctionMsg.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{correctionMsg.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: TAKE NEW CLASS ROLL CALL                                          */}
      {/* ========================================================================= */}
      {activeMode === 'roll_call' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">New Lecture Attendance Sheet</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mark present (✓) or absent (✗). Immediately increments conducted classes and recalculates percentages.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleMarkAll('PRESENT')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              >
                Mark All Present
              </button>
              <button
                onClick={() => handleMarkAll('ABSENT')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                Mark All Absent
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lecture Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time Slot</label>
              <input
                type="text"
                value={sessionTime}
                onChange={e => setSessionTime(e.target.value)}
                placeholder="e.g. 10:00 AM"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Session Notes</label>
              <input
                type="text"
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="Lecture notes..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Roll Number</th>
                  <th className="py-2.5 px-4 text-center">Status Selection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrolledStudents.map((st, idx) => {
                  const currentStatus = attendanceMap[st.id] || 'PRESENT';
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{st.name}</td>
                      <td className="py-2.5 px-4 font-mono text-indigo-700 font-semibold">{st.studentId}</td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex rounded-xl bg-slate-100 p-1 space-x-1">
                          <button
                            type="button"
                            onClick={() => handleMark(st.id, 'PRESENT')}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                              currentStatus === 'PRESENT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                            }`}
                          >
                            ✓ Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMark(st.id, 'ABSENT')}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                              currentStatus === 'ABSENT' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-rose-700'
                            }`}
                          >
                            ✗ Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMark(st.id, 'LATE')}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                              currentStatus === 'LATE' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700'
                            }`}
                          >
                            ⏱ Late
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Total Cohort: <strong>{totalCount}</strong> • Present: <strong className="text-emerald-700">{presentCount}</strong> • Absent: <strong className="text-rose-700">{absentCount}</strong>
            </span>
            <button
              onClick={handleSubmitAttendance}
              disabled={isSubmitting || totalCount === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Recording...' : 'Submit Class Attendance'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: MANUAL ATTENDANCE CORRECTION & PAST SESSIONS                      */}
      {/* ========================================================================= */}
      {activeMode === 'correction' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  Manual Attendance Correction &amp; Session Review
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Change status (Present, Absent, Late, Excused) for any student in any session. Displays "Manually edited" badge and logs complete audit trail.
              </p>
            </div>

            {/* Filter by Specific Session or All */}
            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">Select Session:</label>
              <select
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Past Sessions &amp; Overall Status</option>
                {offeringSessions.map(sess => (
                  <option key={sess.id} value={sess.id}>
                    {sess.date} ({sess.startTime}) - {sess.status} [{sess.attendanceMethod}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search & Bulk Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={correctionSearch}
                onChange={e => setCorrectionSearch(e.target.value)}
                placeholder="Search student by name or roll..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Bulk Edit Controls */}
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleSelectAllBulk}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                {selectedStudentIdsForBulk.size === enrolledStudents.length ? 'Deselect All' : 'Select All'}
              </button>

              {selectedStudentIdsForBulk.size > 0 && (
                <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg text-xs animate-fadeIn">
                  <span className="font-bold text-indigo-900">
                    {selectedStudentIdsForBulk.size} selected:
                  </span>
                  <select
                    value={bulkStatus}
                    onChange={e => setBulkStatus(e.target.value as AttendanceStatus)}
                    className="px-2 py-0.5 rounded border border-indigo-300 text-xs font-bold bg-white text-indigo-900"
                  >
                    <option value="PRESENT">Set PRESENT</option>
                    <option value="ABSENT">Set ABSENT</option>
                    <option value="LATE">Set LATE</option>
                    <option value="EXCUSED">Set EXCUSED</option>
                  </select>
                  <input
                    type="text"
                    value={bulkReason}
                    onChange={e => setBulkReason(e.target.value)}
                    placeholder="Reason for bulk change..."
                    className="px-2 py-0.5 rounded border border-indigo-300 text-xs w-48 bg-white"
                  />
                  <button
                    onClick={handleApplyBulkCorrection}
                    className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs transition"
                  >
                    Apply Bulk
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Student Correction Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedStudentIdsForBulk.size === enrolledStudents.length && enrolledStudents.length > 0}
                        onChange={handleSelectAllBulk}
                        className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Roll</th>
                    <th className="py-2.5 px-4">Current Session Status</th>
                    <th className="py-2.5 px-4">Source / Badges</th>
                    <th className="py-2.5 px-4">Correction History</th>
                    <th className="py-2.5 px-4 text-right">Correct Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudentsForCorrection.map(st => {
                    // Resolve record for this student
                    const record = offeringRecords.find(
                      r => r.studentId === st.id && (selectedSessionId === 'ALL' || r.sessionId === selectedSessionId)
                    );
                    const isSelected = selectedStudentIdsForBulk.has(st.id);

                    const status = record?.status || 'ABSENT';

                    return (
                      <tr key={st.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectStudentForBulk(st.id)}
                            className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{st.name}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">{st.studentId}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : status === 'LATE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : status === 'EXCUSED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {record?.isManuallyEdited && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center space-x-1"
                                title={`Manually edited by ${record.editedBy} on ${new Date(record.editedAt || '').toLocaleString()}: ${record.editReason}`}
                              >
                                <Info className="w-3 h-3 text-purple-600" />
                                <span>Manually edited</span>
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase font-mono">
                              {record?.source || record?.method || 'manual'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {record?.isManuallyEdited ? (
                            <span className="truncate max-w-[180px] block" title={record.editReason}>
                              {record.editReason} ({record.editedBy?.split(' ')[0]})
                            </span>
                          ) : (
                            <span className="text-slate-400">Original check-in</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedStudentForEdit({ student: st, record });
                              setEditTargetStatus(status === 'PRESENT' ? 'EXCUSED' : 'PRESENT');
                              setEditReason('Manual attendance correction');
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                          >
                            Edit Status
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: CORRECTION AUDIT TRAIL                                            */}
      {/* ========================================================================= */}
      {activeMode === 'audits' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Manual Attendance Correction Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Official audit log of all manual changes made by faculty and administrators for this course.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              {offeringAudits.length} Recorded Adjustments
            </span>
          </div>

          {offeringAudits.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No manual corrections have been recorded for this course offering yet.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Date &amp; Time</th>
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Changed By</th>
                    <th className="py-2.5 px-4">Status Adjustment</th>
                    <th className="py-2.5 px-4">Reason Given</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {offeringAudits.map(audit => (
                    <tr key={audit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {new Date(audit.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{audit.studentName}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{audit.changedBy}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 line-through mr-1.5">
                          {audit.originalStatus}
                        </span>
                        <span className="text-slate-400 font-bold mr-1.5">→</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {audit.newStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{audit.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SINGLE STUDENT CORRECTION MODAL */}
      {selectedStudentForEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Correct Student Attendance</h3>
              <button
                onClick={() => setSelectedStudentForEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Student:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {selectedStudentForEdit.student.name} ({selectedStudentForEdit.student.studentId})
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Current Status:</span>
                <span className="font-bold text-slate-800">
                  {selectedStudentForEdit.record?.status || 'ABSENT (No check-in)'}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">New Attendance Status</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as AttendanceStatus[]).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditTargetStatus(st)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        editTargetStatus === st
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Reason for Manual Correction <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="e.g. Student attended lecture, biometric sensor error..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSelectedStudentForEdit(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplySingleCorrection}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                Save Correction &amp; Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
