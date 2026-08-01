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
  
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const kanbanColumns = [
    { id: 'todo', title: 'To Do', badgeClass: 'bg-zinc-200 text-zinc-800' },
    { id: 'in_progress', title: 'In Progress', badgeClass: 'bg-zinc-950 text-white' },
    { id: 'done', title: 'Done', badgeClass: 'bg-zinc-800 text-zinc-100' }
  ];

  const getMemberDisplayName = (member: any) => {
    return member.nickname || member.username;
  };

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
            {tasks.filter(t => t.status === col.id).map((task, index) => (
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
                  {members.length > 0 && (
                    <div 
                      title={getMemberDisplayName(members[index % members.length])} 
                      className="w-6 h-6 rounded-md bg-zinc-950 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs uppercase"
                    >
                      {getMemberDisplayName(members[index % members.length]).charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            ))}

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
                      <span className={newTaskAssignee ? 'text-zinc-950 font-bold' : 'text-zinc-400'}>
                        {newTaskAssignee 
                          ? getMemberDisplayName(members.find(m => m.id === newTaskAssignee) || { username: 'Unknown' }) 
                          : 'Assign to member...'}
                      </span>
                      <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isAssigneeDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => { setNewTaskAssignee(''); setIsAssigneeDropdownOpen(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
                        >
                          Unassigned
                        </button>
                        {members.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => { setNewTaskAssignee(m.id); setIsAssigneeDropdownOpen(false); }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-100 transition-colors flex items-center gap-2 border-t border-zinc-100"
                          >
                            <div className="w-5 h-5 rounded bg-zinc-950 text-white flex items-center justify-center text-[9px] font-bold uppercase">
                              {getMemberDisplayName(m).charAt(0)}
                            </div>
                            <span className="truncate">{getMemberDisplayName(m)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {(col.id === 'todo' || col.id === 'in_progress') && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-400 font-mono uppercase tracking-wider">Start Date</span>
                      <input 
                        type="date" 
                        value={newTaskStartDate} 
                        onChange={(e) => setNewTaskStartDate(e.target.value)} 
                        className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-zinc-950" 
                      />
                    </div>
                  )}

                  {(col.id === 'todo' || col.id === 'done') && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-400 font-mono uppercase tracking-wider">
                        {col.id === 'done' ? 'End Date' : 'Due Date'}
                      </span>
                      <input 
                        type="date" 
                        value={newTaskDueDate} 
                        onChange={(e) => setNewTaskDueDate(e.target.value)} 
                        className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-zinc-950" 
                      />
                    </div>
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
                onClick={() => setAddingTaskTo(col.id)} 
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