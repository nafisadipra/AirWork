// src/app/dashboard/dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import KanbanBoard from './KanbanBoard';
import Settings from './Settings'; // <--- Import the new Settings component

export default function Dashboard() {
  const [username, setUsername] = useState('User');

  // Modal & Project States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('kanban');

  // Shared Data States (Passed down to components)
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]); 
  const [inviteToken, setInviteToken] = useState<string | null>(null); 

  // --- API CALLS ---

  const fetchProjects = async (user: string) => {
    try {
      const api = (window as any).electronAPI;
      const result = await api.listProjects({ userId: user });
      if (result.success && result.projects) {
        setProjects(result.projects);
        // If the currently selected project was deleted/removed, clear selection
        if (selectedProject && !result.projects.find((p: any) => p.id === selectedProject.id)) {
          setSelectedProject(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch projects", error);
    }
  };

  const fetchTasksAndMembers = async (projectId: string) => {
    try {
      const api = (window as any).electronAPI;
      
      const taskResult = await api.listTasks({ projectId });
      if (taskResult.success && taskResult.tasks) setTasks(taskResult.tasks);

      const memberResult = await api.getProjectMembers({ projectId });
      if (memberResult.success && memberResult.members) setMembers(memberResult.members);
      
    } catch (error) {
      console.error("Failed to fetch project data", error);
    }
  };

  // Initial load
  useEffect(() => {
    const storedUser = localStorage.getItem('airwork_user');
    if (storedUser) {
      setUsername(storedUser);
      fetchProjects(storedUser);
    }
  }, []);

  // Whenever a project is selected, fetch its tasks and members
  useEffect(() => {
    if (selectedProject) {
      fetchTasksAndMembers(selectedProject.id);
      setInviteToken(null); 
    } else {
      setTasks([]);
      setMembers([]);
    }
  }, [selectedProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const result = await api.createProject({ name: projectName, userId: username });
      if (result.success) {
        setIsModalOpen(false);
        setProjectName('');
        fetchProjects(username); 
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to the backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!selectedProject) return;
    try {
      const api = (window as any).electronAPI;
      const result = await api.generateInviteToken({ projectId: selectedProject.id, userId: username });
      if (result.success && result.inviteToken) {
        setInviteToken(result.inviteToken);
      }
    } catch (error) {
      console.error("Failed to generate invite", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#121212] text-[#E0E0E0] font-sans selection:bg-blue-500/30 relative">
      
      {/* ==================== SIDEBAR ==================== */}
      <div className="w-[260px] bg-[#0A0A0A] border-r border-[#2A2A2A] flex flex-col z-10">
        <div className="h-14 flex items-center px-5 border-b border-[#2A2A2A] shrink-0">
          <h1 className="text-sm font-bold tracking-wide text-white">AirWork</h1>
          <span className="ml-2 px-1.5 py-0.5 bg-[#2A2A2A] text-[#A0A0A0] text-[10px] font-bold uppercase tracking-wider rounded-sm">Local</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          <div>
            <h3 className="px-2 text-xs font-bold text-[#666666] uppercase tracking-wider mb-2">Workspace</h3>
            <div className="space-y-1">
              <button 
                onClick={() => setSelectedProject(null)}
                className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm font-medium transition-none ${
                  !selectedProject ? 'bg-[#1A2633] text-[#4DA6FF]' : 'text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-[#E0E0E0]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Overview
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">Projects</h3>
              <button onClick={() => setIsModalOpen(true)} className="text-[#666666] hover:text-white transition-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            
            <div className="space-y-1">
              {projects.length === 0 ? (
                <div className="px-2 py-2 text-xs text-[#666666]">No projects created.</div>
              ) : (
                projects.map((project) => (
                  <button 
                    key={project.id} 
                    onClick={() => {
                      setSelectedProject(project);
                      setActiveTab('kanban');
                    }}
                    className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm font-medium transition-none ${
                      selectedProject?.id === project.id ? 'bg-[#1A2633] text-[#4DA6FF]' : 'text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-[#E0E0E0]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedProject?.id === project.id ? 'bg-[#4DA6FF]' : 'bg-[#0066FF]'}`}></span>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#2A2A2A] bg-[#0A0A0A] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0066FF] flex items-center justify-center text-sm font-bold text-white rounded-sm uppercase">{username.charAt(0)}</div>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold text-white capitalize truncate">{username}</div>
              <div className="text-[11px] text-[#808080] font-medium">Administrator</div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        <header className="h-14 bg-[#121212] border-b border-[#2A2A2A] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#E0E0E0]">
              {selectedProject ? selectedProject.name : 'Dashboard'}
            </h2>
            {selectedProject && (
              <span className="px-1.5 py-0.5 bg-green-900/30 text-green-500 border border-green-800 text-[10px] font-bold uppercase tracking-wider rounded-sm ml-2">
                {selectedProject.role}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col bg-[#0A0A0A]">
          {!selectedProject ? (
            <div className="flex-1 p-8">
               <h2 className="text-2xl font-bold text-white mb-6">Welcome back, <span className="capitalize">{username}</span>.</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 border border-[#2A2A2A] bg-[#121212] rounded-sm">
                    <div className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-2">Total Projects</div>
                    <div className="text-3xl font-light text-white">{projects.length}</div>
                  </div>
                  <div className="p-5 border border-[#2A2A2A] bg-[#121212] rounded-sm">
                    <div className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-2">Active Tasks</div>
                    <div className="text-3xl font-light text-white">-</div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="flex flex-col h-full w-full animate-in fade-in duration-300">
              
              <div className="h-12 border-b border-[#2A2A2A] bg-[#121212] px-6 flex items-end gap-6 shrink-0">
                {[
                  { id: 'kanban', label: 'Kanban Board' },
                  { id: 'docs', label: 'Documents' },
                  { id: 'chat', label: 'Local Chat' },
                  { id: 'settings', label: 'Settings' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-sm font-bold transition-none border-b-2 ${
                      activeTab === tab.id ? 'border-[#0066FF] text-white' : 'border-transparent text-[#666666] hover:text-[#A0A0A0]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-x-auto p-6 bg-[#0A0A0A]">
                
                {/* ==================== WORKSPACE TABS ==================== */}
                
                {activeTab === 'kanban' && (
                  <KanbanBoard 
                    selectedProject={selectedProject} 
                    members={members} 
                    tasks={tasks} 
                    setTasks={setTasks} 
                    fetchTasksAndMembers={fetchTasksAndMembers} 
                  />
                )}

                {activeTab === 'docs' && <div className="text-[#A0A0A0] text-sm">Yjs Collaborative Documents space will go here.</div>}
                
                {activeTab === 'chat' && <div className="text-[#A0A0A0] text-sm">Encrypted Peer-to-Peer Chat will go here.</div>}
                
                {/* <--- HERE IS WHERE WE RENDER THE NEW SETTINGS COMPONENT ---> */}
                {activeTab === 'settings' && (
                  <Settings 
                    members={members}
                    inviteToken={inviteToken}
                    handleGenerateInvite={handleGenerateInvite}
                  />
                )}

              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== INITIALIZE PROJECT MODAL ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-1">Initialize New Project</h3>
            <p className="text-xs text-[#666666] mb-6 uppercase tracking-widest font-bold">Secure Local Workspace</p>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#666666] uppercase mb-1">Project Name</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)} 
                  placeholder="e.g. Apollo Mission" 
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]" 
                  required 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-2 text-xs font-bold text-[#A0A0A0] hover:text-white transition-none"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-sm transition-none disabled:opacity-50"
                >
                  {loading ? 'INITIALIZING...' : 'CREATE PROJECT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}