"""
University Relational Models (SQLAlchemy)
Normalized schema enforcing 4 Years x 2 Semesters academic structure,
course offering layers, teacher assignment constraints, and auditability.
"""
from datetime import datetime
from app import db
import json

class Department(db.Model):
    __tablename__ = 'departments'
    id = db.Column(db.String(36), primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    building = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AcademicSession(db.Model):
    __tablename__ = 'academic_sessions'
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False) # e.g. "2025-2026"
    is_current = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Batch(db.Model):
    __tablename__ = 'batches'
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(100), nullable=False) # e.g. "Batch 2026"
    start_year = db.Column(db.Integer, nullable=False)
    department_id = db.Column(db.String(36), db.ForeignKey('departments.id'), nullable=False)
    current_year = db.Column(db.Integer, nullable=False) # 1, 2, 3, 4
    current_semester = db.Column(db.Integer, nullable=False) # 1, 2
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Course(db.Model):
    __tablename__ = 'courses'
    id = db.Column(db.String(36), primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False, index=True) # e.g. "CSE-1101"
    name = db.Column(db.String(150), nullable=False)
    credit = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(20), nullable=False) # "THEORY" or "LAB"
    department_id = db.Column(db.String(36), db.ForeignKey('departments.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False) # 1 to 4
    semester = db.Column(db.Integer, nullable=False) # 1 or 2
    status = db.Column(db.String(20), default='ACTIVE')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CourseOffering(db.Model):
    """
    Identifies the actual course conducted for a specific Department,
    Academic Session, Year, Semester, Batch, and Section.
    """
    __tablename__ = 'course_offerings'
    id = db.Column(db.String(36), primary_key=True)
    course_id = db.Column(db.String(36), db.ForeignKey('courses.id'), nullable=False, index=True)
    department_id = db.Column(db.String(36), db.ForeignKey('departments.id'), nullable=False)
    academic_session_id = db.Column(db.String(36), db.ForeignKey('academic_sessions.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    batch_id = db.Column(db.String(36), db.ForeignKey('batches.id'), nullable=False)
    section = db.Column(db.String(10), default='A')
    planned_classes = db.Column(db.Integer, default=35)
    conducted_classes = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='ACTIVE')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Teacher(db.Model):
    __tablename__ = 'teachers'
    id = db.Column(db.String(36), primary_key=True)
    teacher_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    department_id = db.Column(db.String(36), db.ForeignKey('departments.id'), nullable=False)
    designation = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='ACTIVE')
    authorized_courses_json = db.Column(db.Text, default='[]') # JSON list of authorized course IDs

    def get_authorized_courses(self):
        try:
            return json.loads(self.authorized_courses_json or '[]')
        except:
            return []

class TeacherAssignment(db.Model):
    """
    Assigns teacher to Course Offering.
    Enforces Rule: Teacher max ONE regular course per semester+batch, plus lab allowed.
    """
    __tablename__ = 'teacher_assignments'
    id = db.Column(db.String(36), primary_key=True)
    course_offering_id = db.Column(db.String(36), db.ForeignKey('course_offerings.id'), nullable=False)
    teacher_id = db.Column(db.String(36), db.ForeignKey('teachers.id'), nullable=False)
    role = db.Column(db.String(20), default='PRIMARY')
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.String(36), primary_key=True)
    student_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    department_id = db.Column(db.String(36), db.ForeignKey('departments.id'), nullable=False)
    academic_session_id = db.Column(db.String(36), db.ForeignKey('academic_sessions.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    batch_id = db.Column(db.String(36), db.ForeignKey('batches.id'), nullable=False)
    section = db.Column(db.String(10), default='A')
    status = db.Column(db.String(20), default='ACTIVE')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class StudentEnrollment(db.Model):
    __tablename__ = 'student_enrollments'
    id = db.Column(db.String(36), primary_key=True)
    student_id = db.Column(db.String(36), db.ForeignKey('students.id'), nullable=False)
    course_offering_id = db.Column(db.String(36), db.ForeignKey('course_offerings.id'), nullable=False)
    status = db.Column(db.String(20), default='ENROLLED')
    enrolled_at = db.Column(db.DateTime, default=datetime.utcnow)

class FaceProfile(db.Model):
    """
    Sensitive biometric profile storing 128D facial representation vector.
    """
    __tablename__ = 'face_profiles'
    id = db.Column(db.String(36), primary_key=True)
    student_id = db.Column(db.String(36), db.ForeignKey('students.id'), unique=True, nullable=False)
    embedding_json = db.Column(db.Text, nullable=False) # 128D float vector
    model_version = db.Column(db.String(50), default='v2.1-mobilenet-ssd')
    status = db.Column(db.String(20), default='REGISTERED')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Routine(db.Model):
    __tablename__ = 'routines'
    id = db.Column(db.String(36), primary_key=True)
    course_offering_id = db.Column(db.String(36), db.ForeignKey('course_offerings.id'), nullable=False)
    teacher_id = db.Column(db.String(36), db.ForeignKey('teachers.id'), nullable=False)
    day_of_week = db.Column(db.String(20), nullable=False) # "Sunday", "Monday", etc.
    start_time = db.Column(db.String(20), nullable=False) # "10:00 AM"
    end_time = db.Column(db.String(20), nullable=False) # "11:00 AM"
    room = db.Column(db.String(50), nullable=False)
    building = db.Column(db.String(100))

class AttendanceSession(db.Model):
    __tablename__ = 'attendance_sessions'
    id = db.Column(db.String(36), primary_key=True)
    course_offering_id = db.Column(db.String(36), db.ForeignKey('course_offerings.id'), nullable=False)
    teacher_id = db.Column(db.String(36), db.ForeignKey('teachers.id'), nullable=False)
    routine_id = db.Column(db.String(36), db.ForeignKey('routines.id'), nullable=True)
    date = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.String(20), nullable=False)
    end_time = db.Column(db.String(20), nullable=False)
    attendance_method = db.Column(db.String(20), nullable=False) # "QR" or "FACE"
    status = db.Column(db.String(20), default='SCHEDULED') # "SCHEDULED", "ACTIVE", "CLOSED"
    current_token = db.Column(db.String(100), nullable=False)
    token_expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    closed_at = db.Column(db.DateTime, nullable=True)

class AttendanceRecord(db.Model):
    __tablename__ = 'attendance_records'
    id = db.Column(db.String(36), primary_key=True)
    session_id = db.Column(db.String(36), db.ForeignKey('attendance_sessions.id'), nullable=False, index=True)
    course_offering_id = db.Column(db.String(36), db.ForeignKey('course_offerings.id'), nullable=False, index=True)
    student_id = db.Column(db.String(36), db.ForeignKey('students.id'), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    method = db.Column(db.String(20), nullable=False) # "QR", "FACE", "MANUAL_ADMIN"
    status = db.Column(db.String(20), nullable=False) # "PRESENT", "LATE", "ABSENT"
    minutes_late = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text, nullable=True)

class AttendanceCorrectionAudit(db.Model):
    __tablename__ = 'attendance_corrections'
    id = db.Column(db.String(36), primary_key=True)
    attendance_id = db.Column(db.String(36), db.ForeignKey('attendance_records.id'), nullable=False)
    student_id = db.Column(db.String(36), nullable=False)
    student_name = db.Column(db.String(120), nullable=False)
    course_offering_id = db.Column(db.String(36), nullable=False)
    original_status = db.Column(db.String(20), nullable=False)
    new_status = db.Column(db.String(20), nullable=False)
    changed_by = db.Column(db.String(100), nullable=False) # Admin identity
    reason = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class EmailLog(db.Model):
    __tablename__ = 'email_logs'
    id = db.Column(db.String(36), primary_key=True)
    recipient_email = db.Column(db.String(120), nullable=False)
    recipient_name = db.Column(db.String(120), nullable=False)
    recipient_role = db.Column(db.String(20), nullable=False)
    type = db.Column(db.String(50), nullable=False) # "CLASS_REMINDER" or "ATTENDANCE_WARNING"
    subject = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    dedup_key = db.Column(db.String(150), unique=True, nullable=False, index=True)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='SENT')

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(50), nullable=False)
    user_name = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    entity = db.Column(db.String(100), nullable=False)
    entity_id = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
