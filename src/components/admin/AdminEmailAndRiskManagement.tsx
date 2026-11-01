import React, { useState, useEffect } from 'react';
import {
  Mail,
  AlertTriangle,
  RotateCw,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Server,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { db } from '../../services/db';
import { NotificationService } from '../../services/notificationService';
import { computeStudentCourseAnalytics } from '../../services/attendanceEngine';
import { EmailLog, Student, CourseOffering, Course, Teacher } from '../../types';

interface AdminEmailAndRiskManagementProps {
  onRefresh: () => void;
}

export const AdminEmailAndRiskManagement: React.FC<AdminEmailAndRiskManagementProps> = ({ onRefresh }) => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(() => db.getEmailLogs());
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    host: string;
    sender: string;
    totalSent: number;
    instructions: string;
  } | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  // Search & category filter state
  const [logSearch, setLogSearch] = useState('');
  const [riskSearch, setRiskSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'MILESTONE_50' | 'BELOW_60' | 'CAN_REACH' | 'BARRED'>('ALL');

  // Live SMTP verification & test dispatcher state
  const [testRecipientEmail, setTestRecipientEmail] = useState('sabbirstudy2002@gmail.com');
  const [isTestingDelivery, setIsTestingDelivery] = useState(false);
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);
  const [liveTestResult, setLiveTestResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
    error?: string;
  } | null>(null);

  // Fetch SMTP status from backend /api/email/status
  useEffect(() => {
    fetch('/api/email/status')
      .then(res => res.json())
      .then(data => setSmtpStatus(data))
      .catch(err => {
        console.debug('Email status API check:', err);
      });
  }, []);

  // Sync email logs
  useEffect(() => {
    setEmailLogs(db.getEmailLogs());
  }, [actionNotice]);

  const students = db.getStudents();
  const offerings = db.getCourseOfferings();
  const courses = db.getCourses();
  const records = db.getAttendanceRecords();
  const enrollments = db.getStudentEnrollments();
  const settings = db.getSettings();

  // Comprehensive Early Warning & 60% Attendance Inspection Items
  interface EarlyWarningItem {
    student: Student;
    course: Course;
    offering: CourseOffering;
    analytics: ReturnType<typeof computeStudentCourseAnalytics>;
  }

  const allEarlyWarningItems: EarlyWarningItem[] = [];

  for (const st of students) {
    const studentEnrs = enrollments.filter(e => e.studentId === st.id && e.status === 'ENROLLED');
    for (const en of studentEnrs) {
      const off = offerings.find(o => o.id === en.courseOfferingId);
      if (!off) continue;
      const crs = courses.find(c => c.id === off.courseId);
      if (!crs) continue;

      const courseRecords = records.filter(r => r.courseOfferingId === off.id && r.studentId === st.id);
      const analytics = computeStudentCourseAnalytics({
        studentId: st.id,
        studentName: st.name,
        studentRoll: st.studentId,
        courseOffering: off,
        courseCode: crs.code,
        courseName: crs.name,
        credit: crs.credit,
        courseType: crs.type,
        records: courseRecords,
        settings,
      });

      allEarlyWarningItems.push({
        student: st,
        course: crs,
        offering: off,
        analytics,
      });
    }
  }

  // Filter based on selected category & search
  const filteredRisk = allEarlyWarningItems.filter(item => {
    const a = item.analytics;

    // Category filter
    if (riskFilter === 'MILESTONE_50' && !a.isHalfwayMilestone) return false;
    if (riskFilter === 'BELOW_60' && a.attendancePercentage >= 60.0) return false;
    if (riskFilter === 'CAN_REACH' && (a.canReach60 === false || a.minAdditionalClassesToPass === 0)) return false;
    if (riskFilter === 'BARRED' && a.canReach60 !== false) return false;

    // Search query
    const q = riskSearch.toLowerCase();
    return (
      item.student.name.toLowerCase().includes(q) ||
      item.student.studentId.toLowerCase().includes(q) ||
      item.course.code.toLowerCase().includes(q) ||
      item.course.name.toLowerCase().includes(q)
    );
  });

  // Summary counts
  const countMilestone50 = allEarlyWarningItems.filter(i => i.analytics.isHalfwayMilestone).length;
  const countBelow60 = allEarlyWarningItems.filter(i => i.analytics.attendancePercentage < 60.0).length;
  const countCanReach = allEarlyWarningItems.filter(i => i.analytics.canReach60 && i.analytics.minAdditionalClassesToPass > 0).length;
  const countBarred = allEarlyWarningItems.filter(i => !i.analytics.canReach60).length;

  const handleScanWarnings = async () => {
    setIsScanning(true);
    setActionNotice(null);
    try {
      const result = await NotificationService.scanAndSendStudentRiskWarnings();
      if (result.warningsSent > 0) {
        setActionNotice({
          type: 'success',
          text: `Dispatched ${result.warningsSent} attendance warning email(s) successfully!`,
        });
      } else {
        setActionNotice({
          type: 'info',
          text: `Scan complete: All eligible warning notices have been processed or are pending retry.`,
        });
      }
      setEmailLogs(db.getEmailLogs());
      onRefresh();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Warning scan encountered an error.' });
    } finally {
      setIsScanning(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleScan50Milestone = async () => {
    setIsScanning(true);
    setActionNotice(null);
    try {
      const result = await NotificationService.triggerHalfwayCourseEarlyWarnings();
      if (result.warningsSent > 0) {
        setActionNotice({
          type: 'success',
          text: `50% Milestone Inspection Complete: Inspected ${result.inspectedCount} student enrollments across halfway courses. Dispatched ${result.warningsSent} early warning notice(s)! (${result.atRiskCount} at risk, ${result.ineligibleCount} mathematically barred)`,
        });
      } else {
        setActionNotice({
          type: 'info',
          text: `50% Milestone Inspection Complete: Evaluated ${result.inspectedCount} student enrollments across halfway courses. (${result.atRiskCount} at risk, ${result.ineligibleCount} barred).`,
        });
      }
      setEmailLogs(db.getEmailLogs());
      onRefresh();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || '50% milestone scan encountered an error.' });
    } finally {
      setIsScanning(false);
      setTimeout(() => setActionNotice(null), 6000);
    }
  };

  const handleSendSingleWarning = async (item: EarlyWarningItem) => {
    setActionNotice(null);
    try {
      const res = await NotificationService.sendIndividualEarlyWarning(item.student.id, item.offering.id);
      if (res.status === 'SENT') {
        setActionNotice({ type: 'success', text: `Early warning notice successfully delivered to ${item.student.email}` });
      } else {
        setActionNotice({ type: 'info', text: `Notice queued for ${item.student.email}: ${res.message}` });
      }
      setEmailLogs(db.getEmailLogs());
      onRefresh();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message });
    }
  };

  const handleTriggerReminders = async () => {
    setIsSendingReminder(true);
    setActionNotice(null);
    try {
      const result = await NotificationService.triggerTeacherClassReminders();
      if (result.sentCount > 0) {
        setActionNotice({
          type: 'success',
          text: `Delivered 10-minute class reminders to ${result.sentCount} faculty member(s)!`,
        });
      } else {
        setActionNotice({
          type: 'info',
          text: `Routine check complete: No upcoming lectures starting in 10 minutes right now (or already reminded today).`,
        });
      }
      setEmailLogs(db.getEmailLogs());
      onRefresh();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message });
    } finally {
      setIsSendingReminder(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleRetryEmail = async (logId: string) => {
    setRetryingLogId(logId);
    setActionNotice(null);
    try {
      const res = await NotificationService.retryEmail(logId);
      if (res.success) {
        setActionNotice({ type: 'success', text: res.message });
      } else {
        setActionNotice({ type: 'error', text: res.message });
      }
      setEmailLogs(db.getEmailLogs());
      onRefresh();
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message });
    } finally {
      setRetryingLogId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleVerifySmtpConnection = async () => {
    setIsVerifyingSmtp(true);
    setLiveTestResult(null);
    try {
      const res = await fetch('/api/email/verify-smtp');
      const data = await res.json();
      if (data.success) {
        setActionNotice({
          type: 'success',
          text: `SMTP Handshake Verified: Connected to ${data.host}:${data.port} as ${data.user}`,
        });
      } else {
        setActionNotice({
          type: 'error',
          text: `SMTP Verification Failed: ${data.message || data.error}`,
        });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to verify SMTP connection' });
    } finally {
      setIsVerifyingSmtp(false);
      setTimeout(() => setActionNotice(null), 6000);
    }
  };

  const handleSendLiveTestWarning = async () => {
    if (!testRecipientEmail) return;
    setIsTestingDelivery(true);
    setLiveTestResult(null);
    try {
      const res = await fetch('/api/email/test-warning-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testRecipientEmail,
          studentName: 'Sabbir Hossain',
          studentRoll: 'CSE-26003',
          courseCode: 'CSE-1101',
          courseName: 'Structured Programming Language',
        }),
      });
      const data = await res.json();
      setLiveTestResult(data);
      if (data.success) {
        setActionNotice({
          type: 'success',
          text: `Live warning email successfully delivered to ${testRecipientEmail}! Message ID: ${data.messageId}`,
        });
        setEmailLogs(db.getEmailLogs());
      } else {
        setActionNotice({
          type: 'error',
          text: `Delivery failed: ${data.message || data.error}`,
        });
      }
      onRefresh();
    } catch (err: any) {
      setLiveTestResult({ success: false, message: err.message });
      setActionNotice({ type: 'error', text: err.message });
    } finally {
      setIsTestingDelivery(false);
      setTimeout(() => setActionNotice(null), 7000);
    }
  };

  const filteredLogs = emailLogs.filter(l => {
    return (
      l.recipientEmail.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.recipientName.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.subject.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.type.toLowerCase().includes(logSearch.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Real SMTP Email Gateway Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-indigo-800/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                smtpStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <h4 className="font-bold text-sm text-white">
              Real Email Notification Gateway (Node.js & SMTP Transport)
            </h4>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                smtpStatus?.configured
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {smtpStatus?.configured ? 'Real SMTP Active' : 'SMTP Setup Pending in .env'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">SMTP Host / Server:</span>
            <span className="text-slate-200 font-bold">{smtpStatus?.host || 'smtp.gmail.com (pending)'}</span>
          </div>
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Sender Identity:</span>
            <span className="text-slate-200 font-bold truncate block">{smtpStatus?.sender || 'noreply@mbstu.ac.bd'}</span>
          </div>
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Delivery Confirmation:</span>
            <span className="text-emerald-400 font-bold">
              {emailLogs.filter(l => l.status === 'SENT').length} Sent &bull; {emailLogs.filter(l => l.status === 'CONFIG_REQUIRED').length} Queued
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-slate-300 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-400">
            Automated alerts for Teacher Accounts, 10-min Routine Reminders, and &lt;60% Student Warning notices.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTriggerReminders}
              disabled={isSendingReminder}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isSendingReminder ? 'Checking Routine...' : 'Trigger 10-Min Reminders'}</span>
            </button>
            <button
              onClick={handleScan50Milestone}
              disabled={isScanning}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer shadow-sm"
              title="Inspect every enrolled student when ~50% classes have been held"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isScanning ? 'Evaluating...' : 'Trigger 50% Milestone Early Warning Scan'}</span>
            </button>
            <button
              onClick={handleScanWarnings}
              disabled={isScanning}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Scan All &lt;60% Warnings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Email Delivery Verification & Authorized Test Panel */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white border border-blue-800/40 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-300">
              Live Real Warning Email Verification Tool
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-300">
            Target: Student Sabbir Hossain (CSE-26003) &bull; CSE-1101 (50.0% Attended)
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Verify live outbound delivery through real Google SMTP (<code className="text-cyan-300 font-mono">smtp.gmail.com:587</code>). This dispatches an official academic attendance warning letter containing all 8 eligibility metrics directly to your verified inbox.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <div className="relative flex-1">
            <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={testRecipientEmail}
              onChange={e => setTestRecipientEmail(e.target.value)}
              placeholder="sabbirstudy2002@gmail.com"
              className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifySmtpConnection}
              disabled={isVerifyingSmtp}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors cursor-pointer flex items-center space-x-1.5"
              title="Test connection and TLS handshake with SMTP host"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isVerifyingSmtp ? 'animate-spin' : ''}`} />
              <span>{isVerifyingSmtp ? 'Testing...' : 'Verify SMTP Handshake'}</span>
            </button>

            <button
              onClick={handleSendLiveTestWarning}
              disabled={isTestingDelivery || !testRecipientEmail}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md"
              title="Dispatch complete 8-metric attendance warning email to test recipient"
            >
              <Send className={`w-3.5 h-3.5 ${isTestingDelivery ? 'animate-bounce' : ''}`} />
              <span>{isTestingDelivery ? 'Sending Live Email...' : 'Send Live Warning Email'}</span>
            </button>
          </div>
        </div>

        {liveTestResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start space-x-2 border ${
              liveTestResult.success
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
            }`}
          >
            {liveTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 font-mono text-[11px]">
              <div className="font-bold">{liveTestResult.message}</div>
              {liveTestResult.messageId && (
                <div className="text-emerald-300">Message-ID: {liveTestResult.messageId}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {emailLogs.some(l => l.status === 'FAILED' && (l.error?.includes('535') || l.error?.includes('App Password') || l.error?.includes('Password not accepted'))) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
          <div className="flex items-center space-x-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Gmail / SMTP Authentication Notice (Error 535: Invalid Login)</span>
          </div>
          <p className="text-amber-800 leading-relaxed">
            Google SMTP rejected the password provided in your environment. Google accounts do not allow standard passwords for third-party SMTP access; they require a dedicated 16-character <strong>App Password</strong>:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-amber-900 font-medium pl-1">
            <li>Go to your Google Account at <strong>myaccount.google.com/security</strong>.</li>
            <li>Ensure <strong>2-Step Verification</strong> is enabled.</li>
            <li>Navigate to <strong>App passwords</strong> (search "App passwords" in the Google Account search bar).</li>
            <li>Generate an app password for <strong>UniAttend</strong> and copy the 16-character code (e.g. <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">abcd efgh ijkl mnop</code>).</li>
            <li>Set <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">SMTP_PASS</code> in your environment secrets or .env file to this 16-character code (without spaces) and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">SMTP_USER</code> to your full Gmail address.</li>
          </ol>
        </div>
      )}

      {actionNotice && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center space-x-2.5 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : actionNotice.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : actionNotice.type === 'error' ? (
            <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <Server className="w-4 h-4 shrink-0 text-indigo-600" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* SECTION 1: 50% COURSE MILESTONE & 60% EXAM ELIGIBILITY EARLY WARNING INSPECTOR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50/70 via-slate-50 to-indigo-50/40">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-bold text-slate-900 text-sm">
                50% Course Milestone & 60% Exam Eligibility Early Warning Inspector
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous monitoring of all courses at ~50% progress. Identifies students below 60%, students at risk, and students mathematically unable to reach 60%.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {countBelow60} &lt;60% Cases
            </span>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-700 border border-rose-200">
              {countBarred} Mathematically Barred
            </span>
          </div>
        </div>

        {/* Filter Tabs for Early Warning Categories */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <button
              onClick={() => setRiskFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                riskFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Students ({allEarlyWarningItems.length})
            </button>
            <button
              onClick={() => setRiskFilter('MILESTONE_50')}
              className={`px-3 py-1 rounded-lg transition-all ${
                riskFilter === 'MILESTONE_50'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              50% Milestone Courses ({countMilestone50})
            </button>
            <button
              onClick={() => setRiskFilter('BELOW_60')}
              className={`px-3 py-1 rounded-lg transition-all ${
                riskFilter === 'BELOW_60'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Current &lt;60% ({countBelow60})
            </button>
            <button
              onClick={() => setRiskFilter('CAN_REACH')}
              className={`px-3 py-1 rounded-lg transition-all ${
                riskFilter === 'CAN_REACH'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Can Still Reach 60% ({countCanReach})
            </button>
            <button
              onClick={() => setRiskFilter('BARRED')}
              className={`px-3 py-1 rounded-lg transition-all ${
                riskFilter === 'BARRED'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Mathematically Barred ({countBarred})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student, roll, course..."
              value={riskSearch}
              onChange={e => setRiskSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Student</th>
                <th className="py-3 px-3">Course & Progress</th>
                <th className="py-3 px-3 text-center">Classes Held / Total</th>
                <th className="py-3 px-3 text-center">Attended (Eff.)</th>
                <th className="py-3 px-3 text-center">Current %</th>
                <th className="py-3 px-3 text-center">Remaining</th>
                <th className="py-3 px-3 text-center">Min Addl. to 60%</th>
                <th className="py-3 px-3">Mathematical Possibility</th>
                <th className="py-3 px-3 text-center">Exam Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRisk.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No student cases found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredRisk.map((item, idx) => {
                  const a = item.analytics;
                  const isBarred = !a.canReach60;
                  const isBelow60 = a.attendancePercentage < 60.0;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isBarred ? 'bg-rose-50/30' : isBelow60 ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.student.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.student.studentId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold font-mono text-indigo-700">{item.course.code}</span>
                          {a.isHalfwayMilestone && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              50% Held
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">{item.course.name}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-slate-800">{a.conductedClasses}</span>
                        <span className="text-slate-400"> / {a.plannedClasses}</span>
                        <div className="text-[10px] text-slate-500 font-sans">({a.courseProgressPercentage}%)</div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-emerald-600">{a.effectivePresentCount}</span>
                        <div className="text-[10px] text-slate-400">({a.presentCount}P, {a.lateCount}L)</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono font-extrabold px-2 py-0.5 rounded border text-xs ${
                            a.attendancePercentage >= 60.0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {a.attendancePercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {a.remainingClasses}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span
                          className={`font-extrabold ${
                            a.minAdditionalClassesToPass > a.remainingClasses
                              ? 'text-rose-600'
                              : a.minAdditionalClassesToPass > 0
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {a.minAdditionalClassesToPass} classes
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {a.canReach60 ? (
                          <span
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title={`Max possible: ${a.maximumPossibleAttendance}%`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Possible ({a.minAdditionalClassesToPass}/{a.remainingClasses} needed)</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                            title={`Even attending all ${a.remainingClasses} remaining classes reaches max ${a.maximumPossibleAttendance}% (<60%)`}
                          >
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Impossible (Max {a.maximumPossibleAttendance}%)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {a.projectedExamStatus === 'PROJECTED_INELIGIBLE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            BARRED (&lt;60%)
                          </span>
                        ) : a.projectedExamStatus === 'AT_RISK' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            AT RISK
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ELIGIBLE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleSendSingleWarning(item)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                          title="Dispatch official early warning notification email"
                        >
                          <Send className="w-3 h-3" />
                          <span>Warn</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: REAL EMAIL AUDIT & DELIVERY LOGS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Real Email Delivery & Audit Trail</h3>
            <p className="text-xs text-slate-500">
              Verified transmission history across teacher accounts, routine updates, reminders & warnings
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">{emailLogs.length} logged emails</span>
        </div>

        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search email logs..."
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Sent At</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No email logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{l.recipientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{l.recipientEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {l.recipientRole}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.type === 'ACCOUNT_CREATED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : l.type === 'CLASS_REMINDER'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : l.type === 'ATTENDANCE_WARNING'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {l.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate" title={l.subject}>
                      {l.subject}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(l.sentAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : l.status === 'CONFIG_REQUIRED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {l.status === 'SENT' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : l.status === 'CONFIG_REQUIRED' ? (
                          <Clock className="w-3 h-3 text-amber-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        )}
                        <span>{l.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {l.status !== 'SENT' && (
                        <button
                          onClick={() => handleRetryEmail(l.id)}
                          disabled={retryingLogId === l.id}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors"
                        >
                          <RotateCw className={`w-3 h-3 ${retryingLogId === l.id ? 'animate-spin' : ''}`} />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
