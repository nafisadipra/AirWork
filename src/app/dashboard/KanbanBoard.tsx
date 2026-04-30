// src/app/dashboard/KanbanBoard.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface KanbanBoardProps {
  selectedProject: any;
  members: any[];
  tasks: any[];
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  fetchTasksAndMembers: (projectId: string) => Promise<void>;
}

export default function KanbanBoard({ selectedProject, members, tasks, setTasks, fetchTasksAndMembers }: KanbanBoardProps) {
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState(''); 
  const [newTaskDueDate, setNewTaskDueDate] = useState(''); 
  
  // New state for custom dropdown
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

  // Ref to detect clicks outside the form
  const formRef = useRef<HTMLFormElement>(null);

  const kanbanColumns = [
    { id: 'todo', title: 'To Do', color: 'bg-slate-400' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-[#0066FF]' },
    { id: 'done', title: 'Done', color: 'bg-[#00875a]' }
  ];

  const getAvatarColor = (index: number) => {
    const colors = ['bg-[#e0e7ff]', 'bg-[#fce4ec]', 'bg-[#e8f5e9]', 'bg-[#fff3e0]', 'bg-[#f3e5f5]'];
    return colors[index % colors.length];
  };
  
  const getAvatarTextColor = (index: number) => {
    const colors = ['text-[#3730a3]', 'text-[#880e4f]', 'text-[#1b5e20]', 'text-[#e65100]', 'text-[#4a148c]'];
    return colors[index % colors.length];
  };

  const getMemberDisplayName = (member: any) => {
    return member.nickname || member.username;
  };

  // Listen for P2P Syncs
  useEffect(() => {
    const api = (window as any).electronAPI;
    
    if (api && api.onSyncMessage) {
      const unsubscribe = api.onSyncMessage(async () => {
        if (selectedProject) {
          await fetchTasksAndMembers(selectedProject.id);
          console.log('[Kanban] Refreshed from P2P sync');
        }
      });
      
      return () => unsubscribe?.();
    }
  }, [selectedProject, fetchTasksAndMembers]);

  // Click outside listener to auto-cancel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
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

  const handleCreateTask = async (e: React.FormEvent, status: string) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedProject) return;
    
    try {
      const api = (window as any).electronAPI;
      const result = await api.createTask({ 
        projectId: selectedProject.id, 
        title: newTaskTitle, 
        status,
        assigneeId: newTaskAssignee || null,
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full pb-4 w-full items-start">
      {kanbanColumns.map(col => (
        <div 
          key={col.id} 
          className="flex flex-col bg-[#141414] rounded-2xl max-h-full shadow-md w-full" 
          onDrop={(e) => handleDrop(e, col.id)} 
          onDragOver={handleDragOver}
        >
          
          <div className="p-5 flex justify-between items-center border-b border-neutral-800/50 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${col.color}`}></span>
              <h3 className="text-base font-bold text-white">{col.title}</h3>
            </div>
            <span className="text-xs font-bold text-neutral-400 bg-neutral-800/60 px-2.5 py-1 rounded-full">
              {tasks.filter(t => t.status === col.id).length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {tasks.filter(t => t.status === col.id).map((task, index) => (
              <div 
                key={task.id} 
                draggable 
                onDragStart={(e) => handleDragStart(e, task.id)} 
                className="p-4 bg-[#202020] border border-neutral-800 rounded-xl cursor-grab hover:border-neutral-600 transition-colors shadow-sm relative group"
              >
                <button onClick={() => handleDeleteTask(task.id)} className="absolute top-3 right-3 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <p className="text-sm font-medium text-[#f0f0f0] pr-6 mb-5 leading-relaxed">{task.title}</p>
                
                <div className="flex items-end justify-between mt-auto pt-3 border-t border-neutral-800">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider flex flex-col gap-1">
                    <span>Start: {task.start_date ? new Date(task.start_date).toLocaleDateString() : (task.created_at ? new Date(task.created_at + 'Z').toLocaleDateString() : 'Today')}</span>
                    {task.due_date && <span className="text-blue-400/80">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                  </div>
                  {members.length > 0 && (
                    <div title={getMemberDisplayName(members[index % members.length])} className={`w-6 h-6 rounded-full ${getAvatarColor(index)} ${getAvatarTextColor(index)} flex items-center justify-center text-[10px] font-bold shadow-sm uppercase`}>
                      {getMemberDisplayName(members[index % members.length]).charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* CONDITIONAL TASK FORM WITH CLICK-OUTSIDE REF */}
            {addingTaskTo === col.id ? (
              <form 
                ref={formRef}
                onSubmit={(e) => handleCreateTask(e, col.id)} 
                className="mt-3 bg-[#1a1a1a] p-5 rounded-2xl shadow-xl flex flex-col gap-4 border border-neutral-800/80 animate-in fade-in zoom-in-95 duration-200"
              >
                <input 
                  autoFocus 
                  type="text" 
                  value={newTaskTitle} 
                  onChange={(e) => setNewTaskTitle(e.target.value)} 
                  placeholder="Task description..." 
                  className="w-full bg-[#262626] border border-transparent rounded-xl px-4 py-3 text-sm font-medium text-white placeholder-neutral-500 focus:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#0066FF]/40 transition-all" 
                />
                
                {/* CUSTOM SELECT DROPDOWN */}
                {col.id === 'todo' && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                      className="w-full bg-[#262626] border border-transparent hover:bg-[#2a2a2a] text-neutral-300 text-sm rounded-xl px-4 py-3 outline-none font-medium focus:ring-2 focus:ring-[#0066FF]/40 transition-all flex justify-between items-center"
                    >
                      <span className={newTaskAssignee ? 'text-white' : 'text-neutral-500'}>
                        {newTaskAssignee 
                          ? getMemberDisplayName(members.find(m => m.id === newTaskAssignee) || { username: 'Unknown' }) 
                          : 'Assign to...'}
                      </span>
                      <svg className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* CUSTOM DROPDOWN OPTIONS MENU */}
                    {isAssigneeDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-[#262626] border border-neutral-700/50 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => { setNewTaskAssignee(''); setIsAssigneeDropdownOpen(false); }}
                          className="w-full text-left px-4 py-3 text-sm font-medium text-neutral-400 hover:bg-[#333] hover:text-white transition-colors"
                        >
                          Unassigned
                        </button>
                        {members.map((m, idx) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => { setNewTaskAssignee(m.id); setIsAssigneeDropdownOpen(false); }}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-white hover:bg-[#333] transition-colors flex items-center gap-3 border-t border-neutral-700/50"
                          >
                            <div className={`w-6 h-6 rounded-full ${getAvatarColor(idx)} ${getAvatarTextColor(idx)} flex items-center justify-center text-[10px] font-bold uppercase shrink-0`}>
                              {getMemberDisplayName(m).charAt(0)}
                            </div>
                            <span className="truncate">{getMemberDisplayName(m)}</span>
                            {newTaskAssignee === m.id && (
                              <svg className="w-4 h-4 text-[#0066FF] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {(col.id === 'todo' || col.id === 'in_progress') && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider pl-1">Start Date</span>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-neutral-400 group-hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </div>
                        <input 
                          type="date" 
                          value={newTaskStartDate} 
                          onChange={(e) => setNewTaskStartDate(e.target.value)} 
                          className="w-full bg-[#262626] border border-transparent text-neutral-300 text-sm rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#0066FF]/40 transition-all [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full cursor-pointer hover:bg-[#2a2a2a]" 
                        />
                      </div>
                    </div>
                  )}

                  {(col.id === 'todo' || col.id === 'done') && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider pl-1">
                        {col.id === 'done' ? 'End Date' : 'Due Date'}
                      </span>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-neutral-400 group-hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </div>
                        <input 
                          type="date" 
                          value={newTaskDueDate} 
                          onChange={(e) => setNewTaskDueDate(e.target.value)} 
                          className="w-full bg-[#262626] border border-transparent text-neutral-300 text-sm rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#0066FF]/40 transition-all [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full cursor-pointer hover:bg-[#2a2a2a]" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-4 border-t border-neutral-800/80">
                  <button 
                    type="submit" 
                    className="w-full text-sm bg-[#0066FF] hover:bg-blue-600 transition-colors text-white py-3 rounded-xl font-bold uppercase tracking-wider shadow-md"
                  >
                    Save Task
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setAddingTaskTo(col.id)} className="w-full text-left px-4 py-3 text-sm font-semibold text-neutral-500 hover:text-white hover:bg-neutral-800/50 rounded-xl transition-all mt-1 flex items-center gap-2">
                <span className="text-lg leading-none">+</span> Add Task
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}