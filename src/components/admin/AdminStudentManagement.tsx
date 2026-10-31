import React, { useState } from 'react';
import {
  GraduationCap,
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
  Camera,
} from 'lucide-react';
import { db } from '../../services/db';
import { Student, Department, Batch, AcademicSession } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { NotificationService } from '../../services/notificationService';

interface AdminStudentManagementProps {
  students: Student[];
  departments: Department[];
  batches: Batch[];
  sessions: AcademicSession[];
  onRefresh: () => void;
}

export const AdminStudentManagement: React.FC<AdminStudentManagementProps> = ({
  students,
  departments,
  batches,
  sessions,
  onRefresh,
}) => {
  const { createManagedAccount, sendPasswordReset } = useAuth();

  // Search & Filter & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBatch, setFilterBatch] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Selected Student
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Add Student Form State
  const [addStudentId, setAddStudentId] = useState('');
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addDeptId, setAddDeptId] = useState(departments[0]?.id || 'dept-cse');
  const [addSessionId, setAddSessionId] = useState(sessions[0]?.id || 'sess-2025-2026');
  const [addBatchId, setAddBatchId] = useState(batches[0]?.id || 'batch-2026');
  const [addYear, setAddYear] = useState(1);
  const [addSemester, setAddSemester] = useState(1);
  const [addSection, setAddSection] = useState('A');
  const [addPassword, setAddPassword] = useState('Student@1234');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Student Form State
  const [editName, setEditName] = useState('');
  const [editYear, setEditYear] = useState(1);
  const [editSemester, setEditSemester] = useState(1);
  const [editSection, setEditSection] = useState('A');
  const [editBatchId, setEditBatchId] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Feedback Notification
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtered Students
  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBatch = filterBatch === 'ALL' || s.batchId === filterBatch;
    const matchesDept = filterDept === 'ALL' || s.departmentId === filterDept;
    const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus;

    return matchesSearch && matchesBatch && matchesDept && matchesStatus;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenEdit = (s: Student) => {
    setSelectedStudent(s);
    setEditName(s.name);
    setEditYear(s.year);
    setEditSemester(s.semester);
    setEditSection(s.section);
    setEditBatchId(s.batchId);
    setEditDeptId(s.departmentId);
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!editName.trim()) {
      setEditError('Student name cannot be empty.');
      return;
    }

    const updated = db.updateStudent(selectedStudent.id, {
      name: editName.trim(),
      year: Number(editYear),
      semester: Number(editSemester),
      section: editSection.trim(),
      batchId: editBatchId,
      departmentId: editDeptId,
    });

    if (updated) {
      setEditModalOpen(false);
      setActionNotice({ type: 'success', text: `Student record for ${updated.name} updated successfully.` });
      setTimeout(() => setActionNotice(null), 3500);
      onRefresh();
    }
  };

  const handleToggleStatus = (s: Student) => {
    const newStatus = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    db.updateStudent(s.id, { status: newStatus as any });
    setActionNotice({
      type: 'success',
      text: `Student ${s.name} (${s.studentId}) is now ${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'}.`,
    });
    setTimeout(() => setActionNotice(null), 3500);
    onRefresh();
  };

  const handleConfirmDelete = () => {
    if (!selectedStudent) return;
    const name = selectedStudent.name;
    const roll = selectedStudent.studentId;
    const success = db.deleteStudent(selectedStudent.id);
    setDeleteModalOpen(false);
    setSelectedStudent(null);

    if (success) {
      setActionNotice({ type: 'success', text: `Student ${name} (${roll}) removed from the system.` });
    } else {
      setActionNotice({ type: 'error', text: 'Failed to delete student record.' });
    }
    setTimeout(() => setActionNotice(null), 3500);
    onRefresh();
  };

  const handleSendResetLink = async (email: string) => {
    const res = await sendPasswordReset(email);
    if (res.success) {
      setActionNotice({ type: 'success', text: `Password setup email sent to ${email}.` });
    } else {
      setActionNotice({ type: 'error', text: res.error || 'Failed to dispatch email.' });
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    const cleanRoll = addStudentId.trim();
    const cleanName = addName.trim();
    const cleanEmail = addEmail.trim().toLowerCase();

    if (!cleanRoll || !cleanName || !cleanEmail || !addPassword) {
      setAddError('Please fill in all mandatory fields.');
      return;
    }

    if (db.isStudentIdTaken(cleanRoll)) {
      setAddError(`Student ID / Roll "${cleanRoll}" is already registered.`);
      return;
    }

    if (db.isEmailTaken(cleanEmail)) {
      setAddError(`Email "${cleanEmail}" is already in use by another user.`);
      return;
    }

    if (addPassword.length < 6) {
      setAddError('Temporary password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    // Step 1: Store Student Entity in Database
    const newStudent = db.addStudent({
      studentId: cleanRoll,
      name: cleanName,
      email: cleanEmail,
      departmentId: addDeptId,
      academicSessionId: addSessionId,
      batchId: addBatchId,
      year: Number(addYear),
      semester: Number(addSemester),
      section: addSection.trim(),
      status: 'ACTIVE',
      hasFaceProfile: false,
    });

    // Step 2: Create Firebase Auth Account via Secondary Admin Instance with canonical student id
    const authResult = await createManagedAccount({
      role: 'STUDENT',
      email: cleanEmail,
      temporaryPassword: addPassword,
      displayName: cleanName,
      entityId: newStudent.id,
    });

    if (!authResult.success) {
      db.deleteStudent(newStudent.id);
      setAddError(authResult.error || 'Authentication account creation failed.');
      setIsSubmitting(false);
      return;
    }

    if (authResult.uid) {
      db.updateStudent(newStudent.id, { authUid: authResult.uid });
    }

    // Step 3: Dispatch real account credentials email
    const dept = departments.find(d => d.id === addDeptId);
    const batch = batches.find(b => b.id === addBatchId);

    const emailRes = await NotificationService.sendStudentAccountCreatedEmail({
      student: newStudent,
      temporaryPassword: addPassword,
      departmentName: dept?.name || 'Computer Science & Engineering',
      batchName: batch?.name || 'Current Academic Cohort',
    });

    setIsSubmitting(false);

    const emailNotice =
      emailRes.status === 'SENT'
        ? `Credentials delivered to ${cleanEmail}`
        : `Email queued (${emailRes.status === 'CONFIG_REQUIRED' ? 'SMTP configuration pending in .env' : emailRes.message})`;

    setAddSuccess(`Student ${newStudent.name} (${newStudent.studentId}) registered! ${emailNotice}`);
    onRefresh();

    setTimeout(() => {
      setAddModalOpen(false);
      setAddSuccess(null);
      setAddStudentId('');
      setAddName('');
      setAddEmail('');
    }, 2500);
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

      {/* Top Banner & Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>Enrolled Students Directory & Management</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin registration, credential provisioning, profile editing, and status controls
          </p>
        </div>

        <button
          onClick={() => {
            setAddError(null);
            setAddSuccess(null);
            setAddModalOpen(true);
          }}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register New Student</span>
        </button>
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
            placeholder="Search student by name, student roll/ID, email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filterBatch}
            onChange={e => {
              setFilterBatch(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Batches</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

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
                {d.code}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Deactivated</option>
            <option value="DROPOUT">Dropout</option>
            <option value="GRADUATED">Graduated</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student ID / Roll</th>
                <th className="py-3 px-4">Student Name & Email</th>
                <th className="py-3 px-4">Batch & Department</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">Biometric Status</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No student records found matching current criteria.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map(s => {
                  const batch = batches.find(b => b.id === s.batchId);
                  const dept = departments.find(d => d.id === s.departmentId);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {s.studentId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{s.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{batch?.name}</div>
                        <div className="text-[11px] text-slate-400">{dept?.code} Dept • Sec {s.section}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        Year {s.year}, Sem {s.semester}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.hasFaceProfile
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-amber-50 text-amber-700 border border-amber-300'
                          }`}
                        >
                          <Camera className="w-3 h-3 mr-0.5" />
                          <span>{s.hasFaceProfile ? 'Face Enrolled' : 'Not Enrolled'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : s.status === 'INACTIVE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => handleSendResetLink(s.email)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Send Password Reset Email"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(s)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              s.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={s.status === 'ACTIVE' ? 'Deactivate Student Account' : 'Activate Student Account'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Student Information"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedStudent(s);
                              setDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Student Record"
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
            {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
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

      {/* ================= REGISTER STUDENT MODAL ================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Register New Student</h3>
                  <p className="text-[11px] text-slate-500">Creates secure Firebase Auth login & student record</p>
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

            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Student Roll / ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addStudentId}
                    onChange={e => setAddStudentId(e.target.value)}
                    placeholder="e.g. IT-24027"
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
                    placeholder="e.g. Shakil Ahmed"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    University Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                    placeholder="student@mbstu.ac.bd"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={addDeptId}
                    onChange={e => {
                      const newDept = e.target.value;
                      setAddDeptId(newDept);
                      const matching = batches.filter(b => b.departmentId === newDept);
                      if (matching.length > 0) {
                        setAddBatchId(matching[0].id);
                      }
                    }}
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
                  <label className="block text-slate-700 font-semibold mb-1">Batch Cohort</label>
                  <select
                    value={addBatchId}
                    onChange={e => setAddBatchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {(batches.filter(b => b.departmentId === addDeptId).length > 0
                      ? batches.filter(b => b.departmentId === addDeptId)
                      : batches
                    ).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Academic Session</label>
                  <select
                    value={addSessionId}
                    onChange={e => setAddSessionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Year</label>
                  <select
                    value={addYear}
                    onChange={e => setAddYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={addSemester}
                    onChange={e => setAddSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    value={addSection}
                    onChange={e => setAddSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
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
                    onClick={() => setAddPassword('StuPass@' + Math.floor(Math.random() * 9000 + 1000))}
                    className="absolute right-2 top-2 text-[10px] text-indigo-600 font-semibold hover:underline"
                  >
                    Generate
                  </button>
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
                  {isSubmitting ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT STUDENT MODAL ================= */}
      {editModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Student Profile: {selectedStudent.studentId}
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
                <label className="block text-slate-700 font-semibold mb-1">Student Full Name</label>
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
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={editDeptId}
                    onChange={e => {
                      const newDept = e.target.value;
                      setEditDeptId(newDept);
                      const matching = batches.filter(b => b.departmentId === newDept);
                      if (matching.length > 0) {
                        setEditBatchId(matching[0].id);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cohort Batch</label>
                  <select
                    value={editBatchId}
                    onChange={e => setEditBatchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {(batches.filter(b => b.departmentId === editDeptId).length > 0
                      ? batches.filter(b => b.departmentId === editDeptId)
                      : batches
                    ).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Year</label>
                  <select
                    value={editYear}
                    onChange={e => setEditYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={editSemester}
                    onChange={e => setEditSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    value={editSection}
                    onChange={e => setEditSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
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
      {deleteModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Delete Student Record?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong>{selectedStudent.name}</strong> ({selectedStudent.studentId})?
              This will remove all course enrollments and facial profile records for this student.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedStudent(null);
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
    </div>
  );
};
