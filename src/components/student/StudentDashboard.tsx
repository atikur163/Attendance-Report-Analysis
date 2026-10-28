import React, { useState } from 'react';
import {
  QrCode,
  Scan,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  AlertCircle,
  TrendingUp,
  FileCheck,
  Shield,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { db } from '../../services/db';
import { computeStudentCourseAnalytics } from '../../services/attendanceEngine';
import { QRService } from '../../services/qrService';
import { CameraCaptureModal } from '../common/CameraCaptureModal';
import { getRiskBadgeClasses, getStatusBadgeClasses, formatTimeAgo } from '../../utils/formatters';

interface StudentDashboardProps {
  studentId: string;
  onRefresh: () => void;
  isMobileFrame?: boolean;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  studentId,
  onRefresh,
  isMobileFrame = false,
}) => {
  const [activeTab, setActiveTab] = useState<'courses' | 'history' | 'biometrics'>('courses');
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [selectedSessionForFace, setSelectedSessionForFace] = useState<string | null>(null);
  const [selectedOfferingForFace, setSelectedOfferingForFace] = useState<string | null>(null);

  // Scanner modal / interactive token input
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const student = db.getStudents().find(s => s.id === studentId) || db.getStudents()[0];
  const enrollments = db.getStudentEnrollments().filter(e => e.studentId === student.id && e.status === 'ENROLLED');
  const courseOfferings = db.getCourseOfferings();
  const courses = db.getCourses();
  const allRecords = db.getAttendanceRecords().filter(r => r.studentId === student.id);
  const settings = db.getSettings();
  const faceProfile = db.getFaceProfile(student.id);

  // Compute analytics for each registered course
  const studentCourses = enrollments.map(enr => {
    const offering = courseOfferings.find(co => co.id === enr.courseOfferingId)!;
    const course = courses.find(c => c.id === offering.courseId)!;
    const courseRecords = allRecords.filter(r => r.courseOfferingId === offering.id);

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

    return {
      enrollment: enr,
      offering,
      course,
      analytics,
      records: courseRecords,
    };
  });

  // Calculate student overall summary
  const totalConducted = studentCourses.reduce((sum, sc) => sum + sc.analytics.conductedClasses, 0);
  const totalEffective = studentCourses.reduce((sum, sc) => sum + sc.analytics.effectivePresentCount, 0);
  const overallPercentage = totalConducted > 0 ? Number(((totalEffective / totalConducted) * 100).toFixed(1)) : 100.0;
  const criticalCourses = studentCourses.filter(sc => sc.analytics.riskLevel === 'CRITICAL');
  const warningCourses = studentCourses.filter(sc => sc.analytics.riskLevel === 'WARNING' || sc.analytics.riskLevel === 'HIGH_RISK');

  // Find active attendance sessions for student's courses right now
  const activeSessions = db.getAttendanceSessions().filter(sess => {
    return (
      sess.status === 'ACTIVE' &&
      studentCourses.some(sc => sc.offering.id === sess.courseOfferingId)
    );
  });

  // Handler for dynamic QR check-in
  const handleCheckInWithQR = (tokenString?: string) => {
    const token = tokenString || manualTokenInput.trim();
    if (!token) {
      setScanFeedback({ success: false, message: 'Please enter or scan a valid session QR token' });
      return;
    }

    // Validate QR payload
    const validation = QRService.validateScannedPayload(token, student.id);
    if (!validation.valid || !validation.sessionId) {
      setScanFeedback({ success: false, message: validation.reason || 'Invalid QR Token' });
      return;
    }

    // Record attendance
    const recordResult = db.recordStudentAttendance({
      sessionId: validation.sessionId,
      studentId: student.id,
      method: 'QR',
      minutesLate: validation.minutesLate ?? 5,
    });

    setScanFeedback({
      success: recordResult.success,
      message: recordResult.message,
    });

    if (recordResult.success) {
      setManualTokenInput('');
      onRefresh();
    }
  };

  return (
    <div className={`space-y-6 ${isMobileFrame ? 'max-w-md mx-auto px-2 py-4' : 'max-w-7xl mx-auto px-4 py-8'}`}>
      {/* Student Identity Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <img
                src={student.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'}
                alt={student.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-400/40 shadow-md"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-indigo-950 ${
                  student.hasFaceProfile ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                title={student.hasFaceProfile ? 'Biometric Face Enrolled' : 'Face Not Enrolled'}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">{student.name}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-indigo-200 border border-white/10 font-bold">
                  {student.studentId}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                {student.year}st Year, {student.semester}st Semester • Dept of CSE • Section {student.section}
              </p>
            </div>
          </div>

          {/* Quick Metrics Header */}
          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10">
            <div>
              <div className="text-[10px] text-indigo-200 font-medium uppercase tracking-wider">Overall Rate</div>
              <div className="text-lg font-extrabold text-white">{overallPercentage}%</div>
            </div>
            <div className="h-7 w-px bg-white/20" />
            <div>
              <div className="text-[10px] text-indigo-200 font-medium uppercase tracking-wider">Exam Status</div>
              <div className={`text-xs font-bold ${overallPercentage >= 60 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {overallPercentage >= 60 ? 'Eligible (≥60%)' : 'At Risk (<60%)'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Warnings Banner (If Any Risk Courses) */}
      {criticalCourses.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex items-start space-x-3 shadow-xs animate-pulse">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <p className="font-bold">
              Critical Attendance Warning ({criticalCourses.length} Course Below 60% Exam Eligibility)
            </p>
            <p className="mt-0.5 text-rose-700">
              Your attendance in{' '}
              {criticalCourses.map(c => `${c.course.code} (${c.analytics.attendancePercentage}%)`).join(', ')}{' '}
              violates the university minimum exam threshold. Automatic warning emails have been logged.
            </p>
          </div>
        </div>
      )}

      {/* LIVE ACTIVE CLASS ATTENDANCE BANNER (IF TEACHER STARTED A CLASS NOW) */}
      {activeSessions.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                Attendance Session Active Now
              </span>
            </div>
            <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-mono">
              Late rule: {settings.lateThresholdMinutes}m
            </span>
          </div>

          {activeSessions.map(sess => {
            const offering = courseOfferings.find(o => o.id === sess.courseOfferingId);
            const course = offering ? courses.find(c => c.id === offering.courseId) : undefined;
            const alreadyCheckedIn = allRecords.some(r => r.sessionId === sess.id);

            return (
              <div
                key={sess.id}
                className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-bold text-sm text-white">
                    {course?.code} - {course?.name}
                  </h4>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Mode: <span className="font-bold">{sess.attendanceMethod} Attendance</span> • Time: {sess.startTime} - {sess.endTime}
                  </p>
                </div>

                {alreadyCheckedIn ? (
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 text-emerald-950 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attendance Marked</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    {sess.attendanceMethod === 'QR' ? (
                      <button
                        onClick={() => {
                          setManualTokenInput(sess.currentToken);
                          setIsQRScannerOpen(true);
                        }}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold shadow-xs transition-all active:scale-95"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Scan / Check In</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedSessionForFace(sess.id);
                          setSelectedOfferingForFace(sess.courseOfferingId);
                          setIsFaceModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold shadow-xs transition-all active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Face Verification</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('courses')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'courses'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Registered Courses ({studentCourses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'history'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>My Attendance Log ({allRecords.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('biometrics')}
          className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === 'biometrics'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Biometric Profile</span>
        </button>
      </div>

      {/* TAB 1: REGISTERED COURSES (Filtered to Current Semester!) */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Current Semester Course Offerings
            </h3>
            <span className="text-[11px] text-slate-400">
              Exam Requirement: 60.0% Effective Attendance
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentCourses.map(({ course, offering, analytics }) => {
              const riskBadges = getRiskBadgeClasses(analytics.riskLevel);

              return (
                <div
                  key={offering.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {course.code}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                            course.type === 'THEORY'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {course.type} • {course.credit} Cr
                        </span>
                      </div>

                      {/* 60% Exam Eligibility Badge */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          analytics.examEligible
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                        }`}
                      >
                        {analytics.examEligible ? 'Exam Eligible' : 'Ineligible (<60%)'}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mt-2">{course.name}</h4>
                  </div>

                  {/* Attendance Percentage & Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 font-medium">Attendance Rate</span>
                      <span className="text-xl font-extrabold text-slate-900">
                        {analytics.attendancePercentage}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          analytics.attendancePercentage >= 75
                            ? 'bg-emerald-500'
                            : analytics.attendancePercentage >= 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, analytics.attendancePercentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* Detailed Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Present</div>
                      <div className="font-bold text-emerald-700 text-sm">{analytics.presentCount}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Late</div>
                      <div className="font-bold text-amber-700 text-sm">{analytics.lateCount}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Absent</div>
                      <div className="font-bold text-rose-700 text-sm">{analytics.absentCount}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl" title="3 consecutive lates = 1 penalty deduction">
                      <div className="text-[10px] text-slate-400 font-medium">3-Late Pen.</div>
                      <div className="font-bold text-slate-700 text-sm">{analytics.penaltyCount}</div>
                    </div>
                  </div>

                  {/* Academic Projections & Recoverability (Prompt Section 23) */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Classes Conducted:</span>
                      <span className="font-bold text-slate-800">
                        {analytics.conductedClasses} / {analytics.plannedClasses} (Remaining: {analytics.remainingClasses})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Max Possible Attendance:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {analytics.maximumPossibleAttendance}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Required Future Classes:</span>
                      <span className="font-bold text-indigo-700 font-mono">
                        {analytics.requiredFutureAttendance} classes to hit 60%
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Recoverability:</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                          analytics.isRecoverable
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {analytics.isRecoverable ? 'Recoverable' : 'CRITICAL / NOT RECOVERABLE'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE HISTORY LOG */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Verified Attendance Timeline
            </h3>
            <span className="text-xs text-slate-500">
              Total Records: {allRecords.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {allRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No attendance records recorded yet.
              </div>
            ) : (
              allRecords.map(rec => {
                const offering = courseOfferings.find(o => o.id === rec.courseOfferingId);
                const course = offering ? courses.find(c => c.id === offering.courseId) : undefined;
                const statusClasses = getStatusBadgeClasses(rec.status);

                return (
                  <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                        {rec.method === 'FACE' ? <Camera className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">{course?.code}</span>
                          <span className="text-xs text-slate-600 hidden sm:inline">{course?.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                          <span>{new Date(rec.timestamp).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span className="capitalize">{rec.method.toLowerCase()} scan</span>
                          {rec.minutesLate > 0 && <span>({rec.minutesLate}m after start)</span>}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusClasses.bg} ${statusClasses.text} ${statusClasses.border}`}>
                      {rec.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BIOMETRIC PROFILE MANAGEMENT */}
      {activeTab === 'biometrics' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Face Recognition Enrollment</h4>
                <p className="text-xs text-slate-500">
                  Model Version: {faceProfile?.modelVersion || 'v2.1-mobilenet-ssd'}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                faceProfile && faceProfile.status === 'REGISTERED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}
            >
              {faceProfile && faceProfile.status === 'REGISTERED' ? 'Active Biometric Profile' : 'Not Registered'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            UniAttend uses a 128-dimensional geometric landmark vector matching algorithm. Raw camera images are not transmitted publicly; only encrypted facial vectors are compared against your registered biometric profile during attendance.
          </p>

          {faceProfile && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Eye Distance</div>
                <div className="font-bold text-slate-800">{faceProfile.features.eyeDistance} px</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Jaw Width</div>
                <div className="font-bold text-slate-800">{faceProfile.features.jawWidth} px</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Nose Length</div>
                <div className="font-bold text-slate-800">{faceProfile.features.noseLength} px</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Face Ratio</div>
                <div className="font-bold text-slate-800">{faceProfile.features.faceRatio}</div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => setIsFaceModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>{faceProfile ? 'Update Face Biometrics' : 'Enroll Face Biometrics'}</span>
            </button>
          </div>
        </div>
      )}

      {/* QR SCANNER / CODE CHECK-IN MODAL */}
      {isQRScannerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">Dynamic QR Attendance Check-In</h4>
              </div>
              <button
                onClick={() => {
                  setIsQRScannerOpen(false);
                  setScanFeedback(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Scan the dynamic rolling QR code from the teacher's podium screen, or enter the session token:
            </p>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Paste or enter Session Token (e.g. UNI-QR-...)"
                value={manualTokenInput}
                onChange={e => setManualTokenInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleCheckInWithQR()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                Validate & Mark Attendance
              </button>
            </div>

            {scanFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                  scanFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                {scanFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{scanFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Face Biometric Camera Modal */}
      <CameraCaptureModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        mode={selectedSessionForFace ? 'VERIFY' : 'ENROLL'}
        studentId={student.id}
        sessionId={selectedSessionForFace || undefined}
        courseOfferingId={selectedOfferingForFace || undefined}
        onSuccess={result => {
          if (selectedSessionForFace) {
            // Record face attendance
            db.recordStudentAttendance({
              sessionId: selectedSessionForFace,
              studentId: student.id,
              method: 'FACE',
              minutesLate: 5,
            });
            onRefresh();
          } else {
            onRefresh();
          }
        }}
      />
    </div>
  );
};
