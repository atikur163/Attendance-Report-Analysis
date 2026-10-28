import React, { useState } from 'react';
import { X, FileCode2, Layers, Server, Terminal, Copy, Check } from 'lucide-react';

interface PythonDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonDocsModal: React.FC<PythonDocsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'models' | 'engine' | 'docker' | 'api'>('architecture');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Python + Flask Backend Architecture & Specification
              </h3>
              <p className="text-xs text-slate-500">
                SQLAlchemy models, Centralized Attendance Engine, Gunicorn/PostgreSQL Docker deployment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'architecture'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Architecture & Layers</span>
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'models'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>SQLAlchemy Models</span>
          </button>
          <button
            onClick={() => setActiveTab('engine')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'engine'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Attendance Engine (Python)</span>
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'docker'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Deployment & Gunicorn</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-slate-800 bg-slate-950 text-slate-200">
          {activeTab === 'architecture' && (
            <div className="space-y-4 font-sans text-slate-300">
              <h4 className="text-white font-bold text-sm font-mono text-indigo-400">
                1. Modular Directory Structure (Prompt Section 38)
              </h4>
              <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
{`backend_python/
├── app/
│   ├── __init__.py           # Flask App Factory & Blueprint registration
│   ├── config.py             # SQLite (dev) / PostgreSQL (prod) configs
│   ├── models/
│   │   └── __init__.py       # Normalized Relational SQLAlchemy Models
│   ├── services/
│   │   ├── attendance_engine.py  # Centralized Late / 3-Late / 60% Exam Rule
│   │   ├── qr_service.py         # Dynamic rotating session tokens
│   │   ├── face_service.py       # 128D Biometric Cosine Similarity
│   │   └── notification_service.py # Deduplicated Routine & Risk Warnings
│   └── routes/
│       └── api.py            # REST API endpoints for Admin/Teacher/Student
├── tests/
│   └── test_attendance_rules.py  # 24 automated unit tests
├── requirements.txt          # Flask, SQLAlchemy, Gunicorn, NumPy, Pandas
├── Dockerfile                # Production multi-stage container
├── nginx.conf                # Reverse proxy config with SSL & caching
└── run.py                    # Entrypoint for local development`}
              </pre>

              <h4 className="text-white font-bold text-sm font-mono text-indigo-400 mt-6">
                2. Academic Hierarchy Separation
              </h4>
              <p className="text-xs text-slate-400">
                The architecture ensures strict multi-year cohort isolation. Students in 1st Year Batch 2026 cannot view or enroll into 2nd Year Batch 2025 Course Offerings. Teachers are restricted to max 1 regular theory course per semester+batch to prevent over-allocation.
              </p>
            </div>
          )}

          {activeTab === 'models' && (
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-blue-300 overflow-x-auto">
{`# Excerpt from backend_python/app/models/__init__.py

class CourseOffering(db.Model):
    __tablename__ = 'course_offerings'
    id = db.Column(db.String(36), primary_key=True)
    course_id = db.Column(db.String(36), db.ForeignKey('courses.id'), nullable=False)
    department_id = db.Column(db.String(36), db.ForeignKey('departments.id'), nullable=False)
    academic_session_id = db.Column(db.String(36), db.ForeignKey('academic_sessions.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)      # 1 to 4
    semester = db.Column(db.Integer, nullable=False)  # 1 or 2
    batch_id = db.Column(db.String(36), db.ForeignKey('batches.id'), nullable=False)
    section = db.Column(db.String(10), default='A')
    planned_classes = db.Column(db.Integer, default=35)
    conducted_classes = db.Column(db.Integer, default=0)

class TeacherAssignment(db.Model):
    __tablename__ = 'teacher_assignments'
    id = db.Column(db.String(36), primary_key=True)
    course_offering_id = db.Column(db.String(36), db.ForeignKey('course_offerings.id'), nullable=False)
    teacher_id = db.Column(db.String(36), db.ForeignKey('teachers.id'), nullable=False)
    role = db.Column(db.String(20), default='PRIMARY')
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

class AttendanceCorrectionAudit(db.Model):
    __tablename__ = 'attendance_corrections'
    id = db.Column(db.String(36), primary_key=True)
    attendance_id = db.Column(db.String(36), db.ForeignKey('attendance_records.id'), nullable=False)
    student_id = db.Column(db.String(36), nullable=False)
    original_status = db.Column(db.String(20), nullable=False)
    new_status = db.Column(db.String(20), nullable=False)
    changed_by = db.Column(db.String(100), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)`}
            </pre>
          )}

          {activeTab === 'engine' && (
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto">
{`# Excerpt from backend_python/app/services/attendance_engine.py

def calculate_consecutive_late_penalties(records):
    # Rule 19: 3 consecutive LATE = 1 penalty
    sorted_records = sorted(records, key=lambda r: r.get('timestamp', ''))
    late_count = 0
    current_consecutive = 0
    penalty_count = 0

    for r in sorted_records:
        if r.get('status') == 'LATE':
            late_count += 1
            current_consecutive += 1
            if current_consecutive == 3:
                penalty_count += 1
                current_consecutive = 0
        elif r.get('status') in ('PRESENT', 'ABSENT'):
            current_consecutive = 0

    return {'late_count': late_count, 'penalty_count': penalty_count}

def compute_course_attendance_analytics(planned_classes, conducted_classes, records):
    penalties = calculate_consecutive_late_penalties(records)
    effective_present = max(0, present_count + penalties['late_count'] - penalties['penalty_count'])
    attendance_percentage = round((effective_present / conducted_classes * 100), 2)
    
    # Rule 21: Exactly 60.0% is Eligible
    exam_eligible = attendance_percentage >= 60.0
    
    # Rule 23: Maximum Possible Attendance
    remaining = max(0, planned_classes - conducted_classes)
    max_possible = round(((effective_present + remaining) / planned_classes * 100), 2)
    is_recoverable = max_possible >= 60.0
    
    return {
        'attendance_percentage': attendance_percentage,
        'exam_eligible': exam_eligible,
        'maximum_possible_attendance': max_possible,
        'is_recoverable': is_recoverable
    }`}
            </pre>
          )}

          {activeTab === 'docker' && (
            <div className="space-y-3 font-mono text-xs">
              <p className="text-slate-400 font-sans">
                Production deployment setup using Gunicorn WSGI workers behind Nginx reverse proxy with PostgreSQL:
              </p>
              <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-purple-300 overflow-x-auto">
{`# Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--workers=4", "--bind=0.0.0.0:5000", "run:app"]`}
              </pre>
              <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-cyan-300 overflow-x-auto">
{`# Start local development
cd backend_python
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python run.py

# Run automated tests
pytest tests/test_attendance_rules.py`}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-sans">
          <span>Backend files located in <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">/backend_python</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
