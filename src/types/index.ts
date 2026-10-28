/**
 * University Attendance Management and Analytics System
 * Comprehensive Core Domain Types & Data Contracts
 */

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type CourseType = 'THEORY' | 'LAB';

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export type AttendanceMethod = 'QR' | 'FACE';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export type RiskLevel = 'SAFE' | 'WARNING' | 'HIGH_RISK' | 'CRITICAL';

export interface Department {
  id: string;
  code: string;
  name: string;
  building: string;
}

export interface AcademicSession {
  id: string;
  name: string; // e.g. "2025-2026"
  isCurrent: boolean;
}

export interface Batch {
  id: string;
  name: string; // e.g. "Batch 2023", "Batch 2024"
  startYear: number;
  departmentId: string;
  currentYear: number; // 1, 2, 3, 4
  currentSemester: number; // 1, 2
}

export interface Course {
  id: string;
  code: string; // e.g. "CSE-1101"
  name: string; // e.g. "Structured Programming Language"
  credit: number;
  type: CourseType;
  departmentId: string;
  year: number; // 1, 2, 3, 4
  semester: number; // 1, 2
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CourseOffering {
  id: string;
  courseId: string;
  departmentId: string;
  academicSessionId: string;
  year: number; // 1, 2, 3, 4
  semester: number; // 1, 2
  batchId: string;
  section: string; // e.g. "A"
  plannedClasses: number; // e.g. 35
  conductedClasses: number;
  status: 'ACTIVE' | 'COMPLETED';
}

export interface Teacher {
  id: string;
  teacherId: string; // e.g. "TCH-042"
  name: string;
  email: string;
  departmentId: string;
  designation: string; // Professor, Associate Professor, Assistant Professor, Lecturer
  phone?: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  authorizedCourseIds: string[]; // List of Course IDs this teacher is eligible to teach
}

export interface TeacherAssignment {
  id: string;
  courseOfferingId: string;
  teacherId: string;
  role: 'PRIMARY' | 'CO_TEACHER';
  assignedAt: string;
}

export interface FaceProfile {
  studentId: string;
  embedding: number[]; // 128-dimensional facial representation vector
  features: {
    eyeDistance: number;
    jawWidth: number;
    noseLength: number;
    faceRatio: number;
  };
  samplePhotoUrl?: string;
  modelVersion: string;
  status: 'REGISTERED' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  studentId: string; // e.g. "IT-24026", "CSE-23001"
  name: string;
  email: string;
  departmentId: string;
  academicSessionId: string;
  year: number; // 1, 2, 3, 4
  semester: number; // 1, 2
  batchId: string;
  section: string;
  status: 'ACTIVE' | 'DROPOUT' | 'GRADUATED';
  hasFaceProfile: boolean;
  avatarUrl?: string;
}

export interface StudentEnrollment {
  id: string;
  studentId: string;
  courseOfferingId: string;
  enrolledAt: string;
  status: 'ENROLLED' | 'DROPPED';
}

export interface RoutineEntry {
  id: string;
  courseOfferingId: string;
  teacherId: string;
  dayOfWeek: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  startTime: string; // "10:00 AM"
  endTime: string; // "11:00 AM"
  room: string;
  building: string;
}

export interface AttendanceSession {
  id: string;
  courseOfferingId: string;
  teacherId: string;
  routineEntryId?: string;
  date: string; // "2026-10-28"
  startTime: string; // "10:00 AM"
  endTime: string; // "11:00 AM"
  attendanceMethod: AttendanceMethod;
  status: SessionStatus;
  currentToken: string;
  tokenExpiresAt: string;
  allowSelfCheckIn: boolean;
  notes?: string;
  createdAt: string;
  closedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  courseOfferingId: string;
  studentId: string;
  timestamp: string;
  method: AttendanceMethod | 'MANUAL_ADMIN';
  status: AttendanceStatus;
  minutesLate: number;
  notes?: string;
}

export interface AttendanceCorrectionAudit {
  id: string;
  attendanceId: string;
  studentId: string;
  studentName: string;
  courseOfferingId: string;
  courseCode: string;
  originalStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  changedBy: string; // Admin user
  reason: string;
  timestamp: string;
}

export interface FaceVerificationLog {
  id: string;
  studentId: string;
  sessionId: string;
  courseOfferingId: string;
  similarityScore: number;
  matched: boolean;
  reason?: string;
  timestamp: string;
}

export interface QRVerificationLog {
  id: string;
  studentId: string;
  sessionId: string;
  courseOfferingId: string;
  validToken: boolean;
  reason?: string;
  timestamp: string;
}

export interface EmailLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'TEACHER' | 'STUDENT' | 'ADMIN';
  type: 'CLASS_REMINDER' | 'ATTENDANCE_WARNING' | 'SYSTEM_ALERT';
  courseOfferingId?: string;
  subject: string;
  body: string;
  dedupKey: string; // To prevent duplicate emails for same event
  sentAt: string;
  status: 'SENT' | 'SIMULATED';
}

export interface SystemAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface SystemSettings {
  lateThresholdMinutes: number; // default 20
  examEligibilityThreshold: number; // default 60%
  threeLatePenaltyEnabled: boolean;
  teacherReminderTiming: 'AT_CLASS' | '15_MIN_BEFORE' | '30_MIN_BEFORE';
  allowDynamicQRScan: boolean;
  faceMatchThreshold: number; // default 0.72
}

/**
 * Centralized Attendance Analytics Metrics for a Student in a Course Offering
 */
export interface StudentCourseAnalytics {
  studentId: string;
  studentName: string;
  studentRoll: string;
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  credit: number;
  courseType: CourseType;
  plannedClasses: number;
  conductedClasses: number;
  remainingClasses: number;
  
  // Raw counts
  presentCount: number;
  lateCount: number;
  absentCount: number;
  
  // Penalties
  consecutiveLateCount: number;
  penaltyCount: number; // 3 consecutive lates = 1 penalty
  
  // Calculations
  effectivePresentCount: number;
  attendancePercentage: number;
  examEligible: boolean; // attendancePercentage >= 60.0%
  
  // Projections
  maximumPossibleAttendance: number;
  requiredFutureAttendance: number;
  isRecoverable: boolean;
  riskLevel: RiskLevel;
}
