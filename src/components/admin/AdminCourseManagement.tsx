import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { Course, CourseOffering, CourseType, Department, Batch, AcademicSession } from '../../types';
import { db } from '../../services/db';

interface AdminCourseManagementProps {
  courses: Course[];
  offerings: CourseOffering[];
  departments: Department[];
  batches: Batch[];
  sessions: AcademicSession[];
  onRefresh: () => void;
}

export const AdminCourseManagement: React.FC<AdminCourseManagementProps> = ({
  courses,
  offerings,
  departments,
  batches,
  sessions,
  onRefresh,
}) => {
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | CourseType>('ALL');
  const [filterYearSem, setFilterYearSem] = useState('ALL');

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Add / Edit Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<CourseType>('THEORY');
  const [credit, setCredit] = useState<number>(3.0);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || 'dept-cse');
  const [year, setYear] = useState<number>(1);
  const [semester, setSemester] = useState<number>(1);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [autoCreateOffering, setAutoCreateOffering] = useState(true);
  const [plannedClasses, setPlannedClasses] = useState(35);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filtered courses
  const filteredCourses = courses.filter(c => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || c.type === filterType;
    const matchesYearSem = filterYearSem === 'ALL' || `Y${c.year}S${c.semester}` === filterYearSem;
    return matchesSearch && matchesType && matchesYearSem;
  });

  const handleOpenAdd = () => {
    setCode('');
    setName('');
    setType('THEORY');
    setCredit(3.0);
    setDepartmentId(departments[0]?.id || 'dept-cse');
    setYear(1);
    setSemester(1);
    setStatus('ACTIVE');
    setAutoCreateOffering(true);
    setPlannedClasses(35);
    setFormError(null);
    setFormSuccess(null);
    setAddModalOpen(true);
  };

  const handleOpenEdit = (c: Course) => {
    setSelectedCourse(c);
    setCode(c.code);
    setName(c.name);
    setType(c.type);
    setCredit(c.credit);
    setDepartmentId(c.departmentId);
    setYear(c.year);
    setSemester(c.semester);
    setStatus(c.status);
    setFormError(null);
    setFormSuccess(null);
    setEditModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || !cleanName) {
      setFormError('Course code and course name are required.');
      return;
    }

    if (db.isCourseCodeTaken(cleanCode)) {
      setFormError(`Course code "${cleanCode}" is already registered. Please specify a unique code.`);
      return;
    }

    if (credit <= 0) {
      setFormError('Course credit must be greater than zero.');
      return;
    }

    // 1. Add Course to DB & Cloud Firestore
    const newCourse = db.addCourse({
      code: cleanCode,
      name: cleanName,
      type,
      credit: Number(credit),
      departmentId,
      year: Number(year),
      semester: Number(semester),
      status,
    });

    // 2. Optionally create course offering for current batch
    if (autoCreateOffering) {
      const currentSession = sessions.find(s => s.isCurrent) || sessions[0];
      const deptBatches = db.getBatchesByDepartment(departmentId);
      const matchingBatch =
        deptBatches.find(b => b.currentYear === Number(year) && b.currentSemester === Number(semester)) ||
        deptBatches[0] ||
        db.ensureBatchesForDepartment(departmentId)[0];

      if (currentSession && matchingBatch) {
        db.addCourseOffering({
          courseId: newCourse.id,
          departmentId,
          academicSessionId: currentSession.id,
          batchId: matchingBatch.id,
          year: Number(year),
          semester: Number(semester),
          section: 'A',
          plannedClasses: Number(plannedClasses) || (type === 'LAB' ? 14 : 35),
          status: 'ACTIVE',
        });
      }
    }

    setFormSuccess(`Course ${newCourse.code} created successfully!`);
    onRefresh();

    setTimeout(() => {
      setAddModalOpen(false);
      setFormSuccess(null);
    }, 1200);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setFormError(null);

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || !cleanName) {
      setFormError('Course code and course name cannot be blank.');
      return;
    }

    if (db.isCourseCodeTaken(cleanCode, selectedCourse.id)) {
      setFormError(`Course code "${cleanCode}" is already in use by another course.`);
      return;
    }

    const updated = db.updateCourse(selectedCourse.id, {
      code: cleanCode,
      name: cleanName,
      type,
      credit: Number(credit),
      departmentId,
      year: Number(year),
      semester: Number(semester),
      status,
    });

    if (updated) {
      setFormSuccess(`Course ${updated.code} updated successfully.`);
      onRefresh();
      setTimeout(() => {
        setEditModalOpen(false);
        setFormSuccess(null);
      }, 1200);
    }
  };

  const handleConfirmDelete = () => {
    if (!selectedCourse) return;
    db.deleteCourse(selectedCourse.id);
    setDeleteModalOpen(false);
    setSelectedCourse(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Course Catalog Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header matching image exactly */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Course Catalog</h3>
            <p className="text-xs text-slate-500">
              Definitions of semester-specific theory and lab courses
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Total: {courses.length} courses
            </span>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Course</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code or title (e.g. CSE-1101)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-medium">Type:</span>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Types</option>
                <option value="THEORY">Theory</option>
                <option value="LAB">Lab</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-medium">Level:</span>
              <select
                value={filterYearSem}
                onChange={e => setFilterYearSem(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Semesters</option>
                <option value="Y1S1">Year 1, Sem 1</option>
                <option value="Y1S2">Year 1, Sem 2</option>
                <option value="Y2S1">Year 2, Sem 1</option>
                <option value="Y2S2">Year 2, Sem 2</option>
                <option value="Y3S1">Year 3, Sem 1</option>
                <option value="Y3S2">Year 3, Sem 2</option>
                <option value="Y4S1">Year 4, Sem 1</option>
                <option value="Y4S2">Year 4, Sem 2</option>
              </select>
            </div>
          </div>
        </div>

        {/* Courses Table (Exact UI matching screenshot) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-4">Course Code</th>
                <th className="py-3 px-4">Course Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Credit</th>
                <th className="py-3 px-4">Year & Semester</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No courses match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCourses.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-indigo-700 font-mono text-[13px]">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.type === 'THEORY'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {c.credit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      Year {c.year}, Sem {c.semester}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          title="Edit course"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCourse(c);
                            setDeleteModalOpen(true);
                          }}
                          title="Delete course"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD COURSE MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Add New University Course</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE-3201"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Format: DEPT-XXXX</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Type <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setType('THEORY');
                        if (credit === 1.5) setCredit(3.0);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        type === 'THEORY'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      THEORY
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setType('LAB');
                        if (credit === 3.0) setCredit(1.5);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        type === 'LAB'
                          ? 'bg-white text-purple-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      LAB
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Course Name / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operating Systems & System Programming"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Credit Units <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="6.0"
                    required
                    value={credit}
                    onChange={e => setCredit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Year Level</label>
                  <select
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={semester}
                    onChange={e => setSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Automatic Offering Checkbox */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-indigo-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateOffering}
                    onChange={e => setAutoCreateOffering(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>Automatically open active Course Offering for current batch cohort</span>
                </label>

                {autoCreateOffering && (
                  <div className="flex items-center space-x-2 pl-6">
                    <span className="text-[11px] text-slate-600">Planned Classes:</span>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={plannedClasses}
                      onChange={e => setPlannedClasses(Number(e.target.value))}
                      className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                >
                  Save & Register Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COURSE MODAL */}
      {editModalOpen && selectedCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Edit Course: {selectedCourse.code}</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Credits</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="6.0"
                    required
                    value={credit}
                    onChange={e => setCredit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Year</label>
                  <select
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={semester}
                    onChange={e => setSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && selectedCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Delete Course?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <span className="font-bold font-mono text-slate-800">{selectedCourse.code}</span> ({selectedCourse.name})?
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                Yes, Delete Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
