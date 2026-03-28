// src/app/dashboard/KanbanBoard.tsx
'use client';

import { useState } from 'react';

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

  const kanbanColumns = [
    { id: 'todo', title: 'To Do', color: 'bg-slate-500' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-[#0066FF]' },
    { id: 'done', title: 'Done', color: 'bg-emerald-500' }
  ];

  const getAvatarColor = (index: number) => {
    const colors = ['bg-[#0066FF]', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
    return colors[index % colors.length];
  };

  // <--- ADDED: Helper to extract the alias --->
  const getMemberDisplayName = (member: any) => {
    return member.nickname || member.username;
  };

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
    <div className="flex h-full gap-6 items-start pb-4">
      {kanbanColumns.map(col => (
        <div key={col.id} className="flex-shrink-0 w-80 flex flex-col bg-[#121212] rounded-md border border-[#2A2A2A] max-h-full" onDrop={(e) => handleDrop(e, col.id)} onDragOver={handleDragOver}>
          
          <div className="p-3 flex justify-between items-center border-b border-[#1A1A1A]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${col.color}`}></span>
              <h3 className="text-sm font-bold text-white">{col.title}</h3>
            </div>
            <span className="text-xs font-bold text-[#666] bg-[#1A1A1A] px-2 py-0.5 rounded-sm">{tasks.filter(t => t.status === col.id).length}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {tasks.filter(t => t.status === col.id).map((task, index) => (
              <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)} className="p-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm cursor-grab hover:border-[#4DA6FF] transition-colors shadow-sm relative group">
                <button onClick={() => handleDeleteTask(task.id)} className="absolute top-2 right-2 text-[#444] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <p className="text-sm text-[#E0E0E0] pr-6 mb-4">{task.title}</p>
                
                <div className="flex items-end justify-between mt-auto pt-2 border-t border-[#2A2A2A]">
                  <div className="text-[9px] text-[#666] font-bold uppercase tracking-wider flex flex-col gap-1">
                    <span>Start: {task.start_date ? new Date(task.start_date).toLocaleDateString() : (task.created_at ? new Date(task.created_at + 'Z').toLocaleDateString() : 'Today')}</span>
                    {task.due_date && <span className="text-blue-500/80">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                  </div>
                  {members.length > 0 && (
                    <div title={getMemberDisplayName(members[index % members.length])} className={`w-5 h-5 rounded-full ${getAvatarColor(index)} flex items-center justify-center text-[9px] text-white font-bold shadow-sm uppercase`}>
                      {/* <--- CHANGED: Extract the first letter of the Alias ---> */}
                      {getMemberDisplayName(members[index % members.length]).charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ==================== CONDITIONAL TASK FORM ==================== */}
            {addingTaskTo === col.id ? (
              <form onSubmit={(e) => handleCreateTask(e, col.id)} className="mt-2 bg-[#1A1A1A] p-2 border border-[#0066FF] rounded-sm">
                <input autoFocus type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task description..." className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-2 py-1.5 text-xs text-white focus:outline-none mb-2" />
                
                {/* Only show Assignee Dropdown if we are in "To Do" */}
                {col.id === 'todo' && (
                  <select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-[#A0A0A0] text-[10px] rounded-sm px-1 py-1.5 outline-none mb-2">
                    <option value="">Assign to...</option>
                    {/* <--- CHANGED: Display Alias in dropdown ---> */}
                    {members.map(m => <option key={m.id} value={m.id}>{getMemberDisplayName(m)}</option>)}
                  </select>
                )}

                <div className="flex gap-2 mb-2">
                  
                  {/* Show Start Date ONLY in "To Do" and "In Progress" */}
                  {(col.id === 'todo' || col.id === 'in_progress') && (
                    <div className="flex-1 flex flex-col">
                      <span className="text-[8px] text-[#666] uppercase font-bold mb-0.5">Start Date</span>
                      <input type="date" value={newTaskStartDate} onChange={(e) => setNewTaskStartDate(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-[#A0A0A0] text-[10px] rounded-sm px-1 py-1 outline-none" />
                    </div>
                  )}

                  {/* Show Due/End Date ONLY in "To Do" and "Done" */}
                  {(col.id === 'todo' || col.id === 'done') && (
                    <div className="flex-1 flex flex-col">
                      <span className="text-[8px] text-[#666] uppercase font-bold mb-0.5">
                        {col.id === 'done' ? 'End Date' : 'Due Date'}
                      </span>
                      <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-[#A0A0A0] text-[10px] rounded-sm px-1 py-1 outline-none" />
                    </div>
                  )}

                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => { setAddingTaskTo(null); setNewTaskTitle(''); setNewTaskAssignee(''); setNewTaskStartDate(''); setNewTaskDueDate(''); }} className="text-[10px] text-[#666] hover:text-white font-bold uppercase">Cancel</button>
                  <button type="submit" className="text-[10px] bg-[#0066FF] text-white px-2 py-1 rounded-sm font-bold uppercase">Save</button>
                </div>
              </form>
            ) : (
              <button onClick={() => setAddingTaskTo(col.id)} className="w-full text-left px-2 py-1.5 text-xs font-bold text-[#666] hover:text-[#E0E0E0] hover:bg-[#1A1A1A] rounded-sm transition-none mt-1">+ Add Task</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}