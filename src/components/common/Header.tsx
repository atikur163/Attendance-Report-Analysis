import React from 'react';
import {
  GraduationCap,
  Shield,
  UserCheck,
  Smartphone,
  Monitor,
  CheckCircle2,
  FileCode2,
  RefreshCw,
  LogIn,
  LogOut,
  Database,
} from 'lucide-react';
import { UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  isMobileFrame: boolean;
  onToggleMobileFrame: () => void;
  onOpenTests: () => void;
  onOpenPythonDocs: () => void;
  onResetSeed: () => void;
  unreadEmailCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  isMobileFrame,
  onToggleMobileFrame,
  onOpenTests,
  onOpenPythonDocs,
  onResetSeed,
}) => {
  const { currentUser, userProfile, loginWithGoogle, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & University Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 bg-clip-text text-transparent">
                  UniAttend
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Firestore Live
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                University Attendance Management & Analytics Platform
              </p>
            </div>
          </div>

          {/* Action Center & Role Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Automated Business Rules Test Suite */}
            <button
              onClick={onOpenTests}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              title="Run automated validation tests for all attendance rules"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Rule Tests</span>
            </button>

            {/* Architecture Specs */}
            <button
              onClick={onOpenPythonDocs}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
              title="Explore Cloud Firestore schema and backend architecture"
            >
              <FileCode2 className="w-4 h-4 text-amber-700" />
              <span className="hidden md:inline">Backend & Docs</span>
            </button>

            {/* Mobile / Desktop View Mode Toggle */}
            <button
              onClick={onToggleMobileFrame}
              className={`p-2 rounded-lg border transition-all ${
                isMobileFrame
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title={isMobileFrame ? 'Switch to Full Desktop View' : 'Preview as Mobile Smartphone Interface'}
            >
              {isMobileFrame ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>

            {/* Reset Seed Data */}
            <button
              onClick={onResetSeed}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Reset Database to Clean University Seed Data in Firestore"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Google Authentication Status */}
            {/* Authenticated User Status & Role Badge */}
            {currentUser && userProfile && (
              <div className="flex items-center space-x-2 bg-slate-100 py-1 px-2.5 rounded-xl border border-slate-200 text-xs">
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {(userProfile.displayName || userProfile.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block">
                  <div className="font-bold text-slate-800 max-w-[120px] truncate leading-tight">
                    {userProfile.displayName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                    {userProfile.email}
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    userProfile.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : userProfile.role === 'TEACHER'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {userProfile.role}
                </span>

                <button
                  onClick={logout}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                  title="Sign Out of University Portal"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              </div>
            )}

            {/* Role Switcher (Admin-Only Audit & Preview Mode) */}
            {userProfile?.role === 'ADMIN' && (
              <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
                <span className="text-[10px] text-slate-400 font-semibold px-1.5 uppercase">Preview:</span>
                <button
                  onClick={() => onRoleChange('ADMIN')}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-all ${
                    currentRole === 'ADMIN'
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>Admin</span>
                </button>
                <button
                  onClick={() => onRoleChange('TEACHER')}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-all ${
                    currentRole === 'TEACHER'
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Teacher</span>
                </button>
                <button
                  onClick={() => onRoleChange('STUDENT')}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-all ${
                    currentRole === 'STUDENT'
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="w-3 h-3" />
                  <span>Student</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
