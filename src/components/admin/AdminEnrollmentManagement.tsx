import React, { useState } from 'react';
import {
  BookOpen,
  UserPlus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { db } from '../../services/db';
import { Student, Course, CourseOffering, Batch, StudentEnrollment } from '../../types';

interface AdminEnrollmentManagementProps {
  students: Student[];
  courses: Course[];
  offerings: CourseOffering[];
  batches: Batch[];
  enrollments: StudentEnrollment[];
  onRefresh: () => void;
}

export const AdminEnrollmentManagement: React.FC<AdminEnrollmentManagementProps> = ({
  students,
  courses,
  offerings,
  batches,
  enrollments,
  onRefresh,
}) => {
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(offerings[0]?.id || '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const currentOffering = offerings.find(o => o.id === selectedOfferingId);
  const currentCourse = currentOffering ? courses.find(c => c.id === currentOffering.courseId) : undefined;
  const currentBatch = currentOffering ? batches.find(b => b.id === currentOffering.batchId) : undefined;

  // Enrolled students in current offering
  const currentOfferingEnrollments = enrollments.filter(e => e.courseOfferingId === selectedOfferingId && e.status === 'ENROLLED');

  const enrolledStudentIds = new Set(currentOfferingEnrollments.map(e => e.studentId));

  // Eligible students (students matching batch, year, semester not yet enrolled)
  const eligibleStudents = students.filter(s => {
    if (!currentOffering) return false;
    const matchesBatch = s.batchId === currentOffering.batchId;
    const matchesLevel = s.year === currentOffering.year && s.semester === currentOffering.semester;
    const notEnrolled = !enrolledStudentIds.has(s.id);
    return matchesBatch && matchesLevel && notEnrolled && s.status === 'ACTIVE';
  });

  // Filtered enrolled students for search
  const filteredEnrollments = currentOfferingEnrollments.filter(e => {
    const student = students.find(s => s.id === e.studentId);
    if (!student) return false;
    return (
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalPages = Math.ceil(filteredEnrollments.length / itemsPerPage) || 1;
  const paginatedEnrollments = filteredEnrollments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleEnrollStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    setEnrollSuccess(null);

    if (!selectedOfferingId || !selectedStudentId) {
      setEnrollError('Please select both a course offering and a student.');
      return;
    }

    const res = db.enrollStudent(selectedStudentId, selectedOfferingId);
    if (!res.success) {
      setEnrollError(res.message);
    } else {
      const student = students.find(s => s.id === selectedStudentId);
      setEnrollSuccess(`Successfully enrolled ${student?.name} (${student?.studentId}) into ${currentCourse?.code}!`);
      setSelectedStudentId('');
      onRefresh();
      setTimeout(() => setEnrollSuccess(null), 3000);
    }
  };

  const handleUnenroll = (enrollmentId: string, studentName: string) => {
    if (window.confirm(`Unenroll student ${studentName} from ${currentCourse?.code}?`)) {
      db.unenrollStudent(enrollmentId);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Course Enrollment Administration</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage student registrations per course offering and enforce batch/semester prerequisite checks
          </p>
        </div>

        {/* Course Offering Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-600 shrink-0">Selected Course:</span>
          <select
            value={selectedOfferingId}
            onChange={e => {
              setSelectedOfferingId(e.target.value);
              setSelectedStudentId('');
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs truncate"
          >
            {offerings.map(o => {
              const c = courses.find(crs => crs.id === o.courseId);
              const b = batches.find(bat => bat.id === o.batchId);
              return (
                <option key={o.id} value={o.id}>
                  {c?.code} - {c?.name} ({b?.name})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Selected Offering Info Header Card */}
      {currentOffering && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-black text-indigo-800 text-sm">{currentCourse?.code}</span>
              <span className="font-bold text-slate-900">{currentCourse?.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200">
                {currentCourse?.type} • {currentCourse?.credit} Credits
              </span>
            </div>
            <div className="text-slate-600 mt-1">
              Cohort: <strong>{currentBatch?.name}</strong> • Year {currentOffering.year}, Semester {currentOffering.semester} • Section {currentOffering.section}
            </div>
          </div>
          <div className="flex items-center space-x-3 text-slate-700 font-semibold shrink-0">
            <div>
              Total Enrolled: <span className="font-mono font-bold text-indigo-700 text-sm">{currentOfferingEnrollments.length}</span> students
            </div>
          </div>
        </div>
      )}

      {/* Enroll Eligible Student Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
          <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
          <span>Enroll New Student in this Offering</span>
        </h4>

        {enrollError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{enrollError}</span>
          </div>
        )}

        {enrollSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{enrollSuccess}</span>
          </div>
        )}

        <form onSubmit={handleEnrollStudent} className="flex flex-col sm:flex-row gap-3 text-xs">
          <div className="flex-1">
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">
                {eligibleStudents.length > 0
                  ? `-- Select Eligible Student (${eligibleStudents.length} available) --`
                  : 'All eligible students in this batch are already enrolled'}
              </option>
              {eligibleStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.studentId} • Sec {s.section})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!selectedStudentId}
            className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center space-x-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll Student</span>
          </button>
        </form>
      </div>

      {/* Enrolled Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <h4 className="font-bold text-slate-900 text-xs">Currently Enrolled Students</h4>
            <span className="text-[11px] text-slate-400 font-mono">({filteredEnrollments.length} total)</span>
          </div>

          <div className="relative w-full sm:w-64 text-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search enrolled students..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Student ID / Roll</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Enrollment Date</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No enrolled students found for this course offering.
                  </td>
                </tr>
              ) : (
                paginatedEnrollments.map(e => {
                  const student = students.find(s => s.id === e.studentId);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                        {student?.studentId}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{student?.name}</td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{student?.email}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {new Date(e.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleUnenroll(e.id, student?.name || 'Student')}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Unenroll Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredEnrollments.length)} of {filteredEnrollments.length} students
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
