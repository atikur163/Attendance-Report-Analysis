import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Power,
  Shield,
  BookOpen,
} from 'lucide-react';
import { db } from '../../services/db';
import { Teacher, Course, Department, CourseOffering, Batch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { NotificationService } from '../../services/notificationService';

interface AdminTeacherManagementProps {
  teachers: Teacher[];
  courses: Course[];
  departments: Department[];
  offerings: CourseOffering[];
  batches: Batch[];
  onRefresh: () => void;
}

export const AdminTeacherManagement: React.FC<AdminTeacherManagementProps> = ({
  teachers,
  courses,
  departments,
  offerings,
  batches,
  onRefresh,
}) => {
  const { createManagedAccount, sendPasswordReset } = useAuth();

  // Search, filter, pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // Selected Teacher for Edit or Delete
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Add Teacher Form
  const [addTeacherId, setAddTeacherId] = useState('');
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addDeptId, setAddDeptId] = useState(departments[0]?.id || 'dept-cse');
  const [addDesignation, setAddDesignation] = useState('Assistant Professor');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('Teacher@1234');
  const [addAuthorizedCourseIds, setAddAuthorizedCourseIds] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Teacher Form
  const [editName, setEditName] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAuthorizedCourseIds, setEditAuthorizedCourseIds] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  // Feedback notifications
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Teacher Assignment Form (Rule 10)
  const [assignTeacherId, setAssignTeacherId] = useState(teachers[0]?.id || '');
  const [assignOfferingId, setAssignOfferingId] = useState(offerings[0]?.id || '');
  const [assignError, setAssignError] = useState<string | null>(null);

  const assignments = db.getTeacherAssignments();

  // Filtered teachers list
  const filteredTeachers = teachers.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.teacherId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.designation.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = filterDept === 'ALL' || t.departmentId === filterDept;
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage) || 1;
  const paginatedTeachers = filteredTeachers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenEdit = (t: Teacher) => {
    setSelectedTeacher(t);
    setEditName(t.name);
    setEditDeptId(t.departmentId);
    setEditDesignation(t.designation);
    setEditPhone(t.phone || '');
    setEditAuthorizedCourseIds(t.authorizedCourseIds || []);
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    if (!editName.trim()) {
      setEditError('Teacher name cannot be empty.');
      return;
    }

    const updated = db.updateTeacher(selectedTeacher.id, {
      name: editName.trim(),
      departmentId: editDeptId,
      designation: editDesignation,
      phone: editPhone.trim() || undefined,
      authorizedCourseIds: editAuthorizedCourseIds,
    });

    if (updated) {
      setEditModalOpen(false);
      setActionNotice({ type: 'success', text: `Faculty profile for ${updated.name} updated successfully.` });
      setTimeout(() => setActionNotice(null), 3500);
      onRefresh();
    }
  };

  const handleToggleStatus = (t: Teacher) => {
    const newStatus = t.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    db.updateTeacher(t.id, { status: newStatus });
    setActionNotice({
      type: 'success',
      text: `Teacher ${t.name} is now ${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'}.`,
    });
    setTimeout(() => setActionNotice(null), 3500);
    onRefresh();
  };

  const handleConfirmDelete = () => {
    if (!selectedTeacher) return;
    const teacherName = selectedTeacher.name;
    const success = db.deleteTeacher(selectedTeacher.id);
    setDeleteModalOpen(false);
    setSelectedTeacher(null);

    if (success) {
      setActionNotice({ type: 'success', text: `Teacher ${teacherName} and all assigned routine links removed.` });
    } else {
      setActionNotice({ type: 'error', text: `Failed to remove teacher record.` });
    }
    setTimeout(() => setActionNotice(null), 3500);
    onRefresh();
  };

  const handleSendResetLink = async (email: string) => {
    const res = await sendPasswordReset(email);
    if (res.success) {
      setActionNotice({ type: 'success', text: `Password setup link sent to ${email}.` });
    } else {
      setActionNotice({ type: 'error', text: res.error || 'Failed to dispatch email.' });
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    // Validation
    const cleanId = addTeacherId.trim();
    const cleanName = addName.trim();
    const cleanEmail = addEmail.trim().toLowerCase();

    if (!cleanId || !cleanName || !cleanEmail || !addPassword) {
      setAddError('All mandatory fields (Teacher ID, Name, Email, Password) must be provided.');
      return;
    }

    if (db.isTeacherIdTaken(cleanId)) {
      setAddError(`Teacher ID / Code "${cleanId}" is already registered. Please use a distinct ID.`);
      return;
    }

    if (db.isEmailTaken(cleanEmail)) {
      setAddError(`Email "${cleanEmail}" is already associated with an existing student or teacher.`);
      return;
    }

    if (addPassword.length < 6) {
      setAddError('Temporary password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    // Step 1: Save Teacher Entity Profile in Database
    const newTeacher = db.addTeacher({
      teacherId: cleanId,
      name: cleanName,
      email: cleanEmail,
      departmentId: addDeptId,
      designation: addDesignation,
      phone: addPhone.trim() || undefined,
      status: 'ACTIVE',
      authorizedCourseIds: addAuthorizedCourseIds,
    });

    // Step 2: Create Firebase Auth Account via Privileged Secondary Helper with canonical teacher id
    const authResult = await createManagedAccount({
      role: 'TEACHER',
      email: cleanEmail,
      temporaryPassword: addPassword,
      displayName: cleanName,
      entityId: newTeacher.id,
    });

    if (!authResult.success) {
      db.deleteTeacher(newTeacher.id);
      setAddError(authResult.error || 'Authentication account creation failed.');
      setIsSubmitting(false);
      return;
    }

    if (authResult.uid) {
      db.updateTeacher(newTeacher.id, { authUid: authResult.uid });
    }

    // Auto-allocate teacher to matching active course offerings for authorized courses
    if (addAuthorizedCourseIds.length > 0) {
      for (const courseId of addAuthorizedCourseIds) {
        const matchingOfferings = offerings.filter(o => o.courseId === courseId);
        for (const off of matchingOfferings) {
          db.assignTeacherToOffering(newTeacher.id, off.id);
        }
      }
    }

    // Step 3: Send real email notification with account credentials, ID, assigned courses, and routine schedule
    const assignedCourses = courses.filter(c => addAuthorizedCourseIds.includes(c.id));
    const routineEntries = db.getRoutines().filter(r => r.teacherId === newTeacher.id);

    const emailRes = await NotificationService.sendTeacherAccountCreatedEmail({
      teacher: newTeacher,
      temporaryPassword: addPassword,
      assignedCourses,
      routineEntries,
    });

    setIsSubmitting(false);

    const emailNotice =
      emailRes.status === 'SENT'
        ? `Credentials & schedule delivered to ${cleanEmail}`
        : `Email queued (${emailRes.status === 'CONFIG_REQUIRED' ? 'SMTP configuration pending in .env' : emailRes.message})`;

    setAddSuccess(`Teacher ${newTeacher.name} successfully created! ${emailNotice}`);
    onRefresh();

    // Reset inputs
    setTimeout(() => {
      setAddModalOpen(false);
      setAddSuccess(null);
      setAddTeacherId('');
      setAddName('');
      setAddEmail('');
      setAddPhone('');
      setAddAuthorizedCourseIds([]);
    }, 2500);
  };

  const handleAssignTeacher = () => {
    setAssignError(null);
    const result = db.assignTeacherToOffering(assignTeacherId, assignOfferingId);
    if (!result.success) {
      setAssignError(result.message);
    } else {
      setAssignModalOpen(false);
      setActionNotice({ type: 'success', text: 'Teacher course assignment recorded successfully.' });
      setTimeout(() => setActionNotice(null), 3500);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Controls Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Faculty Members Directory & Credentials</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin management of teacher accounts, credential provisioning, and authorized courses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAssignModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Course Allocation</span>
          </button>

          <button
            onClick={() => {
              setAddError(null);
              setAddSuccess(null);
              setAddModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Faculty Member</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search teacher by name, faculty code, email, designation..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filterDept}
            onChange={e => {
              setFilterDept(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => {
              setFilterStatus(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Accounts</option>
            <option value="INACTIVE">Deactivated Accounts</option>
          </select>
        </div>
      </div>

      {/* Teachers Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Faculty ID</th>
                <th className="py-3 px-4">Teacher Name & Email</th>
                <th className="py-3 px-4">Department & Rank</th>
                <th className="py-3 px-4">Authorized Courses</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No faculty members found matching your search criteria.
                  </td>
                </tr>
              ) : (
                paginatedTeachers.map(t => {
                  const dept = departments.find(d => d.id === t.departmentId);
                  const authCourses = courses.filter(c => t.authorizedCourseIds.includes(c.id));

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {t.teacherId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{t.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{t.designation}</div>
                        <div className="text-[11px] text-slate-400">{dept?.code} Dept</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {authCourses.length > 0 ? (
                            authCourses.map(c => (
                              <span
                                key={c.id}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                              >
                                {c.code}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">None assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              t.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => handleSendResetLink(t.email)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Send Password Reset Link"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(t)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              t.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={t.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Teacher Information"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedTeacher(t);
                              setDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Teacher Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredTeachers.length)} of {filteredTeachers.length} faculty members
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

      {/* Course Assignments Policy Section (Prompt Section 10) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h4 className="font-bold text-slate-900 text-xs">Course Offerings & Teacher Allocations</h4>
            <p className="text-[11px] text-slate-500">
              Validates that teachers teach maximum 1 regular/theory course in a semester + batch (Rule 10).
            </p>
          </div>
          <button
            onClick={() => setAssignModalOpen(true)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Allocation</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Faculty Member</th>
                <th className="py-2.5 px-4">Assigned Course</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Batch / Semester</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map(ta => {
                const teacher = teachers.find(t => t.id === ta.teacherId);
                const off = offerings.find(o => o.id === ta.courseOfferingId);
                const crs = off ? courses.find(c => c.id === off.courseId) : undefined;
                const batch = off ? batches.find(b => b.id === off.batchId) : undefined;

                return (
                  <tr key={ta.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{teacher?.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-indigo-700 mr-1.5">{crs?.code}</span>
                      <span className="text-slate-700 font-medium">{crs?.name}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          crs?.type === 'THEORY' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {crs?.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {batch?.name} • Year {off?.year} Sem {off?.semester}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {ta.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => {
                          db.removeTeacherAssignment(ta.id);
                          onRefresh();
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remove Assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= ADD TEACHER MODAL ================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Faculty Member</h3>
                  <p className="text-[11px] text-slate-500">Creates secure Firebase Auth account & university record</p>
                </div>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            {addSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{addSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeacher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Faculty Code / ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addTeacherId}
                    onChange={e => setAddTeacherId(e.target.value)}
                    placeholder="e.g. TCH-103"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder="e.g. Dr. Salman F. Rahman"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                    placeholder="teacher@mbstu.ac.bd"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={addDeptId}
                    onChange={e => setAddDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <select
                    value={addDesignation}
                    onChange={e => setAddDesignation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="Professor & Head">Professor & Head</option>
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={addPhone}
                    onChange={e => setAddPhone(e.target.value)}
                    placeholder="+880 1711-000000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Initial Authentication Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={addPassword}
                    onChange={e => setAddPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setAddPassword('TchPass@' + Math.floor(Math.random() * 9000 + 1000))}
                    className="absolute right-2 top-2 text-[10px] text-indigo-600 font-semibold hover:underline"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Authorized Courses to Teach</label>
                <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                  {courses.map(c => {
                    const isChecked = addAuthorizedCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-2 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setAddAuthorizedCourseIds(prev => [...prev, c.id]);
                            } else {
                              setAddAuthorizedCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span className="font-mono font-bold text-indigo-700">{c.code}</span>
                        <span className="text-slate-700 truncate">{c.name}</span>
                        <span className="text-slate-400">({c.type})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Provisioning Account...' : 'Create Faculty Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT TEACHER MODAL ================= */}
      {editModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Faculty Profile: {selectedTeacher.teacherId}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <select
                    value={editDesignation}
                    onChange={e => setEditDesignation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="Professor & Head">Professor & Head</option>
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={editDeptId}
                    onChange={e => setEditDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Authorized Courses to Teach</label>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                  {courses.map(c => {
                    const isChecked = editAuthorizedCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-2 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setEditAuthorizedCourseIds(prev => [...prev, c.id]);
                            } else {
                              setEditAuthorizedCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600"
                        />
                        <span className="font-mono font-bold text-indigo-700">{c.code}</span>
                        <span className="text-slate-700 truncate">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {deleteModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Delete Faculty Account?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong>{selectedTeacher.name}</strong> ({selectedTeacher.teacherId})?
              This will permanently revoke all teaching allocations and routine lectures associated with this faculty member.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedTeacher(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TEACHER ASSIGNMENT MODAL (RULE 10) ================= */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Assign Teacher to Course Offering</h3>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Policy 10: Validates course eligibility and the 1-regular-theory course limit per batch & semester.
            </p>

            {assignError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                {assignError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Faculty Member</label>
                <select
                  value={assignTeacherId}
                  onChange={e => setAssignTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.teacherId} • {t.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Course Offering</label>
                <select
                  value={assignOfferingId}
                  onChange={e => setAssignOfferingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  {offerings.map(o => {
                    const c = courses.find(crs => crs.id === o.courseId);
                    const b = batches.find(bat => bat.id === o.batchId);
                    return (
                      <option key={o.id} value={o.id}>
                        {c?.code} - {c?.name} ({c?.type}) • {b?.name}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTeacher}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                Record Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
