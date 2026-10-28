/**
 * University Dynamic QR Code Engine
 * Generates dynamic expiring session QR tokens, generates high-res QR data URLs,
 * and validates scans against course offerings, student enrollment, and session status.
 */

import QRCode from 'qrcode';
import { db } from './db';

export interface QRTokenPayload {
  version: number;
  sessionId: string;
  courseOfferingId: string;
  courseCode: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
  hash: string;
}

export class QRService {
  /**
   * Generates a dynamic QR payload object for an active attendance session.
   */
  public static createSessionPayload(sessionId: string): QRTokenPayload | null {
    const session = db.getAttendanceSessions().find(s => s.id === sessionId);
    if (!session || session.status !== 'ACTIVE') return null;

    const offering = db.getCourseOfferings().find(o => o.id === session.courseOfferingId);
    const course = offering ? db.getCourses().find(c => c.id === offering.courseId) : undefined;

    const now = Date.now();
    const expiresAt = new Date(session.tokenExpiresAt).getTime() || now + 120000;

    // Simple robust hash signature
    const signature = btoa(`${session.id}:${session.currentToken}:${expiresAt}`);

    return {
      version: 1,
      sessionId: session.id,
      courseOfferingId: session.courseOfferingId,
      courseCode: course?.code || 'CSE',
      token: session.currentToken,
      issuedAt: now,
      expiresAt,
      hash: signature.slice(0, 16),
    };
  }

  /**
   * Generates an SVG or Base64 Data URL string for rendering QR code on Teacher screen
   */
  public static async generateQRCodeDataUrl(sessionId: string): Promise<string> {
    const payload = this.createSessionPayload(sessionId);
    if (!payload) {
      return '';
    }

    const payloadString = JSON.stringify(payload);
    try {
      const dataUrl = await QRCode.toDataURL(payloadString, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 8,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate QR data URL:', err);
      return '';
    }
  }

  /**
   * Validates a scanned QR payload string from student's device
   */
  public static validateScannedPayload(
    scannedText: string,
    studentId: string
  ): {
    valid: boolean;
    reason?: string;
    sessionId?: string;
    courseOfferingId?: string;
    minutesLate?: number;
  } {
    let payload: QRTokenPayload;
    try {
      payload = JSON.parse(scannedText);
    } catch {
      // Fallback: check if the student scanned the raw token string
      const matchingSession = db.getAttendanceSessions().find(s => s.currentToken === scannedText.trim());
      if (matchingSession) {
        payload = {
          version: 1,
          sessionId: matchingSession.id,
          courseOfferingId: matchingSession.courseOfferingId,
          courseCode: 'COURSE',
          token: matchingSession.currentToken,
          issuedAt: Date.now() - 60000,
          expiresAt: new Date(matchingSession.tokenExpiresAt).getTime(),
          hash: 'RAW',
        };
      } else {
        db.addQRLog({
          studentId,
          sessionId: 'UNKNOWN',
          courseOfferingId: 'UNKNOWN',
          validToken: false,
          reason: 'Malformed or invalid QR payload structure',
        });
        return { valid: false, reason: 'Invalid QR code. Please scan the official class attendance code.' };
      }
    }

    const session = db.getAttendanceSessions().find(s => s.id === payload.sessionId);
    if (!session) {
      db.addQRLog({
        studentId,
        sessionId: payload.sessionId,
        courseOfferingId: payload.courseOfferingId,
        validToken: false,
        reason: 'Session does not exist',
      });
      return { valid: false, reason: 'This attendance session could not be found.' };
    }

    if (session.status !== 'ACTIVE') {
      db.addQRLog({
        studentId,
        sessionId: session.id,
        courseOfferingId: session.courseOfferingId,
        validToken: false,
        reason: `Session is ${session.status}`,
      });
      return { valid: false, reason: `Session is ${session.status.toLowerCase()}. QR scanning is closed.` };
    }

    // Verify token expiration
    const now = Date.now();
    const tokenExp = new Date(session.tokenExpiresAt).getTime();
    if (now > tokenExp + 10000) { // 10s grace period for clock drift
      db.addQRLog({
        studentId,
        sessionId: session.id,
        courseOfferingId: session.courseOfferingId,
        validToken: false,
        reason: 'QR token has expired',
      });
      return { valid: false, reason: 'This dynamic QR code has expired. Please scan the refreshed code on the teacher screen.' };
    }

    // Check student enrollment in this offering
    const student = db.getStudents().find(s => s.id === studentId);
    if (!student) {
      return { valid: false, reason: 'Student profile not found.' };
    }

    const isEnrolled = db.getStudentEnrollments().some(
      e => e.studentId === studentId && e.courseOfferingId === session.courseOfferingId && e.status === 'ENROLLED'
    );

    if (!isEnrolled) {
      db.addQRLog({
        studentId,
        sessionId: session.id,
        courseOfferingId: session.courseOfferingId,
        validToken: false,
        reason: 'Student not enrolled in course offering',
      });
      return { valid: false, reason: `You are not enrolled in this course offering (${payload.courseCode || 'Course'}). Attendance denied.` };
    }

    // Calculate arrival time relative to session creation / start time
    const sessionStartTime = new Date(session.createdAt).getTime();
    const arrivalMinutes = Math.max(0, Math.floor((now - sessionStartTime) / (60 * 1000)));

    db.addQRLog({
      studentId,
      sessionId: session.id,
      courseOfferingId: session.courseOfferingId,
      validToken: true,
    });

    return {
      valid: true,
      sessionId: session.id,
      courseOfferingId: session.courseOfferingId,
      minutesLate: arrivalMinutes,
    };
  }
}
