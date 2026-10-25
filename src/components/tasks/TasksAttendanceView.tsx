import React, { useState } from 'react';
import {
  CheckSquare,
  Users,
  Plus,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  X,
  Edit,
  FileDown,
  Sparkles,
} from 'lucide-react';
import { WorkerTask, WorkerAttendance, TaskType, TaskPriority, TaskStatus, AttendanceStatus } from '../../types/erp';
import { exportToCSV } from '../../utils/export';
import { saveWorkerTask, updateTaskStatus, recordWorkerAttendance } from '../../services/db';
import { useAuth, PRESET_WORKERS, WorkerInfo } from '../../context/AuthContext';

interface TasksAttendanceViewProps {
  tasks: WorkerTask[];
  attendanceRecords: WorkerAttendance[];
  initialTab?: 'tasks' | 'attendance';
}

const TASK_TYPES: TaskType[] = [
  'Mixing',
  'Granulation',
  'Filling',
  'Packing',
  'Loading',
  'Maintenance',
  'Inventory Count',
  'General',
];

export const TasksAttendanceView: React.FC<TasksAttendanceViewProps> = ({
  tasks,
  attendanceRecords,
  initialTab = 'tasks',
}) => {
  const { userProfile, role, activeWorker, isOwner, isManager, isWorker, canAssignTasks } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'attendance'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Task Filter
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [workerFilter, setWorkerFilter] = useState<string>(isWorker ? activeWorker.id : 'all');

  // Modals
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('Mixing');
  const [assignedWorkerId, setAssignedWorkerId] = useState<string>(PRESET_WORKERS[0].id);
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('normal');
  const [taskBatchNum, setTaskBatchNum] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskSaving, setTaskSaving] = useState(false);

  // Quick Work Log Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedTaskForStatus, setSelectedTaskForStatus] = useState<WorkerTask | null>(null);
  const [newStatus, setNewStatus] = useState<TaskStatus>('completed');
  const [workLogText, setWorkLogText] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  // Attendance Date
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [markingAttendanceWorkerId, setMarkingAttendanceWorkerId] = useState<string | null>(null);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter;
    const matchesWorker = workerFilter === 'all' || t.assignedToWorkerId === workerFilter;
    return matchesStatus && matchesWorker;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const worker = PRESET_WORKERS.find((w) => w.id === assignedWorkerId);

    try {
      setTaskSaving(true);
      await saveWorkerTask(
        {
          title: taskTitle.trim(),
          description: taskDesc.trim(),
          entryType: taskType,
          assignedToWorkerId: assignedWorkerId,
          assignedToWorkerName: worker ? worker.name : 'Worker',
          priority: taskPriority,
          status: 'pending',
          batchNumber: taskBatchNum.trim() || undefined,
          dueDate: taskDueDate,
          assignedBy: userProfile?.email || 'manager',
          assignedByName: userProfile?.displayName || 'Manager',
        },
        undefined,
        userProfile?.email || 'manager',
        userProfile?.displayName || 'Manager'
      );
      setTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskBatchNum('');
    } catch (err) {
      console.error('Save task error:', err);
    } finally {
      setTaskSaving(false);
    }
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForStatus) return;

    try {
      setStatusSaving(true);
      await updateTaskStatus(
        selectedTaskForStatus.id,
        newStatus,
        workLogText,
        userProfile?.email || 'worker',
        userProfile?.displayName || activeWorker.name
      );
      setStatusModalOpen(false);
      setSelectedTaskForStatus(null);
    } catch (err) {
      console.error('Update status error:', err);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleQuickMarkAttendance = async (
    worker: WorkerInfo,
    status: AttendanceStatus,
    overtimeHours: number = 0,
    workLog: string = ''
  ) => {
    try {
      setMarkingAttendanceWorkerId(worker.id);
      await recordWorkerAttendance(
        {
          workerId: worker.id,
          workerName: worker.name,
          workerRole: worker.role,
          date: selectedAttendanceDate,
          status,
          checkInTime: status === 'present' ? '08:30 AM' : status === 'half_day' ? '01:00 PM' : undefined,
          workLog: workLog || (status === 'present' ? `Factory shift completed for ${worker.role}` : ''),
          overtimeHours,
          recordedBy: userProfile?.email || 'manager',
          recordedByName: userProfile?.displayName || 'Manager',
        },
        userProfile?.email || 'manager',
        userProfile?.displayName || 'Manager'
      );
    } catch (err) {
      console.error('Record attendance error:', err);
    } finally {
      setMarkingAttendanceWorkerId(null);
    }
  };

  const handleExportTasksCSV = () => {
    const headers = [
      'Task Title',
      'Entry Type',
      'Assigned Worker',
      'Priority',
      'Status',
      'Batch #',
      'Assigned Date',
      'Completed Date',
      'Work Log',
      'Assigned By',
    ];
    const rows = filteredTasks.map((t) => [
      t.title,
      t.entryType,
      t.assignedToWorkerName,
      t.priority.toUpperCase(),
      t.status.toUpperCase(),
      t.batchNumber || '',
      t.assignedAt,
      t.completedAt || '',
      t.workLog || '',
      t.assignedByName,
    ]);
    exportToCSV('Agro_Worker_Tasks_Report', headers, rows);
  };

  const handleExportAttendanceCSV = () => {
    const headers = ['Date', 'Worker Name', 'Role', 'Status', 'Check-in Time', 'Overtime (Hrs)', 'Work Log', 'Recorded By'];
    const rows = attendanceRecords.map((a) => [
      a.date,
      a.workerName,
      a.workerRole || '',
      a.status.toUpperCase(),
      a.checkInTime || '',
      a.overtimeHours || 0,
      a.workLog || '',
      a.recordedByName,
    ]);
    exportToCSV('Agro_Daily_Attendance_Report', headers, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Worker Tasks & Daily Attendance</h1>
              <p className="text-xs text-slate-500">
                Assign production tasks (mixing, granulation, filling, loading) and track 10 worker daily attendance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'tasks' ? (
            <button
              type="button"
              onClick={handleExportTasksCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              <span>Export Tasks CSV</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportAttendanceCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              <span>Export Attendance CSV</span>
            </button>
          )}

          {canAssignTasks && activeTab === 'tasks' && (
            <button
              type="button"
              onClick={() => setTaskModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Assign New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Work Order Tasks ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'attendance'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daily Worker Attendance (10 Workers)</span>
        </button>
      </div>

      {/* TAB 1: WORKER TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
            <div className="w-full md:w-56">
              <select
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
              >
                <option value="all">All Workers (10 Workers)</option>
                {PRESET_WORKERS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-stretch md:self-auto">
              {(['all', 'pending', 'in_progress', 'completed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setTaskStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                    taskStatusFilter === st
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                No tasks assigned for this filter criteria.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {task.entryType}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            task.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : task.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-slate-900 text-sm mt-2">{task.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>

                      <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Assigned To:</span>
                          <span className="font-bold text-slate-900">{task.assignedToWorkerName}</span>
                        </div>
                        {task.batchNumber && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Batch Ref:</span>
                            <span className="font-mono font-bold text-slate-800">{task.batchNumber}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Due Date:</span>
                            <span className={`font-mono ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                              {task.dueDate}
                            </span>
                          </div>
                        )}
                        {task.workLog && (
                          <div className="pt-1 text-[11px] text-emerald-800 italic border-t border-slate-200">
                            Log: {task.workLog}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">By {task.assignedByName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTaskForStatus(task);
                          setNewStatus(task.status === 'pending' ? 'in_progress' : 'completed');
                          setWorkLogText(task.workLog || '');
                          setStatusModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                      >
                        Update Status
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY ATTENDANCE (10 WORKERS) */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Attendance Date:</span>
              <input
                type="date"
                value={selectedAttendanceDate}
                onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <div className="text-xs text-slate-500">
              Shift hours: 08:30 AM – 05:30 PM • 10 Assigned Plant Workers
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Worker Name</th>
                    <th className="py-3 px-3">Role / Area</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Today Status</th>
                    <th className="py-3 px-3">Check-in Time</th>
                    <th className="py-3 px-3 text-right">OT Hours</th>
                    <th className="py-3 px-4 text-right">Mark Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {PRESET_WORKERS.map((worker) => {
                    // Find attendance record for this worker on this date
                    const record = attendanceRecords.find(
                      (r) => r.workerId === worker.id && r.date === selectedAttendanceDate
                    );
                    const currentStatus = record?.status || 'pending';
                    const isBusy = markingAttendanceWorkerId === worker.id;

                    return (
                      <tr key={worker.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{worker.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {worker.id}</span>
                        </td>

                        <td className="py-3 px-3 font-semibold text-slate-700">{worker.role}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{worker.phone}</td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              currentStatus === 'present'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : currentStatus === 'half_day'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : currentStatus === 'leave' || currentStatus === 'absent'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {currentStatus}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-600">
                          {record?.checkInTime || '-'}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {record?.overtimeHours ? `+${record.overtimeHours}h` : '-'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickMarkAttendance(worker, 'present', 0)}
                              className="px-2 py-1 text-[11px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                              title="Mark Present"
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickMarkAttendance(worker, 'half_day', 0)}
                              className="px-2 py-1 text-[11px] font-bold rounded bg-amber-500 text-white hover:bg-amber-600"
                              title="Mark Half-Day"
                            >
                              Half
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQuickMarkAttendance(worker, 'leave', 0)}
                              className="px-2 py-1 text-[11px] font-bold rounded bg-rose-600 text-white hover:bg-rose-700"
                              title="Mark Leave / Absent"
                            >
                              Leave
                            </button>
                          </div>
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

      {/* Modal: Assign Task */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Assign Task to Worker</h3>
              <button onClick={() => setTaskModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Mixing Humistar 1000L Reactor 1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Entry / Work Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assign to Worker</label>
                  <select
                    value={assignedWorkerId}
                    onChange={(e) => setAssignedWorkerId(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                  >
                    {PRESET_WORKERS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none capitalize"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number Ref</label>
                <input
                  type="text"
                  value={taskBatchNum}
                  onChange={(e) => setTaskBatchNum(e.target.value)}
                  placeholder="e.g. BATCH-2026-H1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instructions / Description</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Key instructions, safety guidelines, kettle ID"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  {taskSaving ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Status & Work Log */}
      {statusModalOpen && selectedTaskForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Update Task: {selectedTaskForStatus.title}
              </h3>
              <button onClick={() => setStatusModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Change Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-bold"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Worker Work Log / Notes
                </label>
                <textarea
                  rows={3}
                  value={workLogText}
                  onChange={(e) => setWorkLogText(e.target.value)}
                  placeholder="e.g. Mixed 1000L successfully, checked viscosity 45 cP, no residues left in kettle."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  {statusSaving ? 'Updating...' : 'Save Work Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
