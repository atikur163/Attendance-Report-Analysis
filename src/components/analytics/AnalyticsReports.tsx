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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MILESTONE_50' | 'BELOW_60' | 'CAN_REACH' | 'BARRED'>('ALL');
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const batches = db.getBatches();
  const offerings = db.getCourseOfferings();
  const courses = db.getCourses();
  const students = db.getStudents();
  const enrollments = db.getStudentEnrollments();
  const records = db.getAttendanceRecords();
  const settings = db.getSettings();

  // Compute analytics for all valid enrollments safely
  const allStudentAnalytics = enrollments
    .map(enr => {
      const student = students.find(s => s.id === enr.studentId);
      const offering = offerings.find(o => o.id === enr.courseOfferingId);
      if (!student || !offering) return null;

      const course = courses.find(c => c.id === offering.courseId);
      if (!course) return null;

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
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Filter by batch if selected
  const batchFilteredAnalytics = allStudentAnalytics.filter(item => {
    if (selectedBatch === 'ALL') return true;
    const student = students.find(s => s.id === item.studentId);
    return student?.batchId === selectedBatch;
  });

  // Filter by 50% milestone & eligibility status
  const filteredAnalytics = batchFilteredAnalytics.filter(item => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'MILESTONE_50') return item.isHalfwayMilestone;
    if (statusFilter === 'BELOW_60') return item.attendancePercentage < 60.0;
    if (statusFilter === 'CAN_REACH') return item.attendancePercentage < 60.0 && item.canReach60;
    if (statusFilter === 'BARRED') return !item.canReach60;
    return true;
  });

  // Milestone & Eligibility Counts
  const countMilestone50 = batchFilteredAnalytics.filter(a => a.isHalfwayMilestone).length;
  const countBelow60 = batchFilteredAnalytics.filter(a => a.attendancePercentage < 60.0).length;
  const countCanReach = batchFilteredAnalytics.filter(a => a.attendancePercentage < 60.0 && a.canReach60).length;
  const countBarred = batchFilteredAnalytics.filter(a => !a.canReach60).length;

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
      'Total Classes Scheduled',
      'Classes Held So Far',
      'Progress (%)',
      '50% Milestone Reached',
      'Classes Attended',
      'Current Attendance Rate (%)',
      'Remaining Classes',
      'Min Additional Classes to Hit 60%',
      'Can Reach 60% Mathematically',
      'Current Exam Status',
      'Projected Exam Status',
      'Early Warning Category',
    ];

    const rows = filteredAnalytics.map(a => [
      a.studentRoll,
      a.studentName,
      a.courseCode,
      a.courseName,
      a.plannedClasses,
      a.conductedClasses,
      a.courseProgressPercentage + '%',
      a.isHalfwayMilestone ? 'YES' : 'NO',
      a.effectivePresentCount,
      a.attendancePercentage + '%',
      a.remainingClasses,
      a.minAdditionalClassesToPass,
      a.canReach60 ? 'YES' : 'MATHEMATICALLY IMPOSSIBLE',
      a.examEligible ? 'ELIGIBLE' : 'BELOW 60%',
      a.projectedExamStatus,
      a.earlyWarningCategory,
    ]);

    exportToCSV(`UniAttend_50Pct_Milestone_Exam_Eligibility_${Date.now()}.csv`, headers, rows);
  };

  const handleExportStudentAttendance = () => {
    const headers = [
      'Student ID',
      'Student Name',
      'Course Code',
      'Total Scheduled',
      'Held So Far',
      'Present Count',
      'Late Count',
      'Absent Count',
      '3-Late Penalty Count',
      'Effective Attendance',
      'Attendance Rate (%)',
      'Min Additional to Pass',
      'Mathematical Feasibility',
      'Projected Exam Status',
    ];

    const rows = filteredAnalytics.map(a => [
      a.studentRoll,
      a.studentName,
      a.courseCode,
      a.plannedClasses,
      a.conductedClasses,
      a.presentCount,
      a.lateCount,
      a.absentCount,
      a.penaltyCount,
      a.effectivePresentCount,
      a.attendancePercentage + '%',
      a.minAdditionalClassesToPass,
      a.canReach60 ? 'Can Reach' : 'Barred',
      a.projectedExamStatus,
    ]);

    exportToCSV(`UniAttend_Detailed_Attendance_Sheet_${Date.now()}.csv`, headers, rows);
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

      {/* Interactive Milestone & Exam Status Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 mr-1 flex items-center space-x-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Milestone Filter:</span>
        </span>
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Records ({batchFilteredAnalytics.length})
        </button>
        <button
          onClick={() => setStatusFilter('MILESTONE_50')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
            statusFilter === 'MILESTONE_50'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50'
          }`}
        >
          <span>50% Course Milestone</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20">{countMilestone50}</span>
        </button>
        <button
          onClick={() => setStatusFilter('BELOW_60')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
            statusFilter === 'BELOW_60'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
          }`}
        >
          <span>Current &lt;60% Attendance</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20">{countBelow60}</span>
        </button>
        <button
          onClick={() => setStatusFilter('CAN_REACH')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
            statusFilter === 'CAN_REACH'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-teal-700 hover:bg-teal-50'
          }`}
        >
          <span>Can Still Reach 60%</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-500/20">{countCanReach}</span>
        </button>
        <button
          onClick={() => setStatusFilter('BARRED')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 ${
            statusFilter === 'BARRED'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
          }`}
        >
          <span>Mathematically Barred</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20">{countBarred}</span>
        </button>
      </div>

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
            <span className="text-rose-600 font-bold">Ineligible/At Risk: {ineligibleCount}</span>
          </div>
        </div>

        {/* 50% Course Milestone & Early Warning Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>50% Milestone &amp; Feasibility</span>
            <AlertTriangle className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-indigo-900">{countMilestone50}</span>
            <span className="text-xs text-slate-400">Offerings at ≥50% Held</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-teal-50 border border-teal-200 text-teal-800 p-1.5 rounded-lg font-bold">
              <div>{countCanReach}</div>
              <div className="text-[10px] font-normal text-teal-600">Can Still Reach</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-1.5 rounded-lg font-bold">
              <div>{countBarred}</div>
              <div className="text-[10px] font-normal text-rose-600">Mathematically Barred</div>
            </div>
          </div>
        </div>

        {/* Risk Breakdown: Safe vs Critical */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Risk Classification</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{filteredAnalytics.length}</span>
            <span className="text-xs text-slate-400">Evaluated Records</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center font-mono text-xs">
            <div className="bg-emerald-50 text-emerald-800 p-1 rounded font-bold">{safeCount} Safe</div>
            <div className="bg-amber-50 text-amber-800 p-1 rounded font-bold">{warningCount} Warn</div>
            <div className="bg-orange-50 text-orange-800 p-1 rounded font-bold">{highRiskCount} High</div>
            <div className="bg-rose-50 text-rose-800 p-1 rounded font-bold">{criticalCount} Crit</div>
          </div>
        </div>

        {/* Quick Report Download Actions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-700">Official Committee Exports</div>
          <button
            onClick={handleExportExamEligibility}
            className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export 50% Milestone &amp; Eligibility CSV</span>
          </button>
          <button
            onClick={handleExportStudentAttendance}
            className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Attendance Roster CSV</span>
          </button>
        </div>
      </div>

      {/* Detailed Student Attendance Table with all 8 metrics */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Comprehensive Student Attendance &amp; 60% Exam Eligibility Roster</h3>
            <p className="text-xs text-slate-500">
              Evaluates held classes, effective presents, 3-late penalties, min additional required, and mathematical recoverability
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Showing {filteredAnalytics.length} of {batchFilteredAnalytics.length} student-course enrollments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Lectures Held</th>
                <th className="py-3 px-4">Classes Attended</th>
                <th className="py-3 px-4">Current %</th>
                <th className="py-3 px-4">Remaining</th>
                <th className="py-3 px-4">Needed for 60%</th>
                <th className="py-3 px-4">Mathematical Feasibility</th>
                <th className="py-3 px-4">Exam Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAnalytics.map((item, idx) => {
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.studentName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.studentRoll}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-indigo-700">{item.courseCode}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{item.courseName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {item.conductedClasses} / {item.plannedClasses}
                      </div>
                      <div className="flex items-center space-x-1 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-500">{item.courseProgressPercentage}%</span>
                        {item.isHalfwayMilestone && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            ≥50% Held
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{item.effectivePresentCount}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.presentCount}P • {item.lateCount}L • {item.absentCount}A
                        {item.penaltyCount > 0 && ` (-${item.penaltyCount} pen)`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-black text-xs ${
                          item.attendancePercentage >= 60.0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {item.attendancePercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {item.remainingClasses}
                    </td>
                    <td className="py-3 px-4">
                      {item.minAdditionalClassesToPass === 0 ? (
                        <span className="text-emerald-700 font-bold text-[11px]">Met (0 needed)</span>
                      ) : (
                        <span className="text-indigo-700 font-bold text-[11px]">
                          +{item.minAdditionalClassesToPass} more
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.canReach60 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          Possible (Max {item.maximumPossibleAttendance}%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          Impossible (Max {item.maximumPossibleAttendance}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.projectedExamStatus === 'ELIGIBLE' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Eligible
                        </span>
                      )}
                      {item.projectedExamStatus === 'AT_RISK' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          At Risk (&lt;60%)
                        </span>
                      )}
                      {item.projectedExamStatus === 'PROJECTED_INELIGIBLE' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Barred From Exam
                        </span>
                      )}
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
