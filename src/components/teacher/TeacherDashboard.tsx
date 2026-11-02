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
  Cpu,
  Radio,
  SlidersHorizontal,
  History,
  PlusCircle,
  X,
  Key,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Fingerprint,
} from 'lucide-react';
import { db } from '../../services/db';
import { auth } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { QRService } from '../../services/qrService';
import { NotificationService } from '../../services/notificationService';
import { computeStudentCourseAnalytics } from '../../services/attendanceEngine';
import { AttendanceSession, CourseOffering, Course, Teacher, TeacherAssignment, HardwareDevice, HardwareScanLog, ClassCountAuditLog, Student } from '../../types';
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
  const { currentUser, userProfile } = useAuth();
  const teachers = db.getTeachers();

  const targetEmail = (userProfile?.email || currentUser?.email || '').toLowerCase().trim();
  const targetUid = currentUser?.uid;

  // Strict identity mapping:
  // If user role is TEACHER: Must match authenticated email, authUid, or verified teacherId
  // If user role is ADMIN: Can audit any teacher via teacherId prop
  let currentTeacher: Teacher | undefined;
  if (userProfile?.role === 'TEACHER') {
    currentTeacher = teachers.find(
      t =>
        (targetEmail && t.email.toLowerCase() === targetEmail) ||
        (targetUid && t.authUid === targetUid) ||
        (userProfile.teacherId && (t.id === userProfile.teacherId || t.teacherId.toLowerCase() === userProfile.teacherId.toLowerCase()))
    );
  } else if (userProfile?.role === 'ADMIN') {
    // Admin supervisor preview mode: must explicitly specify teacherId or match admin's own assigned profile
    const effectiveTargetId = teacherId || userProfile?.teacherId;
    if (effectiveTargetId) {
      currentTeacher = teachers.find(
        t => t.id === effectiveTargetId || t.teacherId.toLowerCase() === effectiveTargetId.toLowerCase()
      );
    }
  }

  if (!currentTeacher) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-white rounded-2xl border border-slate-200 mt-12 shadow-xs">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 text-lg">Teacher Profile Not Found</h3>
        <p className="text-sm text-slate-600 mt-1">
          No faculty profile matching account <span className="font-semibold text-slate-900">{targetEmail || 'your credentials'}</span> was found in the system.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Please contact the university administrator to register or activate your faculty profile.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => auth.signOut()}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition"
          >
            Sign Out & Switch Account
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
          >
            Retry Verification
          </button>
        </div>
      </div>
    );
  }

  const offerings = db.getCourseOfferings();
  const courses = db.getCourses();
  const batches = db.getBatches();
  const allSessions = db.getAttendanceSessions();
  const allRecords = db.getAttendanceRecords();
  const allStudents = db.getStudents();
  const enrollments = db.getStudentEnrollments();
  const settings = db.getSettings();

  // Helper to match teacher identity across both unique entity ID and teacherId code
  const teacherIdMatches = (tid?: string) =>
    Boolean(tid && currentTeacher && (tid === currentTeacher.id || tid === currentTeacher.teacherId));

  // 1. Direct teacher assignment records
  const directAssignments = db.getTeacherAssignments().filter(ta => teacherIdMatches(ta.teacherId));

  // 2. Scheduled routines for this teacher
  const routines = db.getRoutines().filter(r => teacherIdMatches(r.teacherId));

  // 3. Resolve all course offering IDs assigned to this teacher (via TeacherAssignment, Routine, or Authorized Courses)
  const assignedOfferingIds = new Set<string>();
  directAssignments.forEach(ta => assignedOfferingIds.add(ta.courseOfferingId));
  routines.forEach(r => {
    if (r.courseOfferingId) assignedOfferingIds.add(r.courseOfferingId);
  });
  if (currentTeacher.authorizedCourseIds && currentTeacher.authorizedCourseIds.length > 0) {
    offerings.forEach(o => {
      if (currentTeacher.authorizedCourseIds.includes(o.courseId)) {
        assignedOfferingIds.add(o.id);
      }
    });
  }

  // Combined assigned course offerings list
  const assignedCourseOfferings = offerings.filter(o => assignedOfferingIds.has(o.id));

  // Comprehensive assignments array (so all selectors have rich representation)
  const assignments: TeacherAssignment[] = assignedCourseOfferings.map(off => {
    const direct = directAssignments.find(da => da.courseOfferingId === off.id);
    if (direct) return direct;
    return {
      id: `ta-syn-${currentTeacher.id}-${off.id}`,
      teacherId: currentTeacher.id,
      courseOfferingId: off.id,
      role: 'PRIMARY' as const,
      assignedAt: new Date().toISOString(),
    };
  });

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

  // View mode tab: live, manual attendance, class-count, hardware, or analytics
  const [activeViewTab, setActiveViewTab] = useState<'live' | 'manual' | 'class-count' | 'hardware' | 'analytics'>('live');

  // Selected course for analytics view
  const [selectedCourseOfferingId, setSelectedCourseOfferingId] = useState<string>(
    assignments[0]?.courseOfferingId || ''
  );
  const [warningStatusMessage, setWarningStatusMessage] = useState<string | null>(null);
  const [isTriggeringWarning, setIsTriggeringWarning] = useState(false);

  // Class Count Management states
  const [adjustModalOffering, setAdjustModalOffering] = useState<CourseOffering | null>(null);
  const [adjustCountInput, setAdjustCountInput] = useState<number>(0);
  const [adjustReasonInput, setAdjustReasonInput] = useState<string>('');
  const [adjustFeedback, setAdjustFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [cancelModalSession, setCancelModalSession] = useState<AttendanceSession | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');

  // Hardware RFID & Fingerprint states
  const [simulatedDeviceId, setSimulatedDeviceId] = useState<string>('DEV-R304-RFID');
  const [simulatedCredType, setSimulatedCredType] = useState<'RFID' | 'FINGERPRINT'>('RFID');
  const [simulatedCredId, setSimulatedCredId] = useState<string>('RFID-CS-2023-0101');
  const [simulatedStudentId, setSimulatedStudentId] = useState<string>('');
  const [hardwareScanFeedback, setHardwareScanFeedback] = useState<{ success: boolean; status?: string; message: string; record?: any } | null>(null);
  const [isRegisterDeviceModalOpen, setIsRegisterDeviceModalOpen] = useState(false);
  const [newDeviceForm, setNewDeviceForm] = useState({
    deviceId: '',
    name: '',
    room: 'Room 304',
    building: 'Academic Complex',
    deviceType: 'RFID' as 'RFID' | 'FINGERPRINT' | 'DUAL',
    apiKey: '',
  });
  const [deviceActionFeedback, setDeviceActionFeedback] = useState<string | null>(null);
  const [linkModalStudent, setLinkModalStudent] = useState<Student | null>(null);
  const [linkRfidInput, setLinkRfidInput] = useState<string>('');
  const [linkFingerprintInput, setLinkFingerprintInput] = useState<string>('');

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
              Teacher ID: <span className="font-mono font-semibold">{currentTeacher.teacherId}</span> • {db.getDepartments().find(d => d.id === currentTeacher.departmentId)?.name || 'Department of CSE'} • {currentTeacher.email}
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
          { id: 'manual', label: 'Manual Correction & Roll', icon: UserCheck },
          { id: 'class-count', label: 'Class Count Management', icon: SlidersHorizontal },
          { id: 'hardware', label: 'RFID / Fingerprint Hardware', icon: Cpu },
          { id: 'analytics', label: 'Cohort Analytics & Risk', icon: Users },
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
          {/* MY ASSIGNED COURSES & OFFERINGS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>My Assigned Courses ({assignedCourseOfferings.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Courses allocated to you by Department & Academic Administration
              </span>
            </div>

            {assignedCourseOfferings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">No Courses Assigned Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  You do not currently have any active course offerings assigned. When the administrator assigns a course to your faculty profile in Course Allocation, it will immediately appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedCourseOfferings.map(off => {
                  const crs = courses.find(c => c.id === off.courseId);
                  const batch = batches.find(b => b.id === off.batchId);
                  const enrolledCount = enrollments.filter(
                    e => e.courseOfferingId === off.id && e.status === 'ENROLLED'
                  ).length;
                  const progressPct = off.plannedClasses > 0
                    ? Math.min(100, Math.round((off.conductedClasses / off.plannedClasses) * 100))
                    : 0;

                  return (
                    <div
                      key={off.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all hover:shadow-md"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-mono">
                            {crs?.code}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {crs?.type} • {crs?.credit} Cr
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 text-sm leading-snug">{crs?.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Cohort: <strong className="text-slate-700">{batch?.name || 'Assigned Cohort'}</strong> • Year {off.year}, Sem {off.semester} (Sec {off.section})
                          </p>
                        </div>

                        {/* Class Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Conducted: <strong className="text-indigo-700">{off.conductedClasses}</strong> / {off.plannedClasses}</span>
                            <span className="font-bold text-slate-700">{progressPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                          <span className="flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span><strong>{enrolledCount}</strong> Students Enrolled</span>
                          </span>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="pt-4 mt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setSelectedOfferingId(off.id);
                            setIsStartModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-xs transition"
                          title="Start Dynamic QR or Face Recognition Kiosk"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Kiosk</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCourseOfferingId(off.id);
                            setActiveViewTab('analytics');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center space-x-1 transition"
                          title="View student attendance analytics"
                        >
                          <Users className="w-3 h-3" />
                          <span>Analytics</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TODAY'S SCHEDULE & ROUTINE REMINDER */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>My Timetable & Routine Schedule ({routines.length})</span>
            </h3>

            {routines.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500 italic">
                No recurring timetable slots scheduled yet. You can launch ad-hoc attendance sessions directly from "My Assigned Courses" above.
              </div>
            ) : (
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
            )}
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

        {/* Course Progress Summary & 50% Milestone Inspector */}
        {viewingOffering && viewingCourse && (
          <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
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

            {/* 50% Milestone Banner & Warning Dispatch */}
            {viewingOffering.conductedClasses >= Math.floor(viewingOffering.plannedClasses * 0.5) && (
              <div className="bg-gradient-to-r from-indigo-50 to-amber-50 border border-indigo-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                  <div>
                    <span className="font-extrabold text-slate-900">
                      50% Milestone Reached ({viewingOffering.conductedClasses} of {viewingOffering.plannedClasses} classes held)
                    </span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Early warning inspection active: Students below 60% attendance have been identified with required makeup calculations.
                    </p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setIsTriggeringWarning(true);
                    try {
                      const res = await NotificationService.triggerHalfwayCourseEarlyWarnings(viewingOffering.id);
                      setWarningStatusMessage(`Dispatched warning notices to ${res.warningsSent} at-risk students.`);
                      setTimeout(() => setWarningStatusMessage(null), 4000);
                    } finally {
                      setIsTriggeringWarning(false);
                    }
                  }}
                  disabled={isTriggeringWarning}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center space-x-1.5 shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTriggeringWarning ? 'Sending Notices...' : 'Send 50% Milestone Warnings'}</span>
                </button>
              </div>
            )}

            {warningStatusMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{warningStatusMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Student Attendance & Risk Table with 8 metrics */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Attended</th>
                <th className="py-3 px-4">Current %</th>
                <th className="py-3 px-4">Remaining</th>
                <th className="py-3 px-4">Needed for 60%</th>
                <th className="py-3 px-4">Feasibility</th>
                <th className="py-3 px-4">Projected Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentAnalyticsList.map(item => {
                return (
                  <tr key={item.studentId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.studentName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.studentRoll}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{item.effectivePresentCount}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.presentCount}P • {item.lateCount}L • {item.absentCount}A
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-black text-xs ${
                          item.attendancePercentage >= 60.0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {item.attendancePercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {item.remainingClasses}
                    </td>
                    <td className="py-3 px-4">
                      {item.minAdditionalClassesToPass === 0 ? (
                        <span className="text-emerald-700 font-bold text-[11px]">Met (0 needed)</span>
                      ) : (
                        <span className="text-indigo-700 font-bold text-[11px]">
                          +{item.minAdditionalClassesToPass} more
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.canReach60 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          Possible (Max {item.maximumPossibleAttendance}%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          Barred (Max {item.maximumPossibleAttendance}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.projectedExamStatus === 'ELIGIBLE' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Eligible
                        </span>
                      )}
                      {item.projectedExamStatus === 'AT_RISK' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          At Risk
                        </span>
                      )}
                      {item.projectedExamStatus === 'PROJECTED_INELIGIBLE' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Barred
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.projectedExamStatus !== 'ELIGIBLE' && (
                        <button
                          onClick={async () => {
                            const res = await NotificationService.sendIndividualEarlyWarning(item);
                            setWarningStatusMessage(
                              res.success
                                ? `Sent warning notice to ${item.studentName}!`
                                : `Notice logged: ${res.message}`
                            );
                            setTimeout(() => setWarningStatusMessage(null), 3500);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold transition inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Warn</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* TAB: TEACHER-MANAGED CLASS COUNT */}
      {activeViewTab === 'class-count' && (
        <div className="space-y-6">
          {/* Header Card with Regulatory Formula */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-extrabold tracking-tight">Class Count & Conducted Lecture Management</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    Faculty Authorized Control
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Academic regulations mandate that attendance percentage is strictly computed against <strong>Conducted Classes</strong>, not scheduled totals. When classes are cancelled or university events occur, faculty can adjust the conducted tally with an audited reason.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/15 text-center shrink-0">
                <div className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">Attendance Formula</div>
                <div className="font-mono text-sm font-extrabold text-white mt-0.5">
                  % = (Attended / Conducted) × 100
                </div>
              </div>
            </div>
          </div>

          {adjustFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between animate-fadeIn ${
                adjustFeedback.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                {adjustFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{adjustFeedback.message}</span>
              </div>
              <button
                onClick={() => setAdjustFeedback(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Assigned Course Offerings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Course Offering Class Tallies</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled versus actually conducted lectures for assigned courses
                </p>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                {assignedCourseOfferings.length} Assigned Course(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Course Code & Title</th>
                    <th className="py-3 px-4">Cohort / Section</th>
                    <th className="py-3 px-4 text-center">Scheduled Total</th>
                    <th className="py-3 px-4 text-center">Conducted Classes</th>
                    <th className="py-3 px-4 text-center">Remaining</th>
                    <th className="py-3 px-4">Class Progress</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedCourseOfferings.map(off => {
                    const crs = courses.find(c => c.id === off.courseId);
                    const batch = batches.find(b => b.id === off.batchId);
                    const scheduled = off.plannedClasses || 35;
                    const conducted = off.conductedClasses || 0;
                    const remaining = Math.max(0, scheduled - conducted);
                    const pct = scheduled > 0 ? Math.min(100, Math.round((conducted / scheduled) * 100)) : 0;

                    return (
                      <tr key={off.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {crs?.code}
                            </span>
                            <span className="font-semibold text-slate-900">{crs?.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {batch?.name || 'Assigned'} • Sec {off.section} (Yr {off.year}, Sem {off.semester})
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700 font-mono">
                          {scheduled}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-indigo-700 font-mono bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                            {conducted}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-500 font-mono">
                          {remaining}
                        </td>
                        <td className="py-3.5 px-4 w-48">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>{pct}% held</span>
                              <span className="font-semibold">{conducted}/{scheduled}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setAdjustModalOffering(off);
                              setAdjustCountInput(off.conductedClasses || 0);
                              setAdjustReasonInput('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Adjust Count</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Class Count Audit History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="font-bold text-slate-900 text-sm">Class Count Audit Trail</h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Every modification is permanently logged with faculty identity and reason
              </span>
            </div>

            {db.getClassCountAudits().length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No conducted class adjustments recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Course</th>
                      <th className="py-2.5 px-4">Adjusted By</th>
                      <th className="py-2.5 px-4 text-center">Old Conducted</th>
                      <th className="py-2.5 px-4 text-center">New Conducted</th>
                      <th className="py-2.5 px-4 text-center">Scheduled</th>
                      <th className="py-2.5 px-4">Audit Reason</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {db.getClassCountAudits().slice(0, 10).map(audit => (
                      <tr key={audit.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-indigo-700">{audit.courseCode}</td>
                        <td className="py-2.5 px-4 font-sans text-slate-700">{audit.changedBy}</td>
                        <td className="py-2.5 px-4 text-center text-rose-600 font-bold">{audit.oldConducted}</td>
                        <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">{audit.newConducted}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">{audit.scheduledTotal}</td>
                        <td className="py-2.5 px-4 font-sans text-slate-600 max-w-xs truncate">{audit.reason}</td>
                        <td className="py-2.5 px-4 text-slate-400 text-[10px]">
                          {new Date(audit.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: RFID & FINGERPRINT HARDWARE ATTENDANCE */}
      {activeViewTab === 'hardware' && (
        <div className="space-y-6">
          {/* Header Card with Privacy Declaration */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white border border-slate-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-extrabold tracking-tight">Classroom Hardware Scanners & IoT Terminal</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Live Hardware Endpoint Ready
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Support for physical wall-mounted RFID card readers and optical fingerprint sensors. Microcontrollers (ESP32/Arduino) authenticate via HMAC token and submit scans directly to <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-200">POST /api/hardware/scan</code>.
                </p>
                <div className="mt-3 flex items-center space-x-2 text-[11px] text-indigo-200/90 bg-indigo-900/40 px-3 py-1.5 rounded-xl border border-indigo-500/20 w-fit">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Zero Raw Biometrics:</strong> Raw fingerprint images are never stored or transmitted. The system processes only irreversible 256-bit template feature vectors.</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  onClick={() => setIsRegisterDeviceModalOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Register Device</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Hardware Scan Simulator */}
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-md p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Radio className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h4 className="font-extrabold text-slate-900 text-sm">Interactive Hardware Scan Simulator</h4>
              </div>
              <span className="text-xs text-slate-500">
                Simulate real physical scans from classroom wall readers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              {/* Select Device */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Classroom Device</label>
                <select
                  value={simulatedDeviceId}
                  onChange={e => {
                    setSimulatedDeviceId(e.target.value);
                    const dev = db.getHardwareDevices().find(d => d.deviceId === e.target.value);
                    if (dev) {
                      setSimulatedCredType(dev.deviceType === 'FINGERPRINT' ? 'FINGERPRINT' : 'RFID');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                >
                  {db.getHardwareDevices().map(d => (
                    <option key={d.id} value={d.deviceId}>
                      {d.name} ({d.room}) - {d.deviceType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Credential Type */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Credential Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimulatedCredType('RFID');
                      const s = allStudents.find(st => st.rfidCardUid);
                      if (s && s.rfidCardUid) setSimulatedCredId(s.rfidCardUid);
                    }}
                    className={`py-2 px-2 rounded-xl border flex items-center justify-center space-x-1.5 font-bold ${
                      simulatedCredType === 'RFID'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>RFID Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimulatedCredType('FINGERPRINT');
                      const s = allStudents.find(st => st.fingerprintTemplateId);
                      if (s && s.fingerprintTemplateId) setSimulatedCredId(s.fingerprintTemplateId);
                    }}
                    className={`py-2 px-2 rounded-xl border flex items-center justify-center space-x-1.5 font-bold ${
                      simulatedCredType === 'FINGERPRINT'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Fingerprint</span>
                  </button>
                </div>
              </div>

              {/* Student Quick Pick */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Select Enrolled Student</label>
                <select
                  value={simulatedStudentId}
                  onChange={e => {
                    const sid = e.target.value;
                    setSimulatedStudentId(sid);
                    const stu = allStudents.find(s => s.id === sid);
                    if (stu) {
                      if (simulatedCredType === 'RFID') {
                        setSimulatedCredId(stu.rfidCardUid || 'RFID-' + stu.studentId);
                      } else {
                        setSimulatedCredId(stu.fingerprintTemplateId || 'FP-TMPL-' + stu.studentId);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                >
                  <option value="">-- Choose Student or enter Credential --</option>
                  {allStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.studentId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Credential ID input */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  {simulatedCredType === 'RFID' ? 'RFID Card UID' : 'Fingerprint Template Hash'}
                </label>
                <input
                  type="text"
                  value={simulatedCredId}
                  onChange={e => setSimulatedCredId(e.target.value)}
                  placeholder={simulatedCredType === 'RFID' ? 'e.g. RFID-CS-2023-0101' : 'e.g. FP-TMPL-90412-A'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <span>Quick Edge-Case Tests:</span>
                <button
                  type="button"
                  onClick={() => setSimulatedCredId('UNKNOWN-CARD-9999')}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                >
                  Unknown Card
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const stu = allStudents[0];
                    if (stu) {
                      setSimulatedCredId(stu.rfidCardUid || 'RFID-' + stu.studentId);
                      setSimulatedCredType('RFID');
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                >
                  Valid Student Scan
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const dev = db.getHardwareDevices().find(d => d.deviceId === simulatedDeviceId);
                  const apiKey = dev?.apiKey || 'dev-secret-key-304';
                  const res = db.processHardwareScan({
                    deviceId: simulatedDeviceId,
                    credentialId: simulatedCredId.trim(),
                    credentialType: simulatedCredType,
                    timestamp: new Date().toISOString(),
                    apiKey,
                  });
                  setHardwareScanFeedback({
                    success: res.success,
                    status: res.status,
                    message: res.message,
                    record: res.record,
                  });
                  onRefresh();
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>Simulate Hardware Tap</span>
              </button>
            </div>

            {/* Scan Feedback Banner */}
            {hardwareScanFeedback && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 animate-fadeIn ${
                  hardwareScanFeedback.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : hardwareScanFeedback.status === 'DUPLICATE'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold">
                    {hardwareScanFeedback.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : hardwareScanFeedback.status === 'DUPLICATE' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600" />
                    )}
                    <span className="text-sm">Scan Result: {hardwareScanFeedback.status}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs">{hardwareScanFeedback.message}</p>
                {hardwareScanFeedback.record && (
                  <div className="text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-200/60">
                    Record ID: {hardwareScanFeedback.record.id} • Method: {hardwareScanFeedback.record.method} • Source: <strong>{hardwareScanFeedback.record.source || 'hardware'}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Registered Classroom Devices Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Classroom Hardware Readers</h4>
                <p className="text-xs text-slate-500 mt-0.5">Physical RFID & Fingerprint scanners deployed in lecture halls</p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {db.getHardwareDevices().length} Devices Registered
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Device ID & Name</th>
                    <th className="py-2.5 px-4">Classroom</th>
                    <th className="py-2.5 px-4">Reader Type</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">API Key Token</th>
                    <th className="py-2.5 px-4">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.getHardwareDevices().map(dev => (
                    <tr key={dev.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{dev.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{dev.deviceId}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{dev.room}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {dev.deviceType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{dev.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        ••••••••{dev.apiKey.slice(-4)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {dev.lastHeartbeat ? new Date(dev.lastHeartbeat).toLocaleTimeString() : 'Online'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Biometric & RFID Credential Registry */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Student Hardware Biometric Registry</h4>
                <p className="text-xs text-slate-500 mt-0.5">Pair student IDs with RFID UIDs and optical fingerprint template IDs</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Student Name & Roll</th>
                    <th className="py-2.5 px-4">Class Year & Sem</th>
                    <th className="py-2.5 px-4">RFID Card UID</th>
                    <th className="py-2.5 px-4">Fingerprint Template ID</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allStudents.map(stu => (
                    <tr key={stu.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-slate-900 mr-2">{stu.name}</span>
                        <span className="font-mono text-[11px] text-slate-500">({stu.studentId})</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        Yr {stu.year}, Sem {stu.semester}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        {stu.rfidCardUid ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {stu.rfidCardUid}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not Linked</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        {stu.fingerprintTemplateId ? (
                          <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {stu.fingerprintTemplateId}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not Linked</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setLinkModalStudent(stu);
                            setLinkRfidInput(stu.rfidCardUid || '');
                            setLinkFingerprintInput(stu.fingerprintTemplateId || '');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hardware Scan Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="font-bold text-slate-900 text-sm">Classroom Device Scan Event Logs</h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Real-time stream of all physical scans, deduplications, and validations
              </span>
            </div>

            {db.getHardwareScanLogs().length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No scan events recorded yet. Try testing a scan in the simulator above!
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-4">Device & Room</th>
                      <th className="py-2 px-4">Credential ID</th>
                      <th className="py-2 px-4">Type</th>
                      <th className="py-2 px-4">Student</th>
                      <th className="py-2 px-4">Result Status</th>
                      <th className="py-2 px-4">Details / Error</th>
                      <th className="py-2 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {db.getHardwareScanLogs().slice(0, 20).map(log => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2 px-4 font-semibold text-slate-800">
                          {log.deviceId}
                        </td>
                        <td className="py-2 px-4 font-mono text-slate-600">{log.credentialId}</td>
                        <td className="py-2 px-4">
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
                            {log.credentialType}
                          </span>
                        </td>
                        <td className="py-2 px-4 font-medium text-slate-900">{log.studentName || '-'}</td>
                        <td className="py-2 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'DUPLICATE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-slate-500 max-w-xs truncate">{log.reason || '-'}</td>
                        <td className="py-2 px-4 text-slate-400 text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADJUST CONDUCTED CLASS COUNT */}
      {adjustModalOffering && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Adjust Conducted Classes Count
              </h3>
              <button
                onClick={() => setAdjustModalOffering(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">
                {courses.find(c => c.id === adjustModalOffering.courseId)?.code} -{' '}
                {courses.find(c => c.id === adjustModalOffering.courseId)?.name}
              </div>
              <div className="text-slate-500">
                Scheduled Total: <strong>{adjustModalOffering.plannedClasses} classes</strong> • Current Conducted: <strong>{adjustModalOffering.conductedClasses} classes</strong>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  New Conducted Classes Count (Must be between 0 and {adjustModalOffering.plannedClasses})
                </label>
                <input
                  type="number"
                  min="0"
                  max={adjustModalOffering.plannedClasses}
                  value={adjustCountInput}
                  onChange={e => setAdjustCountInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mandatory Adjustment Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={adjustReasonInput}
                  onChange={e => setAdjustReasonInput(e.target.value)}
                  placeholder="e.g. Class on Oct 24 cancelled due to university convocation, or scheduled makeup lecture added."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setAdjustModalOffering(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const res = db.adjustConductedClasses({
                    courseOfferingId: adjustModalOffering.id,
                    newConductedCount: adjustCountInput,
                    changedBy: currentTeacher.name,
                    reason: adjustReasonInput,
                    userRole: userProfile?.role,
                    teacherId: currentTeacher.id,
                  });
                  setAdjustFeedback({ success: res.success, message: res.message });
                  if (res.success) {
                    setAdjustModalOffering(null);
                    onRefresh();
                  }
                }}
                disabled={!adjustReasonInput.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER HARDWARE DEVICE */}
      {isRegisterDeviceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Register Classroom Hardware Reader</h3>
              <button
                onClick={() => setIsRegisterDeviceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Device ID / MAC Address</label>
                <input
                  type="text"
                  placeholder="e.g. DEV-R501-DUAL"
                  value={newDeviceForm.deviceId}
                  onChange={e => setNewDeviceForm({ ...newDeviceForm, deviceId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Device Name / Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Lab 501 Wall Terminal"
                  value={newDeviceForm.name}
                  onChange={e => setNewDeviceForm({ ...newDeviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Classroom / Room Number</label>
                <input
                  type="text"
                  placeholder="e.g. Room 304 or Lab 402"
                  value={newDeviceForm.room}
                  onChange={e => setNewDeviceForm({ ...newDeviceForm, room: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Hardware Sensor Type</label>
                <select
                  value={newDeviceForm.deviceType}
                  onChange={e => setNewDeviceForm({ ...newDeviceForm, deviceType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="RFID">RFID Card Scanner (RC522 / PN532)</option>
                  <option value="FINGERPRINT">Optical Fingerprint Scanner (R307 / AS608)</option>
                  <option value="DUAL">Dual RFID + Fingerprint Terminal</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Device Secret API Key</label>
                <input
                  type="text"
                  placeholder="Enter secret key for device authentication"
                  value={newDeviceForm.apiKey}
                  onChange={e => setNewDeviceForm({ ...newDeviceForm, apiKey: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsRegisterDeviceModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newDeviceForm.deviceId || !newDeviceForm.name) return;
                  db.registerHardwareDevice({
                    deviceId: newDeviceForm.deviceId.trim(),
                    name: newDeviceForm.name.trim(),
                    room: newDeviceForm.room.trim(),
                    building: newDeviceForm.building.trim() || 'Academic Complex',
                    deviceType: newDeviceForm.deviceType,
                    apiKey: newDeviceForm.apiKey.trim() || 'dev-key-' + Date.now(),
                    status: 'ACTIVE',
                  });
                  setIsRegisterDeviceModalOpen(false);
                  onRefresh();
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                Register Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LINK STUDENT BIOMETRIC / RFID CREDENTIALS */}
      {linkModalStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Pair Hardware Credentials for {linkModalStudent.name}
              </h3>
              <button
                onClick={() => setLinkModalStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">RFID Card Serial UID</label>
                <input
                  type="text"
                  placeholder="e.g. RFID-CS-2023-0101 or 4-byte HEX"
                  value={linkRfidInput}
                  onChange={e => setLinkRfidInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Fingerprint Template Feature ID / Hash
                </label>
                <input
                  type="text"
                  placeholder="e.g. FP-TMPL-90412-A"
                  value={linkFingerprintInput}
                  onChange={e => setLinkFingerprintInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Note: Only cryptographic template IDs or hashes are stored; raw biometric images are never uploaded.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setLinkModalStudent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  db.linkStudentBiometrics({
                    studentId: linkModalStudent.id,
                    rfidCardUid: linkRfidInput.trim() || undefined,
                    fingerprintTemplateId: linkFingerprintInput.trim() || undefined,
                  });
                  setLinkModalStudent(null);
                  onRefresh();
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}
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
