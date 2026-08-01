// src/app/dashboard/KanbanBoard.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import CompactDatePicker from './CompactDatePicker';

interface KanbanBoardProps {
  selectedProject: any;
  members: any[];
  tasks: any[];
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  fetchTasksAndMembers: (projectId: string) => Promise<void>;
  username?: string;
}

export default function KanbanBoard({ selectedProject, members, tasks, setTasks, fetchTasksAndMembers, username }: KanbanBoardProps) {
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState(''); 
  const [newTaskDueDate, setNewTaskDueDate] = useState(''); 
  
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const kanbanColumns = [
    { id: 'todo', title: 'To Do', badgeClass: 'bg-zinc-200 text-zinc-800' },
    { id: 'in_progress', title: 'In Progress', badgeClass: 'bg-zinc-950 text-white' },
    { id: 'done', title: 'Done', badgeClass: 'bg-zinc-800 text-zinc-100' }
  ];

  const getMemberDisplayName = (member: any) => {
    if (!member) return 'Unassigned';
    return member.nickname || member.username || 'Member';
  };

  // Build effective member list including project creator / logged-in user
  const effectiveMembers = [...members];
  if (username && !effectiveMembers.some(m => m.username === username || m.id === username)) {
    effectiveMembers.unshift({
      id: username,
      username: username,
      nickname: username,
      role: 'admin'
    });
  }

  useEffect(() => {
    const api = (window as any).electronAPI;
    
    if (api && api.onSyncMessage) {
      const unsubscribe = api.onSyncMessage(async () => {
        if (selectedProject) {
          await fetchTasksAndMembers(selectedProject.id);
        }
      });
      
      return () => unsubscribe?.();
    }
  }, [selectedProject, fetchTasksAndMembers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target && target.closest && target.closest('.compact-date-picker-popover')) {
        return;
      }

      if (formRef.current && !formRef.current.contains(target as Node)) {
        setAddingTaskTo(null);
        setNewTaskTitle('');
        setNewTaskAssignee('');
        setNewTaskStartDate('');
        setNewTaskDueDate('');
        setIsAssigneeDropdownOpen(false);
      }
    };

    if (addingTaskTo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [addingTaskTo]);

  const handleOpenAddTask = (columnId: string) => {
    setAddingTaskTo(columnId);
    setNewTaskAssignee('');
  };

  const handleCreateTask = async (e: React.FormEvent, status: string) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedProject) return;
    
    const finalAssignee = newTaskAssignee || effectiveMembers[0]?.id || username || null;

    try {
      const api = (window as any).electronAPI;
      const result = await api.createTask({ 
        projectId: selectedProject.id, 
        title: newTaskTitle, 
        status,
        assigneeId: finalAssignee,
        startDate: newTaskStartDate || null,
        dueDate: newTaskDueDate || null
      });
      
      if (result.success) {
        setNewTaskTitle('');
        setNewTaskAssignee('');
        setNewTaskStartDate(''); 
        setNewTaskDueDate('');
        setAddingTaskTo(null);
        setIsAssigneeDropdownOpen(false);
        fetchTasksAndMembers(selectedProject.id); 
      } else {
        console.error("Backend refused to save:", result.error);
      }
    } catch (error) {
      console.error("Failed to create task", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setTasks(prev => prev.filter(t => t.id !== taskId)); 
    try {
      const api = (window as any).electronAPI;
      await api.deleteTask({ taskId });
    } catch (error) {
      console.error("Failed to delete task", error);
      fetchTasksAndMembers(selectedProject.id); 
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId || !selectedProject) return;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)); 

    try {
      const api = (window as any).electronAPI;
      await api.updateTaskStatus({ taskId, newStatus });
      fetchTasksAndMembers(selectedProject.id);
    } catch (error) {
      console.error("Failed to update task status", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const currentAssignedMember = newTaskAssignee 
    ? effectiveMembers.find(m => m.id === newTaskAssignee || m.username === newTaskAssignee) 
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full pb-2 w-full items-start">
      {kanbanColumns.map(col => (
        <div 
          key={col.id} 
          className="flex flex-col bg-zinc-50 rounded-2xl max-h-full border border-zinc-200/80 w-full" 
          onDrop={(e) => handleDrop(e, col.id)} 
          onDragOver={handleDragOver}
        >
          {/* Header */}
          <div className="p-4 flex justify-between items-center border-b border-zinc-200 shrink-0">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md ${col.badgeClass}`}>
                {col.title}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-zinc-500 bg-white border border-zinc-200 px-2 py-0.5 rounded-full">
              {tasks.filter(t => t.status === col.id).length}
            </span>
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            {tasks.filter(t => t.status === col.id).map((task) => {
              const cardAssignee = effectiveMembers.find(m => m.id === task.assigned_to || m.username === task.assigned_to) || effectiveMembers[0];
              return (
                <div 
                  key={task.id} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, task.id)} 
                  className="p-4 bg-white border border-zinc-200 rounded-xl cursor-grab hover:border-zinc-400 transition-all shadow-2xs relative group"
                >
                  <button 
                    onClick={() => handleDeleteTask(task.id)} 
                    className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-950 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>

                  <p className="text-xs font-semibold text-zinc-900 pr-6 mb-4 leading-relaxed">{task.title}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-100">
                    <div className="text-[10px] text-zinc-400 font-mono flex flex-col gap-0.5">
                      <span>Start: {task.start_date ? new Date(task.start_date).toLocaleDateString() : (task.created_at ? new Date(task.created_at + 'Z').toLocaleDateString() : 'Today')}</span>
                      {task.due_date && <span className="text-zinc-700 font-semibold">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                    </div>
                    {cardAssignee && (
                      <div 
                        title={`Assigned to: ${getMemberDisplayName(cardAssignee)}`} 
                        className="flex items-center gap-1.5 bg-zinc-100 px-2 py-1 rounded-lg border border-zinc-200"
                      >
                        <div className="w-5 h-5 rounded bg-zinc-950 text-white flex items-center justify-center text-[9px] font-bold uppercase">
                          {getMemberDisplayName(cardAssignee).charAt(0)}
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-900">{getMemberDisplayName(cardAssignee)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Task Add Form */}
            {addingTaskTo === col.id ? (
              <form 
                ref={formRef}
                onSubmit={(e) => handleCreateTask(e, col.id)} 
                className="mt-2 bg-white p-4 rounded-xl shadow-lg flex flex-col gap-3 border border-zinc-300 animate-in fade-in duration-150"
              >
                <input 
                  autoFocus 
                  type="text" 
                  value={newTaskTitle} 
                  onChange={(e) => setNewTaskTitle(e.target.value)} 
                  placeholder="Task title..." 
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 transition-all" 
                />
                
                {col.id === 'todo' && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                      className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-400 text-zinc-800 text-xs rounded-lg px-3 py-2.5 outline-none font-medium transition-all flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2">
                        {currentAssignedMember ? (
                          <>
                            <div className="w-4 h-4 rounded bg-zinc-950 text-white flex items-center justify-center text-[9px] font-bold uppercase shrink-0">
                              {getMemberDisplayName(currentAssignedMember).charAt(0)}
                            </div>
                            <span className="text-zinc-950 font-bold">
                              {getMemberDisplayName(currentAssignedMember)}
                            </span>
                          </>
                        ) : (
                          <span className="text-zinc-400 font-medium">Assign to member...</span>
                        )}
                      </div>
                      <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isAssigneeDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in">
                        {effectiveMembers.map((m) => (
                          <button
                            key={m.id || m.username}
                            type="button"
                            onClick={() => { setNewTaskAssignee(m.id || m.username); setIsAssigneeDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 text-xs font-medium hover:bg-zinc-100 transition-colors flex items-center justify-between gap-2 border-b border-zinc-100 last:border-0 ${
                              (newTaskAssignee === m.id || newTaskAssignee === m.username) ? 'bg-zinc-50 font-bold' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-5 h-5 rounded bg-zinc-950 text-white flex items-center justify-center text-[9px] font-bold uppercase shrink-0">
                                {getMemberDisplayName(m).charAt(0)}
                              </div>
                              <span className="truncate text-zinc-950 font-semibold">{getMemberDisplayName(m)}</span>
                            </div>
                            {m.role && (
                              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider shrink-0">
                                {m.role === 'admin' || m.role === 'creator' ? 'Creator' : m.role}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {(col.id === 'todo' || col.id === 'in_progress') && (
                    <CompactDatePicker
                      label="Start Date"
                      placeholder="Start date..."
                      value={newTaskStartDate}
                      onChange={(val) => setNewTaskStartDate(val)}
                    />
                  )}

                  {(col.id === 'todo' || col.id === 'done') && (
                    <CompactDatePicker
                      label={col.id === 'done' ? 'End Date' : 'Due Date'}
                      placeholder={col.id === 'done' ? 'End date...' : 'Due date...'}
                      value={newTaskDueDate}
                      onChange={(val) => setNewTaskDueDate(val)}
                    />
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-100 flex gap-2">
                  <button 
                    type="submit" 
                    className="w-full text-xs bg-zinc-950 hover:bg-black transition-colors text-white py-2.5 rounded-lg font-bold shadow-xs"
                  >
                    Save Task
                  </button>
                </div>
              </form>
            ) : (
              <button 
                onClick={() => handleOpenAddTask(col.id)} 
                className="w-full text-left px-3 py-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-xl transition-all border border-dashed border-zinc-200 mt-1 flex items-center justify-center gap-1.5"
              >
                <span>+</span> Add Task
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}