"""
RESTful API Endpoints for UniAttend Platform
Covers Admin, Teacher, Student, Routine, Dynamic QR, Biometric Face, Analytics, and Reports.
"""
from flask import Blueprint, request, jsonify
from app import db
from app.models import (
    Department, AcademicSession, Batch, Course, CourseOffering,
    Teacher, TeacherAssignment, Student, StudentEnrollment,
    FaceProfile, Routine, AttendanceSession, AttendanceRecord,
    AttendanceCorrectionAudit, EmailLog, AuditLog
)
from app.services.attendance_engine import (
    determine_attendance_status,
    compute_course_attendance_analytics
)
from datetime import datetime
import uuid
import json

api_bp = Blueprint('api', __name__)

@api_bp.route('/courses', methods=['GET'])
def get_courses():
    courses = Course.query.all()
    return jsonify([{
        'id': c.id,
        'code': c.code,
        'name': c.name,
        'credit': c.credit,
        'type': c.type,
        'year': c.year,
        'semester': c.semester,
        'status': c.status
    } for c in courses])

@api_bp.route('/course-offerings', methods=['GET'])
def get_offerings():
    offerings = CourseOffering.query.all()
    return jsonify([{
        'id': o.id,
        'course_id': o.course_id,
        'batch_id': o.batch_id,
        'year': o.year,
        'semester': o.semester,
        'planned_classes': o.planned_classes,
        'conducted_classes': o.conducted_classes
    } for o in offerings])

@api_bp.route('/teacher/assign', methods=['POST'])
def assign_teacher():
    data = request.get_json() or {}
    teacher_id = data.get('teacher_id')
    course_offering_id = data.get('course_offering_id')
    
    teacher = Teacher.query.get(teacher_id)
    offering = CourseOffering.query.get(course_offering_id)
    if not teacher or not offering:
        return jsonify({'error': 'Teacher or Course Offering not found'}), 404
        
    target_course = Course.query.get(offering.course_id)
    
    # Rule 10: Teacher can teach MAXIMUM ONE regular/theory course in a specific semester + batch!
    if target_course.type == 'THEORY':
        existing_assignments = TeacherAssignment.query.filter_by(teacher_id=teacher_id).all()
        for ea in existing_assignments:
            ea_off = CourseOffering.query.get(ea.course_offering_id)
            if ea_off and ea_off.batch_id == offering.batch_id and ea_off.year == offering.year and ea_off.semester == offering.semester:
                assigned_course = Course.query.get(ea_off.course_id)
                if assigned_course and assigned_course.type == 'THEORY' and ea_off.id != course_offering_id:
                    return jsonify({
                        'error': f'Policy Violation: Teacher already teaches regular theory course {assigned_course.code} in this batch. Max 1 regular course allowed.'
                    }), 400

    assignment = TeacherAssignment(
        id=str(uuid.uuid4()),
        teacher_id=teacher_id,
        course_offering_id=course_offering_id,
        role='PRIMARY',
        assigned_at=datetime.utcnow()
    )
    db.session.add(assignment)
    db.session.commit()
    return jsonify({'message': 'Teacher successfully assigned to course offering'}), 201

@api_bp.route('/attendance/correct', methods=['POST'])
def correct_attendance():
    """Manual attendance correction by Admin with mandatory reason & audit log (Section 4)."""
    data = request.get_json() or {}
    record_id = data.get('attendance_record_id')
    new_status = data.get('new_status') # "PRESENT", "LATE", "ABSENT"
    reason = data.get('reason')
    changed_by = data.get('changed_by', 'Admin Office')
    
    if not record_id or not reason:
        return jsonify({'error': 'Missing record_id or correction reason'}), 400
        
    rec = AttendanceRecord.query.get(record_id)
    if not rec:
        return jsonify({'error': 'Attendance record not found'}), 404
        
    orig_status = rec.status
    rec.status = new_status
    rec.notes = f'Corrected by {changed_by}: {reason}'
    
    audit = AttendanceCorrectionAudit(
        id=str(uuid.uuid4()),
        attendance_id=rec.id,
        student_id=rec.student_id,
        student_name='Student',
        course_offering_id=rec.course_offering_id,
        original_status=orig_status,
        new_status=new_status,
        changed_by=changed_by,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.session.add(audit)
    db.session.commit()
    return jsonify({'message': 'Attendance successfully corrected and recorded in audit log'}), 200
