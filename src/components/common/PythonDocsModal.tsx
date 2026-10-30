import React, { useState } from 'react';
import { X, FileCode2, Layers, Server, Terminal, Copy, Check, Database, Cloud, ExternalLink, Download } from 'lucide-react';

interface PythonDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonDocsModal: React.FC<PythonDocsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'mysql_render' | 'architecture' | 'models' | 'engine' | 'schema'>('mysql_render');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const mysqlConnectionString = "mysql+pymysql://root:1234@localhost:3306/uniattend_db?charset=utf8mb4";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">
                  MySQL Database & Render Deployment Architecture
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  MySQL + PyMySQL
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configured with user: <code className="font-mono text-slate-700">root</code>, pass: <code className="font-mono text-slate-700">1234</code>, and production Render web service setup
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
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 space-x-4 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('mysql_render')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'mysql_render'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4 text-indigo-600" />
            <span>Render Deployment & MySQL Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'schema'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>MySQL Schema (InnoDB DDL)</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Directory & Blueprint</span>
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
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
            className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'engine'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Attendance Engine (Python)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs bg-slate-950 text-slate-200">
          {activeTab === 'mysql_render' && (
            <div className="space-y-6 font-sans text-slate-300">
              {/* MySQL Quick Connection Pill */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center space-x-1.5">
                    <Database className="w-4 h-4" />
                    <span>Your Configured MySQL Connection String</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(mysqlConnectionString, 'conn_str')}
                    className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                  >
                    {copiedText === 'conn_str' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'conn_str' ? 'Copied' : 'Copy URI'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-emerald-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 select-all overflow-x-auto">
                  {mysqlConnectionString}
                </div>
                <p className="text-[11px] text-slate-400">
                  User: <strong className="text-white">root</strong> • Password: <strong className="text-white">1234</strong> • Database: <strong className="text-white">uniattend_db</strong> • Driver: <strong className="text-white">PyMySQL</strong>
                </p>
              </div>

              {/* Render Deployment Steps */}
              <div className="space-y-4">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <Cloud className="w-5 h-5 text-indigo-400" />
                  <span>Step-by-Step: Deploying Backend to Render</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">1</div>
                    <h5 className="font-bold text-white">Create Web Service</h5>
                    <p className="text-slate-400 text-[11px]">
                      On <a href="https://dashboard.render.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">Render Dashboard</a>, click <strong>New +</strong> $\rightarrow$ <strong>Web Service</strong> and select your GitHub repo.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">2</div>
                    <h5 className="font-bold text-white">Commands & Runtime</h5>
                    <p className="text-slate-400 text-[11px]">
                      Root Dir: <code className="text-indigo-300">backend_python</code><br />
                      Build: <code className="text-indigo-300">pip install -r requirements.txt</code><br />
                      Start: <code className="text-indigo-300">gunicorn --workers=3 --bind=0.0.0.0:$PORT run:app</code>
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">3</div>
                    <h5 className="font-bold text-white">Set Environment Vars</h5>
                    <p className="text-slate-400 text-[11px]">
                      Add <code className="text-indigo-300">DATABASE_URL</code>, <code className="text-indigo-300">SECRET_KEY</code>, and <code className="text-indigo-300">FLASK_ENV=production</code>.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <h5 className="font-bold text-sm text-white">Render Environment Variables Table</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead className="text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Variable Key</th>
                          <th className="py-2 px-3">Example Value</th>
                          <th className="py-2 px-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        <tr>
                          <td className="py-2 px-3 text-indigo-400 font-bold">DATABASE_URL</td>
                          <td className="py-2 px-3 text-emerald-400">mysql+pymysql://root:1234@...</td>
                          <td className="py-2 px-3 font-sans text-slate-400">MySQL connection URI with PyMySQL</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-indigo-400 font-bold">FLASK_ENV</td>
                          <td className="py-2 px-3 text-slate-300">production</td>
                          <td className="py-2 px-3 font-sans text-slate-400">Enables production cookies & Gunicorn settings</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-indigo-400 font-bold">SECRET_KEY</td>
                          <td className="py-2 px-3 text-amber-400">32-character random string</td>
                          <td className="py-2 px-3 font-sans text-slate-400">Session signing secret</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-indigo-400 font-bold">LATE_THRESHOLD_MINUTES</td>
                          <td className="py-2 px-3 text-slate-300">20</td>
                          <td className="py-2 px-3 font-sans text-slate-400">Prompt Rule 17: arrival $\ge 20$m is LATE</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-indigo-400 font-bold">EXAM_ELIGIBILITY_PERCENTAGE</td>
                          <td className="py-2 px-3 text-slate-300">60.0</td>
                          <td className="py-2 px-3 font-sans text-slate-400">Prompt Rule 21: $\ge 60\%$ is exam eligible</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-800/60 space-y-2 text-xs">
                  <h5 className="font-bold text-indigo-300">Render Blueprint file included!</h5>
                  <p className="text-slate-300 text-[11px]">
                    A pre-configured <code className="text-indigo-300">render.yaml</code> is created in <code className="text-indigo-300">backend_python/render.yaml</code>. You can deploy with 1-click on Render using Blueprints.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between font-sans">
                <span className="text-xs text-slate-400">
                  InnoDB UTF8MB4 schema saved to <code className="text-indigo-400">backend_python/schema_mysql.sql</code>
                </span>
                <button
                  onClick={() => copyToClipboard('source backend_python/schema_mysql.sql', 'schema_cmd')}
                  className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  {copiedText === 'schema_cmd' ? 'Copied Import Command' : 'Copy Import Command'}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs text-blue-300 overflow-x-auto max-h-[500px]">
{`-- MySQL DDL Schema Excerpt
CREATE DATABASE IF NOT EXISTS \`uniattend_db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`uniattend_db\`;

CREATE TABLE \`course_offerings\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`course_id\` VARCHAR(36) NOT NULL,
  \`department_id\` VARCHAR(36) NOT NULL,
  \`academic_session_id\` VARCHAR(36) NOT NULL,
  \`year\` INT NOT NULL,
  \`semester\` INT NOT NULL,
  \`batch_id\` VARCHAR(36) NOT NULL,
  \`section\` VARCHAR(10) NOT NULL DEFAULT 'A',
  \`planned_classes\` INT NOT NULL DEFAULT 35,
  \`conducted_classes\` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_offering_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE \`attendance_records\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`session_id\` VARCHAR(36) NOT NULL,
  \`course_offering_id\` VARCHAR(36) NOT NULL,
  \`student_id\` VARCHAR(36) NOT NULL,
  \`timestamp\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`method\` ENUM('QR', 'FACE', 'MANUAL_ADMIN') NOT NULL,
  \`status\` ENUM('PRESENT', 'LATE', 'ABSENT') NOT NULL,
  \`minutes_late\` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_session_student\` (\`session_id\`, \`student_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`}
              </pre>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4 font-sans text-slate-300">
              <h4 className="text-white font-bold text-sm font-mono text-indigo-400">
                Backend Architecture with MySQL + PyMySQL
              </h4>
              <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
{`backend_python/
├── app/
│   ├── __init__.py           # Flask App Factory & Blueprint registration
│   ├── config.py             # MySQL URI with PyMySQL & root:1234
│   ├── models/
│   │   └── __init__.py       # SQLAlchemy MySQL InnoDB models
│   ├── services/
│   │   ├── attendance_engine.py  # 20m late / 3-late penalty / 60% exam rule
│   │   ├── qr_service.py         # Dynamic rotating session tokens
│   │   ├── face_service.py       # 128D Biometric Cosine Similarity
│   │   └── notification_service.py # Deduplicated Routine & Risk Warnings
│   └── routes/
│       └── api.py            # REST API endpoints
├── tests/
│   └── test_attendance_rules.py  # 24 automated unit tests
├── requirements.txt          # PyMySQL, Cryptography, Flask, SQLAlchemy, Gunicorn
├── schema_mysql.sql          # Complete MySQL DDL & Initial Seed Data
├── render.yaml               # Render Infrastructure as Code Blueprint
├── RENDER_DEPLOY_GUIDE.md    # Step-by-step Render deployment walkthrough
└── run.py                    # Local development runner`}
              </pre>
            </div>
          )}

          {activeTab === 'models' && (
            <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-blue-300 overflow-x-auto">
{`# SQLAlchemy Models configured for MySQL InnoDB

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

    return {'late_count': late_count, 'penalty_count': penalty_count}`}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-sans">
          <span>
            MySQL schema: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">backend_python/schema_mysql.sql</code> • Guide: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">RENDER_DEPLOY_GUIDE.md</code>
          </span>
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
