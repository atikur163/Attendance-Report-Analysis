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

  // Search filter
  const [logSearch, setLogSearch] = useState('');
  const [riskSearch, setRiskSearch] = useState('');

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

  // Compute Low Attendance (<60%) Watchlist
  interface LowAttendanceItem {
    student: Student;
    course: Course;
    offering: CourseOffering;
    conducted: number;
    attended: number;
    missed: number;
    percentage: number;
    requiredToRecover: number;
    examEligible: boolean;
  }

  const lowAttendanceList: LowAttendanceItem[] = [];

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

      // Filter: total conducted > 0 and percentage < 60%
      if (analytics.conductedClasses > 0 && analytics.attendancePercentage < 60.0) {
        // Exact formula: max(0, ceil((0.60 * Total Held - Attended) / 0.40))
        const req = Math.max(
          0,
          Math.ceil((0.60 * analytics.conductedClasses - analytics.presentCount) / 0.40)
        );

        lowAttendanceList.push({
          student: st,
          course: crs,
          offering: off,
          conducted: analytics.conductedClasses,
          attended: analytics.presentCount,
          missed: analytics.absentCount,
          percentage: analytics.attendancePercentage,
          requiredToRecover: req,
          examEligible: analytics.examEligible,
        });
      }
    }
  }

  const handleScanWarnings = async () => {
    setIsScanning(true);
    setActionNotice(null);
    try {
      const result = await NotificationService.scanAndSendStudentRiskWarnings();
      if (result.warningsSent > 0) {
        setActionNotice({
          type: 'success',
          text: `Dispatched ${result.warningsSent} low-attendance warning email(s) successfully!`,
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

  const handleSendSingleWarning = async (item: LowAttendanceItem) => {
    setActionNotice(null);
    const totalHeld = item.conducted;
    const attended = item.attended;
    const req = item.requiredToRecover;
    const dedupKey = `RISK_WARN_${item.student.id}_${item.offering.id}_${Date.now()}`;

    const subject = `⚠️ URGENT ATTENDANCE WARNING (<60%): ${item.course.code} - Exam Ineligibility Notice`;
    const text = `Dear ${item.student.name} (Roll: ${item.student.studentId}),\n\nYour attendance in ${item.course.code} (${item.course.name}) has fallen below the mandatory 60% threshold.\n\nAcademic Status:\n• Classes Held: ${totalHeld}\n• Attended: ${attended}\n• Missed: ${item.missed}\n• Current Attendance: ${item.percentage.toFixed(1)}%\n• Mandatory Next Consecutive Classes Required to Reach 60%: ${req}\n\nExam Ineligibility Notice:\nStudents with < 60% attendance are strictly barred from semester finals.\n\nBest regards,\nOffice of Academic Affairs\nUniAttend MBSTU`;

    try {
      const res = await (NotificationService as any).dispatchServerEmail({
        to: item.student.email,
        recipientName: item.student.name,
        recipientRole: 'STUDENT',
        type: 'ATTENDANCE_WARNING',
        courseOfferingId: item.offering.id,
        subject,
        text,
        dedupKey,
      });

      if (res.status === 'SENT') {
        setActionNotice({ type: 'success', text: `Warning successfully delivered to ${item.student.email}` });
      } else {
        setActionNotice({ type: 'info', text: `Email queued: ${res.message}` });
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

  const filteredLogs = emailLogs.filter(l => {
    return (
      l.recipientEmail.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.recipientName.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.subject.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.type.toLowerCase().includes(logSearch.toLowerCase())
    );
  });

  const filteredRisk = lowAttendanceList.filter(item => {
    return (
      item.student.name.toLowerCase().includes(riskSearch.toLowerCase()) ||
      item.student.studentId.toLowerCase().includes(riskSearch.toLowerCase()) ||
      item.course.code.toLowerCase().includes(riskSearch.toLowerCase())
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
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTriggerReminders}
              disabled={isSendingReminder}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isSendingReminder ? 'Checking Routine...' : 'Trigger 10-Min Reminders'}</span>
            </button>
            <button
              onClick={handleScanWarnings}
              disabled={isScanning}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isScanning ? 'Evaluating...' : 'Scan & Send <60% Warnings'}</span>
            </button>
          </div>
        </div>
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

      {/* SECTION 1: LOW ATTENDANCE WATCHLIST (<60%) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-bold text-slate-900 text-sm">
                Low Attendance Risk Watchlist (&lt;60% Exam Disqualification)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Targeted students at risk of semester final exam ineligibility. Required future classes calculated via:
              <code className="ml-1 text-slate-700 font-mono font-bold">
                Required = max(0, ceil((0.60 * Total Held - Attended) / 0.40))
              </code>
            </p>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-700">
            {lowAttendanceList.length} At-Risk Cohort Cases
          </span>
        </div>

        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student, roll, or course..."
              value={riskSearch}
              onChange={e => setRiskSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Held</th>
                <th className="py-3 px-4">Attended</th>
                <th className="py-3 px-4">Missed</th>
                <th className="py-3 px-4">Attendance %</th>
                <th className="py-3 px-4">Next Required Classes (to 60%)</th>
                <th className="py-3 px-4">Exam Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRisk.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No students currently below the 60% attendance threshold.
                  </td>
                </tr>
              ) : (
                filteredRisk.map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.student.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.student.studentId}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold font-mono text-indigo-700">{item.course.code}</span>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">{item.course.name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{item.conducted}</td>
                    <td className="py-3 px-4 font-mono text-emerald-600 font-bold">{item.attended}</td>
                    <td className="py-3 px-4 font-mono text-rose-600 font-bold">{item.missed}</td>
                    <td className="py-3 px-4">
                      <span className="font-extrabold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-indigo-900">
                      {item.requiredToRecover} consecutive classes
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        BARRED (&lt;60%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleSendSingleWarning(item)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Warning</span>
                      </button>
                    </td>
                  </tr>
                ))
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
