-- ==============================================================================
-- UniAttend: University Attendance Management & Analytics Platform
-- MySQL Production Schema DDL (InnoDB / UTF8MB4)
-- Tested for MySQL 8.0+ and MariaDB 10.5+
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `uniattend_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `uniattend_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Departments
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `building` VARCHAR(150) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dept_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Academic Sessions
DROP TABLE IF EXISTS `academic_sessions`;
CREATE TABLE `academic_sessions` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `is_current` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Batches (4-Year Cohorts)
DROP TABLE IF EXISTS `batches`;
CREATE TABLE `batches` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `start_year` INT NOT NULL,
  `department_id` VARCHAR(36) NOT NULL,
  `current_year` INT NOT NULL COMMENT '1, 2, 3, or 4',
  `current_semester` INT NOT NULL COMMENT '1 or 2',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_dept` (`department_id`),
  CONSTRAINT `fk_batch_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Courses
DROP TABLE IF EXISTS `courses`;
CREATE TABLE `courses` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `credit` DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  `type` ENUM('THEORY', 'LAB') NOT NULL DEFAULT 'THEORY',
  `department_id` VARCHAR(36) NOT NULL,
  `year` INT NOT NULL,
  `semester` INT NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_course_code` (`code`),
  KEY `idx_course_dept` (`department_id`),
  CONSTRAINT `fk_course_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Course Offerings (Actual course running for specific session + batch)
DROP TABLE IF EXISTS `course_offerings`;
CREATE TABLE `course_offerings` (
  `id` VARCHAR(36) NOT NULL,
  `course_id` VARCHAR(36) NOT NULL,
  `department_id` VARCHAR(36) NOT NULL,
  `academic_session_id` VARCHAR(36) NOT NULL,
  `year` INT NOT NULL,
  `semester` INT NOT NULL,
  `batch_id` VARCHAR(36) NOT NULL,
  `section` VARCHAR(10) NOT NULL DEFAULT 'A',
  `planned_classes` INT NOT NULL DEFAULT 35,
  `conducted_classes` INT NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_offering_course` (`course_id`),
  KEY `idx_offering_batch` (`batch_id`),
  KEY `idx_offering_session` (`academic_session_id`),
  CONSTRAINT `fk_offering_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_offering_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_offering_session` FOREIGN KEY (`academic_session_id`) REFERENCES `academic_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Teachers
DROP TABLE IF EXISTS `teachers`;
CREATE TABLE `teachers` (
  `id` VARCHAR(36) NOT NULL,
  `teacher_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `department_id` VARCHAR(36) NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `status` ENUM('ACTIVE', 'ON_LEAVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `authorized_courses_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_teacher_id` (`teacher_id`),
  UNIQUE KEY `uk_teacher_email` (`email`),
  KEY `idx_teacher_dept` (`department_id`),
  CONSTRAINT `fk_teacher_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Teacher Assignments (Enforces Max 1 regular theory course per semester+batch)
DROP TABLE IF EXISTS `teacher_assignments`;
CREATE TABLE `teacher_assignments` (
  `id` VARCHAR(36) NOT NULL,
  `course_offering_id` VARCHAR(36) NOT NULL,
  `teacher_id` VARCHAR(36) NOT NULL,
  `role` ENUM('PRIMARY', 'CO_TEACHER') NOT NULL DEFAULT 'PRIMARY',
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assign_offering` (`course_offering_id`),
  KEY `idx_assign_teacher` (`teacher_id`),
  CONSTRAINT `fk_assign_offering` FOREIGN KEY (`course_offering_id`) REFERENCES `course_offerings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assign_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Students
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `department_id` VARCHAR(36) NOT NULL,
  `academic_session_id` VARCHAR(36) NOT NULL,
  `year` INT NOT NULL,
  `semester` INT NOT NULL,
  `batch_id` VARCHAR(36) NOT NULL,
  `section` VARCHAR(10) NOT NULL DEFAULT 'A',
  `avatar_url` TEXT NULL,
  `status` ENUM('ACTIVE', 'DROPOUT', 'GRADUATED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_id` (`student_id`),
  UNIQUE KEY `uk_student_email` (`email`),
  KEY `idx_student_batch` (`batch_id`),
  CONSTRAINT `fk_student_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Student Enrollments
DROP TABLE IF EXISTS `student_enrollments`;
CREATE TABLE `student_enrollments` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `course_offering_id` VARCHAR(36) NOT NULL,
  `status` ENUM('ENROLLED', 'DROPPED') NOT NULL DEFAULT 'ENROLLED',
  `enrolled_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_offering` (`student_id`, `course_offering_id`),
  KEY `idx_enroll_offering` (`course_offering_id`),
  CONSTRAINT `fk_enroll_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enroll_offering` FOREIGN KEY (`course_offering_id`) REFERENCES `course_offerings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Biometric Face Profiles
DROP TABLE IF EXISTS `face_profiles`;
CREATE TABLE `face_profiles` (
  `id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `embedding_json` LONGTEXT NOT NULL COMMENT '128D geometric face vector',
  `features_json` TEXT NULL,
  `sample_photo_url` TEXT NULL,
  `model_version` VARCHAR(50) NOT NULL DEFAULT 'v2.1-mobilenet-ssd',
  `status` ENUM('REGISTERED', 'DISABLED') NOT NULL DEFAULT 'REGISTERED',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_face_student` (`student_id`),
  CONSTRAINT `fk_face_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Routine Timetable
DROP TABLE IF EXISTS `routines`;
CREATE TABLE `routines` (
  `id` VARCHAR(36) NOT NULL,
  `course_offering_id` VARCHAR(36) NOT NULL,
  `teacher_id` VARCHAR(36) NOT NULL,
  `day_of_week` ENUM('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
  `start_time` VARCHAR(20) NOT NULL,
  `end_time` VARCHAR(20) NOT NULL,
  `room` VARCHAR(50) NOT NULL,
  `building` VARCHAR(150) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_routine_offering` (`course_offering_id`),
  KEY `idx_routine_teacher` (`teacher_id`),
  CONSTRAINT `fk_routine_offering` FOREIGN KEY (`course_offering_id`) REFERENCES `course_offerings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_routine_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Attendance Sessions
DROP TABLE IF EXISTS `attendance_sessions`;
CREATE TABLE `attendance_sessions` (
  `id` VARCHAR(36) NOT NULL,
  `course_offering_id` VARCHAR(36) NOT NULL,
  `teacher_id` VARCHAR(36) NOT NULL,
  `routine_id` VARCHAR(36) NULL,
  `date` DATE NOT NULL,
  `start_time` VARCHAR(20) NOT NULL,
  `end_time` VARCHAR(20) NOT NULL,
  `attendance_method` ENUM('QR', 'FACE') NOT NULL DEFAULT 'QR',
  `status` ENUM('SCHEDULED', 'ACTIVE', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  `current_token` VARCHAR(120) NOT NULL,
  `token_expires_at` DATETIME NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_offering` (`course_offering_id`),
  KEY `idx_session_status` (`status`),
  CONSTRAINT `fk_session_offering` FOREIGN KEY (`course_offering_id`) REFERENCES `course_offerings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Attendance Records
DROP TABLE IF EXISTS `attendance_records`;
CREATE TABLE `attendance_records` (
  `id` VARCHAR(36) NOT NULL,
  `session_id` VARCHAR(36) NOT NULL,
  `course_offering_id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `method` ENUM('QR', 'FACE', 'MANUAL_ADMIN') NOT NULL,
  `status` ENUM('PRESENT', 'LATE', 'ABSENT') NOT NULL,
  `minutes_late` INT NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_student` (`session_id`, `student_id`),
  KEY `idx_att_offering_student` (`course_offering_id`, `student_id`),
  CONSTRAINT `fk_att_session` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_att_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Attendance Manual Correction Audit
DROP TABLE IF EXISTS `attendance_corrections`;
CREATE TABLE `attendance_corrections` (
  `id` VARCHAR(36) NOT NULL,
  `attendance_id` VARCHAR(36) NOT NULL,
  `student_id` VARCHAR(36) NOT NULL,
  `student_name` VARCHAR(150) NOT NULL,
  `course_offering_id` VARCHAR(36) NOT NULL,
  `course_code` VARCHAR(50) NOT NULL,
  `original_status` ENUM('PRESENT', 'LATE', 'ABSENT') NOT NULL,
  `new_status` ENUM('PRESENT', 'LATE', 'ABSENT') NOT NULL,
  `changed_by` VARCHAR(150) NOT NULL,
  `reason` TEXT NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_corr_attendance` (`attendance_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Email Logs (Deduplicated)
DROP TABLE IF EXISTS `email_logs`;
CREATE TABLE `email_logs` (
  `id` VARCHAR(36) NOT NULL,
  `recipient_email` VARCHAR(150) NOT NULL,
  `recipient_name` VARCHAR(150) NOT NULL,
  `recipient_role` ENUM('TEACHER', 'STUDENT', 'ADMIN') NOT NULL,
  `type` ENUM('CLASS_REMINDER', 'ATTENDANCE_WARNING', 'SYSTEM_ALERT') NOT NULL,
  `course_offering_id` VARCHAR(36) NULL,
  `subject` VARCHAR(255) NOT NULL,
  `body` LONGTEXT NOT NULL,
  `dedup_key` VARCHAR(180) NOT NULL,
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('SENT', 'FAILED') NOT NULL DEFAULT 'SENT',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email_dedup` (`dedup_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Audit Logs
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `user_name` VARCHAR(150) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(100) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `details` TEXT NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- INITIAL UNIVERSITY SEED DATA
-- ==============================================================================

INSERT INTO `departments` (`id`, `code`, `name`, `building`) VALUES
('dept-cse', 'CSE', 'Computer Science and Engineering', 'Engineering Complex Bldg 1'),
('dept-ict', 'ICT', 'Information and Communication Technology', 'Academic Bldg 2'),
('dept-eee', 'EEE', 'Electrical and Electronic Engineering', 'Engineering Complex Bldg 3');

INSERT INTO `academic_sessions` (`id`, `name`, `is_current`) VALUES
('sess-2025-2026', '2025-2026', 1),
('sess-2024-2025', '2024-2025', 0);

INSERT INTO `batches` (`id`, `name`, `start_year`, `department_id`, `current_year`, `current_semester`) VALUES
('batch-2026', 'Batch 2026 (1st Year)', 2026, 'dept-cse', 1, 1),
('batch-2025', 'Batch 2025 (2nd Year)', 2025, 'dept-cse', 2, 1),
('batch-2024', 'Batch 2024 (3rd Year)', 2024, 'dept-cse', 3, 1),
('batch-2023', 'Batch 2023 (4th Year)', 2023, 'dept-cse', 4, 1);

INSERT INTO `courses` (`id`, `code`, `name`, `credit`, `type`, `department_id`, `year`, `semester`, `status`) VALUES
('c-1101', 'CSE-1101', 'Structured Programming Language', 3.0, 'THEORY', 'dept-cse', 1, 1, 'ACTIVE'),
('c-1102', 'CSE-1102', 'Structured Programming Lab', 1.5, 'LAB', 'dept-cse', 1, 1, 'ACTIVE'),
('c-1103', 'MAT-1103', 'Differential and Integral Calculus', 3.0, 'THEORY', 'dept-cse', 1, 1, 'ACTIVE'),
('c-1105', 'PHY-1105', 'Engineering Physics', 3.0, 'THEORY', 'dept-cse', 1, 1, 'ACTIVE'),
('c-2101', 'CSE-2101', 'Data Structures and Algorithms', 3.0, 'THEORY', 'dept-cse', 2, 1, 'ACTIVE'),
('c-2102', 'CSE-2102', 'Data Structures Lab', 1.5, 'LAB', 'dept-cse', 2, 1, 'ACTIVE'),
('c-3101', 'CSE-3101', 'Database Management Systems', 3.0, 'THEORY', 'dept-cse', 3, 1, 'ACTIVE');

INSERT INTO `teachers` (`id`, `teacher_id`, `name`, `email`, `department_id`, `designation`, `authorized_courses_json`) VALUES
('tch-01', 'TCH-101', 'Dr. Ahsan Habib', 'ahsan.habib@mbstu.ac.bd', 'dept-cse', 'Professor & Head', '["c-1101", "c-1102", "c-2101"]'),
('tch-02', 'TCH-102', 'Dr. Mahmudul Hasan', 'm.hasan@mbstu.ac.bd', 'dept-cse', 'Associate Professor', '["c-3101", "c-2101"]');

INSERT INTO `students` (`id`, `student_id`, `name`, `email`, `department_id`, `academic_session_id`, `year`, `semester`, `batch_id`, `section`, `avatar_url`) VALUES
('stu-01', 'IT-24026', 'Tanvir Islam', 'it24026@mbstu.ac.bd', 'dept-cse', 'sess-2025-2026', 1, 1, 'batch-2026', 'A', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'),
('stu-02', 'CSE-26002', 'Farhana Yasmin', 'farhana.y@mbstu.ac.bd', 'dept-cse', 'sess-2025-2026', 1, 1, 'batch-2026', 'A', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80'),
('stu-03', 'CSE-26003', 'Sabbir Hossain', 'sabbir.h@mbstu.ac.bd', 'dept-cse', 'sess-2025-2026', 1, 1, 'batch-2026', 'A', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80');
