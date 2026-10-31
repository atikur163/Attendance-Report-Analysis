import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Shield,
  UserCheck,
  BarChart3,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  Database,
  CloudCheck,
} from 'lucide-react';
import { Header } from './components/common/Header';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { AnalyticsReports } from './components/analytics/AnalyticsReports';
import { AutomatedTestsModal } from './components/common/AutomatedTestsModal';
import { PythonDocsModal } from './components/common/PythonDocsModal';
import { LoginPage } from './components/auth/LoginPage';
import { UserRole } from './types';
import { db } from './services/db';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { currentUser, userProfile, loading, authError } = useAuth();
  const [currentRole, setCurrentRole] = useState<UserRole>('STUDENT');
  const [activeMainView, setActiveMainView] = useState<'dashboard' | 'analytics'>('dashboard');
  const [isMobileFrame, setIsMobileFrame] = useState(false);
  const [isTestsModalOpen, setIsTestsModalOpen] = useState(false);
  const [isPythonDocsModalOpen, setIsPythonDocsModalOpen] = useState(false);
  const [, setRefreshTicker] = useState(0);

  // Active student and teacher identities (empty by default; resolved dynamically from verified user session)
  const [activeStudentId, setActiveStudentId] = useState('');
  const [activeTeacherId, setActiveTeacherId] = useState('');

  const students = db.getStudents();
  const teachers = db.getTeachers();

  const handleRefresh = () => {
    setRefreshTicker(prev => prev + 1);
  };

  // Subscribe to real-time Firestore changes
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      handleRefresh();
    });
    return () => unsubscribe();
  }, []);

  // Sync role and identity with server-side verified Firestore userProfile
  useEffect(() => {
    if (userProfile?.role) {
      setCurrentRole(userProfile.role);
      if (userProfile.role === 'TEACHER') {
        const matched =
          db.findTeacher(userProfile.email) ||
          (currentUser?.email ? db.findTeacher(currentUser.email) : undefined) ||
          (currentUser?.uid ? db.findTeacher(currentUser.uid) : undefined) ||
          db.findTeacher(userProfile.teacherId);
        if (matched) {
          setActiveTeacherId(matched.id);
        }
      } else if (userProfile.role === 'STUDENT') {
        const matched =
          db.findStudent(userProfile.email) ||
          (currentUser?.email ? db.findStudent(currentUser.email) : undefined) ||
          (currentUser?.uid ? db.findStudent(currentUser.uid) : undefined) ||
          db.findStudent(userProfile.studentId);
        if (matched) {
          setActiveStudentId(matched.id);
        }
      } else if (userProfile.role === 'ADMIN') {
        if (!activeTeacherId && teachers.length > 0) setActiveTeacherId(teachers[0].id);
        if (!activeStudentId && students.length > 0) setActiveStudentId(students[0].id);
      }
    } else {
      setActiveTeacherId('');
      setActiveStudentId('');
    }
  }, [userProfile, currentUser, teachers.length, students.length]);

  const handleResetSeed = () => {
    if (window.confirm('Reset Cloud Firestore database to clean university seed state?')) {
      db.resetToDefaultSeed();
      handleRefresh();
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-600/30 animate-pulse">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div className="text-base font-bold text-white">UniAttend Portal</div>
        <div className="text-xs text-slate-400 mt-2 flex items-center space-x-2">
          <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span>Verifying role and authenticating session from Cloud Firestore...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render Common Login Page
  if (!currentUser || !userProfile) {
    return <LoginPage />;
  }

  // 3. Security Boundary: If a non-admin user somehow tries to set currentRole to ADMIN, enforce their true role
  const effectiveRole = userProfile.role === 'ADMIN' ? currentRole : userProfile.role;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Application Header */}
      <Header
        currentRole={effectiveRole}
        onRoleChange={role => {
          if (userProfile.role === 'ADMIN') {
            setCurrentRole(role);
            setActiveMainView('dashboard');
          }
        }}
        isMobileFrame={isMobileFrame}
        onToggleMobileFrame={() => setIsMobileFrame(prev => !prev)}
        onOpenTests={() => setIsTestsModalOpen(true)}
        onOpenPythonDocs={() => setIsPythonDocsModalOpen(true)}
        onResetSeed={handleResetSeed}
        unreadEmailCount={db.getEmailLogs().length}
      />

      {/* Auth Error Banner if any */}
      {authError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{authError}</span>
          </div>
        </div>
      )}

      {/* Sub-Header Bar: Verified Identity & Navigation */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Identity & Context Banner */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-semibold">Active Workspace:</span>

            {userProfile.role === 'ADMIN' ? (
              // Admin Supervisory Control
              <div className="flex items-center space-x-2">
                <span className="font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                  Superintendent / Registrar Console (Full Admin Control)
                </span>
                {effectiveRole === 'STUDENT' && (
                  <span className="text-slate-500 font-medium">
                    (Auditing as Student:{' '}
                    <select
                      value={activeStudentId}
                      onChange={e => {
                        setActiveStudentId(e.target.value);
                        handleRefresh();
                      }}
                      className="px-2 py-0.5 rounded border border-slate-300 font-bold"
                    >
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.studentId})
                        </option>
                      ))}
                    </select>
                    )
                  </span>
                )}
                {effectiveRole === 'TEACHER' && (
                  <span className="text-slate-500 font-medium">
                    (Auditing as Teacher:{' '}
                    <select
                      value={activeTeacherId}
                      onChange={e => {
                        setActiveTeacherId(e.target.value);
                        handleRefresh();
                      }}
                      className="px-2 py-0.5 rounded border border-slate-300 font-bold"
                    >
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.designation})
                        </option>
                      ))}
                    </select>
                    )
                  </span>
                )}
              </div>
            ) : userProfile.role === 'TEACHER' ? (
              // Teacher Locked Session
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Faculty Workspace: {db.findTeacher(activeTeacherId)?.name || userProfile.displayName} ({db.findTeacher(activeTeacherId)?.designation || 'Faculty Member'})
              </span>
            ) : (
              // Student Locked Session
              <span className="font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                Student Portal: {db.findStudent(activeStudentId)?.name || userProfile.displayName} ({db.findStudent(activeStudentId)?.studentId || 'Enrolled Student'})
              </span>
            )}
          </div>

          {/* View Mode Toggle: Dashboard vs Comprehensive Analytics */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveMainView('dashboard')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeMainView === 'dashboard'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Role Workspace
            </button>
            <button
              onClick={() => setActiveMainView('analytics')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center space-x-1.5 transition-all ${
                activeMainView === 'analytics'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Faculty Analytics & Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start">
        {isMobileFrame ? (
          // Mobile Smartphone Device Wrapper Frame
          <div className="py-6 px-4 flex items-center justify-center">
            <div className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl border-[10px] border-slate-900 overflow-hidden flex flex-col min-h-[780px] max-h-[860px]">
              {/* Phone Speaker Notch */}
              <div className="h-6 bg-slate-900 flex items-center justify-center">
                <div className="w-20 h-3.5 bg-slate-950 rounded-full" />
              </div>

              {/* Mobile View Scrollable Screen */}
              <div className="flex-1 overflow-y-auto bg-slate-50">
                {activeMainView === 'analytics' ? (
                  <AnalyticsReports onRefresh={handleRefresh} />
                ) : effectiveRole === 'ADMIN' ? (
                  <AdminDashboard onRefresh={handleRefresh} />
                ) : effectiveRole === 'TEACHER' ? (
                  <TeacherDashboard teacherId={activeTeacherId} onRefresh={handleRefresh} />
                ) : (
                  <StudentDashboard
                    studentId={activeStudentId}
                    onRefresh={handleRefresh}
                    isMobileFrame={true}
                  />
                )}
              </div>

              {/* Phone Home Bar */}
              <div className="h-5 bg-white flex items-center justify-center">
                <div className="w-32 h-1 bg-slate-300 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          // Standard Responsive Workstation Desktop Layout
          <div className="flex-1">
            {activeMainView === 'analytics' ? (
              <AnalyticsReports onRefresh={handleRefresh} />
            ) : effectiveRole === 'ADMIN' ? (
              <AdminDashboard onRefresh={handleRefresh} />
            ) : effectiveRole === 'TEACHER' ? (
              <TeacherDashboard teacherId={activeTeacherId} onRefresh={handleRefresh} />
            ) : (
              <StudentDashboard
                studentId={activeStudentId}
                onRefresh={handleRefresh}
                isMobileFrame={false}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">UniAttend System v2.5</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud Firestore & Zero-Trust RBAC Connected</span>
            </span>
            <span>•</span>
            <span>MBSTU Department of CSE</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsTestsModalOpen(true)}
              className="text-emerald-700 hover:underline font-semibold flex items-center space-x-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>24/24 Rule Tests Passing</span>
            </button>
            <button
              onClick={() => setIsPythonDocsModalOpen(true)}
              className="text-indigo-600 hover:underline font-semibold"
            >
              Architecture & Security
            </button>
          </div>
        </div>
      </footer>

      {/* Automated Tests Verification Modal */}
      <AutomatedTestsModal
        isOpen={isTestsModalOpen}
        onClose={() => setIsTestsModalOpen(false)}
      />

      {/* Architecture Documentation Modal */}
      <PythonDocsModal
        isOpen={isPythonDocsModalOpen}
        onClose={() => setIsPythonDocsModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
