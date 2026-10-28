/**
 * University Database Service & Academic State Store
 * Implements full academic model: Departments, Batches, Sessions, Courses,
 * Course Offerings, Teacher Eligibility/Assignments, Student Enrollments,
 * Routines, Attendance Sessions, Attendance Records, Face Profiles, Audit Logs.
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
} from '../types';
import { DEFAULT_SYSTEM_SETTINGS } from './attendanceEngine';

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

// Initial University Seed Data
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
    { id: 'batch-2026', name: 'Batch 2026 (1st Year)', startYear: 2026, departmentId: 'dept-cse', currentYear: 1, currentSemester: 1 },
    { id: 'batch-2025', name: 'Batch 2025 (2nd Year)', startYear: 2025, departmentId: 'dept-cse', currentYear: 2, currentSemester: 1 },
    { id: 'batch-2024', name: 'Batch 2024 (3rd Year)', startYear: 2024, departmentId: 'dept-cse', currentYear: 3, currentSemester: 1 },
    { id: 'batch-2023', name: 'Batch 2023 (4th Year)', startYear: 2023, departmentId: 'dept-cse', currentYear: 4, currentSemester: 1 },
  ],
  courses: [
    // 1st Year 1st Semester
    { id: 'c-1101', code: 'CSE-1101', name: 'Structured Programming Language', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-1102', code: 'CSE-1102', name: 'Structured Programming Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-1103', code: 'MAT-1103', name: 'Differential and Integral Calculus', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },
    { id: 'c-1105', code: 'PHY-1105', name: 'Engineering Physics', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 1, semester: 1, status: 'ACTIVE' },

    // 2nd Year 1st Semester
    { id: 'c-2101', code: 'CSE-2101', name: 'Data Structures and Algorithms', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 2, semester: 1, status: 'ACTIVE' },
    { id: 'c-2102', code: 'CSE-2102', name: 'Data Structures Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-cse', year: 2, semester: 1, status: 'ACTIVE' },
    { id: 'c-2103', code: 'CSE-2103', name: 'Object Oriented Programming', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 2, semester: 1, status: 'ACTIVE' },

    // 3rd Year 1st Semester
    { id: 'c-3101', code: 'CSE-3101', name: 'Database Management Systems', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 3, semester: 1, status: 'ACTIVE' },
    { id: 'c-3102', code: 'CSE-3102', name: 'Database Systems Lab', credit: 1.5, type: 'LAB', departmentId: 'dept-cse', year: 3, semester: 1, status: 'ACTIVE' },
    { id: 'c-3103', code: 'CSE-3103', name: 'Operating Systems', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 3, semester: 1, status: 'ACTIVE' },

    // 4th Year 1st Semester
    { id: 'c-4101', code: 'CSE-4101', name: 'Machine Learning & Neural Networks', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 4, semester: 1, status: 'ACTIVE' },
    { id: 'c-4103', code: 'CSE-4103', name: 'Computer Networks and Security', credit: 3.0, type: 'THEORY', departmentId: 'dept-cse', year: 4, semester: 1, status: 'ACTIVE' },
  ],
  courseOfferings: [
    // 1st Year 1st Sem offerings
    { id: 'co-1101', courseId: 'c-1101', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 35, conductedClasses: 22, status: 'ACTIVE' },
    { id: 'co-1102', courseId: 'c-1102', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 14, conductedClasses: 9, status: 'ACTIVE' },
    { id: 'co-1103', courseId: 'c-1103', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 35, conductedClasses: 20, status: 'ACTIVE' },
    { id: 'co-1105', courseId: 'c-1105', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 1, semester: 1, batchId: 'batch-2026', section: 'A', plannedClasses: 35, conductedClasses: 21, status: 'ACTIVE' },

    // 2nd Year 1st Sem offerings
    { id: 'co-2101', courseId: 'c-2101', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 2, semester: 1, batchId: 'batch-2025', section: 'A', plannedClasses: 35, conductedClasses: 24, status: 'ACTIVE' },
    { id: 'co-2102', courseId: 'c-2102', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 2, semester: 1, batchId: 'batch-2025', section: 'A', plannedClasses: 14, conductedClasses: 10, status: 'ACTIVE' },

    // 3rd Year 1st Sem offerings
    { id: 'co-3101', courseId: 'c-3101', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 3, semester: 1, batchId: 'batch-2024', section: 'A', plannedClasses: 35, conductedClasses: 24, status: 'ACTIVE' },
    { id: 'co-3102', courseId: 'c-3102', departmentId: 'dept-cse', academicSessionId: 'sess-2025-2026', year: 3, semester: 1, batchId: 'batch-2024', section: 'A', plannedClasses: 14, conductedClasses: 10, status: 'ACTIVE' },
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
      name: 'Prof. Fahmida Rahman',
      email: 'fahmida.r@mbstu.ac.bd',
      departmentId: 'dept-cse',
      designation: 'Assistant Professor',
      phone: '+880 1733-445566',
      status: 'ACTIVE',
      authorizedCourseIds: ['c-1103', 'c-2103'],
    },
    {
      id: 'tch-04',
      teacherId: 'TCH-104',
      name: 'Tanvir Ahmed',
      email: 'tanvir.ahmed@mbstu.ac.bd',
      departmentId: 'dept-cse',
      designation: 'Lecturer',
      phone: '+880 1744-556677',
      status: 'ACTIVE',
      authorizedCourseIds: ['c-1105', 'c-1102', 'c-2102'],
    },
  ],
  teacherAssignments: [
    // Teacher 1 teaches 1 regular theory (CSE-1101) + relevant lab (CSE-1102) in Batch 2026 (Complies with Rule 10!)
    { id: 'ta-01', courseOfferingId: 'co-1101', teacherId: 'tch-01', role: 'PRIMARY', assignedAt: '2026-08-01' },
    { id: 'ta-02', courseOfferingId: 'co-1102', teacherId: 'tch-01', role: 'PRIMARY', assignedAt: '2026-08-01' },

    // Teacher 3 teaches MAT-1103 in Batch 2026
    { id: 'ta-03', courseOfferingId: 'co-1103', teacherId: 'tch-03', role: 'PRIMARY', assignedAt: '2026-08-01' },

    // Teacher 4 teaches PHY-1105 in Batch 2026
    { id: 'ta-04', courseOfferingId: 'co-1105', teacherId: 'tch-04', role: 'PRIMARY', assignedAt: '2026-08-01' },

    // Teacher 2 teaches CSE-3101 (Database) + CSE-3102 (Lab) in Batch 2024
    { id: 'ta-05', courseOfferingId: 'co-3101', teacherId: 'tch-02', role: 'PRIMARY', assignedAt: '2026-08-01' },
    { id: 'ta-06', courseOfferingId: 'co-3102', teacherId: 'tch-02', role: 'PRIMARY', assignedAt: '2026-08-01' },
  ],
  students: [
    {
      id: 'stu-01',
      studentId: 'IT-24026',
      name: 'Tanvir Islam',
      email: 'it24026@mbstu.ac.bd',
      departmentId: 'dept-cse',
      academicSessionId: 'sess-2025-2026',
      year: 1,
      semester: 1,
      batchId: 'batch-2026',
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
      studentId: 'CSE-26004',
      name: 'Nusrat Jahan Mim',
      email: 'mim.n@mbstu.ac.bd',
      departmentId: 'dept-cse',
      academicSessionId: 'sess-2025-2026',
      year: 1,
      semester: 1,
      batchId: 'batch-2026',
      section: 'A',
      status: 'ACTIVE',
      hasFaceProfile: true,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
    },
    {
      id: 'stu-05',
      studentId: 'CSE-26005',
      name: 'Rakibul Hasan',
      email: 'rakibul.h@mbstu.ac.bd',
      departmentId: 'dept-cse',
      academicSessionId: 'sess-2025-2026',
      year: 1,
      semester: 1,
      batchId: 'batch-2026',
      section: 'A',
      status: 'ACTIVE',
      hasFaceProfile: true,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    },
  ],
  studentEnrollments: [
    // Tanvir Islam (IT-24026) enrolled in 1st Year 1st Sem offerings
    { id: 'enr-01', studentId: 'stu-01', courseOfferingId: 'co-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-02', studentId: 'stu-01', courseOfferingId: 'co-1102', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-03', studentId: 'stu-01', courseOfferingId: 'co-1103', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-04', studentId: 'stu-01', courseOfferingId: 'co-1105', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Classmate Farhana
    { id: 'enr-05', studentId: 'stu-02', courseOfferingId: 'co-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-06', studentId: 'stu-02', courseOfferingId: 'co-1102', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-07', studentId: 'stu-02', courseOfferingId: 'co-1103', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-08', studentId: 'stu-02', courseOfferingId: 'co-1105', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Sabbir (at-risk student example)
    { id: 'enr-09', studentId: 'stu-03', courseOfferingId: 'co-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-10', studentId: 'stu-03', courseOfferingId: 'co-1103', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Nusrat Mim
    { id: 'enr-11', studentId: 'stu-04', courseOfferingId: 'co-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
    { id: 'enr-12', studentId: 'stu-04', courseOfferingId: 'co-1102', enrolledAt: '2026-08-05', status: 'ENROLLED' },

    // Rakibul Hasan
    { id: 'enr-13', studentId: 'stu-05', courseOfferingId: 'co-1101', enrolledAt: '2026-08-05', status: 'ENROLLED' },
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
    {
      studentId: 'stu-02',
      embedding: Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.38)),
      features: { eyeDistance: 62, jawWidth: 118, noseLength: 46, faceRatio: 1.31 },
      modelVersion: 'v2.1-mobilenet-ssd',
      status: 'REGISTERED',
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
    },
    {
      studentId: 'stu-04',
      embedding: Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.55)),
      features: { eyeDistance: 65, jawWidth: 120, noseLength: 47, faceRatio: 1.33 },
      modelVersion: 'v2.1-mobilenet-ssd',
      status: 'REGISTERED',
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
    },
    {
      studentId: 'stu-05',
      embedding: Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.62)),
      features: { eyeDistance: 66, jawWidth: 124, noseLength: 49, faceRatio: 1.35 },
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
      dayOfWeek: 'Monday',
      startTime: '11:00 AM',
      endTime: '01:00 PM',
      room: 'Software Lab 1',
      building: 'Engineering Complex Bldg 1',
    },
    {
      id: 'rt-03',
      courseOfferingId: 'co-1103',
      teacherId: 'tch-03',
      dayOfWeek: 'Tuesday',
      startTime: '09:00 AM',
      endTime: '10:00 AM',
      room: 'Room 302',
      building: 'Academic Complex 2',
    },
    {
      id: 'rt-04',
      courseOfferingId: 'co-1105',
      teacherId: 'tch-04',
      dayOfWeek: 'Wednesday',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      room: 'Physics Lab / Room 201',
      building: 'Science Bldg',
    },
    {
      id: 'rt-05',
      courseOfferingId: 'co-3101',
      teacherId: 'tch-02',
      dayOfWeek: 'Sunday',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      room: 'Room 401',
      building: 'Engineering Complex Bldg 1',
    },
  ],
  attendanceSessions: [
    // Live active QR session for CSE-1101 today
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
      currentToken: 'UNI-QR-SESSION-ACTIVE-1101-' + Math.floor(Math.random() * 90000 + 10000),
      tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      allowSelfCheckIn: true,
      notes: 'Midterm review and Chapter 5 attendance',
      createdAt: new Date().toISOString(),
    },
    // Past closed session 1
    {
      id: 'sess-closed-01',
      courseOfferingId: 'co-1101',
      teacherId: 'tch-01',
      routineEntryId: 'rt-01',
      date: '2026-10-26',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      attendanceMethod: 'QR',
      status: 'CLOSED',
      currentToken: 'TOKEN-CLOSED-01',
      tokenExpiresAt: '2026-10-26T11:00:00Z',
      allowSelfCheckIn: false,
      createdAt: '2026-10-26T10:00:00Z',
      closedAt: '2026-10-26T11:05:00Z',
    },
    // Past closed session 2 (Face Recognition mode)
    {
      id: 'sess-closed-02',
      courseOfferingId: 'co-1101',
      teacherId: 'tch-01',
      routineEntryId: 'rt-01',
      date: '2026-10-24',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      attendanceMethod: 'FACE',
      status: 'CLOSED',
      currentToken: 'TOKEN-CLOSED-02',
      tokenExpiresAt: '2026-10-24T11:00:00Z',
      allowSelfCheckIn: false,
      createdAt: '2026-10-24T10:00:00Z',
      closedAt: '2026-10-24T11:05:00Z',
    },
  ],
  attendanceRecords: [
    // Tanvir Islam (IT-24026): 20 presents, 1 late, 1 absent in co-1101 -> high attendance ~91%
    { id: 'rec-01', sessionId: 'sess-closed-01', courseOfferingId: 'co-1101', studentId: 'stu-01', timestamp: '2026-10-26T10:05:00Z', method: 'QR', status: 'PRESENT', minutesLate: 5 },
    { id: 'rec-02', sessionId: 'sess-closed-02', courseOfferingId: 'co-1101', studentId: 'stu-01', timestamp: '2026-10-24T10:08:00Z', method: 'FACE', status: 'PRESENT', minutesLate: 8 },

    // Farhana:
    { id: 'rec-03', sessionId: 'sess-closed-01', courseOfferingId: 'co-1101', studentId: 'stu-02', timestamp: '2026-10-26T10:07:00Z', method: 'QR', status: 'PRESENT', minutesLate: 7 },
    { id: 'rec-04', sessionId: 'sess-closed-02', courseOfferingId: 'co-1101', studentId: 'stu-02', timestamp: '2026-10-24T10:04:00Z', method: 'FACE', status: 'PRESENT', minutesLate: 4 },

    // Sabbir (stu-03): Has 3 consecutive LATE records to show the 3-Late = 1 Penalty rule!
    { id: 'rec-05', sessionId: 'sess-closed-01', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-26T10:25:00Z', method: 'QR', status: 'LATE', minutesLate: 25 },
    { id: 'rec-06', sessionId: 'sess-closed-02', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-24T10:22:00Z', method: 'FACE', status: 'LATE', minutesLate: 22 },
    { id: 'rec-07', sessionId: 'sess-closed-03', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-21T10:28:00Z', method: 'QR', status: 'LATE', minutesLate: 28 },
    // Sabbir absents
    { id: 'rec-08', sessionId: 'sess-closed-04', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-19T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-09', sessionId: 'sess-closed-05', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-17T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-10', sessionId: 'sess-closed-06', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-14T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-11', sessionId: 'sess-closed-07', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-12T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-12', sessionId: 'sess-closed-08', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-10T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-13', sessionId: 'sess-closed-09', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-07T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-14', sessionId: 'sess-closed-10', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-05T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-15', sessionId: 'sess-closed-11', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-10-03T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-16', sessionId: 'sess-closed-12', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-30T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-17', sessionId: 'sess-closed-13', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-28T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-18', sessionId: 'sess-closed-14', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-25T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-19', sessionId: 'sess-closed-15', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-23T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-20', sessionId: 'sess-closed-16', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-21T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-21', sessionId: 'sess-closed-17', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-18T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-22', sessionId: 'sess-closed-18', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-16T10:00:00Z', method: 'QR', status: 'ABSENT', minutesLate: 60 },
    { id: 'rec-23', sessionId: 'sess-closed-19', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-14T10:00:00Z', method: 'QR', status: 'PRESENT', minutesLate: 2 },
    { id: 'rec-24', sessionId: 'sess-closed-20', courseOfferingId: 'co-1101', studentId: 'stu-03', timestamp: '2026-09-11T10:00:00Z', method: 'QR', status: 'PRESENT', minutesLate: 4 },
  ],
  attendanceCorrections: [
    {
      id: 'corr-01',
      attendanceId: 'rec-02',
      studentId: 'stu-01',
      studentName: 'Tanvir Islam',
      courseOfferingId: 'co-1101',
      courseCode: 'CSE-1101',
      originalStatus: 'ABSENT',
      newStatus: 'PRESENT',
      changedBy: 'Admin Office (Superintendent)',
      reason: 'Biometric webcam driver stutter during initial face verification batch; manually approved after student presented valid campus pass.',
      timestamp: '2026-10-24T12:30:00Z',
    },
  ],
  faceLogs: [
    {
      id: 'fl-01',
      studentId: 'stu-01',
      sessionId: 'sess-closed-02',
      courseOfferingId: 'co-1101',
      similarityScore: 0.88,
      matched: true,
      timestamp: '2026-10-24T10:08:15Z',
    },
    {
      id: 'fl-02',
      studentId: 'stu-02',
      sessionId: 'sess-closed-02',
      courseOfferingId: 'co-1101',
      similarityScore: 0.92,
      matched: true,
      timestamp: '2026-10-24T10:04:30Z',
    },
    {
      id: 'fl-03',
      studentId: 'stu-03',
      sessionId: 'sess-closed-02',
      courseOfferingId: 'co-1101',
      similarityScore: 0.41,
      matched: false,
      reason: 'Face profile not registered or low lighting geometry mismatch',
      timestamp: '2026-10-24T10:21:40Z',
    },
  ],
  qrLogs: [
    {
      id: 'ql-01',
      studentId: 'stu-01',
      sessionId: 'sess-closed-01',
      courseOfferingId: 'co-1101',
      validToken: true,
      timestamp: '2026-10-26T10:05:12Z',
    },
    {
      id: 'ql-02',
      studentId: 'stu-02',
      sessionId: 'sess-closed-01',
      courseOfferingId: 'co-1101',
      validToken: true,
      timestamp: '2026-10-26T10:07:05Z',
    },
  ],
  emailLogs: [
    {
      id: 'em-01',
      recipientEmail: 'ahsan.habib@mbstu.ac.bd',
      recipientName: 'Dr. Ahsan Habib',
      recipientRole: 'TEACHER',
      type: 'CLASS_REMINDER',
      courseOfferingId: 'co-1101',
      subject: 'Class Reminder: CSE-1101 Structured Programming Language at 10:00 AM',
      body: 'Dear Dr. Ahsan Habib,\nYour Structured Programming Language (CSE-1101) class is scheduled at 10:00 AM today in Room 304. You can now launch the attendance session in UniAttend.',
      dedupKey: 'REMINDER-tch-01-co-1101-2026-10-28',
      sentAt: '2026-10-28T09:45:00Z',
      status: 'SENT',
    },
    {
      id: 'em-02',
      recipientEmail: 'sabbir.h@mbstu.ac.bd',
      recipientName: 'Sabbir Hossain',
      recipientRole: 'STUDENT',
      type: 'ATTENDANCE_WARNING',
      courseOfferingId: 'co-1101',
      subject: 'URGENT: Critical Attendance Risk in CSE-1101 (Below 60% Exam Eligibility)',
      body: 'Dear Sabbir Hossain (CSE-26003),\nYour current attendance in CSE-1101 is 18.18%, which is far below the mandatory 60.0% university exam threshold. Conducted: 22, Effective Presents: 4, Remaining: 13. Even with 100% future attendance, your maximum possible attendance is 48.57% (NOT RECOVERABLE). Please meet your academic advisor immediately.',
      dedupKey: 'RISK_WARN-stu-03-co-1101-CRITICAL',
      sentAt: '2026-10-26T18:00:00Z',
      status: 'SENT',
    },
  ],
  auditLogs: [
    {
      id: 'aud-01',
      userId: 'usr-admin-1',
      userName: 'Academic Registrar',
      action: 'SYSTEM_INITIALIZED',
      entity: 'SYSTEM',
      entityId: 'ROOT',
      details: 'Academic sessions 2025-2026 provisioned with 4 simultaneous cohorts (Batches 2023-2026).',
      timestamp: '2026-08-01T08:00:00Z',
    },
    {
      id: 'aud-02',
      userId: 'usr-admin-1',
      userName: 'Academic Registrar',
      action: 'TEACHER_ASSIGNMENT',
      entity: 'TeacherAssignment',
      entityId: 'ta-01',
      details: 'Assigned Dr. Ahsan Habib to CSE-1101 (Theory) and CSE-1102 (Lab). Verified 1-regular-course rule.',
      timestamp: '2026-08-01T09:15:00Z',
    },
    {
      id: 'aud-03',
      userId: 'usr-admin-1',
      userName: 'Admin Office',
      action: 'ATTENDANCE_MANUAL_CORRECTION',
      entity: 'AttendanceRecord',
      entityId: 'rec-02',
      details: 'Corrected attendance status of Tanvir Islam (IT-24026) in CSE-1101 from ABSENT to PRESENT. Reason: Biometric webcam stutter.',
      timestamp: '2026-10-24T12:30:00Z',
    },
  ],
  settings: DEFAULT_SYSTEM_SETTINGS,
};

class DatabaseService {
  private state: SystemDatabaseState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): SystemDatabaseState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_STATE,
          ...parsed,
          settings: { ...DEFAULT_SYSTEM_SETTINGS, ...(parsed.settings || {}) },
        };
      }
    } catch {
      // LocalStorage not available or parse error
    }
    return INITIAL_STATE;
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  public getState(): SystemDatabaseState {
    return this.state;
  }

  public resetToDefaultSeed(): void {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveState();
  }

  // ==================== DEPARTMENTS ====================
  public getDepartments(): Department[] {
    return this.state.departments;
  }

  public addDepartment(dept: Omit<Department, 'id'>): Department {
    const newDept: Department = {
      ...dept,
      id: 'dept-' + dept.code.toLowerCase().replace(/\s+/g, '-'),
    };
    this.state.departments.push(newDept);
    this.logAudit('ADMIN', 'Admin', 'CREATE_DEPARTMENT', 'Department', newDept.id, `Created department ${newDept.name} (${newDept.code})`);
    this.saveState();
    return newDept;
  }

  // ==================== ACADEMIC SESSIONS & BATCHES ====================
  public getAcademicSessions(): AcademicSession[] {
    return this.state.academicSessions;
  }

  public getBatches(): Batch[] {
    return this.state.batches;
  }

  public addBatch(batch: Omit<Batch, 'id'>): Batch {
    const newBatch: Batch = {
      ...batch,
      id: 'batch-' + Date.now(),
    };
    this.state.batches.push(newBatch);
    this.logAudit('ADMIN', 'Admin', 'CREATE_BATCH', 'Batch', newBatch.id, `Created batch ${newBatch.name}`);
    this.saveState();
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
    this.logAudit('ADMIN', 'Admin', 'CREATE_COURSE', 'Course', newCourse.id, `Created course ${newCourse.code} - ${newCourse.name}`);
    this.saveState();
    return newCourse;
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
    this.logAudit('ADMIN', 'Admin', 'CREATE_COURSE_OFFERING', 'CourseOffering', newOffering.id, `Created course offering for course ${newOffering.courseId} in batch ${newOffering.batchId}`);
    this.saveState();
    return newOffering;
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
    this.logAudit('ADMIN', 'Admin', 'CREATE_TEACHER', 'Teacher', newTeacher.id, `Created teacher ${newTeacher.name} (${newTeacher.teacherId})`);
    this.saveState();
    return newTeacher;
  }

  public updateTeacherEligibility(teacherId: string, authorizedCourseIds: string[]): void {
    const teacher = this.state.teachers.find(t => t.id === teacherId);
    if (teacher) {
      teacher.authorizedCourseIds = authorizedCourseIds;
      this.logAudit('ADMIN', 'Admin', 'UPDATE_TEACHER_ELIGIBILITY', 'Teacher', teacherId, `Updated authorized courses for ${teacher.name}`);
      this.saveState();
    }
  }

  public getTeacherAssignments(): TeacherAssignment[] {
    return this.state.teacherAssignments;
  }

  /**
   * IMPORTANT RULE (Prompt Section 10):
   * A teacher can teach MAXIMUM ONE regular/theory course in a specific semester + batch.
   * However, if a laboratory course exists, the teacher may additionally be assigned the relevant lab!
   * System enforces this automatically.
   */
  public canAssignTeacherToOffering(teacherId: string, courseOfferingId: string): { allowed: boolean; reason?: string } {
    const teacher = this.state.teachers.find(t => t.id === teacherId);
    if (!teacher) return { allowed: false, reason: 'Teacher not found' };

    const targetOffering = this.state.courseOfferings.find(co => co.id === courseOfferingId);
    if (!targetOffering) return { allowed: false, reason: 'Course offering not found' };

    const targetCourse = this.state.courses.find(c => c.id === targetOffering.courseId);
    if (!targetCourse) return { allowed: false, reason: 'Course not found' };

    // Check authorization
    if (!teacher.authorizedCourseIds.includes(targetCourse.id)) {
      return { allowed: false, reason: `Teacher is not authorized/eligible to teach ${targetCourse.code} (${targetCourse.name}). Add authorization first.` };
    }

    // Check 1 regular/theory course rule per semester + batch
    if (targetCourse.type === 'THEORY') {
      const existingAssignments = this.state.teacherAssignments.filter(ta => ta.teacherId === teacherId);
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
    const check = this.canAssignTeacherToOffering(teacherId, courseOfferingId);
    if (!check.allowed) {
      return { success: false, message: check.reason || 'Assignment not allowed' };
    }

    // Check if duplicate assignment
    const exists = this.state.teacherAssignments.find(ta => ta.teacherId === teacherId && ta.courseOfferingId === courseOfferingId);
    if (exists) {
      return { success: false, message: 'Teacher is already assigned to this course offering' };
    }

    const newAssignment: TeacherAssignment = {
      id: 'ta-' + Date.now(),
      teacherId,
      courseOfferingId,
      role,
      assignedAt: new Date().toISOString(),
    };
    this.state.teacherAssignments.push(newAssignment);
    this.logAudit('ADMIN', 'Admin', 'ASSIGN_TEACHER', 'TeacherAssignment', newAssignment.id, `Assigned teacher ${teacherId} to offering ${courseOfferingId}`);
    this.saveState();
    return { success: true, message: 'Teacher successfully assigned to course offering!' };
  }

  public removeTeacherAssignment(assignmentId: string): void {
    this.state.teacherAssignments = this.state.teacherAssignments.filter(ta => ta.id !== assignmentId);
    this.logAudit('ADMIN', 'Admin', 'REMOVE_TEACHER_ASSIGNMENT', 'TeacherAssignment', assignmentId, 'Removed teacher assignment');
    this.saveState();
  }

  // ==================== STUDENTS & ENROLLMENT ====================
  public getStudents(): Student[] {
    return this.state.students;
  }

  public addStudent(student: Omit<Student, 'id' | 'hasFaceProfile'>): Student {
    const newStudent: Student = {
      ...student,
      id: 'stu-' + Date.now(),
      hasFaceProfile: false,
    };
    this.state.students.push(newStudent);
    this.logAudit('ADMIN', 'Admin', 'CREATE_STUDENT', 'Student', newStudent.id, `Created student ${newStudent.name} (${newStudent.studentId})`);
    this.saveState();
    return newStudent;
  }

  public getStudentEnrollments(): StudentEnrollment[] {
    return this.state.studentEnrollments;
  }

  public enrollStudent(studentId: string, courseOfferingId: string): { success: boolean; message: string } {
    const student = this.state.students.find(s => s.id === studentId);
    const offering = this.state.courseOfferings.find(co => co.id === courseOfferingId);
    if (!student || !offering) return { success: false, message: 'Invalid student or course offering' };

    // Prevent invalid enrollment outside student's current academic structure
    if (student.batchId !== offering.batchId || student.year !== offering.year || student.semester !== offering.semester) {
      return {
        success: false,
        message: `Academic Structure Mismatch: Student is in Year ${student.year} Sem ${student.semester} (${student.batchId}), but course offering belongs to Year ${offering.year} Sem ${offering.semester} (${offering.batchId}).`,
      };
    }

    const existing = this.state.studentEnrollments.find(e => e.studentId === studentId && e.courseOfferingId === courseOfferingId);
    if (existing) {
      return { success: false, message: 'Student is already enrolled in this course offering' };
    }

    const enrollment: StudentEnrollment = {
      id: 'enr-' + Date.now(),
      studentId,
      courseOfferingId,
      enrolledAt: new Date().toISOString(),
      status: 'ENROLLED',
    };
    this.state.studentEnrollments.push(enrollment);
    this.logAudit('ADMIN', 'Admin', 'ENROLL_STUDENT', 'StudentEnrollment', enrollment.id, `Enrolled student ${student.name} in course offering ${offering.id}`);
    this.saveState();
    return { success: true, message: 'Student enrolled successfully' };
  }

  public unenrollStudent(enrollmentId: string): void {
    this.state.studentEnrollments = this.state.studentEnrollments.filter(e => e.id !== enrollmentId);
    this.logAudit('ADMIN', 'Admin', 'UNENROLL_STUDENT', 'StudentEnrollment', enrollmentId, 'Student dropped/unenrolled');
    this.saveState();
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
    this.logAudit('SYSTEM', 'System/Admin', 'SAVE_FACE_PROFILE', 'FaceProfile', profile.studentId, `Saved face profile for student ${profile.studentId}`);
    this.saveState();
  }

  public setFaceProfileStatus(studentId: string, status: 'REGISTERED' | 'DISABLED'): void {
    const profile = this.getFaceProfile(studentId);
    if (profile) {
      profile.status = status;
      profile.updatedAt = new Date().toISOString();
      const student = this.state.students.find(s => s.id === studentId);
      if (student) student.hasFaceProfile = status === 'REGISTERED';
      this.saveState();
    }
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
    this.logAudit('ADMIN', 'Admin', 'CREATE_ROUTINE', 'RoutineEntry', newRoutine.id, `Created timetable routine on ${newRoutine.dayOfWeek} at ${newRoutine.startTime}`);
    this.saveState();
    return newRoutine;
  }

  public deleteRoutine(routineId: string): void {
    this.state.routines = this.state.routines.filter(r => r.id !== routineId);
    this.saveState();
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
    const expires = new Date(now.getTime() + 20 * 60 * 1000); // 20 minutes active window

    const session: AttendanceSession = {
      id: 'sess-' + Date.now(),
      courseOfferingId: params.courseOfferingId,
      teacherId: params.teacherId,
      routineEntryId: params.routineEntryId,
      date: now.toISOString().split('T')[0],
      startTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(now.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attendanceMethod: params.attendanceMethod,
      status: 'ACTIVE',
      currentToken: sessionToken,
      tokenExpiresAt: expires.toISOString(),
      allowSelfCheckIn: true,
      notes: params.notes,
      createdAt: now.toISOString(),
    };

    this.state.attendanceSessions.unshift(session);
    this.logAudit('TEACHER', params.teacherId, 'START_ATTENDANCE_SESSION', 'AttendanceSession', session.id, `Started ${session.attendanceMethod} session for offering ${session.courseOfferingId}`);
    this.saveState();
    return session;
  }

  /**
   * Refreshes the dynamic session token to prevent unauthorized screenshot sharing
   */
  public refreshSessionToken(sessionId: string): string {
    const session = this.state.attendanceSessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'ACTIVE') return '';
    session.currentToken = 'UNI-QR-' + Date.now() + '-' + Math.floor(Math.random() * 90000 + 10000);
    session.tokenExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minute rolling token
    this.saveState();
    return session.currentToken;
  }

  /**
   * Closes an attendance session.
   * IMPORTANT RULE (Prompt Section 18):
   * A student is considered absent when the attendance session/class is finalized and the student has no valid attendance record!
   */
  public closeAttendanceSession(sessionId: string): void {
    const session = this.state.attendanceSessions.find(s => s.id === sessionId);
    if (!session || session.status === 'CLOSED') return;

    session.status = 'CLOSED';
    session.closedAt = new Date().toISOString();

    // Find all enrolled students for this course offering
    const enrollments = this.state.studentEnrollments.filter(e => e.courseOfferingId === session.courseOfferingId && e.status === 'ENROLLED');
    const existingRecords = this.state.attendanceRecords.filter(r => r.sessionId === sessionId);
    const recordedStudentIds = new Set(existingRecords.map(r => r.studentId));

    // Mark remaining enrolled students as ABSENT
    for (const enr of enrollments) {
      if (!recordedStudentIds.has(enr.studentId)) {
        this.state.attendanceRecords.push({
          id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
          sessionId: session.id,
          courseOfferingId: session.courseOfferingId,
          studentId: enr.studentId,
          timestamp: new Date().toISOString(),
          method: session.attendanceMethod,
          status: 'ABSENT',
          minutesLate: 60,
          notes: 'Finalized absent upon session close',
        });
      }
    }

    // Increment conducted classes count for this course offering
    const offering = this.state.courseOfferings.find(co => co.id === session.courseOfferingId);
    if (offering) {
      offering.conductedClasses = (offering.conductedClasses || 0) + 1;
    }

    this.logAudit('TEACHER', session.teacherId, 'CLOSE_ATTENDANCE_SESSION', 'AttendanceSession', session.id, `Closed attendance session. Finalized absents for non-attendees.`);
    this.saveState();
  }

  // ==================== ATTENDANCE RECORDS & VERIFICATION ====================
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

    // Verify enrollment
    const isEnrolled = this.state.studentEnrollments.some(
      e => e.courseOfferingId === session.courseOfferingId && e.studentId === params.studentId && e.status === 'ENROLLED'
    );
    if (!isEnrolled) {
      return { success: false, message: 'Student is not enrolled in this course offering' };
    }

    // Prevent duplicate attendance for the same session
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

    // Calculate status based on late threshold
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
      notes: params.notes,
    };

    this.state.attendanceRecords.push(record);
    this.saveState();

    return {
      success: true,
      message: status === 'PRESENT' ? 'Attendance marked PRESENT!' : `Attendance marked LATE (${params.minutesLate} min after start)`,
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
    this.logAudit(
      'ADMIN',
      params.changedBy,
      'ATTENDANCE_CORRECTION',
      'AttendanceRecord',
      record.id,
      `Changed student ${student?.name} (${record.studentId}) attendance in ${course?.code} from ${originalStatus} to ${params.newStatus}. Reason: ${params.reason}`
    );

    this.saveState();
    return { success: true, message: 'Attendance successfully updated and recorded in audit log' };
  }

  public getAttendanceCorrections(): AttendanceCorrectionAudit[] {
    return this.state.attendanceCorrections;
  }

  // ==================== LOGS & SETTINGS ====================
  public addFaceLog(log: Omit<FaceVerificationLog, 'id' | 'timestamp'>): void {
    this.state.faceLogs.unshift({
      ...log,
      id: 'fl-' + Date.now(),
      timestamp: new Date().toISOString(),
    });
    this.saveState();
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
    this.saveState();
  }

  public getQRLogs(): QRVerificationLog[] {
    return this.state.qrLogs;
  }

  public addEmailLog(log: Omit<EmailLog, 'id' | 'sentAt'>): boolean {
    // Check deduplication key to avoid repeat spam
    const existing = this.state.emailLogs.find(e => e.dedupKey === log.dedupKey);
    if (existing) {
      return false; // Deduplicated
    }
    this.state.emailLogs.unshift({
      ...log,
      id: 'em-' + Date.now(),
      sentAt: new Date().toISOString(),
    });
    this.saveState();
    return true;
  }

  public getEmailLogs(): EmailLog[] {
    return this.state.emailLogs;
  }

  public logAudit(userId: string, userName: string, action: string, entity: string, entityId: string, details: string): void {
    this.state.auditLogs.unshift({
      id: 'aud-' + Date.now(),
      userId,
      userName,
      action,
      entity,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    });
    // Keep last 500 audit logs
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
  }

  public getAuditLogs(): SystemAuditLog[] {
    return this.state.auditLogs;
  }

  public getSettings(): SystemSettings {
    return this.state.settings;
  }

  public updateSettings(newSettings: Partial<SystemSettings>): void {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.logAudit('ADMIN', 'Admin', 'UPDATE_SETTINGS', 'SystemSettings', 'CONFIG', JSON.stringify(newSettings));
    this.saveState();
  }
}

export const db = new DatabaseService();
