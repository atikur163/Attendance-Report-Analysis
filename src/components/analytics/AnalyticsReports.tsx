import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Users,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { db } from '../../services/db';
import { computeStudentCourseAnalytics } from '../../services/attendanceEngine';
import { getRiskBadgeClasses } from '../../utils/formatters';

interface AnalyticsReportsProps {
  onRefresh: () => void;
}

export const AnalyticsReports: React.FC<AnalyticsReportsProps> = ({ onRefresh }) => {
  const [selectedBatch, setSelectedBatch] = useState('ALL');
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const batches = db.getBatches();
  const offerings = db.getCourseOfferings();
  const courses = db.getCourses();
  const students = db.getStudents();
  const enrollments = db.getStudentEnrollments();
  const records = db.getAttendanceRecords();
  const settings = db.getSettings();

  // Compute analytics for all enrollments
  const allStudentAnalytics = enrollments.map(enr => {
    const student = students.find(s => s.id === enr.studentId)!;
    const offering = offerings.find(o => o.id === enr.courseOfferingId)!;
    const course = courses.find(c => c.id === offering.courseId)!;
    const courseRecords = records.filter(
      r => r.courseOfferingId === offering.id && r.studentId === student.id
    );

    return computeStudentCourseAnalytics({
      studentId: student.id,
      studentName: student.name,
      studentRoll: student.studentId,
      courseOffering: offering,
      courseCode: course.code,
      courseName: course.name,
      credit: course.credit,
      courseType: course.type,
      records: courseRecords,
      settings,
    });
  });

  // Filter by batch if selected
  const filteredAnalytics = allStudentAnalytics.filter(item => {
    if (selectedBatch === 'ALL') return true;
    const student = students.find(s => s.id === item.studentId);
    return student?.batchId === selectedBatch;
  });

  // Risk counts
  const safeCount = filteredAnalytics.filter(a => a.riskLevel === 'SAFE').length;
  const warningCount = filteredAnalytics.filter(a => a.riskLevel === 'WARNING').length;
  const highRiskCount = filteredAnalytics.filter(a => a.riskLevel === 'HIGH_RISK').length;
  const criticalCount = filteredAnalytics.filter(a => a.riskLevel === 'CRITICAL').length;

  // Exam eligible count (>=60%)
  const eligibleCount = filteredAnalytics.filter(a => a.examEligible).length;
  const ineligibleCount = filteredAnalytics.filter(a => !a.examEligible).length;

  // CSV Export utility
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.map(cell => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportMessage(`Successfully exported ${filename}`);
    setTimeout(() => setExportMessage(null), 3000);
  };

  const handleExportExamEligibility = () => {
    const headers = [
      'Student Roll',
      'Student Name',
      'Course Code',
      'Course Name',
      'Planned Classes',
      'Conducted Classes',
      'Effective Presents',
      'Attendance Percentage',
      'Exam Eligible (>=60%)',
      'Risk Status',
      'Max Possible Attendance (%)',
    ];

    const rows = filteredAnalytics.map(a => [
      a.studentRoll,
      a.studentName,
      a.courseCode,
      a.courseName,
      a.plannedClasses,
      a.conductedClasses,
      a.effectivePresentCount,
      a.attendancePercentage + '%',
      a.examEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE (BARRED)',
      a.riskLevel,
      a.maximumPossibleAttendance + '%',
    ]);

    exportToCSV(`MBSTU_Exam_Eligibility_Report_${Date.now()}.csv`, headers, rows);
  };

  const handleExportStudentAttendance = () => {
    const headers = [
      'Student ID',
      'Student Name',
      'Course Code',
      'Present Count',
      'Late Count',
      'Absent Count',
      '3-Late Penalty Count',
      'Effective Attendance',
      'Attendance Rate (%)',
      'Exam Status',
    ];

    const rows = filteredAnalytics.map(a => [
      a.studentRoll,
      a.studentName,
      a.courseCode,
      a.presentCount,
      a.lateCount,
      a.absentCount,
      a.penaltyCount,
      a.effectivePresentCount,
      a.attendancePercentage + '%',
      a.examEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE',
    ]);

    exportToCSV(`MBSTU_Student_Attendance_Sheet_${Date.now()}.csv`, headers, rows);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title & Batch Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Attendance Analytics & Faculty Reports</h2>
          <p className="text-xs text-slate-500 mt-1">
            Exam eligibility rosters, risk distribution breakdowns, and official CSV exports
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Cohort:</span>
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none"
            >
              <option value="ALL">All Batches (Simultaneous 1st-4th Year)</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} (Y{b.currentYear} S{b.currentSemester})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportExamEligibility}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Exam Eligibility CSV</span>
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportMessage}</span>
        </div>
      )}

      {/* High-Level Visual Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Exam Eligibility Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>60% Exam Eligibility</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-700">{eligibleCount}</span>
            <span className="text-xs text-slate-400">Eligible (≥60%)</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-2 transition-all"
              style={{
                width: `${
                  filteredAnalytics.length > 0 ? (eligibleCount / filteredAnalytics.length) * 100 : 100
                }%`,
              }}
            />
            <div
              className="bg-rose-500 h-2 transition-all"
              style={{
                width: `${
                  filteredAnalytics.length > 0 ? (ineligibleCount / filteredAnalytics.length) * 100 : 0
                }%`,
              }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Eligible: {eligibleCount}</span>
            <span className="text-rose-600 font-bold">Barred: {ineligibleCount}</span>
          </div>
        </div>

        {/* Risk Breakdown: Safe vs Critical */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Risk Classification</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{filteredAnalytics.length}</span>
            <span className="text-xs text-slate-400">Course Enrollments</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center font-mono text-xs">
            <div className="bg-emerald-50 text-emerald-800 p-1 rounded font-bold">{safeCount} Safe</div>
            <div className="bg-amber-50 text-amber-800 p-1 rounded font-bold">{warningCount} Warn</div>
            <div className="bg-orange-50 text-orange-800 p-1 rounded font-bold">{highRiskCount} High</div>
            <div className="bg-rose-50 text-rose-800 p-1 rounded font-bold">{criticalCount} Crit</div>
          </div>
        </div>

        {/* Conducted vs Planned Classes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Planned vs Conducted</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-700">
              {offerings.reduce((sum, o) => sum + (o.conductedClasses || 0), 0)}
            </span>
            <span className="text-xs text-slate-400">
              / {offerings.reduce((sum, o) => sum + o.plannedClasses, 0)} Total Lectures
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 h-2 w-3/5 rounded-full" />
          </div>
          <p className="text-[11px] text-slate-400">Average syllabus progress ~62%</p>
        </div>

        {/* Quick Report Download Actions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-700">Official Committee Exports</div>
          <button
            onClick={handleExportStudentAttendance}
            className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Complete Attendance Sheet</span>
          </button>
        </div>
      </div>

      {/* Detailed Student Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Comprehensive Student Attendance Roster</h3>
            <p className="text-xs text-slate-500">
              Includes Effective Attendance calculation, 3-Late Penalties, and Recoverability Projections
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Present</th>
                <th className="py-3 px-4">Late</th>
                <th className="py-3 px-4">Absent</th>
                <th className="py-3 px-4">3-Late Penalty</th>
                <th className="py-3 px-4">Effective Presents</th>
                <th className="py-3 px-4">Rate (%)</th>
                <th className="py-3 px-4">60% Exam Eligibility</th>
                <th className="py-3 px-4">Max Possible (%)</th>
                <th className="py-3 px-4">Recoverability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAnalytics.map((item, idx) => {
                const riskClasses = getRiskBadgeClasses(item.riskLevel);

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.studentName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.studentRoll}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      {item.courseCode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">{item.presentCount}</td>
                    <td className="py-3 px-4 font-semibold text-amber-700">{item.lateCount}</td>
                    <td className="py-3 px-4 font-semibold text-rose-700">{item.absentCount}</td>
                    <td className="py-3 px-4 font-bold text-slate-700">{item.penaltyCount}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">{item.effectivePresentCount}</td>
                    <td className="py-3 px-4 font-black text-slate-900">{item.attendancePercentage}%</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.examEligible
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.examEligible ? 'Eligible' : 'Barred (<60%)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {item.maximumPossibleAttendance}%
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${riskClasses.bg} ${riskClasses.text} ${riskClasses.border}`}>
                        {item.isRecoverable ? 'Recoverable' : 'CRITICAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
