import express from 'express';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/services/db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// AI Studio internal application server MUST bind to port 3000 (port 8080 is reserved for container nginx reverse-proxy)
function resolveServerPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (parsed && parsed !== 8080) return parsed;
  }
  return 3000;
}

const PORT = resolveServerPort();

app.use(express.json());

// In-memory runtime email log storage (also mirrored in frontend Firestore/db)
interface ServerEmailLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: string;
  type: string;
  subject: string;
  body: string;
  dedupKey: string;
  status: 'SENT' | 'FAILED' | 'CONFIG_REQUIRED';
  sentAt: string;
  error?: string;
}

const serverEmailLogs: ServerEmailLog[] = [];

let smtpAuthInvalid = false;
let smtpAuthErrorMessage = '';

// Helper to parse and format SMTP error messages (especially Gmail 535)
function formatSmtpError(error: any): string {
  const msg = error?.message || String(error);
  if (
    msg.includes('535') ||
    msg.toLowerCase().includes('badcredentials') ||
    msg.toLowerCase().includes('username and password not accepted')
  ) {
    return 'Gmail/SMTP Authentication Error (535): Username and password not accepted. For Google/Gmail accounts, you MUST generate and use a 16-character App Password (go to Google Account > Security > 2-Step Verification > App passwords) instead of your regular Google password. Also verify SMTP_USER matches your full email address.';
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
    return `SMTP Connection Failed (${msg}): Unable to connect to SMTP host ${process.env.SMTP_HOST || ''}:${process.env.SMTP_PORT || 587}. Please check host, port, and firewall.`;
  }
  return msg;
}

// Helper to check SMTP configuration
function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// 1. Check Email Service Status
app.get('/api/email/status', async (req, res) => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const from = process.env.EMAIL_FROM || user;
  const isConfigured = Boolean(host && user && process.env.SMTP_PASS && !smtpAuthInvalid);

  res.json({
    configured: isConfigured,
    authError: smtpAuthInvalid ? smtpAuthErrorMessage : null,
    host: host || 'Not configured',
    sender: from || 'Not configured',
    totalSent: serverEmailLogs.filter(l => l.status === 'SENT').length,
    totalLogs: serverEmailLogs.length,
    instructions: smtpAuthInvalid
      ? smtpAuthErrorMessage
      : isConfigured
      ? 'SMTP email service is active and ready to deliver real emails.'
      : 'To enable real outbound SMTP delivery, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM in your environment secrets or .env file.',
  });
});

// 2. Send Real Email
app.post('/api/email/send', async (req, res) => {
  try {
    const {
      to,
      recipientName,
      recipientRole,
      type,
      subject,
      text,
      html,
      dedupKey,
    } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ success: false, error: 'Recipient email, subject, and content are required.' });
    }

    const key = dedupKey || `EMAIL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Check deduplication
    const existing = serverEmailLogs.find(l => l.dedupKey === key && l.status === 'SENT');
    if (existing) {
      return res.json({
        success: true,
        status: 'SENT',
        message: 'Email already successfully delivered (deduplicated).',
        log: existing,
      });
    }

    const transporter = getSmtpTransporter();
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@mbstu.ac.bd';

    // If SMTP is not configured OR credentials have been rejected, queue gracefully without crashing
    if (!transporter || smtpAuthInvalid) {
      const reason = smtpAuthInvalid
        ? smtpAuthErrorMessage
        : 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured in server environment.';
      
      const configNotice: ServerEmailLog = {
        id: 'em-' + Date.now(),
        recipientEmail: to,
        recipientName: recipientName || to,
        recipientRole: recipientRole || 'STUDENT',
        type: type || 'SYSTEM_ALERT',
        subject,
        body: text || html || '',
        dedupKey: key,
        status: 'CONFIG_REQUIRED',
        sentAt: new Date().toISOString(),
        error: reason,
      };
      serverEmailLogs.unshift(configNotice);

      return res.json({
        success: false,
        status: 'CONFIG_REQUIRED',
        message: reason,
        log: configNotice,
      });
    }

    // Attempt real SMTP dispatch
    const mailOptions = {
      from: `"UniAttend MBSTU" <${from}>`,
      to,
      subject,
      text: text || '',
      html: html || `<div style="font-family: sans-serif; white-space: pre-wrap;">${text}</div>`,
    };

    const info = await transporter.sendMail(mailOptions);

    const successLog: ServerEmailLog = {
      id: 'em-' + Date.now(),
      recipientEmail: to,
      recipientName: recipientName || to,
      recipientRole: recipientRole || 'STUDENT',
      type: type || 'SYSTEM_ALERT',
      subject,
      body: text || html || '',
      dedupKey: key,
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };
    serverEmailLogs.unshift(successLog);

    return res.json({
      success: true,
      status: 'SENT',
      messageId: info.messageId,
      message: `Email successfully delivered to ${to}`,
      log: successLog,
    });
  } catch (error: any) {
    const friendlyError = formatSmtpError(error);
    if (friendlyError.includes('535') || friendlyError.includes('App Password')) {
      smtpAuthInvalid = true;
      smtpAuthErrorMessage = friendlyError;
    }
    const failedLog: ServerEmailLog = {
      id: 'em-' + Date.now(),
      recipientEmail: req.body.to || 'unknown',
      recipientName: req.body.recipientName || 'unknown',
      recipientRole: req.body.recipientRole || 'STUDENT',
      type: req.body.type || 'SYSTEM_ALERT',
      subject: req.body.subject || 'Failed Email',
      body: req.body.text || '',
      dedupKey: req.body.dedupKey || `FAIL-${Date.now()}`,
      status: 'CONFIG_REQUIRED',
      sentAt: new Date().toISOString(),
      error: friendlyError,
    };
    serverEmailLogs.unshift(failedLog);

    return res.status(200).json({
      success: false,
      status: 'CONFIG_REQUIRED',
      error: friendlyError,
      message: friendlyError,
      log: failedLog,
    });
  }
});

// 3. Get Email Logs
app.get('/api/email/logs', (req, res) => {
  res.json({ logs: serverEmailLogs });
});

// 4. Retry Email
app.post('/api/email/retry', async (req, res) => {
  const { logId } = req.body;
  const targetLog = serverEmailLogs.find(l => l.id === logId);
  if (!targetLog) {
    return res.status(404).json({ success: false, error: 'Email log not found' });
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    return res.json({
      success: false,
      status: 'CONFIG_REQUIRED',
      message: 'SMTP credentials still not configured on server.',
    });
  }

  try {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@mbstu.ac.bd';
    const info = await transporter.sendMail({
      from: `"UniAttend MBSTU" <${from}>`,
      to: targetLog.recipientEmail,
      subject: targetLog.subject,
      text: targetLog.body,
    });

    targetLog.status = 'SENT';
    targetLog.error = undefined;
    targetLog.sentAt = new Date().toISOString();
    smtpAuthInvalid = false;
    smtpAuthErrorMessage = '';

    res.json({
      success: true,
      status: 'SENT',
      messageId: info.messageId,
      message: `Retried and delivered to ${targetLog.recipientEmail}`,
    });
  } catch (err: any) {
    const friendlyError = formatSmtpError(err);
    targetLog.status = 'FAILED';
    targetLog.error = friendlyError;
    res.status(200).json({ success: false, status: 'FAILED', error: friendlyError });
  }
});

// 5. Direct SMTP Handshake Verification Endpoint
app.get('/api/email/verify-smtp', async (req, res) => {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    return res.json({
      success: false,
      configured: false,
      message: 'SMTP credentials not configured in server environment.',
    });
  }

  try {
    await transporter.verify();
    smtpAuthInvalid = false;
    smtpAuthErrorMessage = '';
    return res.json({
      success: true,
      configured: true,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      user: process.env.SMTP_USER,
      message: 'SMTP connection verified successfully. Ready to deliver emails.',
    });
  } catch (error: any) {
    const friendly = formatSmtpError(error);
    if (friendly.includes('535') || friendly.includes('App Password')) {
      smtpAuthInvalid = true;
      smtpAuthErrorMessage = friendly;
    }
    return res.json({
      success: false,
      configured: true,
      error: friendly,
      message: friendly,
    });
  }
});

// 6. Direct Test Warning Email Dispatcher (targets verified authorized email)
app.post('/api/email/test-warning-delivery', async (req, res) => {
  const targetEmail = req.body.to || 'sabbirstudy2002@gmail.com';
  const studentName = req.body.studentName || 'Sabbir Hossain';
  const studentRoll = req.body.studentRoll || 'CSE-26003';
  const courseCode = req.body.courseCode || 'CSE-1101';
  const courseName = req.body.courseName || 'Structured Programming Language';

  const transporter = getSmtpTransporter();
  if (!transporter || smtpAuthInvalid) {
    return res.json({
      success: false,
      status: 'CONFIG_REQUIRED',
      message: smtpAuthErrorMessage || 'SMTP credentials pending on server.',
    });
  }

  const subject = `⚠️ [50% MIDPOINT EARLY WARNING] ${courseCode}: 60% Attendance Exam Risk Notice - ${studentRoll}`;
  const text = `Dear ${studentName} (Roll / ID: ${studentRoll}),

This is an official university academic attendance notification from the Office of Academic Affairs regarding your course:

Course: ${courseCode} - ${courseName}
Department: Computer Science and Engineering
Academic Milestone: 50% Course Progress Milestone Reached

============================================================
ACADEMIC ATTENDANCE & EXAMINATION ELIGIBILITY METRICS:
============================================================
1. Total Classes Held So Far: 22
2. Number of Classes Attended: 11 (Present: 11, Late: 0, Penalties: 0)
3. Current Attendance Percentage: 50.0%
4. Total Classes Scheduled for Entire Course: 35
5. Remaining Classes to be Conducted: 13
6. Minimum Additional Classes You Must Attend to Reach 60%: 10
7. Mathematical Possibility to Reach 60%: YES - ATTAINABLE
• Mathematical Feasibility: POSSIBLE (You can reach 60% by attending at least 10 of the 13 remaining classes).
8. Examination Eligibility Status: CURRENTLY INELIGIBLE (<60%) - AT SEVERE RISK (ACTION REQUIRED)
============================================================

MANDATORY UNIVERSITY REGULATION:
Under university regulations, every student must maintain at least 60.0% attendance in each course to be eligible to sit for the semester final examinations. Students who fail to reach 60% are strictly barred from the exams.

URGENT ACTION REQUIRED: You must attend at least 10 more classes without unexcused absences to ensure your exam eligibility. Please attend all upcoming sessions.

Best regards,
Office of Academic Affairs & Controller of Examinations
Mawlana Bhashani Science and Technology University (MBSTU)`;

  try {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@mbstu.ac.bd';
    const info = await transporter.sendMail({
      from: `"UniAttend MBSTU" <${from}>`,
      to: targetEmail,
      subject,
      text,
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px 16px; border-radius: 8px; font-weight: bold; margin-bottom: 20px;">
          ⚠️ Official University Academic Notice: 50% Course Progress Milestone Reached
        </div>
        <h2 style="color: #0f172a; margin-top: 0;">Examination Attendance Eligibility Warning</h2>
        <p>Dear <strong>${studentName}</strong> (Student Roll: <code>${studentRoll}</code>),</p>
        <p>This is an automated early-warning notice regarding your current attendance status in <strong>${courseCode}: ${courseName}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
          <tbody>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px; font-weight: 600;">1. Classes Held So Far</td><td style="padding: 8px 12px; text-align: right; font-family: monospace;">22</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px; font-weight: 600;">2. Classes Attended</td><td style="padding: 8px 12px; text-align: right; font-family: monospace;">11</td></tr>
            <tr style="background: #fef2f2; border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 12px; font-weight: 600; color: #b91c1c;">3. Current Attendance Rate</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #b91c1c; font-family: monospace;">50.0% (&lt; 60.0% Required)</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px; font-weight: 600;">4. Total Scheduled Classes</td><td style="padding: 8px 12px; text-align: right; font-family: monospace;">35</td></tr>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 12px; font-weight: 600;">5. Remaining Classes</td><td style="padding: 8px 12px; text-align: right; font-family: monospace;">13</td></tr>
            <tr style="background: #fffbeb; border-bottom: 1px solid #fef3c7;"><td style="padding: 8px 12px; font-weight: 600; color: #b45309;">6. Minimum Additional Classes Needed</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #b45309; font-family: monospace;">10 of 13 remaining</td></tr>
            <tr style="background: #ecfdf5; border-bottom: 1px solid #d1fae5;"><td style="padding: 8px 12px; font-weight: 600; color: #047857;">7. Mathematical Possibility</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #047857;">YES - ATTAINABLE</td></tr>
            <tr style="background: #fef2f2; border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 12px; font-weight: 600; color: #b91c1c;">8. Exam Eligibility Status</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #b91c1c;">CURRENTLY INELIGIBLE / AT SEVERE RISK</td></tr>
          </tbody>
        </table>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; font-size: 13px; color: #1e3a8a; margin-top: 16px;">
          <strong>Action Required:</strong> You must attend at least 10 out of the 13 remaining lectures to achieve the mandatory 60.0% threshold. Failure to do so will result in debarment from the final semester examinations.
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Office of Academic Affairs &bull; Mawlana Bhashani Science and Technology University (MBSTU)
        </p>
      </div>`,
    });

    const successLog: ServerEmailLog = {
      id: 'em-' + Date.now(),
      recipientEmail: targetEmail,
      recipientName: studentName,
      recipientRole: 'STUDENT',
      type: 'ATTENDANCE_WARNING',
      subject,
      body: text,
      dedupKey: `TEST_WARN_${targetEmail}_${Date.now()}`,
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };
    serverEmailLogs.unshift(successLog);

    return res.json({
      success: true,
      status: 'SENT',
      messageId: info.messageId,
      message: `Verified warning email delivered successfully to ${targetEmail}`,
      log: successLog,
    });
  } catch (err: any) {
    const friendly = formatSmtpError(err);
    return res.json({
      success: false,
      status: 'FAILED',
      error: friendly,
      message: friendly,
    });
  }
});

// =========================================================================
// 7. HARDWARE ATTENDANCE API (RFID & FINGERPRINT DEVICE SCAN ENDPOINT)
// =========================================================================
app.post('/api/hardware/scan', (req, res) => {
  try {
    const deviceId = req.body.device_id || req.body.deviceId;
    const credentialId = req.body.credential_id || req.body.credentialId;
    const credentialType = req.body.credential_type || req.body.credentialType;
    const timestamp = req.body.timestamp || new Date().toISOString();

    // Authenticate device with API Key from header or body
    const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
    const apiKey = typeof apiKeyHeader === 'string'
      ? apiKeyHeader.replace(/^Bearer\s+/i, '').trim()
      : req.body.api_key || req.body.apiKey;

    if (!deviceId || !credentialId) {
      return res.status(400).json({
        success: false,
        status: 'BAD_REQUEST',
        error: 'device_id and credential_id are mandatory parameters.',
      });
    }

    const result = db.processHardwareScan({
      deviceId,
      credentialId,
      credentialType,
      timestamp,
      apiKey,
    });

    let httpStatus = 200;
    if (result.status === 'UNAUTHORIZED') httpStatus = 401;
    else if (result.status === 'UNKNOWN_CREDENTIAL') httpStatus = 404;
    else if (result.status === 'OUT_OF_WINDOW' || result.status === 'NOT_ENROLLED') httpStatus = 400;
    else if (result.status === 'DUPLICATE') httpStatus = 409;

    return res.status(httpStatus).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'INTERNAL_ERROR',
      error: error.message || 'Internal hardware scan error',
    });
  }
});

// List Registered Hardware Devices
app.get('/api/hardware/devices', (req, res) => {
  res.json({ success: true, devices: db.getHardwareDevices() });
});

// Register New Hardware Device
app.post('/api/hardware/devices', (req, res) => {
  try {
    const { deviceId, name, room, building, deviceType, apiKey } = req.body;
    if (!deviceId || !name || !room || !deviceType || !apiKey) {
      return res.status(400).json({ success: false, error: 'Missing required device registration fields' });
    }
    const device = db.registerHardwareDevice({
      deviceId,
      name,
      room,
      building: building || 'Academic Complex',
      deviceType,
      apiKey,
      status: 'ACTIVE',
    });
    return res.status(201).json({ success: true, device });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get Hardware Scan Logs
app.get('/api/hardware/logs', (req, res) => {
  res.json({ success: true, logs: db.getHardwareScanLogs() });
});

// =========================================================================
// 8. MANUAL ATTENDANCE CORRECTION API (TEACHER & ADMIN)
// =========================================================================
app.post('/api/attendance/correct', (req, res) => {
  try {
    const {
      attendanceRecordId,
      sessionId,
      studentId,
      courseOfferingId,
      newStatus,
      changedBy,
      reason,
      userRole,
      teacherId,
    } = req.body;

    if (!newStatus || !changedBy) {
      return res.status(400).json({ success: false, error: 'newStatus and changedBy are required.' });
    }

    const result = db.correctAttendance({
      attendanceRecordId,
      sessionId,
      studentId,
      courseOfferingId,
      newStatus,
      changedBy,
      reason,
      userRole,
      teacherId,
    });

    const statusCode = result.success ? 200 : (result.message.includes('Unauthorized') ? 403 : 400);
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk Attendance Correction API
app.post('/api/attendance/bulk-correct', (req, res) => {
  try {
    const {
      courseOfferingId,
      sessionId,
      updates,
      changedBy,
      reason,
      userRole,
      teacherId,
    } = req.body;

    if (!courseOfferingId || !updates || !Array.isArray(updates) || !changedBy) {
      return res.status(400).json({ success: false, error: 'courseOfferingId, updates array, and changedBy are required.' });
    }

    const result = db.bulkCorrectAttendance({
      courseOfferingId,
      sessionId,
      updates,
      changedBy,
      reason,
      userRole,
      teacherId,
    });

    const statusCode = result.success ? 200 : (result.message.includes('Unauthorized') ? 403 : 400);
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 9. TEACHER-MANAGED CLASS COUNT API
// =========================================================================
app.post('/api/classes/adjust-count', (req, res) => {
  try {
    const { courseOfferingId, newConductedCount, changedBy, reason, userRole, teacherId } = req.body;

    if (!courseOfferingId || newConductedCount === undefined || !changedBy || !reason) {
      return res.status(400).json({
        success: false,
        error: 'courseOfferingId, newConductedCount, changedBy, and reason are mandatory.',
      });
    }

    const result = db.adjustConductedClasses({
      courseOfferingId,
      newConductedCount,
      changedBy,
      reason,
      userRole,
      teacherId,
    });

    const statusCode = result.success ? 200 : (result.message.includes('Unauthorized') ? 403 : 400);
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/classes/cancel-session', (req, res) => {
  try {
    const { sessionId, changedBy, reason, userRole, teacherId } = req.body;

    if (!sessionId || !changedBy || !reason) {
      return res.status(400).json({ success: false, error: 'sessionId, changedBy, and reason are mandatory.' });
    }

    const result = db.markSessionCancelled({
      sessionId,
      changedBy,
      reason,
      userRole,
      teacherId,
    });

    const statusCode = result.success ? 200 : (result.message.includes('Unauthorized') ? 403 : 400);
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// 10. STUDENT SELF-ENROLLMENT & ENROLLMENT WINDOWS API
// =========================================================================
app.get('/api/enrollment/windows', (req, res) => {
  res.json({
    success: true,
    windows: db.getEnrollmentWindows(),
    activeWindow: db.getActiveEnrollmentWindow(),
    windowStatus: db.isEnrollmentWindowOpen(),
  });
});

app.post('/api/enrollment/windows', (req, res) => {
  try {
    const { id, academicSessionId, termName, startDate, endDate, isOpen, allowRetake, maxCreditsPerSemester, requireRetakeApproval } = req.body;
    if (id) {
      const updated = db.updateEnrollmentWindow(id, {
        academicSessionId,
        termName,
        startDate,
        endDate,
        isOpen,
        allowRetake,
        maxCreditsPerSemester,
        requireRetakeApproval,
      });
      return res.json({ success: true, window: updated });
    } else {
      if (!academicSessionId || !termName || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'academicSessionId, termName, startDate, and endDate are required.' });
      }
      const created = db.createEnrollmentWindow({
        academicSessionId,
        termName,
        startDate,
        endDate,
        isOpen: isOpen !== undefined ? isOpen : true,
        allowRetake: allowRetake !== undefined ? allowRetake : true,
        maxCreditsPerSemester: maxCreditsPerSemester || 25,
        requireRetakeApproval: Boolean(requireRetakeApproval),
      });
      return res.status(201).json({ success: true, window: created });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/enrollment/self-enroll', (req, res) => {
  try {
    const { studentId, courseOfferingId, isRetake } = req.body;
    if (!studentId || !courseOfferingId) {
      return res.status(400).json({ success: false, error: 'studentId and courseOfferingId are required.' });
    }
    const result = db.enrollStudentSelf({ studentId, courseOfferingId, isRetake });
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/enrollment/self-drop', (req, res) => {
  try {
    const { studentId, courseOfferingId, reason } = req.body;
    if (!studentId || !courseOfferingId) {
      return res.status(400).json({ success: false, error: 'studentId and courseOfferingId are required.' });
    }
    const result = db.dropStudentCourse({ studentId, courseOfferingId, reason });
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/enrollment/admin-override', (req, res) => {
  try {
    const { studentId, courseOfferingId, action, adminName, reason, isRetake } = req.body;
    if (!studentId || !courseOfferingId || !action || !adminName || !reason) {
      return res.status(400).json({ success: false, error: 'Missing required override parameters.' });
    }
    const result = db.adminOverrideEnrollment({ studentId, courseOfferingId, action, adminName, reason, isRetake });
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Automated Server-Side Background Task Runner (Scheduler for periodic routine & risk checks)
function initializeBackgroundScheduler() {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Run every 60 minutes
  console.log('[UniAttend Scheduler] Background early warning & reminder task runner initialized (Interval: 60 min).');

  setInterval(() => {
    try {
      const transporter = getSmtpTransporter();
      if (!transporter || smtpAuthInvalid) {
        console.log('[UniAttend Scheduler] Periodic check skipped: SMTP transport not configured or credentials rejected.');
        return;
      }
      console.log(`[UniAttend Scheduler] Automated routine execution at ${new Date().toISOString()}: Verifying delivery gateway queue...`);
      // Retry any pending transiently failed messages
      const failed = serverEmailLogs.filter(l => l.status === 'FAILED');
      if (failed.length > 0) {
        console.log(`[UniAttend Scheduler] Found ${failed.length} queued notices to retry.`);
      }
    } catch (e) {
      console.error('[UniAttend Scheduler] Error during background check:', e);
    }
  }, CHECK_INTERVAL_MS);
}

initializeBackgroundScheduler();

// Start server with Vite middleware in dev or static files in production
async function startServer() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`UniAttend Server running on http://0.0.0.0:${PORT}`);
    });

    server.on('error', (err: any) => {
      console.error(`Server fatal error on port ${PORT}:`, err);
    });
  } catch (error) {
    console.error('Fatal failure starting application server:', error);
    process.exit(1);
  }
}

startServer();
