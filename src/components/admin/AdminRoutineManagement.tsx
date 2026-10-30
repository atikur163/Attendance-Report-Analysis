import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  UserCheck,
  BookOpen,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { RoutineEntry, CourseOffering, Course, Teacher, Student } from '../../types';
import { db } from '../../services/db';
import { NotificationService } from '../../services/notificationService';

interface AdminRoutineManagementProps {
  routines: RoutineEntry[];
  offerings: CourseOffering[];
  courses: Course[];
  teachers: Teacher[];
  students: Student[];
  onRefresh: () => void;
}

const DAYS_OF_WEEK: RoutineEntry['dayOfWeek'][] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const AdminRoutineManagement: React.FC<AdminRoutineManagementProps> = ({
  routines,
  offerings,
  courses,
  teachers,
  students,
  onRefresh,
}) => {
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineEntry | null>(null);

  // Form inputs
  const [offeringId, setOfferingId] = useState(offerings[0]?.id || '');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [dayOfWeek, setDayOfWeek] = useState<RoutineEntry['dayOfWeek']>('Sunday');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endTime, setEndTime] = useState('11:00 AM');
  const [room, setRoom] = useState('Room 302');
  const [building, setBuilding] = useState('Faculty of CSE Building');
  const [notifyOnReschedule, setNotifyOnReschedule] = useState(true);

  // Feedback states
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [filterDay, setFilterDay] = useState<string>('ALL');

  const filteredRoutines = routines.filter(r => {
    return filterDay === 'ALL' || r.dayOfWeek === filterDay;
  });

  const handleOpenAdd = () => {
    setOfferingId(offerings[0]?.id || '');
    setTeacherId(teachers[0]?.id || '');
    setDayOfWeek('Sunday');
    setStartTime('10:00 AM');
    setEndTime('11:00 AM');
    setRoom('Room 302');
    setBuilding('Faculty of CSE Building');
    setConflictError(null);
    setActionSuccess(null);
    setAddModalOpen(true);
  };

  const handleOpenEdit = (r: RoutineEntry) => {
    setSelectedRoutine(r);
    setOfferingId(r.courseOfferingId);
    setTeacherId(r.teacherId);
    setDayOfWeek(r.dayOfWeek);
    setStartTime(r.startTime);
    setEndTime(r.endTime);
    setRoom(r.room);
    setBuilding(r.building);
    setConflictError(null);
    setActionSuccess(null);
    setEditModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    const candidate = {
      courseOfferingId: offeringId,
      teacherId,
      dayOfWeek,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      room: room.trim(),
      building: building.trim(),
    };

    // 1. Conflict detection engine
    const conflict = db.checkRoutineConflict(candidate);
    if (conflict.hasConflict) {
      setConflictError(conflict.reason || 'Conflict detected in schedule.');
      return;
    }

    // 2. Add routine
    const newRoutine = db.addRoutine(candidate);
    setActionSuccess('Timetable slot created successfully with no conflicts!');
    onRefresh();

    setTimeout(() => {
      setAddModalOpen(false);
      setActionSuccess(null);
    }, 1200);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoutine) return;
    setConflictError(null);

    const candidate = {
      courseOfferingId: offeringId,
      teacherId,
      dayOfWeek,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      room: room.trim(),
      building: building.trim(),
    };

    // 1. Conflict detection engine (excluding current routine slot)
    const conflict = db.checkRoutineConflict(candidate, selectedRoutine.id);
    if (conflict.hasConflict) {
      setConflictError(conflict.reason || 'Conflict detected in schedule.');
      return;
    }

    const oldScheduleDesc = `${selectedRoutine.dayOfWeek} from ${selectedRoutine.startTime} to ${selectedRoutine.endTime} (Room ${selectedRoutine.room})`;
    const newScheduleDesc = `${candidate.dayOfWeek} from ${candidate.startTime} to ${candidate.endTime} (Room ${candidate.room})`;

    // 2. Update routine in DB & Cloud Firestore
    const updated = db.updateRoutine(selectedRoutine.id, candidate);

    // 3. Automated Reschedule Email Notification if schedule changed
    if (notifyOnReschedule && updated) {
      const offering = offerings.find(o => o.id === updated.courseOfferingId);
      const course = offering ? courses.find(c => c.id === offering.courseId) : undefined;
      const assignedTeacher = teachers.find(t => t.id === updated.teacherId);

      if (course && assignedTeacher) {
        // Notify Teacher
        NotificationService.sendRoutineChangedEmail({
          recipientEmail: assignedTeacher.email,
          recipientName: assignedTeacher.name,
          recipientRole: 'TEACHER',
          courseCode: course.code,
          courseName: course.name,
          oldSchedule: oldScheduleDesc,
          newSchedule: newScheduleDesc,
        });

        // Notify Enrolled Students
        const enrollments = db.getStudentEnrollments().filter(
          en => en.courseOfferingId === updated.courseOfferingId && en.status === 'ENROLLED'
        );
        for (const en of enrollments) {
          const student = students.find(s => s.id === en.studentId);
          if (student) {
            NotificationService.sendRoutineChangedEmail({
              recipientEmail: student.email,
              recipientName: student.name,
              recipientRole: 'STUDENT',
              courseCode: course.code,
              courseName: course.name,
              oldSchedule: oldScheduleDesc,
              newSchedule: newScheduleDesc,
            });
          }
        }
      }
    }

    setActionSuccess('Timetable slot updated and schedule change notifications dispatched!');
    onRefresh();

    setTimeout(() => {
      setEditModalOpen(false);
      setActionSuccess(null);
    }, 1500);
  };

  const handleConfirmDelete = () => {
    if (!selectedRoutine) return;
    db.deleteRoutine(selectedRoutine.id);
    setDeleteModalOpen(false);
    setSelectedRoutine(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Class Timetable & Routine Schedule</h3>
            <p className="text-xs text-slate-500">
              Conflict-free scheduling with automated 10-minute teacher lecture reminders
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              {routines.length} routine slots
            </span>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Timetable Slot</span>
            </button>
          </div>
        </div>

        {/* Day Filter Bar */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center space-x-2 overflow-x-auto text-xs">
          <button
            onClick={() => setFilterDay('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              filterDay === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Days ({routines.length})
          </button>
          {DAYS_OF_WEEK.map(d => {
            const count = routines.filter(r => r.dayOfWeek === d).length;
            return (
              <button
                key={d}
                onClick={() => setFilterDay(d)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  filterDay === d
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d} ({count})
              </button>
            );
          })}
        </div>

        {/* Routine Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Day</th>
                <th className="py-3 px-4">Time Slot</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Instructor</th>
                <th className="py-3 px-4">Room & Venue</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoutines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No routine slots scheduled for this day.
                  </td>
                </tr>
              ) : (
                filteredRoutines.map(rt => {
                  const off = offerings.find(o => o.id === rt.courseOfferingId);
                  const crs = off ? courses.find(c => c.id === off.courseId) : undefined;
                  const tch = teachers.find(t => t.id === rt.teacherId);

                  return (
                    <tr key={rt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{rt.dayOfWeek}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-indigo-700">
                        {rt.startTime} - {rt.endTime}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold font-mono text-slate-900 mr-1.5">
                          {crs?.code}
                        </span>
                        <span className="text-slate-600">{crs?.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {tch?.name || 'Unassigned'}
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {tch?.teacherId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {rt.room} <span className="text-slate-400 font-normal">({rt.building})</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(rt)}
                            title="Reschedule / Edit routine"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRoutine(rt);
                              setDeleteModalOpen(true);
                            }}
                            title="Delete routine slot"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
      </div>

      {/* ADD ROUTINE MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Schedule New Timetable Slot</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4">
              {conflictError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-medium">{conflictError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Course Offering <span className="text-rose-500">*</span>
                </label>
                <select
                  value={offeringId}
                  onChange={e => setOfferingId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {offerings.map(o => {
                    const crs = courses.find(c => c.id === o.courseId);
                    return (
                      <option key={o.id} value={o.id}>
                        {crs?.code} - {crs?.name} (Year {o.year}, Sem {o.semester}, Sec {o.section})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instructor / Faculty <span className="text-rose-500">*</span>
                </label>
                <select
                  value={teacherId}
                  onChange={e => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.teacherId} - {t.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Day of Week</label>
                  <select
                    value={dayOfWeek}
                    onChange={e => setDayOfWeek(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="text"
                    required
                    placeholder="10:00 AM"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="text"
                    required
                    placeholder="11:00 AM"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Lab</label>
                  <input
                    type="text"
                    required
                    placeholder="Room 302"
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Building</label>
                  <input
                    type="text"
                    required
                    placeholder="Faculty of CSE Building"
                    value={building}
                    onChange={e => setBuilding(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
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
                  Verify & Schedule Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / RESCHEDULE ROUTINE MODAL */}
      {editModalOpen && selectedRoutine && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Reschedule Timetable Slot</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {conflictError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-medium">{conflictError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={e => setDayOfWeek(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {DAYS_OF_WEEK.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="text"
                    required
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Lab</label>
                  <input
                    type="text"
                    required
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Building</label>
                  <input
                    type="text"
                    required
                    value={building}
                    onChange={e => setBuilding(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Email Notification Option */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <label className="flex items-center space-x-2 text-xs font-semibold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnReschedule}
                    onChange={e => setNotifyOnReschedule(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                  />
                  <span>Dispatch automated routine update email to Teacher and Enrolled Students</span>
                </label>
                <p className="text-[10px] text-amber-700 mt-1 pl-6">
                  Emails will include old schedule vs new schedule details.
                </p>
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
                  Save & Notify Cohort
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && selectedRoutine && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Remove Timetable Slot?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove the slot for {selectedRoutine.dayOfWeek} ({selectedRoutine.startTime} - {selectedRoutine.endTime})?
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
                Yes, Remove Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
