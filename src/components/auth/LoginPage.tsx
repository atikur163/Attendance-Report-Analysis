import React, { useState } from 'react';
import {
  GraduationCap,
  Shield,
  UserCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, loginWithGoogleRedirect, sendPasswordReset, authError, setAuthError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    await loginWithGoogle();
    setIsGoogleLoading(false);
  };

  const handleGoogleRedirectLogin = async () => {
    setIsGoogleLoading(true);
    await loginWithGoogleRedirect();
  };

  // Forgot Password Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setAuthError('Please enter both your university email and password.');
      return;
    }

    setIsSubmitting(true);
    await loginWithEmail(email, password);
    setIsSubmitting(false);
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setAuthError(null);
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetStatus({ success: false, message: 'Please provide a valid email address.' });
      return;
    }

    setIsResetting(true);
    const res = await sendPasswordReset(resetEmail);
    setIsResetting(false);

    if (res.success) {
      setResetStatus({
        success: true,
        message: 'Password reset link sent! Check your inbox to set a new password.',
      });
      setTimeout(() => {
        setResetModalOpen(false);
        setResetStatus(null);
      }, 3000);
    } else {
      setResetStatus({
        success: false,
        message: res.error || 'Failed to dispatch reset email.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 mb-4 ring-4 ring-indigo-500/20">
          <GraduationCap className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl">
          UniAttend Portal
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Mawlana Bhashani Science & Technology University
        </p>
        <div className="mt-2 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cloud Firestore & Zero-Trust RBAC Active</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-800/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl border border-slate-700/70 sm:px-10 space-y-6">
          {/* Error Banner */}
          {authError && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-start space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                University Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. it24026@mbstu.ac.bd"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Account Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Role & Access...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social or Google Login separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800 px-3 text-slate-400 text-[11px] font-semibold tracking-wider">
                Or Continue With
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              disabled={isGoogleLoading || isSubmitting}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-700/50 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{isGoogleLoading ? 'Connecting Google Account...' : 'Google Workspace Login'}</span>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleGoogleRedirectLogin}
                className="text-[10px] text-slate-400 hover:text-indigo-400 transition-colors underline-offset-2 hover:underline"
              >
                Having popup issues? Use Full-Page Redirect
              </button>
            </div>
          </div>

          {/* Quick-Fill Demo Logins for Fast Review */}
          <div className="pt-2 border-t border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Instant Demo Role Fill</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">1-Click Credentials</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('it24026@mbstu.ac.bd', 'Admin@1234')}
                className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 text-left transition-colors"
              >
                <div className="flex items-center space-x-1 font-bold text-[11px]">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  <span>Admin</span>
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">Superintendent</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('ahsan.habib@mbstu.ac.bd', 'Teacher@1234')}
                className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 text-left transition-colors"
              >
                <div className="flex items-center space-x-1 font-bold text-[11px]">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>Teacher</span>
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">Faculty Head</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('it24026.student@mbstu.ac.bd', 'Student@1234')}
                className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-300 text-left transition-colors"
              >
                <div className="flex items-center space-x-1 font-bold text-[11px]">
                  <GraduationCap className="w-3 h-3 text-purple-400" />
                  <span>Student</span>
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">IT-24026</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Disclaimers */}
        <p className="mt-4 text-center text-[11px] text-slate-500">
          Roles are authenticated and verified directly against encrypted Cloud Firestore user records.
        </p>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm">Reset Password</h3>
              </div>
              <button
                onClick={() => {
                  setResetModalOpen(false);
                  setResetStatus(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter your registered university email to receive an official password reset link.
            </p>

            {resetStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start space-x-2 ${
                  resetStatus.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {resetStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{resetStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleSendResetEmail} className="space-y-3">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="university.email@mbstu.ac.bd"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalOpen(false);
                    setResetStatus(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors disabled:opacity-50"
                >
                  {isResetting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
