import express from 'express';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

// Start server with Vite middleware in dev or static files in production
async function startServer() {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UniAttend Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
