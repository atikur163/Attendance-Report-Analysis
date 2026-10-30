"""
University Attendance System - Configuration
Configured for MySQL with PyMySQL driver and Render Cloud deployment.
"""
import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

def get_mysql_uri():
    """
    Constructs the MySQL connection URI using PyMySQL.
    Supports Render's DATABASE_URL or individual environment variables.
    Default local: user=root, password=1234, host=localhost:3306, db=uniattend_db
    """
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        # Convert standard mysql:// to mysql+pymysql:// if needed for SQLAlchemy
        if database_url.startswith('mysql://'):
            database_url = database_url.replace('mysql://', 'mysql+pymysql://', 1)
        return database_url

    user = os.getenv('MYSQL_USER', 'root')
    password = os.getenv('MYSQL_PASSWORD', '1234')
    host = os.getenv('MYSQL_HOST', 'localhost')
    port = os.getenv('MYSQL_PORT', '3306')
    db_name = os.getenv('MYSQL_DATABASE', 'uniattend_db')

    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}?charset=utf8mb4"

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'uniattend-production-super-secret-key-change-in-env')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 280,
        'pool_pre_ping': True,
        'pool_size': 10,
        'max_overflow': 20
    }
    
    # University Attendance Business Rules
    DEFAULT_LATE_THRESHOLD_MINUTES = int(os.getenv('LATE_THRESHOLD_MINUTES', '20'))
    EXAM_ELIGIBILITY_PERCENTAGE = float(os.getenv('EXAM_ELIGIBILITY_PERCENTAGE', '60.0'))
    THREE_LATE_PENALTY_ENABLED = os.getenv('THREE_LATE_PENALTY_ENABLED', 'True').lower() == 'true'
    
    # Notifications & Biometrics
    TEACHER_REMINDER_TIMING = os.getenv('TEACHER_REMINDER_TIMING', '15_MIN_BEFORE')
    FACE_SIMILARITY_THRESHOLD = float(os.getenv('FACE_SIMILARITY_THRESHOLD', '0.72'))

class DevelopmentConfig(Config):
    DEBUG = True
    # MySQL Database connection
    SQLALCHEMY_DATABASE_URI = get_mysql_uri()

class ProductionConfig(Config):
    DEBUG = False
    # On Render, DATABASE_URL is injected as an environment variable
    SQLALCHEMY_DATABASE_URI = get_mysql_uri()
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
