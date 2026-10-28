"""
University Attendance System - Configuration
Supports SQLite for development, PostgreSQL for production.
"""
import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'uniattend-production-super-secret-key-change-in-env')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # University Attendance Business Rules (Configurable Defaults)
    DEFAULT_LATE_THRESHOLD_MINUTES = 20
    EXAM_ELIGIBILITY_PERCENTAGE = 60.0
    THREE_LATE_PENALTY_ENABLED = True
    
    # Reminders
    TEACHER_REMINDER_TIMING = '15_MIN_BEFORE'
    
    # Biometric Face Threshold
    FACE_SIMILARITY_THRESHOLD = 0.72

class DevelopmentConfig(Config):
    DEBUG = True
    # Normalized relational SQLite database for development
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(BASE_DIR, "../../instance/university_attendance.db")}'
    )

class ProductionConfig(Config):
    DEBUG = False
    # PostgreSQL for production deployment
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'postgresql://uniadmin:SecurePassword2026!@postgres-db.internal:5432/uniattend_prod'
    )
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(hours=12)

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig
}
