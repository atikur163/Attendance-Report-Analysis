import React, { useState, useMemo } from 'react';
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
  UserCheck,
  Building2,
  Layers,
  Award,
  Info,
  ArrowRight,
  Check,
} from 'lucide-react';
import { db } from '../../services/db';
import { checkStudentCourseEligibility } from '../../services/enrollmentEngine';
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
  const departments = db.getDepartments();

  // 1. Department Filter State (Default 'ALL', or click specific department like 'dept-cse')
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');

  // 2. Focus Mode: 'OFFERING_VIEW' (view enrollments by course offering) or 'STUDENT_PERSONALIZED' (view & enroll individual student)
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(offerings[0]?.id || '');
  const [personalizedStudentId, setPersonalizedStudentId] = useState<string>('');

  // 3. Form & feedback state
  const [enrollStudentSelectId, setEnrollStudentSelectId] = useState<string>('');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Selected student object if in personalized view
  const activeStudent = useMemo(() => {
    return students.find(s => s.id === personalizedStudentId) || null;
  }, [students, personalizedStudentId]);

  // Selected offering object
  const currentOffering = useMemo(() => {
    return offerings.find(o => o.id === selectedOfferingId) || offerings[0];
  }, [offerings, selectedOfferingId]);

  const currentCourse = currentOffering ? courses.find(c => c.id === currentOffering.courseId) : undefined;
  const currentBatch = currentOffering ? batches.find(b => b.id === currentOffering.batchId) : undefined;

  // Department counts for registered students
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: students.length };
    departments.forEach(dept => {
      counts[dept.id] = students.filter(s => s.departmentId === dept.id).length;
    });
    return counts;
  }, [students, departments]);

  // Students filtered by selected department
  const departmentStudents = useMemo(() => {
    if (selectedDeptId === 'ALL') return students;
    return students.filter(s => s.departmentId === selectedDeptId);
  }, [students, selectedDeptId]);

  // Enrolled students in current offering
  const currentOfferingEnrollments = useMemo(() => {
    if (!currentOffering) return [];
    return enrollments.filter(e => e.courseOfferingId === currentOffering.id && e.status === 'ENROLLED');
  }, [enrollments, currentOffering]);

  // Filtered enrolled students for current offering (filtered by department selection + search term)
  const filteredOfferingEnrollments = useMemo(() => {
    return currentOfferingEnrollments.filter(e => {
      const student = students.find(s => s.id === e.studentId);
      if (!student) return false;

      // Department filter check
      if (selectedDeptId !== 'ALL' && student.departmentId !== selectedDeptId) {
        return false;
      }

      // Search term check
      const query = searchTerm.toLowerCase();
      return (
        student.name.toLowerCase().includes(query) ||
        student.studentId.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
      );
    });
  }, [currentOfferingEnrollments, students, selectedDeptId, searchTerm]);

  // Eligible students for the current offering (from the department-filtered student list)
  const eligibleStudentsForOffering = useMemo(() => {
    if (!currentOffering) return [];
    return departmentStudents.filter(s => {
      const check = checkStudentCourseEligibility(
        s,
        currentOffering,
        currentCourse,
        enrollments,
        departments,
        batches
      );
      return check.eligible;
    });
  }, [departmentStudents, currentOffering, currentCourse, enrollments, departments, batches]);

  // Personalized Course Offerings for active student
  // Dynamically computes eligibility, existing enrollment status, and degree relevance for all courses
  const personalizedCoursesForStudent = useMemo(() => {
    if (!activeStudent) return [];

    return offerings.map(off => {
      const crs = courses.find(c => c.id === off.courseId);
      const bat = batches.find(b => b.id === off.batchId);
      const isEnrolled = enrollments.some(
        e => e.studentId === activeStudent.id && e.courseOfferingId === off.id && e.status === 'ENROLLED'
      );
      const eligibility = checkStudentCourseEligibility(
        activeStudent,
        off,
        crs,
        enrollments,
        departments,
        batches
      );

      // Relevance score: higher if matches student's department and batch
      const isDeptMatch = (off.departmentId || crs?.departmentId) === activeStudent.departmentId;
      const isBatchMatch = off.batchId === activeStudent.batchId;

      return {
        offering: off,
        course: crs,
        batch: bat,
        isEnrolled,
        eligibility,
        isDeptMatch,
        isBatchMatch,
      };
    });
  }, [activeStudent, offerings, courses, batches, enrollments, departments]);

  // Active student's currently enrolled courses
  const studentActiveEnrollments = useMemo(() => {
    if (!activeStudent) return [];
    return enrollments.filter(e => e.studentId === activeStudent.id && e.status === 'ENROLLED');
  }, [activeStudent, enrollments]);

  // Total credits currently taken by active student
  const studentTotalCredits = useMemo(() => {
    return studentActiveEnrollments.reduce((sum, en) => {
      const off = offerings.find(o => o.id === en.courseOfferingId);
      const crs = off ? courses.find(c => c.id === off.courseId) : undefined;
      return sum + (crs?.credit || 0);
    }, 0);
  }, [studentActiveEnrollments, offerings, courses]);

  // Pagination for offering view
  const totalPages = Math.ceil(filteredOfferingEnrollments.length / itemsPerPage) || 1;
  const paginatedEnrollments = filteredOfferingEnrollments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle enrolling student from standard offering view
  const handleEnrollStudentInOffering = (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    setEnrollSuccess(null);

    if (!currentOffering || !enrollStudentSelectId) {
      setEnrollError('Please select a student to enroll.');
      return;
    }

    const res = db.enrollStudent(enrollStudentSelectId, currentOffering.id);
    if (!res.success) {
      setEnrollError(res.message);
    } else {
      const student = students.find(s => s.id === enrollStudentSelectId);
      setEnrollSuccess(`Successfully enrolled ${student?.name} (${student?.studentId}) into ${currentCourse?.code}!`);
      setEnrollStudentSelectId('');
      onRefresh();
      setTimeout(() => setEnrollSuccess(null), 3500);
    }
  };

  // Handle enrolling active student in a specific course offering from personalized view
  const handlePersonalizedEnroll = (offeringId: string) => {
    if (!activeStudent) return;
    setEnrollError(null);
    setEnrollSuccess(null);

    const res = db.enrollStudent(activeStudent.id, offeringId);
    if (!res.success) {
      setEnrollError(res.message);
    } else {
      const targetOff = offerings.find(o => o.id === offeringId);
      const targetCrs = targetOff ? courses.find(c => c.id === targetOff.courseId) : undefined;
      setEnrollSuccess(`Enrolled ${activeStudent.name} into ${targetCrs?.code || 'course'} successfully!`);
      onRefresh();
      setTimeout(() => setEnrollSuccess(null), 3500);
    }
  };

  // Handle unenrollment
  const handleUnenroll = (enrollmentId: string, studentName: string, courseCode?: string) => {
    const code = courseCode || currentCourse?.code || 'course';
    if (window.confirm(`Unenroll student ${studentName} from ${code}?`)) {
      db.unenrollStudent(enrollmentId);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Course Enrollment Administration</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Dynamic course offering assignment, personalized student requirement checks, and department-wise student filtering
          </p>
        </div>

        {/* Dynamic "Selected Course" Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 shrink-0">Selected Course:</span>
          <select
            value={selectedOfferingId}
            onChange={e => {
              setSelectedOfferingId(e.target.value);
              setEnrollStudentSelectId('');
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs text-indigo-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-sm truncate"
          >
            {offerings.map(o => {
              const c = courses.find(crs => crs.id === o.courseId);
              const b = batches.find(bat => bat.id === o.batchId);
              const d = departments.find(dept => dept.id === o.departmentId || dept.id === c?.departmentId);
              const isRelevant = activeStudent
                ? (o.departmentId || c?.departmentId) === activeStudent.departmentId
                : true;

              return (
                <option key={o.id} value={o.id}>
                  {c?.code} - {c?.name} ({c?.type} • {c?.credit} Cr) • {b?.name || d?.code} {isRelevant && activeStudent ? '★' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* DEPARTMENT-WISE STUDENT FILTERING BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-xs">Department-Wise Student Filtering</h4>
          </div>
          <span className="text-[11px] text-slate-500">
            Click any department to filter registered students & enrollment eligibility
          </span>
        </div>

        {/* Clickable Department Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedDeptId('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              selectedDeptId === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <span>All Departments</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedDeptId === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {departmentCounts['ALL'] || 0}
            </span>
          </button>

          {departments.map(dept => {
            const isSelected = selectedDeptId === dept.id;
            const count = departmentCounts[dept.id] || 0;

            return (
              <button
                key={dept.id}
                onClick={() => {
                  setSelectedDeptId(dept.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <span>{dept.code}</span>
                <span className="text-[10px] font-normal opacity-80 hidden sm:inline">({dept.name.split(' ')[0]})</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PERSONALIZED STUDENT ENROLLMENT & DEGREE REQUIREMENTS CONTROLLER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Personalized Student View & Course Eligibility</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select an individual student to dynamically inspect their curriculum requirements and tailored course list
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-600 shrink-0">Select Student:</span>
            <select
              value={personalizedStudentId}
              onChange={e => setPersonalizedStudentId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
            >
              <option value="">-- View All Students / Offering Mode --</option>
              {departmentStudents.map(s => {
                const dept = departments.find(d => d.id === s.departmentId);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentId} • {dept?.code || s.departmentId})
                  </option>
                );
              })}
            </select>
            {personalizedStudentId && (
              <button
                onClick={() => setPersonalizedStudentId('')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs"
                title="Reset to Course Offering View"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Personalized Student Profile & Degree Requirements Card */}
        {activeStudent && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-800/50 space-y-4 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center font-bold text-lg text-indigo-200">
                  {activeStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-base text-white">{activeStudent.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 font-mono">
                      {activeStudent.studentId}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    {departments.find(d => d.id === activeStudent.departmentId)?.name} •{' '}
                    {batches.find(b => b.id === activeStudent.batchId)?.name} (Section {activeStudent.section})
                  </p>
                </div>
              </div>

              {/* Academic Standing & Requirement Badges */}
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] text-indigo-300">Enrolled Courses</div>
                  <div className="font-black text-lg text-white">{studentActiveEnrollments.length}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] text-indigo-300">Total Credits</div>
                  <div className="font-black text-lg text-emerald-300">{studentTotalCredits.toFixed(1)} Cr</div>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] text-indigo-300">Academic Standing</div>
                  <div className="font-black text-xs text-cyan-300 uppercase tracking-wide mt-1">Eligible</div>
                </div>
              </div>
            </div>

            {/* Personalized Course Offerings Table for this Student */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-200 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Curriculum Course Offerings & Requirement Analysis for {activeStudent.name}</span>
                </span>
                <span className="text-[11px] text-indigo-300">
                  Only displaying courses matching student's syllabus
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-white/10 text-indigo-200 font-semibold border-b border-white/10">
                    <tr>
                      <th className="py-2 px-3">Course Code & Title</th>
                      <th className="py-2 px-3">Type & Credit</th>
                      <th className="py-2 px-3">Curriculum Level</th>
                      <th className="py-2 px-3">Requirement & Eligibility Status</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {personalizedCoursesForStudent
                      .filter(item => item.isDeptMatch)
                      .map(item => {
                        const { offering, course, batch, isEnrolled, eligibility } = item;

                        return (
                          <tr key={offering.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-indigo-300 mr-2">{course?.code}</span>
                              <span className="text-white font-medium">{course?.name}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-200">
                                {course?.type} • {course?.credit} Cr
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                              {batch?.name || `Year ${offering.year}, Sem ${offering.semester}`}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEnrolled ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <Check className="w-3 h-3" />
                                  <span>Currently Enrolled</span>
                                </span>
                              ) : eligibility.eligible ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Meets All Prerequisites</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  title={eligibility.reason}
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{eligibility.code.replace('_', ' ')}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isEnrolled ? (
                                <button
                                  onClick={() => {
                                    const record = enrollments.find(
                                      e => e.studentId === activeStudent.id && e.courseOfferingId === offering.id && e.status === 'ENROLLED'
                                    );
                                    if (record) handleUnenroll(record.id, activeStudent.name, course?.code);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition"
                                >
                                  Unenroll
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePersonalizedEnroll(offering.id)}
                                  disabled={!eligibility.eligible}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-xs transition disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  Enroll Now
                                </button>
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
        )}
      </div>

      {/* Selected Offering Info Header Card */}
      {currentOffering && (
        <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-slate-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-black text-indigo-800 text-sm">{currentCourse?.code}</span>
              <span className="font-bold text-slate-900">{currentCourse?.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200">
                {currentCourse?.type} • {currentCourse?.credit} Credits
              </span>
            </div>
            <div className="text-slate-600 mt-1">
              Department: <strong>{departments.find(d => d.id === currentOffering.departmentId || d.id === currentCourse?.departmentId)?.name || 'Academic Dept'}</strong> • Cohort: <strong>{currentBatch?.name}</strong> • Year {currentOffering.year}, Semester {currentOffering.semester} (Section {currentOffering.section})
            </div>
          </div>
          <div className="flex items-center space-x-3 text-slate-700 font-semibold shrink-0">
            <div>
              Total Enrolled in Course: <span className="font-mono font-bold text-indigo-700 text-sm">{currentOfferingEnrollments.length}</span> students
            </div>
          </div>
        </div>
      )}

      {/* Enroll Eligible Student Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
          <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
          <span>Enroll Student in {currentCourse?.code || 'Selected Course Offering'}</span>
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

        <form onSubmit={handleEnrollStudentInOffering} className="flex flex-col sm:flex-row gap-3 text-xs">
          <div className="flex-1">
            <select
              value={enrollStudentSelectId}
              onChange={e => setEnrollStudentSelectId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">
                {eligibleStudentsForOffering.length > 0
                  ? `-- Select Eligible Student (${eligibleStudentsForOffering.length} available${selectedDeptId !== 'ALL' ? ' in ' + departments.find(d => d.id === selectedDeptId)?.code : ''}) --`
                  : 'All eligible students in this filtered cohort are already enrolled'}
              </option>
              {eligibleStudentsForOffering.map(s => {
                const dept = departments.find(d => d.id === s.departmentId);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentId} • {dept?.code} • Sec {s.section})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="submit"
            disabled={!enrollStudentSelectId}
            className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center space-x-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll Student</span>
          </button>
        </form>
      </div>

      {/* Currently Enrolled Students Table with Department Separation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <h4 className="font-bold text-slate-900 text-xs">
              Registered Students in {currentCourse?.code}
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              ({filteredOfferingEnrollments.length} {selectedDeptId !== 'ALL' ? `${departments.find(d => d.id === selectedDeptId)?.code} ` : ''}students)
            </span>
            {selectedDeptId !== 'ALL' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Filtered by {departments.find(d => d.id === selectedDeptId)?.code}
              </span>
            )}
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
              placeholder="Search by name, roll, email..."
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
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Enrollment Date</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No enrolled students found{selectedDeptId !== 'ALL' ? ` for department ${departments.find(d => d.id === selectedDeptId)?.code}` : ''}.
                  </td>
                </tr>
              ) : (
                paginatedEnrollments.map(e => {
                  const student = students.find(s => s.id === e.studentId);
                  const dept = departments.find(d => d.id === student?.departmentId);

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">
                        {student?.studentId}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{student?.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {dept?.code || student?.departmentId}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{student?.email}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {new Date(e.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => setPersonalizedStudentId(student?.id || '')}
                          className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition"
                          title="Open personalized student requirements view"
                        >
                          Personal View
                        </button>
                        <button
                          onClick={() => handleUnenroll(e.id, student?.name || 'Student')}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors align-middle"
                          title="Unenroll Student"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
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
            Showing {filteredOfferingEnrollments.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredOfferingEnrollments.length)} of {filteredOfferingEnrollments.length} students
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
