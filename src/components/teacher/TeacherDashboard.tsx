import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  QrCode,
  Camera,
  Play,
  Square,
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  ChevronRight,
  BookOpen,
  Send,
} from 'lucide-react';
import { db } from '../../services/db';
import { QRService } from '../../services/qrService';
import { NotificationService } from '../../services/notificationService';
import { computeStudentCourseAnalytics } from '../../services/attendanceEngine';
import { AttendanceSession, CourseOffering, Course, Teacher } from '../../types';
import { getStatusBadgeClasses, getRiskBadgeClasses } from '../../utils/formatters';
import { TeacherManualAttendance } from './TeacherManualAttendance';

interface TeacherDashboardProps {
  teacherId?: string;
  onRefresh: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacherId,
  onRefresh,
}) => {
  const teachers = db.getTeachers();
  const currentTeacher: Teacher | undefined = teachers.find(t => t.id === teacherId) || teachers[0];

  if (!currentTeacher) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white rounded-2xl border border-slate-200 mt-8 shadow-xs">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 text-base">Teacher Profile Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          No teacher profile could be found for this account. Please contact the administrator.
        </p>
      </div>
    );
  }

  // Teacher assignments & courses (Only assigned courses appear!)
  const assignments = db.getTeacherAssignments().filter(ta => ta.teacherId === currentTeacher.id);
  const offerings = db.getCourseOfferings();
  const courses = db.getCourses();
  const routines = db.getRoutines().filter(r => r.teacherId === currentTeacher.id);
  const allSessions = db.getAttendanceSessions();
  const allRecords = db.getAttendanceRecords();
  const allStudents = db.getStudents();
  const enrollments = db.getStudentEnrollments();
  const settings = db.getSettings();

  // Active session managed by this teacher
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(
    () => allSessions.find(s => s.teacherId === currentTeacher.id && s.status === 'ACTIVE') || null
  );

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [tokenCountdown, setTokenCountdown] = useState<number>(120); // 120s rolling token
  const [copiedToken, setCopiedToken] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  // Modal to start a new session
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(
    assignments[0]?.courseOfferingId || ''
  );
  const [attendanceMethod, setAttendanceMethod] = useState<'QR' | 'FACE'>('QR');
  const [sessionNotes, setSessionNotes] = useState('');

  // View mode tab: live, manual attendance, or analytics
  const [activeViewTab, setActiveViewTab] = useState<'live' | 'manual' | 'analytics'>('live');

  // Selected course for analytics view
  const [selectedCourseOfferingId, setSelectedCourseOfferingId] = useState<string>(
    assignments[0]?.courseOfferingId || ''
  );

  // Keep active session in sync with allSessions
  useEffect(() => {
    const liveActive = allSessions.find(s => s.teacherId === currentTeacher.id && s.status === 'ACTIVE') || null;
    setActiveSession(liveActive);
  }, [allSessions, currentTeacher.id]);

  // Keep offering selection in sync if assignments change
  useEffect(() => {
    if (!selectedOfferingId && assignments.length > 0) {
      setSelectedOfferingId(assignments[0].courseOfferingId);
    }
    if (!selectedCourseOfferingId && assignments.length > 0) {
      setSelectedCourseOfferingId(assignments[0].courseOfferingId);
    }
  }, [assignments, selectedOfferingId, selectedCourseOfferingId]);

  // Generate QR code when active session changes or refreshes
  useEffect(() => {
    if (activeSession && activeSession.status === 'ACTIVE' && activeSession.attendanceMethod === 'QR') {
      QRService.generateQRCodeDataUrl(activeSession.id).then(url => {
        setQrDataUrl(url);
      });
    }
  }, [activeSession?.id, activeSession?.currentToken]);

  // Rolling token countdown timer
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'ACTIVE') return;

    const interval = setInterval(() => {
      setTokenCountdown(prev => {
        if (prev <= 1) {
          // Auto-rotate token to prevent cheating via photos
          const newToken = db.refreshSessionToken(activeSession.id);
          setActiveSession(prevSess => (prevSess ? { ...prevSess, currentToken: newToken } : null));
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.id]);

  const handleStartSession = () => {
    if (!selectedOfferingId) return;

    const newSession = db.startAttendanceSession({
      courseOfferingId: selectedOfferingId,
      teacherId: currentTeacher.id,
      attendanceMethod,
      notes: sessionNotes,
    });

    setActiveSession(newSession);
    setIsStartModalOpen(false);
    setSessionNotes('');
    onRefresh();
  };

  const handleCloseSession = (sessionId: string) => {
    db.closeAttendanceSession(sessionId);
    setActiveSession(null);
    onRefresh();
  };

  const handleManualRotateToken = () => {
    if (!activeSession) return;
    const newToken = db.refreshSessionToken(activeSession.id);
    setActiveSession({ ...activeSession, currentToken: newToken });
    setTokenCountdown(120);
    onRefresh();
  };

  const handleTriggerTodayReminders = async () => {
    const res = await NotificationService.triggerTeacherClassReminders();
    setReminderStatus(
      res.sentCount > 0
        ? `Reminders successfully sent (${res.sentCount} notifications logged)`
        : 'All class reminders for today are already sent and logged (Deduplicated).'
    );
    setTimeout(() => setReminderStatus(null), 5000);
    onRefresh();
  };

  // Find enrolled students for active session
  const activeSessionRecords = activeSession
    ? allRecords.filter(r => r.sessionId === activeSession.id)
    : [];

  const activeOffering = activeSession
    ? offerings.find(o => o.id === activeSession.courseOfferingId)
    : null;
  const activeCourse = activeOffering
    ? courses.find(c => c.id === activeOffering.courseId)
    : null;

  // Analytics for selected course offering
  const viewingOffering = offerings.find(o => o.id === selectedCourseOfferingId);
  const viewingCourse = viewingOffering ? courses.find(c => c.id === viewingOffering.courseId) : null;
  const viewingEnrollments = viewingOffering
    ? enrollments.filter(e => e.courseOfferingId === viewingOffering.id && e.status === 'ENROLLED')
    : [];

  const studentAnalyticsList = viewingOffering && viewingCourse
    ? viewingEnrollments
        .map(enr => {
          const student = allStudents.find(s => s.id === enr.studentId);
          if (!student) return null;
          const studentRecords = allRecords.filter(
            r => r.courseOfferingId === viewingOffering.id && r.studentId === student.id
          );

          return computeStudentCourseAnalytics({
            studentId: student.id,
            studentName: student.name,
            studentRoll: student.studentId,
            courseOffering: viewingOffering,
            courseCode: viewingCourse.code || '',
            courseName: viewingCourse.name || '',
            credit: viewingCourse.credit || 3,
            courseType: viewingCourse.type || 'THEORY',
            records: studentRecords,
            settings,
          });
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Teacher Profile & Greeting Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl shadow-xs">
            {currentTeacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-slate-900">{currentTeacher.name}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {currentTeacher.designation}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Teacher ID: <span className="font-mono font-semibold">{currentTeacher.teacherId}</span> • Department of CSE • {currentTeacher.email}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleTriggerTodayReminders}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            title="Trigger automated routine reminders for today's classes"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Today's Class Reminders</span>
          </button>
          {!activeSession && (
            <button
              onClick={() => setIsStartModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Attendance Session</span>
            </button>
          )}
        </div>
      </div>

      {reminderStatus && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 font-medium flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{reminderStatus}</span>
        </div>
      )}

      {/* Sub-Tab Navigation Bar */}
      <div className="flex border-b border-slate-200 space-x-2 sm:space-x-6 text-xs font-semibold overflow-x-auto pb-1">
        {[
          { id: 'live', label: 'Live Kiosk & Timetable', icon: QrCode },
          { id: 'manual', label: 'Manual Attendance Sheet', icon: UserCheck },
          { id: 'analytics', label: 'Student Cohort Analytics', icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveViewTab(tab.id as any)}
              className={`py-2.5 px-1 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
                activeViewTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LIVE ATTENDANCE & SCHEDULE */}
      {activeViewTab === 'live' && (
        <div className="space-y-8">
          {/* TODAY'S SCHEDULE & ROUTINE REMINDER */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>My Timetable & Routine Schedule</span>
            </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {routines.map(rt => {
            const off = offerings.find(o => o.id === rt.courseOfferingId);
            const crs = off ? courses.find(c => c.id === off.courseId) : undefined;

            return (
              <div
                key={rt.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                      {crs?.code}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {rt.dayOfWeek}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-2">{crs?.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{rt.startTime} - {rt.endTime}</span>
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{rt.room}</span>
                  <button
                    onClick={() => {
                      setSelectedOfferingId(rt.courseOfferingId);
                      setIsStartModalOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                  >
                    Launch Session →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTIVE ATTENDANCE SESSION KIOSK SCREEN (Section 14 & 16) */}
      {activeSession && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-indigo-800/40 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left: Session Details & Controls */}
            <div className="space-y-4 max-w-lg">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Active Attendance Session ({activeSession.attendanceMethod} Mode)</span>
              </div>

              <div>
                <h3 className="text-2xl font-black tracking-tight text-white">
                  {activeCourse?.code} - {activeCourse?.name}
                </h3>
                <p className="text-xs text-indigo-200 mt-1">
                  Started at {activeSession.startTime} • Late threshold: {settings.lateThresholdMinutes} minutes
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
                  <div className="text-[11px] text-indigo-200">Scanned Students</div>
                  <div className="text-2xl font-black text-white">{activeSessionRecords.length}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
                  <div className="text-[11px] text-indigo-200">Token Auto-Refresh</div>
                  <div className="text-2xl font-black text-cyan-300 font-mono">{tokenCountdown}s</div>
                </div>
              </div>

              {/* Token Copy & Manual Refresh */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="text-indigo-200 truncate mr-2">{activeSession.currentToken}</span>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeSession.currentToken);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2000);
                    }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                    title="Copy token"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleManualRotateToken}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                    title="Refresh token now"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleCloseSession(activeSession.id)}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Close Session & Finalize Absences (Rule 18)</span>
                </button>
              </div>
            </div>

            {/* Right: Big Dynamic QR Code Display for Classroom Projector */}
            {activeSession.attendanceMethod === 'QR' ? (
              <div className="bg-white p-5 rounded-3xl shadow-2xl border-4 border-indigo-400/30 flex flex-col items-center space-y-3">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Class Dynamic Attendance QR Code"
                    className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-64 h-64 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                    Generating dynamic QR...
                  </div>
                )}
                <div className="text-center">
                  <span className="text-xs font-extrabold text-slate-900 tracking-wide uppercase">
                    Scan With UniAttend Student App
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Token rotates automatically to prevent photo sharing
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 text-center space-y-3 max-w-xs">
                <div className="w-16 h-16 mx-auto rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <Camera className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-white text-base">Face Recognition Mode Active</h4>
                <p className="text-xs text-indigo-200">
                  Students verify via their mobile devices or the front podium kiosk. Cosine similarity threshold: {settings.faceMatchThreshold * 100}%.
                </p>
              </div>
            )}
          </div>

          {/* Scanned Attendees Live Feed */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-3">
              Live Scanned Attendees ({activeSessionRecords.length})
            </h4>
            {activeSessionRecords.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Waiting for students to scan QR or verify face...
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeSessionRecords.map(rec => {
                  const stu = allStudents.find(s => s.id === rec.studentId);
                  return (
                    <div
                      key={rec.id}
                      className="bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 flex items-center space-x-2 text-xs"
                    >
                      <span className="font-bold text-white">{stu?.name}</span>
                      <span className="text-[10px] text-indigo-200 font-mono">({stu?.studentId})</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          rec.status === 'PRESENT' ? 'bg-emerald-400 text-slate-900' : 'bg-amber-400 text-slate-900'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}

      {/* TAB 2: MANUAL ATTENDANCE SHEET */}
      {activeViewTab === 'manual' && (
        <TeacherManualAttendance
          teacher={currentTeacher}
          offerings={offerings}
          courses={courses}
          students={allStudents}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 3: ASSIGNED COURSES & ANALYTICS */}
      {(activeViewTab === 'analytics' || activeViewTab === 'live') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Course Attendance Analytics & Student Records</h3>
            <p className="text-xs text-slate-500">
              Only showing courses assigned to you by Admin
            </p>
          </div>

          {/* Course Selector Dropdown */}
          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-500 font-medium">Select Course:</label>
            <select
              value={selectedCourseOfferingId}
              onChange={e => setSelectedCourseOfferingId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {assignments.map(assign => {
                const off = offerings.find(o => o.id === assign.courseOfferingId);
                const crs = off ? courses.find(c => c.id === off.courseId) : undefined;
                return (
                  <option key={assign.id} value={assign.courseOfferingId}>
                    {crs?.code} - {crs?.name} ({crs?.type})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Course Progress Summary */}
        {viewingOffering && viewingCourse && (
          <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-400">Planned Classes</div>
              <div className="text-lg font-bold text-slate-800">{viewingOffering.plannedClasses}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-400">Conducted Classes</div>
              <div className="text-lg font-bold text-indigo-700">{viewingOffering.conductedClasses}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-400">Remaining Classes</div>
              <div className="text-lg font-bold text-slate-800">
                {Math.max(0, viewingOffering.plannedClasses - viewingOffering.conductedClasses)}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-400">Enrolled Students</div>
              <div className="text-lg font-bold text-slate-800">{viewingEnrollments.length}</div>
            </div>
          </div>
        )}

        {/* Student Attendance & Risk Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Present</th>
                <th className="py-3 px-4">Late</th>
                <th className="py-3 px-4">Absent</th>
                <th className="py-3 px-4">3-Late Penalty</th>
                <th className="py-3 px-4">Attendance %</th>
                <th className="py-3 px-4">Exam Status</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">Max Possible %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentAnalyticsList.map(item => {
                const riskClasses = getRiskBadgeClasses(item.riskLevel);
                return (
                  <tr key={item.studentId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.studentName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.studentRoll}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">{item.presentCount}</td>
                    <td className="py-3 px-4 font-semibold text-amber-700">{item.lateCount}</td>
                    <td className="py-3 px-4 font-semibold text-rose-700">{item.absentCount}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{item.penaltyCount}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">{item.attendancePercentage}%</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.examEligible
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.examEligible ? 'Eligible' : 'Not Eligible'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${riskClasses.bg} ${riskClasses.text} ${riskClasses.border}`}>
                        {item.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {item.maximumPossibleAttendance}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* START ATTENDANCE MODAL */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Launch Attendance Session</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Course Offering</label>
                <select
                  value={selectedOfferingId}
                  onChange={e => setSelectedOfferingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                >
                  {assignments.map(assign => {
                    const off = offerings.find(o => o.id === assign.courseOfferingId);
                    const crs = off ? courses.find(c => c.id === off.courseId) : undefined;
                    return (
                      <option key={assign.id} value={assign.courseOfferingId}>
                        {crs?.code} - {crs?.name} ({crs?.type})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Attendance Method (Independent Mode - Section 13)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAttendanceMethod('QR')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-2 font-bold ${
                      attendanceMethod === 'QR'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Dynamic QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceMethod('FACE')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-2 font-bold ${
                      attendanceMethod === 'FACE'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Face Recognition</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Session Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 Lecture / Midterm review"
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsStartModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleStartSession}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                Launch Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
