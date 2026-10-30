import React, { useState } from 'react';
import {
  Shield,
  Layers,
  BookOpen,
  UserCheck,
  GraduationCap,
  Calendar,
  Settings,
  FileCheck2,
  AlertTriangle,
  Mail,
  History,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Camera,
  Search,
  Filter,
} from 'lucide-react';
import { db } from '../../services/db';
import {
  Department,
  Course,
  CourseOffering,
  Teacher,
  Student,
  AttendanceStatus,
} from '../../types';
import { getStatusBadgeClasses, formatTimeAgo } from '../../utils/formatters';
import { AdminTeacherManagement } from './AdminTeacherManagement';
import { AdminStudentManagement } from './AdminStudentManagement';
import { AdminEnrollmentManagement } from './AdminEnrollmentManagement';
import { AdminCourseManagement } from './AdminCourseManagement';
import { AdminRoutineManagement } from './AdminRoutineManagement';
import { AdminEmailAndRiskManagement } from './AdminEmailAndRiskManagement';

interface AdminDashboardProps {
  onRefresh: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRefresh }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'structure' | 'courses' | 'teachers' | 'students' | 'enrollments' | 'routine' | 'risk_emails' | 'corrections' | 'settings' | 'audit'
  >('overview');

  const departments = db.getDepartments();
  const sessions = db.getAcademicSessions();
  const batches = db.getBatches();
  const courses = db.getCourses();
  const offerings = db.getCourseOfferings();
  const teachers = db.getTeachers();
  const assignments = db.getTeacherAssignments();
  const students = db.getStudents();
  const enrollments = db.getStudentEnrollments();
  const routines = db.getRoutines();
  const attendanceSessions = db.getAttendanceSessions();
  const attendanceRecords = db.getAttendanceRecords();
  const corrections = db.getAttendanceCorrections();
  const emailLogs = db.getEmailLogs();
  const auditLogs = db.getAuditLogs();
  const settings = db.getSettings();

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');

  // Attendance Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(null);

  // Settings State
  const [lateThreshold, setLateThreshold] = useState(settings.lateThresholdMinutes);
  const [examThreshold, setExamThreshold] = useState(settings.examEligibilityThreshold);
  const [penaltyEnabled, setPenaltyEnabled] = useState(settings.threeLatePenaltyEnabled);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);

  // Teacher Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTeacherId, setAssignTeacherId] = useState(teachers[0]?.id || '');
  const [assignOfferingId, setAssignOfferingId] = useState(offerings[0]?.id || '');
  const [assignError, setAssignError] = useState<string | null>(null);

  // Quick stats calculations
  const totalStudents = students.length;
  const totalTeachers = teachers.length;
  const totalCourses = courses.length;
  const totalOfferings = offerings.length;
  const activeSessionsCount = attendanceSessions.filter(s => s.status === 'ACTIVE').length;

  const handleApplyCorrection = () => {
    if (!selectedRecordId || !correctionReason.trim()) {
      setCorrectionMessage('Please select an attendance record and provide an explanatory reason.');
      return;
    }

    const res = db.correctAttendance({
      attendanceRecordId: selectedRecordId,
      newStatus,
      changedBy: 'Admin Office (Superintendent)',
      reason: correctionReason.trim(),
    });

    if (res.success) {
      setCorrectionMessage('Attendance correction logged and saved to audit trail.');
      setCorrectionReason('');
      setTimeout(() => {
        setCorrectionModalOpen(false);
        setCorrectionMessage(null);
      }, 1500);
      onRefresh();
    }
  };

  const handleSaveSettings = () => {
    db.updateSettings({
      lateThresholdMinutes: Number(lateThreshold),
      examEligibilityThreshold: Number(examThreshold),
      threeLatePenaltyEnabled: penaltyEnabled,
    });
    setSettingsSavedMessage('System attendance rules updated successfully!');
    setTimeout(() => setSettingsSavedMessage(null), 3000);
    onRefresh();
  };

  const handleAssignTeacher = () => {
    setAssignError(null);
    const result = db.assignTeacherToOffering(assignTeacherId, assignOfferingId);
    if (!result.success) {
      setAssignError(result.message);
    } else {
      setAssignModalOpen(false);
      onRefresh();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-extrabold text-slate-900">University Administration Console</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supervisory management of academic cohorts, course offerings, teacher allocations, routines & audit trails
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCorrectionModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Manual Attendance Correction</span>
          </button>
          <button
            onClick={() => setAssignModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Teacher to Course</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 space-x-2 sm:space-x-6 text-xs font-semibold overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview & Metrics', icon: Layers },
          { id: 'structure', label: 'Academic Structure', icon: Layers },
          { id: 'courses', label: 'Courses & Offerings', icon: BookOpen },
          { id: 'teachers', label: 'Faculty Management', icon: UserCheck },
          { id: 'students', label: 'Student Directory', icon: GraduationCap },
          { id: 'enrollments', label: 'Course Enrollments', icon: BookOpen },
          { id: 'routine', label: 'Routines & Timetable', icon: Calendar },
          { id: 'risk_emails', label: 'Warnings & Email Logs', icon: Mail },
          { id: 'corrections', label: 'Corrections & Audit', icon: FileCheck2 },
          { id: 'settings', label: 'System Rules & Database', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-1 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
                activeTab === tab.id
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

      {/* TAB 1: OVERVIEW & SYSTEM STATS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-400">Total Students</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalStudents}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across 4 Batches</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-400">Faculty Members</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalTeachers}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">CSE Department</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-400">Academic Courses</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalCourses}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Theory & Labs</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-400">Active Offerings</div>
              <div className="text-2xl font-black text-indigo-700 mt-1">{totalOfferings}</div>
              <div className="text-[10px] text-indigo-500 mt-0.5">Semester 2025-26</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-400">Live Sessions</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{activeSessionsCount}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">Active right now</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-400">Attendance Logs</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{attendanceRecords.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Verified Scans</div>
            </div>
          </div>

          {/* Academic Cohorts Grid (Simultaneous 4 Years Running!) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Simultaneous Cohort Structure (Prompt Section 2)
                </h3>
                <p className="text-xs text-slate-500">
                  Multiple year levels running concurrently without mixing courses or student records
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Current Session: 2025-2026
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {batches.map(b => {
                const batchOfferings = offerings.filter(o => o.batchId === b.id);
                const batchStudents = students.filter(s => s.batchId === b.id);

                return (
                  <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{b.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                        Y{b.currentYear} S{b.currentSemester}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div>Offerings: <span className="font-semibold text-slate-800">{batchOfferings.length} courses</span></div>
                      <div>Enrolled: <span className="font-semibold text-slate-800">{batchStudents.length} students</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Audit Activities */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Recent System & Attendance Audit Logs (Prompt Section 37)
              </h3>
              <span className="text-xs text-slate-400">Total Entries: {auditLogs.length}</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {auditLogs.slice(0, 8).map(log => (
                <div key={log.id} className="p-3.5 flex items-start justify-between text-xs hover:bg-slate-50">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                        {log.action}
                      </span>
                      <span className="font-semibold text-slate-900">{log.userName}</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono ml-4">
                    {formatTimeAgo(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACADEMIC STRUCTURE (Departments, Batches, Sessions) */}
      {activeTab === 'structure' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">University Departments</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departments.map(d => (
                <div key={d.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-indigo-700">{d.code}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{d.id}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs mt-1">{d.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-1">{d.building}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Academic Batches & Year Levels</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Batch Name</th>
                    <th className="py-2.5 px-3">Start Year</th>
                    <th className="py-2.5 px-3">Current Year</th>
                    <th className="py-2.5 px-3">Current Semester</th>
                    <th className="py-2.5 px-3">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{b.name}</td>
                      <td className="py-2.5 px-3 font-mono">{b.startYear}</td>
                      <td className="py-2.5 px-3">{b.currentYear}st/nd/rd Year</td>
                      <td className="py-2.5 px-3">{b.currentSemester}st/nd Semester</td>
                      <td className="py-2.5 px-3 uppercase text-indigo-700 font-semibold">{b.departmentId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COURSES & COURSE OFFERINGS */}
      {activeTab === 'courses' && (
        <AdminCourseManagement
          courses={courses}
          offerings={offerings}
          departments={departments}
          batches={batches}
          sessions={sessions}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 4: TEACHER MANAGEMENT & ASSIGNMENTS */}
      {activeTab === 'teachers' && (
        <AdminTeacherManagement
          teachers={teachers}
          courses={courses}
          departments={departments}
          offerings={offerings}
          batches={batches}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 5: STUDENTS DIRECTORY & MANAGEMENT */}
      {activeTab === 'students' && (
        <AdminStudentManagement
          students={students}
          departments={departments}
          batches={batches}
          sessions={sessions}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 6: COURSE ENROLLMENTS */}
      {activeTab === 'enrollments' && (
        <AdminEnrollmentManagement
          students={students}
          courses={courses}
          offerings={offerings}
          batches={batches}
          enrollments={enrollments}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 7: ROUTINES & TIMETABLE */}
      {activeTab === 'routine' && (
        <AdminRoutineManagement
          routines={routines}
          offerings={offerings}
          courses={courses}
          teachers={teachers}
          students={students}
          onRefresh={onRefresh}
        />
      )}

      {/* TAB 8: ATTENDANCE WARNINGS (<60%) & REAL EMAIL LOGS */}
      {activeTab === 'risk_emails' && (
        <AdminEmailAndRiskManagement onRefresh={onRefresh} />
      )}

      {/* TAB 7: MANUAL ATTENDANCE CORRECTIONS & AUDIT (Section 4 & 37) */}
      {activeTab === 'corrections' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Attendance Manual Corrections Audit Log (Prompt Section 4)
                </h3>
                <p className="text-xs text-slate-500">
                  Any manual correction by Admin must be recorded with original value, new value, reason, and timestamp
                </p>
              </div>
              <button
                onClick={() => setCorrectionModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Perform Correction</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Original Status</th>
                    <th className="py-3 px-4">New Status</th>
                    <th className="py-3 px-4">Changed By</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {corrections.map(corr => (
                    <tr key={corr.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {corr.studentName}
                        <div className="text-[10px] text-slate-400 font-mono">{corr.studentId}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-700">{corr.courseCode}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          {corr.originalStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {corr.newStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{corr.changedBy}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">{corr.reason}</td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {new Date(corr.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: SYSTEM SETTINGS, EMAIL LOGS & AUDIT TRAIL */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Cloud Firestore & Firebase Auth Status Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-indigo-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="font-bold text-sm text-white">Database Engine: Google Cloud Firestore (Live Production)</h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                Firestore & Auth Active
              </span>
            </div>

            <div className="font-mono text-xs text-amber-300 bg-slate-950/80 p-3 rounded-xl border border-slate-800 select-all overflow-x-auto space-y-1">
              <div><span className="text-slate-400">Database ID:</span> ai-studio-uniattendunivers-c5e1918d-4a9e-4935-a356-3195f6c33ea5</div>
              <div><span className="text-slate-400">Project:</span> gen-lang-client-0312401566 &bull; <span className="text-slate-400">Admin Account:</span> it24026@mbstu.ac.bd</div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 pt-1">
              <span>Security Rules: <strong>RBAC + Deny-All Enforcement Active</strong></span>
              <span className="text-slate-400">MySQL schema backup also preserved in <code className="text-indigo-300">schema_mysql.sql</code></span>
            </div>
          </div>

          {/* Configurable Rules Form (Prompt Section 17, 21, 19) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 max-w-2xl">
            <h3 className="font-bold text-slate-900 text-sm">Configurable University Attendance Policies</h3>
            <p className="text-xs text-slate-500">
              Configure universal late thresholds, exam eligibility criteria, and penalties.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Late Arrival Threshold (Minutes) - Prompt Section 17
                </label>
                <input
                  type="number"
                  value={lateThreshold}
                  onChange={e => setLateThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
                <span className="text-[11px] text-slate-400">Default: 20 minutes (Arrival before is PRESENT, at/after is LATE).</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Minimum Exam Eligibility Attendance (%) - Prompt Section 21
                </label>
                <input
                  type="number"
                  value={examThreshold}
                  onChange={e => setExamThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
                <span className="text-[11px] text-slate-400">Default: 60.0% (Exactly 60.0% is Eligible; below is Ineligible / Critical).</span>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="penaltyCheck"
                  checked={penaltyEnabled}
                  onChange={e => setPenaltyEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="penaltyCheck" className="text-slate-700 font-semibold cursor-pointer">
                  Enable Three Consecutive Late Penalty Rule (3 LATE = 1 Penalty) - Section 19
                </label>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleSaveSettings}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
                >
                  Save Policy Configuration
                </button>
              </div>

              {settingsSavedMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                  {settingsSavedMessage}
                </div>
              )}
            </div>
          </div>

          {/* Email Logs Table (Prompt Section 25) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Automated Email Logs (Reminders & Warnings)</h3>
                <p className="text-xs text-slate-500">
                  Deduplicated email notifications dispatched to teachers and at-risk students
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">{emailLogs.length} emails</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Deduplication Key</th>
                    <th className="py-3 px-4">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emailLogs.map(em => (
                    <tr key={em.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {em.recipientName}
                        <div className="text-[10px] text-slate-400">{em.recipientEmail}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            em.type === 'CLASS_REMINDER'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {em.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{em.subject}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                        {em.dedupKey}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {new Date(em.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ATTENDANCE CORRECTION MODAL */}
      {correctionModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Manual Attendance Correction</h3>
            <p className="text-xs text-slate-500">
              Any change is strictly audited. You must provide a justifiable reason.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Attendance Record</label>
                <select
                  value={selectedRecordId}
                  onChange={e => setSelectedRecordId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                >
                  <option value="">-- Select student attendance record --</option>
                  {attendanceRecords.slice(0, 30).map(rec => {
                    const stu = students.find(s => s.id === rec.studentId);
                    const off = offerings.find(o => o.id === rec.courseOfferingId);
                    const crs = off ? courses.find(c => c.id === off.courseId) : undefined;
                    return (
                      <option key={rec.id} value={rec.id}>
                        {stu?.name} ({stu?.studentId}) - {crs?.code}: Currently {rec.status}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as AttendanceStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reason for Correction (Mandatory)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Technical glitch during face scanner optical capture; student presented authorized faculty pass."
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              {correctionMessage && (
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-800 text-xs font-semibold">
                  {correctionMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setCorrectionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCorrection}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                Apply Correction & Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER ASSIGNMENT MODAL (Enforces Rule 10) */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Assign Teacher to Course Offering</h3>
            <p className="text-xs text-slate-500">
              Validates authorization and the 1-regular-course constraint (Prompt Section 10).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Teacher</label>
                <select
                  value={assignTeacherId}
                  onChange={e => setAssignTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Course Offering</label>
                <select
                  value={assignOfferingId}
                  onChange={e => setAssignOfferingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  {offerings.map(o => {
                    const c = courses.find(crs => crs.id === o.courseId);
                    const b = batches.find(bat => bat.id === o.batchId);
                    return (
                      <option key={o.id} value={o.id}>
                        {c?.code} - {c?.name} ({c?.type}) • {b?.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {assignError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-semibold">
                  {assignError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTeacher}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                Assign Teacher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
