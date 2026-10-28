"""
University Attendance Management - Local Development Server
Usage: python run.py
"""
import os
from app import create_app, db

env = os.getenv('FLASK_ENV', 'development')
app = create_app(env)

if __name__ == '__main__':
    with app.app_context():
        # Ensure database tables exist in SQLite
        db.create_all()
    print("==================================================================")
    print("UniAttend University Attendance Platform - Flask Backend")
    print("Running in environment:", env)
    print("API Endpoint: http://localhost:5000/api/v1")
    print("Health Check: http://localhost:5000/health")
    print("==================================================================")
    app.run(host='0.0.0.0', port=5000, debug=True)
