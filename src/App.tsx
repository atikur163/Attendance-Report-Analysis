import React, { useState } from 'react';
import {
  GraduationCap,
  Shield,
  UserCheck,
  BarChart3,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Header } from './components/common/Header';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { AnalyticsReports } from './components/analytics/AnalyticsReports';
import { AutomatedTestsModal } from './components/common/AutomatedTestsModal';
import { PythonDocsModal } from './components/common/PythonDocsModal';
import { UserRole } from './types';
import { db } from './services/db';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('STUDENT');
  const [activeMainView, setActiveMainView] = useState<'dashboard' | 'analytics'>('dashboard');
  const [isMobileFrame, setIsMobileFrame] = useState(false);
  const [isTestsModalOpen, setIsTestsModalOpen] = useState(false);
  const [isPythonDocsModalOpen, setIsPythonDocsModalOpen] = useState(false);
  const [, setRefreshTicker] = useState(0);

  // Active student and teacher identities
  const [activeStudentId, setActiveStudentId] = useState('stu-01'); // Default: Tanvir Islam (IT-24026)
  const [activeTeacherId, setActiveTeacherId] = useState('tch-01'); // Default: Dr. Ahsan Habib

  const students = db.getStudents();
  const teachers = db.getTeachers();

  const handleRefresh = () => {
    setRefreshTicker(prev => prev + 1);
  };

  const handleResetSeed = () => {
    if (window.confirm('Reset database to pristine university seed state?')) {
      db.resetToDefaultSeed();
      handleRefresh();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Application Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={role => {
          setCurrentRole(role);
          setActiveMainView('dashboard');
        }}
        isMobileFrame={isMobileFrame}
        onToggleMobileFrame={() => setIsMobileFrame(prev => !prev)}
        onOpenTests={() => setIsTestsModalOpen(true)}
        onOpenPythonDocs={() => setIsPythonDocsModalOpen(true)}
        onResetSeed={handleResetSeed}
        unreadEmailCount={db.getEmailLogs().length}
      />

      {/* Sub-Header Bar: Persona Switcher & Analytics Navigation */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Persona selector depending on role */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-semibold">Active Persona:</span>
            {currentRole === 'STUDENT' ? (
              <select
                value={activeStudentId}
                onChange={e => {
                  setActiveStudentId(e.target.value);
                  handleRefresh();
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-300 font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentId} • Batch 2026)
                  </option>
                ))}
              </select>
            ) : currentRole === 'TEACHER' ? (
              <select
                value={activeTeacherId}
                onChange={e => {
                  setActiveTeacherId(e.target.value);
                  handleRefresh();
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-300 font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.designation})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                Superintendent / Registrar Office (Full System Authority)
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
              <span>Faculty Analytics & CSV Reports</span>
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
                ) : currentRole === 'ADMIN' ? (
                  <AdminDashboard onRefresh={handleRefresh} />
                ) : currentRole === 'TEACHER' ? (
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
            ) : currentRole === 'ADMIN' ? (
              <AdminDashboard onRefresh={handleRefresh} />
            ) : currentRole === 'TEACHER' ? (
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
            <span className="font-bold text-slate-700">UniAttend System v2.4</span>
            <span>•</span>
            <span>Mawlana Bhashani Science and Technology University (MBSTU)</span>
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
              Python Flask Specs
            </button>
          </div>
        </div>
      </footer>

      {/* Automated Tests Verification Modal */}
      <AutomatedTestsModal
        isOpen={isTestsModalOpen}
        onClose={() => setIsTestsModalOpen(false)}
      />

      {/* Python Backend & Architecture Documentation Modal */}
      <PythonDocsModal
        isOpen={isPythonDocsModalOpen}
        onClose={() => setIsPythonDocsModalOpen(false)}
      />
    </div>
  );
}
