/**
 * University Database Service & Real-Time Cloud Firestore Sync
 * Provides CRUD operations, data persistence, and real-time subscription across
 * Departments, Sessions, Batches, Courses, Course Offerings, Teachers, Students,
 * Attendance Sessions, and Audit Logs.
 */

import {
  AcademicSession,
  AttendanceCorrectionAudit,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Batch,
  Course,
  CourseOffering,
  Department,
  EmailLog,
  FaceProfile,
  FaceVerificationLog,
  QRVerificationLog,
  RoutineEntry,
  Student,
  StudentEnrollment,
  SystemAuditLog,
  SystemSettings,
  Teacher,
  TeacherAssignment,
  UserRole,
} from '../types';
import { DEFAULT_SYSTEM_SETTINGS } from './attendanceEngine';
import { checkStudentCourseEligibility } from './enrollmentEngine';
import {
  auth,
  firestoreDb,
  handleFirestoreError,
  OperationType,
  sanitizeForFirestore,
} from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

const STORAGE_KEY = 'uniattend_system_state_v1';

export interface SystemDatabaseState {
  departments: Department[];
  academicSessions: AcademicSession[];
  batches: Batch[];
  courses: Course[];
  courseOfferings: CourseOffering[];
  teachers: Teacher[];
  teacherAssignments: TeacherAssignment[];
  students: Student[];
  studentEnrollments: StudentEnrollment[];
  faceProfiles: FaceProfile[];
  routines: RoutineEntry[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
  attendanceCorrections: AttendanceCorrectionAudit[];
  faceLogs: FaceVerificationLog[];
  qrLogs: QRVerificationLog[];
  emailLogs: EmailLog[];
  auditLogs: SystemAuditLog[];
  settings: SystemSettings;
}

// Initial University Seed Data: Multi-Department Academic Structure (CSE, ICT, EEE)
const INITIAL_STATE: SystemDatabaseState = {
  departments: [
    { id: 'dept-cse', code: 'CSE', name: 'Computer Science and Engineering', building: 'Engineering Complex Bldg 1' },
    { id: 'dept-ict', code: 'ICT', name: 'Information and Communication Technology', building: 'Academic Bldg 2' },
    { id: 'dept-eee', code: 'EEE', name: 'Electrical and Electronic Engineering', building: 'Engineering Complex Bldg 3' },
  ],
  academicSessions: [
    { id: 'sess-2025-2026', name: '2025-2026', isCurrent: true },
    { id: 'sess-2024-2025', name: '2024-2025', isCurrent: false },
  ],
  batches: [
    // CSE Cohorts
    { id: 'batch-2026', name: 'Batch 2026 (1st Year - CSE)', startYear: 2026, departmentId: 'dept-cse', currentYear: 1, currentSemester: 1 },
    { id: 'batch-2025', name: 'Batch 2025 (2nd Year - CSE)', startYear: 2025, departmentId: 'dept-cse', currentYear: 2, currentSemester: 1 },
    { id: 'batch-2024', name: 'Batch 2024 (3rd Year - CSE)', startYear: 2024, departmentId: 'dept-cse', currentYear: 3, currentSemester: 1 },
    { id: 'batch-2023', name: 'Batch 2023 (4th Year - CSE)', startYear: 2023, departmentId: 'dept-cse', currentYear: 4, currentSemester: 1 },

    // ICT Cohorts
    { id: 'batch-ict-2026', name: 'Batch 2026 (1st Year - ICT)', startYear: 2026, departmentId: 'dept-ict', currentYear: 1, currentSemester: 1 },
    { id: 'batch-ict-2025', name: 'Batch 2025 (2nd Year - ICT)', startYear: 2025, departmentId: 'dept-ict', currentYear: 2, currentSemester: 1 },
    { id: 'batch-ict-2024', name: 'Batch 2024 (3rd Year - ICT)', startYear: 2024, departmentId: 'dept-ict', currentYear: 3, currentSemester: 1 },
    { id: 'batch-ict-2023', name: 'Batch 2023 (4th Year - ICT)', startYear: 2023, departmentId: 'dept-ict', currentYear: 4, currentSemester: 1 },

    // EEE Cohorts
    { id: 'batch-eee-2026', name: 'Batch 2026 (1st Year - EEE)', startYear: 2026, departmentId: 'dept-eee', currentYear: 1, currentSemester: 1 },
    { id: 'batch-eee-2025', name: 'Batch 2025 (2nd Year - EEE)', startYear: 2025, departmentId: 'dept-eee', currentYear: 2, currentSemester: 1 },
    { id: 'batch-eee-2024', name: 'Batch 2024 (3rd Year - EEE)', startYear: 2024, departmentId: 'dept-eee', currentYear: 3, currentSemester: 1 },
    { id: 'batch-eee-2023', name: 'Batch 2023 (4th Year - EEE)', startYear: 2023, departmentId: 'dept-eee', currentYear: 4, currentSemester: 1 },
  ],
  courses: [
    // CSE Department Courses
    { id: 'c-1101', code: 'CSE-1101', name: 'Structured Programming Language', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-1102', code: 'CSE-1102', name: 'Structured Programming Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-1103', code: 'MAT-1103', name: 'Differential and Integral Calculus', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-1105', code: 'PHY-1105', name: 'Engineering Physics', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-2101', code: 'CSE-2101', name: 'Data Structures and Algorithms', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 2, semester: 1, status: 'ACTIVE' },
    { id: 'c-2102', code: 'CSE-2102', name: 'Data Structures Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-cse', year: 2, semester: 1, status: 'ACTIVE' },
    { id: 'c-2103', code: 'CSE-2103', name: 'Object Oriented Programming', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 2, semester: 1, status: 'ACTIVE' },
    { id: 'c-3101', code: 'CSE-3101', name: 'Database Management Systems', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 3, semester: 1, status: 'ACTIVE' },
    { id: 'c-3102', code: 'CSE-3102', name: 'Database Systems Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-cse', year: 3, semester: 1, status: 'ACTIVE' },

    // ICT Department Courses
    { id: 'c-ict-1101', code: 'ICT-1101', name: 'Introduction to Information Technology', credit: 3.0, type: 'THEORY', departmentId: 'dept-ict', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-ict-1102', code: 'ICT-1102', name: 'Information Technology Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-ict', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-ict-2101', code: 'ICT-2101', name: 'Data Communication and Computer Networks', credit: 3.0, type: 'THEORY', departmentId: 'dept-ict', year: 2, semester: 1, status: 'ACTIVE' },

    // EEE Department Courses
    { id: 'c-eee-1101', code: 'EEE-1101', name: 'Electrical Circuit Analysis I', credit: 3.0, type: 'THEORY', departmentId: 'dept-eee', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-eee-1102', code: 'EEE-1102', name: 'Circuit Analysis Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-eee', year: 1, semester: 1, status: 'ACTIVE' },
  ],
  courseOfferings: [
    // CSE Offerings
    { id: 'co-1101', courseId: 'c-1101', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 35, conductedClasses: 22, status: 'ACTIVE' },
    { id: 'co-1102', courseId: 'c-1102', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 14, conductedClasses: 9, status: 'ACTIVE' },
    { id: 'co-1103', courseId: 'c-1103', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 35, conductedClasses: 20, status: 'ACTIVE' },
    { id: 'co-1105', courseId: 'c-1105', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 35, conductedClasses: 21, status: 'ACTIVE' },
    { id: 'co-2101', courseId: 'c-2101', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 2, semester: 1, batchId: 'batch-2025', section: 'A', plannedClasses: 35, conductedClasses: 18, status: 'ACTIVE' },
    { id: 'co-2103', courseId: 'c-2103', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 2, semester: 1, batchId: 'batch-2025', section: 'A', plannedClasses: 35, conductedClasses: 20, status: 'ACTIVE' },

    // ICT Offerings
    { id: 'co-ict-1101', courseId: 'c-ict-1101', departmentId: 'dept-ict', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-ict-2026', section: 'A', plannedClasses: 35, conductedClasses: 18, status: 'ACTIVE' },
    { id: 'co-ict-1102', courseId: 'c-ict-1102', departmentId: 'dept-ict', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-ict-2026', section: 'A', plannedClasses: 14, conductedClasses: 8, status: 'ACTIVE' },
    { id: 'co-ict-2101', courseId: 'c-ict-2101', departmentId: 'dept-ict', academicSessionId: 'sess-2025-2026', year: 2, semester: 1, batchId: 'batch-ict-2025', section: 'A', plannedClasses: 35, conductedClasses: 16, status: 'ACTIVE' },

    // EEE Offerings
    { id: 'co-eee-1101', courseId: 'c-eee-1101', departmentId: 'dept-eee', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-eee-2026', section: 'A', plannedClasses: 35, conductedClasses: 19, status: 'ACTIVE' },
    { id: 'co-eee-1102', courseId: 'c-eee-1102', departmentId: 'dept-eee', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-eee-2026', section: 'A', plannedClasses: 14, conductedClasses: 7, status: 'ACTIVE' },
  ],
  teachers: [
    {
      id: 'tch-01',
      teacherId: 'TCH-101',
      name: 'Dr. Ahsan Habib',
      email: 'ahsan.habib@mbstu.ac.bd',
      departmentId: 'dept-cse',
      designation: 'Professor & Head',
      phone: '+880 1711-223344',
      status: 'ACTIVE',
      authorizedCourseIds: ['c-1101', 'c-1102', 'c-2101'],
    },
    {
      id: 'tch-02',
      teacherId: 'TCH-102',
      name: 'Dr. Mahmudul Hasan',
      email: 'm.hasan@mbstu.ac.bd',
      departmentId: 'dept-cse',
      designation: 'Associate Professor',
      phone: '+880 1722-334455',
      status: 'ACTIVE',
      authorizedCourseIds: ['c-3101', 'c-3102', 'c-2101', 'c-2102'],
    },
    {
      id: 'tch-03',
      teacherId: 'TCH-103',
      name: 'Professor Dr. Nargis Akter',
      email: 'nargisakter@mbstu.ac.bd',
      departmentId: 'dept-cse',
      designation: 'Professor',
      phone: '+880 1733-445566',
      status: 'ACTIVE',
      authorizedCourseIds: ['c-1103', 'c-2101', 'c-2103'],
    },
    {
      id: 'tch-04',
      teacherId: 'TCH-201',
      name: 'Dr. Kazi Imran',
      email: 'kazi.imran@mbstu.ac.bd',
      departmentId: 'dept-ict',
      designation: 'Associate Professor & Chairman',
      phone: '+880 1744-556677',
      status: 'ACTIVE',
      authorizedCourseIds: ['c-ict-1101', 'c-ict-2101'],
    },
    {
      id: 'tch-05',
      teacherId: 'TCH-301',
      name: 'Dr. Tariqul Islam',
      email: 'tariqul.eee@mbstu.ac.bd',
      departmentId: 'dept-eee',
      designation: 'Professor & Head',
      phone: '+880 1755-667788',
      status: 'ACTIVE',
      authorizedCourseIds: ['c-eee-1101', 'c-eee-1102'],
    },
  ],
  teacherAssignments: [
    { id: 'ta-01', courseOfferingId: 'co-1101', teacherId: 'tch-01', role: 'PRIMARY', assignedAt: '2026-08-01' },
    { id: 'ta-02', courseOfferingId: 'co-1102', teacherId: 'tch-01', role: 'PRIMARY', assignedAt: '2026-08-01' },
    { id: 'ta-03', courseOfferingId: 'co-2103', teacherId: 'tch-03', role: 'PRIMARY', assignedAt: '2026-08-01' },
    { id: 'ta-04', courseOfferingId: 'co-2101', teacherId: 'tch-03', role: 'PRIMARY', assignedAt: '2026-08-01' },
    { id: 'ta-05', courseOfferingId: 'co-ict-1101', teacherId: 'tch-04', role: 'PRIMARY', assignedAt: '2026-08-01' },
    { id: 'ta-06', courseOfferingId: 'co-eee-1101', teacherId: 'tch-05', role: 'PRIMARY', assignedAt: '2026-08-01' },
  ],
  students: [
    {
      id: 'stu-01',
      studentId: 'IT-24026',
      name: 'Tanvir Islam',
      email: 'it24026.student@mbstu.ac.bd',
      departmentId: 'dept-ict',
      academicSessionId: 'sess-2025-2026',
      year: 1,
      semester: 1,
      batchId: 'batch-ict-2026',
      section: 'A',
      status: 'ACTIVE',
      hasFaceProfile: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    },
    {
      id: 'stu-02',
      studentId: 'CSE-26002',
      name: 'Farhana Yasmin',
      email: 'farhana.y@mbstu.ac.bd',
      departmentId: 'dept-cse',
      academicSessionId: 'sess-2025-2026',
      year: 1,
      semester: 1,
      batchId: 'batch-2026',
      section: 'A',
      status: 'ACTIVE',
      hasFaceProfile: true,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
    },
    {
      id: 'stu-03',
      studentId: 'CSE-26003',
      name: 'Sabbir Hossain',
      email: 'sabbir.h@mbstu.ac.bd',
      departmentId: 'dept-cse',
      academicSessionId: 'sess-2025-2026',
      year: 1,
      semester: 1,
      batchId: 'batch-2026',
      section: 'A',
      status: 'ACTIVE',
      hasFaceProfile: false,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
    },
    {
      id: 'stu-04',
      studentId: 'IT-25010',
      name: 'Labib Ahmed',
      email: 'labib.it@mbstu.ac.bd',
      departmentId: 'dept-ict',
      academicSessionId: 'sess-2025-2026',
      year: 2,
      semester: 1,
      batchId: 'batch-ict-2025',
      section: 'A',
      status: 'ACTIVE',
      hasFaceProfile: false,
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=160&q=80',
    },
    {
      id: 'stu-05',
      studentId: 'EEE-26001',
      name: 'Amina Khatun',
      email: 'amina.eee@mbstu.ac.bd',
      departmentId: 'dept-eee',
      academicSessionId: 'sess-2025-2026',
      year: 1,
      semester: 1,
      batchId: 'batch-eee-2026',
      section: 'A',
      status: 'ACTIVE',
      hasFaceProfile: false,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
    },
  ],
  studentEnrollments: [
    // Tanvir Islam (ICT Y1S1)
    { id: 'enr-01', studentId: 'stu-01', courseOfferingId: 'co-ict-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-02', studentId: 'stu-01', courseOfferingId: 'co-ict-1102', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Farhana Yasmin (CSE Y1S1)
    { id: 'enr-05', studentId: 'stu-02', courseOfferingId: 'co-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-06', studentId: 'stu-02', courseOfferingId: 'co-1102', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-07', studentId: 'stu-02', courseOfferingId: 'co-2101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-08', studentId: 'stu-02', courseOfferingId: 'co-2103', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Sabbir Hossain (CSE Y1S1)
    { id: 'enr-09', studentId: 'stu-03', courseOfferingId: 'co-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-10', studentId: 'stu-03', courseOfferingId: 'co-1103', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Labib Ahmed (ICT Y2S1)
    { id: 'enr-12', studentId: 'stu-04', courseOfferingId: 'co-ict-2101', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Amina Khatun (EEE Y1S1)
    { id: 'enr-13', studentId: 'stu-05', courseOfferingId: 'co-eee-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-14', studentId: 'stu-05', courseOfferingId: 'co-eee-1102', enrolledAt: '2026-08-05', status: 'ENROLLED' },
  ],
  faceProfiles: [
    {
      studentId: 'stu-01',
      embedding: Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.42)),
      features: { eyeDistance: 64, jawWidth: 122, noseLength: 48, faceRatio: 1.34 },
      modelVersion: 'v2.1-mobilenet-ssd',
      status: 'REGISTERED',
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
    },
  ],
  routines: [
    {
      id: 'rt-01',
      courseOfferingId: 'co-1101',
      teacherId: 'tch-01',
      dayOfWeek: 'Sunday',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      room: 'Room 304',
      building: 'Academic Complex 2',
    },
    {
      id: 'rt-02',
      courseOfferingId: 'co-1102',
      teacherId: 'tch-01',
      dayOfWeek: 'Sunday',
      startTime: '11:00 AM',
      endTime: '01:00 PM',
      room: 'Lab 402',
      building: 'Academic Complex 2',
    },
    {
      id: 'rt-03',
      courseOfferingId: 'co-2103',
      teacherId: 'tch-03',
      dayOfWeek: 'Monday',
      startTime: '11:00 AM',
      endTime: '12:00 PM',
      room: 'Room 306',
      building: 'Academic Complex 2',
    },
    {
      id: 'rt-04',
      courseOfferingId: 'co-2101',
      teacherId: 'tch-03',
      dayOfWeek: 'Wednesday',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      room: 'Room 304',
      building: 'Academic Complex 2',
    },
  ],
  attendanceSessions: [
    {
      id: 'sess-today-active',
      courseOfferingId: 'co-1101',
      teacherId: 'tch-01',
      routineEntryId: 'rt-01',
      date: '2026-10-28',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      attendanceMethod: 'QR',
      status: 'ACTIVE',
      currentToken: 'UNI-QR-SESSION-ACTIVE-1101',
      tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      allowSelfCheckIn: true,
      notes: 'Midterm review and Chapter 5 attendance',
      createdAt: new Date().toISOString(),
    },
  ],
  attendanceRecords: [
    { id: 'rec-01', sessionId: 'sess-today-active', courseOfferingId: 'co-1101', studentId: 'stu-01', timestamp: new Date().toISOString(), method: 'QR', status: 'PRESENT', minutesLate: 5 },
  ],
  attendanceCorrections: [],
  faceLogs: [],
  qrLogs: [],
  emailLogs: [],
  auditLogs: [
    {
      id: 'aud-01',
      userId: 'usr-admin-1',
      userName: 'Academic Registrar',
      action: 'SYSTEM_INITIALIZED',
      entity: 'SYSTEM',
      entityId: 'ROOT',
      details: 'Academic sessions 2025-2026 provisioned with Cloud Firestore.',
      timestamp: new Date().toISOString(),
    },
  ],
  settings: DEFAULT_SYSTEM_SETTINGS,
};

class DatabaseService {
  private state: SystemDatabaseState;
  private isConnectedToFirestore = false;
  private syncing = false;
  private listeners: (() => void)[] = [];
  private unsubscribeCallbacks: (() => void)[] = [];

  constructor() {
    // Initialize strictly with local backup/seed data. Never fire unauthenticated Firestore queries on startup.
    this.state = this.loadLocalBackup();
    this.runDataIntegrityCheckAndMigrations();
  }

  private loadLocalBackup(): SystemDatabaseState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        const mergeById = <T extends { id: string }>(initialList: T[], savedList?: T[]): T[] => {
          if (!savedList || !Array.isArray(savedList)) return [...initialList];
          const map = new Map<string, T>();
          initialList.forEach(item => map.set(item.id, item));
          savedList.forEach(item => map.set(item.id, { ...(map.get(item.id) || {}), ...item }));
          return Array.from(map.values());
        };

        return {
          ...INITIAL_STATE,
          ...parsed,
          departments: mergeById(INITIAL_STATE.departments, parsed.departments),
          batches: mergeById(INITIAL_STATE.batches, parsed.batches),
          teachers: mergeById(INITIAL_STATE.teachers, parsed.teachers),
          students: mergeById(INITIAL_STATE.students, parsed.students),
          courses: mergeById(INITIAL_STATE.courses, parsed.courses),
          courseOfferings: mergeById(INITIAL_STATE.courseOfferings, parsed.courseOfferings),
          teacherAssignments: mergeById(INITIAL_STATE.teacherAssignments, parsed.teacherAssignments),
          studentEnrollments: mergeById(INITIAL_STATE.studentEnrollments, parsed.studentEnrollments),
          routines: mergeById(INITIAL_STATE.routines, parsed.routines),
          settings: { ...DEFAULT_SYSTEM_SETTINGS, ...(parsed.settings || {}) },
        };
      }
    } catch {
      // Fallback
    }
    return INITIAL_STATE;
  }

  /**
   * System-wide self-healing integrity verification:
   * 1. Generates 4-year cohorts for any department lacking batches.
   * 2. Automatically fixes known legacy student department mismatches (e.g., student with IT- roll mapped to CSE).
   * 3. Preserves all attendance records, logins, and historical grades safely.
   */
  private runDataIntegrityCheckAndMigrations(): void {
    let modified = false;

    // 1. Ensure batches for all existing departments
    for (const dept of this.state.departments) {
      const deptBatches = this.state.batches.filter(b => b.departmentId === dept.id);
      if (deptBatches.length === 0) {
        const generated = this.generateDefaultBatchesForDepartment(dept.id, dept.code);
        this.state.batches.push(...generated);
        modified = true;
      }
    }

    // 2. Data consistency for students: If student ID has 'IT-' or email has 'it', ensure departmentId is 'dept-ict'
    for (const student of this.state.students) {
      if (student.studentId.toUpperCase().startsWith('IT-') && student.departmentId !== 'dept-ict') {
        student.departmentId = 'dept-ict';
        const matchingBatch =
          this.state.batches.find(b => b.departmentId === 'dept-ict' && b.currentYear === student.year) ||
          this.state.batches.find(b => b.departmentId === 'dept-ict');
        if (matchingBatch) student.batchId = matchingBatch.id;
        modified = true;
      } else if (student.studentId.toUpperCase().startsWith('EEE-') && student.departmentId !== 'dept-eee') {
        student.departmentId = 'dept-eee';
        const matchingBatch =
          this.state.batches.find(b => b.departmentId === 'dept-eee' && b.currentYear === student.year) ||
          this.state.batches.find(b => b.departmentId === 'dept-eee');
        if (matchingBatch) student.batchId = matchingBatch.id;
        modified = true;
      }
    }

    if (modified) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // Ignore storage errors
      }
    }
  }

  public saveLocalBackup(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage errors
    }
    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    // Schedule asynchronously to prevent React's "Cannot update a component while rendering a different component"
    setTimeout(() => {
      this.listeners.forEach(cb => {
        try {
          cb();
        } catch (err) {
          console.error('Listener callback error:', err);
        }
      });
    }, 0);
  }

  public isFirestoreConnected(): boolean {
    return this.isConnectedToFirestore;
  }

  public isSyncing(): boolean {
    return this.syncing;
  }

  /**
   * Synchronizes with Cloud Firestore strictly after authentication state is resolved.
   * Tailors collection queries and listeners according to user role (Admin, Teacher, Student).
   */
  public async syncWithAuth(
    user: FirebaseUser | null,
    role: UserRole,
    profile?: { studentId?: string; teacherId?: string } | null
  ): Promise<void> {
    this.cleanupListeners();

    if (!user) {
      this.isConnectedToFirestore = false;
      this.syncing = false;
      this.notifyListeners();
      return;
    }

    try {
      this.syncing = true;
      const isAdmin = role === 'ADMIN' || user.email === 'it24026@mbstu.ac.bd' || user.email === 'sabbirstudy2002@gmail.com';
      const isTeacher = role === 'TEACHER';
      const studentId = profile?.studentId || 'stu-01';

      // 1. If Admin, check if database needs initial university seeding
      if (isAdmin) {
        try {
          const deptSnap = await getDocs(collection(firestoreDb, 'departments'));
          if (deptSnap.empty) {
            await this.seedFirestoreInitialData();
          }
        } catch (seedErr) {
          console.debug('Seeding check note:', seedErr);
        }
      }

      // 2. Load collections permitted for this role
      await this.loadRoleCollectionsFromFirestore(isAdmin, isTeacher, studentId);

      // 3. Attach real-time listeners for live updates across clients
      this.attachRoleRealtimeListeners(isAdmin, isTeacher, studentId);
      this.isConnectedToFirestore = true;
    } catch (error) {
      console.warn('Firestore authenticated sync note:', error);
    } finally {
      this.syncing = false;
      this.notifyListeners();
    }
  }

  public cleanupListeners(): void {
    this.unsubscribeCallbacks.forEach(unsub => {
      try {
        unsub();
      } catch {
        // Safe disposal
      }
    });
    this.unsubscribeCallbacks = [];
  }

  /**
   * Helper that sanitizes any data before sending to Firestore setDoc,
   * completely preventing "Unsupported field value: undefined" errors.
   */
  public async safeSetDoc(docRef: any, data: any, options?: any): Promise<void> {
    if (!docRef) {
      console.warn('safeSetDoc called without a valid DocumentReference; skipping Firestore write.');
      return;
    }
    const cleanData = sanitizeForFirestore(data);
    if (options) {
      return setDoc(docRef, cleanData, options);
    }
    return setDoc(docRef, cleanData);
  }

  private async seedFirestoreInitialData(): Promise<void> {
    try {
      const batch = writeBatch(firestoreDb);

      for (const d of INITIAL_STATE.departments) {
        batch.set(doc(firestoreDb, 'departments', d.id), sanitizeForFirestore(d));
      }
      for (const s of INITIAL_STATE.academicSessions) {
        batch.set(doc(firestoreDb, 'academic_sessions', s.id), sanitizeForFirestore(s));
      }
      for (const b of INITIAL_STATE.batches) {
        batch.set(doc(firestoreDb, 'batches', b.id), sanitizeForFirestore(b));
      }
      for (const c of INITIAL_STATE.courses) {
        batch.set(doc(firestoreDb, 'courses', c.id), sanitizeForFirestore(c));
      }
      for (const co of INITIAL_STATE.courseOfferings) {
        batch.set(doc(firestoreDb, 'course_offerings', co.id), sanitizeForFirestore(co));
      }
      for (const t of INITIAL_STATE.teachers) {
        batch.set(doc(firestoreDb, 'teachers', t.id), sanitizeForFirestore(t));
      }
      for (const ta of INITIAL_STATE.teacherAssignments) {
        batch.set(doc(firestoreDb, 'teacher_assignments', ta.id), sanitizeForFirestore(ta));
      }
      for (const st of INITIAL_STATE.students) {
        batch.set(doc(firestoreDb, 'students', st.id), sanitizeForFirestore(st));
      }
      for (const en of INITIAL_STATE.studentEnrollments) {
        batch.set(doc(firestoreDb, 'student_enrollments', en.id), sanitizeForFirestore(en));
      }
      for (const rt of INITIAL_STATE.routines) {
        batch.set(doc(firestoreDb, 'routines', rt.id), sanitizeForFirestore(rt));
      }
      for (const sess of INITIAL_STATE.attendanceSessions) {
        batch.set(doc(firestoreDb, 'attendance_sessions', sess.id), sanitizeForFirestore(sess));
      }
      for (const rec of INITIAL_STATE.attendanceRecords) {
        batch.set(doc(firestoreDb, 'attendance_records', rec.id), sanitizeForFirestore(rec));
      }

      await batch.commit();
      console.log('Successfully seeded initial university data into Cloud Firestore!');
    } catch (err) {
      console.error('Error seeding Firestore:', err);
    }
  }

  private async loadRoleCollectionsFromFirestore(
    isAdmin: boolean,
    isTeacher: boolean,
    studentId: string
  ): Promise<void> {
    const fetchSafe = async (colName: string, queryRef: any, onDocs: (docs: any[]) => void) => {
      try {
        const snap = await getDocs(queryRef);
        if (!snap.empty) {
          onDocs(snap.docs.map(d => d.data()));
        }
      } catch (err) {
        console.debug(`Collection ${colName} read deferred or restricted:`, err);
      }
    };

    await Promise.all([
      fetchSafe('departments', collection(firestoreDb, 'departments'), data => { this.state.departments = data as Department[]; }),
      fetchSafe('academic_sessions', collection(firestoreDb, 'academic_sessions'), data => { this.state.academicSessions = data as AcademicSession[]; }),
      fetchSafe('batches', collection(firestoreDb, 'batches'), data => { this.state.batches = data as Batch[]; }),
      fetchSafe('courses', collection(firestoreDb, 'courses'), data => { this.state.courses = data as Course[]; }),
      fetchSafe('course_offerings', collection(firestoreDb, 'course_offerings'), data => { this.state.courseOfferings = data as CourseOffering[]; }),
      fetchSafe('teachers', collection(firestoreDb, 'teachers'), data => { this.state.teachers = data as Teacher[]; }),
      fetchSafe('teacher_assignments', collection(firestoreDb, 'teacher_assignments'), data => { this.state.teacherAssignments = data as TeacherAssignment[]; }),
      fetchSafe('students', collection(firestoreDb, 'students'), data => { this.state.students = data as Student[]; }),
      fetchSafe('student_enrollments', collection(firestoreDb, 'student_enrollments'), data => { this.state.studentEnrollments = data as StudentEnrollment[]; }),
      fetchSafe('routines', collection(firestoreDb, 'routines'), data => { this.state.routines = data as RoutineEntry[]; }),
      fetchSafe('attendance_sessions', collection(firestoreDb, 'attendance_sessions'), data => { this.state.attendanceSessions = data as AttendanceSession[]; }),
      fetchSafe(
        'attendance_records',
        (isAdmin || isTeacher)
          ? collection(firestoreDb, 'attendance_records')
          : query(collection(firestoreDb, 'attendance_records'), where('studentId', '==', studentId)),
        data => {
          if (isAdmin || isTeacher) {
            this.state.attendanceRecords = data as AttendanceRecord[];
          } else {
            const otherRecords = this.state.attendanceRecords.filter(r => r.studentId !== studentId);
            this.state.attendanceRecords = [...otherRecords, ...(data as AttendanceRecord[])];
          }
        }
      ),
    ]);

    this.saveLocalBackup();
  }

  private attachRoleRealtimeListeners(isAdmin: boolean, isTeacher: boolean, studentId: string): void {
    // 1. Attendance sessions real-time listener (all authenticated users can read to participate)
    try {
      const unsubSessions = onSnapshot(
        collection(firestoreDb, 'attendance_sessions'),
        snapshot => {
          if (!snapshot.empty) {
            this.state.attendanceSessions = snapshot.docs.map(d => d.data() as AttendanceSession);
            this.saveLocalBackup();
          }
        },
        error => {
          handleFirestoreError(error, OperationType.GET, 'attendance_sessions');
        }
      );
      this.unsubscribeCallbacks.push(unsubSessions);
    } catch (e) {
      console.warn('Sessions listener attachment note:', e);
    }

    // 2. Attendance records real-time listener (filtered by studentId for students, or all for admin/teachers)
    try {
      const recordsQuery = (isAdmin || isTeacher)
        ? collection(firestoreDb, 'attendance_records')
        : query(collection(firestoreDb, 'attendance_records'), where('studentId', '==', studentId));

      const unsubRecords = onSnapshot(
        recordsQuery,
        snapshot => {
          if (!snapshot.empty) {
            const fetched = snapshot.docs.map(d => d.data() as AttendanceRecord);
            if (isAdmin || isTeacher) {
              this.state.attendanceRecords = fetched;
            } else {
              const otherRecords = this.state.attendanceRecords.filter(r => r.studentId !== studentId);
              this.state.attendanceRecords = [...otherRecords, ...fetched];
            }
            this.saveLocalBackup();
          }
        },
        error => {
          handleFirestoreError(error, OperationType.GET, 'attendance_records');
        }
      );
      this.unsubscribeCallbacks.push(unsubRecords);
    } catch (e) {
      console.warn('Records listener attachment note:', e);
    }
  }

  public getState(): SystemDatabaseState {
    return this.state;
  }

  public resetToDefaultSeed(): void {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveLocalBackup();
    this.seedFirestoreInitialData().catch(console.error);
  }

  // ==================== DEPARTMENTS ====================
  public getDepartments(): Department[] {
    return this.state.departments;
  }

  public getDepartmentById(deptId?: string): Department | undefined {
    if (!deptId) return undefined;
    const clean = deptId.trim().toLowerCase();
    return this.state.departments.find(
      d => d.id.toLowerCase() === clean || d.code.toLowerCase() === clean
    );
  }

  public addDepartment(dept: Omit<Department, 'id'>): Department {
    const newDept: Department = {
      ...dept,
      id: 'dept-' + dept.code.toLowerCase().replace(/\s+/g, '-'),
    };
    this.state.departments.push(newDept);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'departments', newDept.id), newDept).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `departments/${newDept.id}`);
    });

    // Automatically generate 4 academic cohort batches for this new department
    this.ensureBatchesForDepartment(newDept.id);

    return newDept;
  }

  // ==================== ACADEMIC SESSIONS & BATCHES ====================
  public getAcademicSessions(): AcademicSession[] {
    return this.state.academicSessions;
  }

  public getBatches(): Batch[] {
    return this.state.batches;
  }

  public getBatchesByDepartment(departmentId?: string): Batch[] {
    if (!departmentId || departmentId === 'ALL') return this.state.batches;
    return this.state.batches.filter(b => b.departmentId === departmentId);
  }

  public generateDefaultBatchesForDepartment(departmentId: string, departmentCode?: string): Batch[] {
    const code = departmentCode || departmentId.replace('dept-', '').toUpperCase();
    return [
      { id: `batch-${code.toLowerCase()}-2026`, name: `Batch 2026 (1st Year - ${code})`, startYear: 2026, departmentId, currentYear: 1, currentSemester: 1 },
      { id: `batch-${code.toLowerCase()}-2025`, name: `Batch 2025 (2nd Year - ${code})`, startYear: 2025, departmentId, currentYear: 2, currentSemester: 1 },
      { id: `batch-${code.toLowerCase()}-2024`, name: `Batch 2024 (3rd Year - ${code})`, startYear: 2024, departmentId, currentYear: 3, currentSemester: 1 },
      { id: `batch-${code.toLowerCase()}-2023`, name: `Batch 2023 (4th Year - ${code})`, startYear: 2023, departmentId, currentYear: 4, currentSemester: 1 },
    ];
  }

  public ensureBatchesForDepartment(departmentId: string): Batch[] {
    const existing = this.getBatchesByDepartment(departmentId);
    if (existing.length > 0) return existing;

    const dept = this.getDepartmentById(departmentId);
    const newBatches = this.generateDefaultBatchesForDepartment(departmentId, dept?.code);
    this.state.batches.push(...newBatches);
    this.saveLocalBackup();

    for (const b of newBatches) {
      this.safeSetDoc(doc(firestoreDb, 'batches', b.id), b).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `batches/${b.id}`);
      });
    }

    return newBatches;
  }

  public addBatch(batch: Omit<Batch, 'id'>): Batch {
    const newBatch: Batch = {
      ...batch,
      id: 'batch-' + Date.now(),
    };
    this.state.batches.push(newBatch);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'batches', newBatch.id), newBatch).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `batches/${newBatch.id}`);
    });

    return newBatch;
  }

  // ==================== COURSES ====================
  public getCourses(): Course[] {
    return this.state.courses;
  }

  public addCourse(course: Omit<Course, 'id'>): Course {
    const newCourse: Course = {
      ...course,
      id: 'c-' + Date.now(),
    };
    this.state.courses.push(newCourse);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'courses', newCourse.id), newCourse).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `courses/${newCourse.id}`);
    });

    return newCourse;
  }

  public updateCourse(courseId: string, updates: Partial<Course>): Course | null {
    const idx = this.state.courses.findIndex(c => c.id === courseId);
    if (idx === -1) return null;

    this.state.courses[idx] = { ...this.state.courses[idx], ...updates };
    const updated = this.state.courses[idx];
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'courses', courseId), updated).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
    });

    return updated;
  }

  public deleteCourse(courseId: string): boolean {
    const exists = this.state.courses.some(c => c.id === courseId);
    if (!exists) return false;

    this.state.courses = this.state.courses.filter(c => c.id !== courseId);
    this.saveLocalBackup();

    deleteDoc(doc(firestoreDb, 'courses', courseId)).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `courses/${courseId}`);
    });

    return true;
  }

  public isCourseCodeTaken(code: string, excludeId?: string): boolean {
    const clean = code.trim().toUpperCase();
    return this.state.courses.some(c => c.code.toUpperCase() === clean && c.id !== excludeId);
  }

  // ==================== COURSE OFFERINGS ====================
  public getCourseOfferings(): CourseOffering[] {
    return this.state.courseOfferings;
  }

  public addCourseOffering(offering: Omit<CourseOffering, 'id' | 'conductedClasses'>): CourseOffering {
    const newOffering: CourseOffering = {
      ...offering,
      id: 'co-' + Date.now(),
      conductedClasses: 0,
    };
    this.state.courseOfferings.push(newOffering);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'course_offerings', newOffering.id), newOffering).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `course_offerings/${newOffering.id}`);
    });

    return newOffering;
  }

  public updateCourseOffering(offeringId: string, updates: Partial<CourseOffering>): CourseOffering | null {
    const idx = this.state.courseOfferings.findIndex(o => o.id === offeringId);
    if (idx === -1) return null;

    this.state.courseOfferings[idx] = { ...this.state.courseOfferings[idx], ...updates };
    const updated = this.state.courseOfferings[idx];
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'course_offerings', offeringId), updated).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `course_offerings/${offeringId}`);
    });

    return updated;
  }

  // ==================== TEACHERS & ASSIGNMENTS ====================
  public getTeachers(): Teacher[] {
    return this.state.teachers;
  }

  public addTeacher(teacher: Omit<Teacher, 'id'>): Teacher {
    const newTeacher: Teacher = {
      ...teacher,
      id: 'tch-' + Date.now(),
    };
    this.state.teachers.push(newTeacher);
    this.saveLocalBackup();

    if (auth.currentUser) {
      setDoc(doc(firestoreDb, 'teachers', newTeacher.id), sanitizeForFirestore(newTeacher)).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `teachers/${newTeacher.id}`);
      });
    }

    return newTeacher;
  }

  public updateTeacher(teacherId: string, updates: Partial<Teacher>): Teacher | null {
    const idx = this.state.teachers.findIndex(t => t.id === teacherId);
    if (idx === -1) return null;

    this.state.teachers[idx] = { ...this.state.teachers[idx], ...updates };
    const updated = this.state.teachers[idx];
    this.saveLocalBackup();

    if (auth.currentUser) {
      setDoc(doc(firestoreDb, 'teachers', teacherId), sanitizeForFirestore(updated), { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `teachers/${teacherId}`);
      });
    }

    return updated;
  }

  public deleteTeacher(teacherId: string): boolean {
    const exists = this.state.teachers.some(t => t.id === teacherId);
    if (!exists) return false;

    this.state.teachers = this.state.teachers.filter(t => t.id !== teacherId);
    this.state.teacherAssignments = this.state.teacherAssignments.filter(ta => ta.teacherId !== teacherId);
    this.saveLocalBackup();

    if (auth.currentUser) {
      deleteDoc(doc(firestoreDb, 'teachers', teacherId)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `teachers/${teacherId}`);
      });
    }

    return true;
  }

  public isTeacherIdTaken(teacherIdStr: string, excludeId?: string): boolean {
    const clean = teacherIdStr.trim().toLowerCase();
    return this.state.teachers.some(t => t.teacherId.toLowerCase() === clean && t.id !== excludeId);
  }

  public findTeacher(query?: string | null): Teacher | undefined {
    if (!query) return undefined;
    const q = query.trim().toLowerCase();
    return this.state.teachers.find(
      t =>
        t.id.toLowerCase() === q ||
        t.teacherId.toLowerCase() === q ||
        t.email.toLowerCase() === q ||
        (t.authUid && t.authUid === query.trim())
    );
  }

  public getTeacherAssignments(): TeacherAssignment[] {
    return this.state.teacherAssignments;
  }

  public canAssignTeacherToOffering(teacherId: string, courseOfferingId: string): { allowed: boolean; reason?: string } {
    const cleanTid = (teacherId || '').trim().toLowerCase();
    const teacher = this.state.teachers.find(
      t => t.id.toLowerCase() === cleanTid || t.teacherId.toLowerCase() === cleanTid
    );
    if (!teacher) return { allowed: false, reason: 'Teacher not found' };

    const targetOffering = this.state.courseOfferings.find(co => co.id === courseOfferingId);
    if (!targetOffering) return { allowed: false, reason: 'Course offering not found' };

    const targetCourse = this.state.courses.find(c => c.id === targetOffering.courseId);
    if (!targetCourse) return { allowed: false, reason: 'Course not found' };

    // Check 1 regular/theory course rule per semester + batch
    if (targetCourse.type === 'THEORY') {
      const existingAssignments = this.state.teacherAssignments.filter(
        ta => ta.teacherId === teacher.id || ta.teacherId === teacher.teacherId
      );
      for (const assign of existingAssignments) {
        const off = this.state.courseOfferings.find(co => co.id === assign.courseOfferingId);
        if (off && off.batchId === targetOffering.batchId && off.year === targetOffering.year && off.semester === targetOffering.semester) {
          const assignedCourse = this.state.courses.find(c => c.id === off.courseId);
          if (assignedCourse && assignedCourse.type === 'THEORY' && off.id !== courseOfferingId) {
            return {
              allowed: false,
              reason: `Policy Violation: A teacher can teach MAXIMUM ONE regular/theory course in a specific semester + batch. Teacher already teaches ${assignedCourse.code} in this batch. (Lab courses remain allowed).`,
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  public assignTeacherToOffering(teacherId: string, courseOfferingId: string, role: 'PRIMARY' | 'CO_TEACHER' = 'PRIMARY'): { success: boolean; message: string } {
    const cleanTid = (teacherId || '').trim().toLowerCase();
    const teacher = this.state.teachers.find(
      t => t.id.toLowerCase() === cleanTid || t.teacherId.toLowerCase() === cleanTid
    );
    if (!teacher) {
      return { success: false, message: 'Teacher not found in system.' };
    }

    const check = this.canAssignTeacherToOffering(teacher.id, courseOfferingId);
    if (!check.allowed) {
      return { success: false, message: check.reason || 'Assignment not allowed' };
    }

    const targetOffering = this.state.courseOfferings.find(co => co.id === courseOfferingId);
    if (!targetOffering) {
      return { success: false, message: 'Target course offering not found.' };
    }

    // Auto-authorize course for teacher if not already present in authorizedCourseIds
    if (!teacher.authorizedCourseIds.includes(targetOffering.courseId)) {
      teacher.authorizedCourseIds.push(targetOffering.courseId);
      this.updateTeacher(teacher.id, { authorizedCourseIds: [...teacher.authorizedCourseIds] });
    }

    // Prevent duplicate assignment of same teacher to same offering
    const existing = this.state.teacherAssignments.find(
      ta => (ta.teacherId === teacher.id || ta.teacherId === teacher.teacherId) && ta.courseOfferingId === courseOfferingId
    );
    if (existing) {
      return { success: true, message: 'Teacher is already assigned to this course offering.' };
    }

    const newAssignment: TeacherAssignment = {
      id: 'ta-' + Date.now(),
      teacherId: teacher.id,
      courseOfferingId,
      role,
      assignedAt: new Date().toISOString(),
    };
    this.state.teacherAssignments.push(newAssignment);
    this.saveLocalBackup();
    this.notifyListeners();

    this.safeSetDoc(doc(firestoreDb, 'teacher_assignments', newAssignment.id), newAssignment).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `teacher_assignments/${newAssignment.id}`);
    });

    return { success: true, message: 'Teacher successfully assigned to course offering!' };
  }

  public removeTeacherAssignment(assignmentId: string): void {
    this.state.teacherAssignments = this.state.teacherAssignments.filter(ta => ta.id !== assignmentId);
    this.saveLocalBackup();

    deleteDoc(doc(firestoreDb, 'teacher_assignments', assignmentId)).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `teacher_assignments/${assignmentId}`);
    });
  }

  // ==================== STUDENTS & ENROLLMENT ====================
  public getStudents(): Student[] {
    return this.state.students;
  }

  public findStudent(query?: string | null): Student | undefined {
    if (!query) return undefined;
    const q = query.trim().toLowerCase();
    return this.state.students.find(
      s =>
        s.id.toLowerCase() === q ||
        s.studentId.toLowerCase() === q ||
        s.email.toLowerCase() === q ||
        (s.authUid && s.authUid === query.trim())
    );
  }

  public getStudentEnrollments(): StudentEnrollment[] {
    return this.state.studentEnrollments;
  }

  public addStudent(student: Omit<Student, 'id'>): Student {
    const newStudent: Student = {
      ...student,
      id: 'stu-' + Date.now(),
    };
    this.state.students.push(newStudent);
    this.saveLocalBackup();

    if (auth.currentUser) {
      setDoc(doc(firestoreDb, 'students', newStudent.id), sanitizeForFirestore(newStudent)).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `students/${newStudent.id}`);
      });
    }

    return newStudent;
  }

  public updateStudent(studentId: string, updates: Partial<Student>): Student | null {
    const idx = this.state.students.findIndex(s => s.id === studentId);
    if (idx === -1) return null;

    this.state.students[idx] = { ...this.state.students[idx], ...updates };
    const updated = this.state.students[idx];
    this.saveLocalBackup();

    if (auth.currentUser) {
      setDoc(doc(firestoreDb, 'students', studentId), sanitizeForFirestore(updated), { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `students/${studentId}`);
      });
    }

    return updated;
  }

  public deleteStudent(studentId: string): boolean {
    const exists = this.state.students.some(s => s.id === studentId);
    if (!exists) return false;

    this.state.students = this.state.students.filter(s => s.id !== studentId);
    this.state.studentEnrollments = this.state.studentEnrollments.filter(e => e.studentId !== studentId);
    this.saveLocalBackup();

    if (auth.currentUser) {
      deleteDoc(doc(firestoreDb, 'students', studentId)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`);
      });
    }

    return true;
  }

  public isStudentIdTaken(roll: string, excludeId?: string): boolean {
    const clean = roll.trim().toLowerCase();
    return this.state.students.some(s => s.studentId.toLowerCase() === clean && s.id !== excludeId);
  }

  public isEmailTaken(email: string, excludeId?: string): boolean {
    const clean = email.trim().toLowerCase();
    const studentMatch = this.state.students.some(s => s.email.toLowerCase() === clean && s.id !== excludeId);
    const teacherMatch = this.state.teachers.some(t => t.email.toLowerCase() === clean && t.id !== excludeId);
    return studentMatch || teacherMatch;
  }

  public enrollStudent(
    studentId: string,
    courseOfferingId: string,
    options?: { allowCrossBatch?: boolean }
  ): { success: boolean; message: string } {
    const student = this.state.students.find(s => s.id === studentId);
    const offering = this.state.courseOfferings.find(co => co.id === courseOfferingId);
    if (!student || !offering) return { success: false, message: 'Invalid student or course offering' };

    const course = this.state.courses.find(c => c.id === offering.courseId);

    const check = checkStudentCourseEligibility(
      student,
      offering,
      course,
      this.state.studentEnrollments,
      this.state.departments,
      this.state.batches,
      options
    );

    if (!check.eligible) {
      return {
        success: false,
        message: check.reason || 'Student is not eligible for this course offering.',
      };
    }

    const enrollment: StudentEnrollment = {
      id: 'enr-' + Date.now(),
      studentId,
      courseOfferingId,
      enrolledAt: new Date().toISOString(),
      status: 'ENROLLED',
    };
    this.state.studentEnrollments.push(enrollment);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'student_enrollments', enrollment.id), enrollment).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `student_enrollments/${enrollment.id}`);
    });

    return { success: true, message: 'Student enrolled successfully' };
  }

  public unenrollStudent(enrollmentId: string): void {
    this.state.studentEnrollments = this.state.studentEnrollments.filter(e => e.id !== enrollmentId);
    this.saveLocalBackup();

    deleteDoc(doc(firestoreDb, 'student_enrollments', enrollmentId)).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `student_enrollments/${enrollmentId}`);
    });
  }

  // ==================== FACE PROFILES ====================
  public getFaceProfiles(): FaceProfile[] {
    return this.state.faceProfiles;
  }

  public getFaceProfile(studentId: string): FaceProfile | undefined {
    return this.state.faceProfiles.find(fp => fp.studentId === studentId);
  }

  public saveFaceProfile(profile: FaceProfile): void {
    const idx = this.state.faceProfiles.findIndex(fp => fp.studentId === profile.studentId);
    if (idx >= 0) {
      this.state.faceProfiles[idx] = profile;
    } else {
      this.state.faceProfiles.push(profile);
    }
    const student = this.state.students.find(s => s.id === profile.studentId);
    if (student) {
      student.hasFaceProfile = profile.status === 'REGISTERED';
    }
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'face_profiles', profile.studentId), profile).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `face_profiles/${profile.studentId}`);
    });
  }

  // ==================== ROUTINES ====================
  public getRoutines(): RoutineEntry[] {
    return this.state.routines;
  }

  public addRoutine(routine: Omit<RoutineEntry, 'id'>): RoutineEntry {
    const newRoutine: RoutineEntry = {
      ...routine,
      id: 'rt-' + Date.now(),
    };
    this.state.routines.push(newRoutine);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'routines', newRoutine.id), newRoutine).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `routines/${newRoutine.id}`);
    });

    return newRoutine;
  }

  public updateRoutine(routineId: string, updates: Partial<RoutineEntry>): RoutineEntry | null {
    const idx = this.state.routines.findIndex(r => r.id === routineId);
    if (idx === -1) return null;

    this.state.routines[idx] = { ...this.state.routines[idx], ...updates };
    const updated = this.state.routines[idx];
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'routines', routineId), updated).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `routines/${routineId}`);
    });

    return updated;
  }

  public deleteRoutine(routineId: string): boolean {
    const exists = this.state.routines.some(r => r.id === routineId);
    if (!exists) return false;

    this.state.routines = this.state.routines.filter(r => r.id !== routineId);
    this.saveLocalBackup();

    deleteDoc(doc(firestoreDb, 'routines', routineId)).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `routines/${routineId}`);
    });

    return true;
  }

  public checkRoutineConflict(
    candidate: Omit<RoutineEntry, 'id'>,
    excludeRoutineId?: string
  ): { hasConflict: boolean; reason?: string } {
    const parseMinutes = (timeStr: string): number => {
      const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return 0;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const candStart = parseMinutes(candidate.startTime);
    const candEnd = parseMinutes(candidate.endTime);

    if (candEnd <= candStart) {
      return { hasConflict: true, reason: 'Class end time must be after start time.' };
    }

    const sameDayRoutines = this.state.routines.filter(
      r => r.dayOfWeek === candidate.dayOfWeek && r.id !== excludeRoutineId
    );

    for (const r of sameDayRoutines) {
      const rStart = parseMinutes(r.startTime);
      const rEnd = parseMinutes(r.endTime);

      const isOverlapping = candStart < rEnd && candEnd > rStart;
      if (!isOverlapping) continue;

      // 1. Teacher Conflict
      if (r.teacherId === candidate.teacherId) {
        const teacher = this.state.teachers.find(t => t.id === candidate.teacherId);
        const offering = this.state.courseOfferings.find(o => o.id === r.courseOfferingId);
        const course = offering ? this.state.courses.find(c => c.id === offering.courseId) : undefined;
        return {
          hasConflict: true,
          reason: `Faculty Conflict: ${teacher?.name || 'Teacher'} is already scheduled for ${course?.code || 'another class'} in Room ${r.room} from ${r.startTime} to ${r.endTime} on ${candidate.dayOfWeek}.`,
        };
      }

      // 2. Room Conflict
      if (
        r.room.trim().toLowerCase() === candidate.room.trim().toLowerCase() &&
        (candidate.building ? r.building.trim().toLowerCase() === candidate.building.trim().toLowerCase() : true)
      ) {
        const offering = this.state.courseOfferings.find(o => o.id === r.courseOfferingId);
        const course = offering ? this.state.courses.find(c => c.id === offering.courseId) : undefined;
        return {
          hasConflict: true,
          reason: `Classroom Conflict: Room ${r.room} is already reserved for ${course?.code || 'another class'} (${r.startTime} - ${r.endTime}) on ${candidate.dayOfWeek}.`,
        };
      }
    }

    return { hasConflict: false };
  }

  // ==================== ATTENDANCE SESSIONS ====================
  public getAttendanceSessions(): AttendanceSession[] {
    return this.state.attendanceSessions;
  }

  public startAttendanceSession(params: {
    courseOfferingId: string;
    teacherId: string;
    routineEntryId?: string;
    attendanceMethod: 'QR' | 'FACE';
    notes?: string;
  }): AttendanceSession {
    const sessionToken = 'UNI-QR-' + Date.now() + '-' + Math.floor(Math.random() * 90000 + 10000);
    const now = new Date();
    const expires = new Date(now.getTime() + 20 * 60 * 1000);

    const session: AttendanceSession = {
      id: 'sess-' + Date.now(),
      courseOfferingId: params.courseOfferingId,
      teacherId: params.teacherId,
      date: now.toISOString().split('T')[0],
      startTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(now.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attendanceMethod: params.attendanceMethod,
      status: 'ACTIVE',
      currentToken: sessionToken,
      tokenExpiresAt: expires.toISOString(),
      allowSelfCheckIn: true,
      createdAt: now.toISOString(),
      ...(params.routineEntryId ? { routineEntryId: params.routineEntryId } : {}),
      ...(params.notes ? { notes: params.notes } : {}),
    };

    this.state.attendanceSessions.unshift(session);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'attendance_sessions', session.id), session).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `attendance_sessions/${session.id}`);
    });

    return session;
  }

  public refreshSessionToken(sessionId: string): string {
    const session = this.state.attendanceSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'ACTIVE') return '';
    session.currentToken = 'UNI-QR-' + Date.now() + '-' + Math.floor(Math.random() * 90000 + 10000);
    session.tokenExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'attendance_sessions', session.id), session).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `attendance_sessions/${session.id}`);
    });

    return session.currentToken;
  }

  public closeAttendanceSession(sessionId: string): void {
    const session = this.state.attendanceSessions.find(s => s.id === sessionId);
    if (!session || session.status === 'CLOSED') return;

    session.status = 'CLOSED';
    session.closedAt = new Date().toISOString();

    const enrollments = this.state.studentEnrollments.filter(e => e.courseOfferingId === session.courseOfferingId && e.status === 'ENROLLED');
    const existingRecords = this.state.attendanceRecords.filter(r => r.sessionId === sessionId);
    const recordedStudentIds = new Set(existingRecords.map(r => r.studentId));

    // Mark non-attendees as ABSENT in Firestore
    for (const enr of enrollments) {
      if (!recordedStudentIds.has(enr.studentId)) {
        const absRecord: AttendanceRecord = {
          id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
          sessionId: session.id,
          courseOfferingId: session.courseOfferingId,
          studentId: enr.studentId,
          timestamp: new Date().toISOString(),
          method: session.attendanceMethod,
          status: 'ABSENT',
          minutesLate: 60,
          notes: 'Finalized absent upon session close',
        };
        this.state.attendanceRecords.push(absRecord);
        this.safeSetDoc(doc(firestoreDb, 'attendance_records', absRecord.id), absRecord).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, `attendance_records/${absRecord.id}`);
        });
      }
    }

    const offering = this.state.courseOfferings.find(co => co.id === session.courseOfferingId);
    if (offering) {
      offering.conductedClasses = (offering.conductedClasses || 0) + 1;
      this.safeSetDoc(doc(firestoreDb, 'course_offerings', offering.id), offering).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `course_offerings/${offering.id}`);
      });
    }

    this.saveLocalBackup();
    this.safeSetDoc(doc(firestoreDb, 'attendance_sessions', session.id), session).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `attendance_sessions/${session.id}`);
    });
  }

  public recordManualSessionAttendance(params: {
    courseOfferingId: string;
    teacherId: string;
    date: string;
    startTime: string;
    notes?: string;
    records: Array<{
      studentId: string;
      status: AttendanceStatus;
      minutesLate: number;
      notes?: string;
    }>;
  }): { session: AttendanceSession; records: AttendanceRecord[] } {
    const now = new Date();
    const session: AttendanceSession = {
      id: 'sess-manual-' + Date.now(),
      courseOfferingId: params.courseOfferingId,
      teacherId: params.teacherId,
      date: params.date,
      startTime: params.startTime,
      endTime: new Date(now.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attendanceMethod: 'QR',
      status: 'CLOSED',
      currentToken: 'MANUAL-SHEET',
      tokenExpiresAt: now.toISOString(),
      allowSelfCheckIn: false,
      notes: params.notes,
      createdAt: now.toISOString(),
      closedAt: now.toISOString(),
    };

    this.state.attendanceSessions.unshift(session);
    this.safeSetDoc(doc(firestoreDb, 'attendance_sessions', session.id), session).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `attendance_sessions/${session.id}`);
    });

    const createdRecords: AttendanceRecord[] = [];
    for (const item of params.records) {
      const rec: AttendanceRecord = {
        id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 90000 + 10000),
        sessionId: session.id,
        courseOfferingId: params.courseOfferingId,
        studentId: item.studentId,
        timestamp: new Date().toISOString(),
        method: 'MANUAL_ADMIN',
        status: item.status,
        minutesLate: item.minutesLate,
        notes: item.notes || 'Marked manually',
      };
      this.state.attendanceRecords.push(rec);
      createdRecords.push(rec);
      this.safeSetDoc(doc(firestoreDb, 'attendance_records', rec.id), rec).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `attendance_records/${rec.id}`);
      });
    }

    const offering = this.state.courseOfferings.find(co => co.id === params.courseOfferingId);
    if (offering) {
      offering.conductedClasses = (offering.conductedClasses || 0) + 1;
      this.safeSetDoc(doc(firestoreDb, 'course_offerings', offering.id), offering).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `course_offerings/${offering.id}`);
      });
    }

    this.saveLocalBackup();
    return { session, records: createdRecords };
  }

  // ==================== ATTENDANCE RECORDS ====================
  public getAttendanceRecords(): AttendanceRecord[] {
    return this.state.attendanceRecords;
  }

  public recordStudentAttendance(params: {
    sessionId: string;
    studentId: string;
    method: 'QR' | 'FACE' | 'MANUAL_ADMIN';
    minutesLate: number;
    notes?: string;
  }): { success: boolean; message: string; record?: AttendanceRecord; status?: AttendanceStatus } {
    const session = this.state.attendanceSessions.find(s => s.id === params.sessionId);
    if (!session) return { success: false, message: 'Attendance session not found' };
    if (session.status !== 'ACTIVE' && params.method !== 'MANUAL_ADMIN') {
      return { success: false, message: 'Session is not currently active' };
    }

    const isEnrolled = this.state.studentEnrollments.some(
      e => e.courseOfferingId === session.courseOfferingId && e.studentId === params.studentId && e.status === 'ENROLLED'
    );
    if (!isEnrolled) {
      return { success: false, message: 'Student is not enrolled in this course offering' };
    }

    const existing = this.state.attendanceRecords.find(
      r => r.sessionId === params.sessionId && r.studentId === params.studentId
    );
    if (existing) {
      return {
        success: false,
        message: `Attendance already recorded for this session (${existing.status} at ${new Date(existing.timestamp).toLocaleTimeString()})`,
        record: existing,
        status: existing.status,
      };
    }

    const status: AttendanceStatus = params.minutesLate < this.state.settings.lateThresholdMinutes ? 'PRESENT' : 'LATE';

    const record: AttendanceRecord = {
      id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      sessionId: params.sessionId,
      courseOfferingId: session.courseOfferingId,
      studentId: params.studentId,
      timestamp: new Date().toISOString(),
      method: params.method,
      status,
      minutesLate: params.minutesLate,
      ...(params.notes ? { notes: params.notes } : {}),
    };

    this.state.attendanceRecords.push(record);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'attendance_records', record.id), record).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `attendance_records/${record.id}`);
    });

    return {
      success: true,
      message: status === 'PRESENT' ? 'Attendance marked PRESENT in Firestore!' : `Attendance marked LATE (${params.minutesLate} min after start)`,
      record,
      status,
    };
  }

  // ==================== MANUAL CORRECTION & AUDIT LOGS ====================
  public correctAttendance(params: {
    attendanceRecordId: string;
    newStatus: AttendanceStatus;
    changedBy: string;
    reason: string;
  }): { success: boolean; message: string } {
    const record = this.state.attendanceRecords.find(r => r.id === params.attendanceRecordId);
    if (!record) return { success: false, message: 'Attendance record not found' };

    const student = this.state.students.find(s => s.id === record.studentId);
    const offering = this.state.courseOfferings.find(co => co.id === record.courseOfferingId);
    const course = offering ? this.state.courses.find(c => c.id === offering.courseId) : undefined;

    const originalStatus = record.status;
    record.status = params.newStatus;
    record.notes = `Corrected by ${params.changedBy}: ${params.reason}`;

    const audit: AttendanceCorrectionAudit = {
      id: 'corr-' + Date.now(),
      attendanceId: record.id,
      studentId: record.studentId,
      studentName: student?.name || 'Unknown',
      courseOfferingId: record.courseOfferingId,
      courseCode: course?.code || 'N/A',
      originalStatus,
      newStatus: params.newStatus,
      changedBy: params.changedBy,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    };

    this.state.attendanceCorrections.unshift(audit);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'attendance_records', record.id), record).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `attendance_records/${record.id}`);
    });
    this.safeSetDoc(doc(firestoreDb, 'attendance_corrections', audit.id), audit).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `attendance_corrections/${audit.id}`);
    });

    return { success: true, message: 'Attendance successfully updated in Cloud Firestore' };
  }

  public getAttendanceCorrections(): AttendanceCorrectionAudit[] {
    return this.state.attendanceCorrections;
  }

  public addFaceLog(log: Omit<FaceVerificationLog, 'id' | 'timestamp'>): void {
    this.state.faceLogs.unshift({
      ...log,
      id: 'fl-' + Date.now(),
      timestamp: new Date().toISOString(),
    });
    this.saveLocalBackup();
  }

  public getFaceLogs(): FaceVerificationLog[] {
    return this.state.faceLogs;
  }

  public addQRLog(log: Omit<QRVerificationLog, 'id' | 'timestamp'>): void {
    this.state.qrLogs.unshift({
      ...log,
      id: 'ql-' + Date.now(),
      timestamp: new Date().toISOString(),
    });
    this.saveLocalBackup();
  }

  public getQRLogs(): QRVerificationLog[] {
    return this.state.qrLogs;
  }

  public addEmailLog(log: Omit<EmailLog, 'id' | 'sentAt'>): boolean {
    const existing = this.state.emailLogs.find(e => e.dedupKey === log.dedupKey);
    if (existing) return false;

    const newLog: EmailLog = {
      ...log,
      id: 'em-' + Date.now(),
      sentAt: new Date().toISOString(),
    };
    this.state.emailLogs.unshift(newLog);
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'email_logs', newLog.id), newLog).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `email_logs/${newLog.id}`);
    });

    return true;
  }

  public getEmailLogs(): EmailLog[] {
    return this.state.emailLogs;
  }

  public updateEmailLog(logId: string, updates: Partial<EmailLog>): EmailLog | null {
    const idx = this.state.emailLogs.findIndex(l => l.id === logId);
    if (idx === -1) return null;
    this.state.emailLogs[idx] = { ...this.state.emailLogs[idx], ...updates };
    const updated = this.state.emailLogs[idx];
    this.saveLocalBackup();
    this.safeSetDoc(doc(firestoreDb, 'email_logs', logId), updated).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `email_logs/${logId}`);
    });
    return updated;
  }

  public logAudit(userId: string, userName: string, action: string, entity: string, entityId: string, details: string): void {
    const newAudit: SystemAuditLog = {
      id: 'aud-' + Date.now(),
      userId,
      userName,
      action,
      entity,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(newAudit);
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'audit_logs', newAudit.id), newAudit).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `audit_logs/${newAudit.id}`);
    });
  }

  public getAuditLogs(): SystemAuditLog[] {
    return this.state.auditLogs;
  }

  public getSettings(): SystemSettings {
    return this.state.settings;
  }

  public updateSettings(newSettings: Partial<SystemSettings>): void {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.saveLocalBackup();

    this.safeSetDoc(doc(firestoreDb, 'system_settings', 'global_config'), this.state.settings).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, 'system_settings/global_config');
    });
  }
}

export const db = new DatabaseService();
