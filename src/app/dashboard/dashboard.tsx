// src/app/dashboard/dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import KanbanBoard from './KanbanBoard';
import Settings from './Settings'; 
import Documents from './Documents';
import LocalChat from './LocalChat';
import Profile from './Profile'; 

export default function Dashboard() {
  const [username, setUsername] = useState('User');

  // Modal & Project States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('kanban');

  // GLOBAL CHAT & PROFILE STATES
  const [showGlobalChat, setShowGlobalChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false); 

  // JOIN MODAL STATES
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joinStatus, setJoinStatus] = useState('');

  // NETWORK RADAR STATES
  const [radarPeers, setRadarPeers] = useState<any[]>([]);

  // Shared Data States
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]); 
  const [inviteToken, setInviteToken] = useState<string | null>(null); 
  const [totalTasksCount, setTotalTasksCount] = useState<number | string>('-');

  // --- API CALLS ---

  const fetchProjects = async (user: string) => {
    try {
      const api = (window as any).electronAPI;
      const result = await api.listProjects({ userId: user });
      
      if (result.success && result.projects) {
        setProjects(result.projects);
        
        try {
          let taskCount = 0;
          for (const project of result.projects) {
            const taskResult = await api.listTasks({ projectId: project.id });
            if (taskResult.success && taskResult.tasks) {
               const activeTasks = taskResult.tasks.filter((t: any) => 
                  t.status?.toLowerCase() !== 'done' && 
                  t.status?.toLowerCase() !== 'completed'
               );
               taskCount += activeTasks.length;
            }
          }
          setTotalTasksCount(taskCount);
        } catch (e) {
          console.error("Failed to count tasks", e);
        }

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

  useEffect(() => {
    const storedUser = localStorage.getItem('airwork_user');
    if (storedUser) {
      setUsername(storedUser);
      fetchProjects(storedUser);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchTasksAndMembers(selectedProject.id);
      setInviteToken(null); 
    } else {
      setTasks([]);
      setMembers([]);
      fetchProjects(username); 
    }
  }, [selectedProject, username]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    const handleSync = () => {  
      fetchProjects(username); 
      if (selectedProject) {
        fetchTasksAndMembers(selectedProject.id);
      }
    };
    if (api && api.onSyncRefresh) {
      const unsubscribe = api.onSyncRefresh(handleSync);
      return () => unsubscribe?.();
    }
  }, [selectedProject, username]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api && api.onPeerDiscovered) {
      const unsubscribe = api.onPeerDiscovered((peerData: any) => {
        setRadarPeers((prev) => {
          if (prev.find(p => p.id === peerData.id)) return prev;
          return [...prev, peerData];
        });
      });
      return () => unsubscribe?.();
    }
  }, []);

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

  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinToken.trim()) return;
    
    setJoinStatus('Knocking on the local network...');
    
    try {
      const api = (window as any).electronAPI;
      const result = await api.joinProject({ token: joinToken, userId: username });

      if (result.success) {
         setJoinStatus('Access Granted! Syncing project data...');
         
         setTimeout(() => {
           fetchProjects(username); 
           setIsJoinModalOpen(false);
           setJoinToken('');
           setJoinStatus('');
         }, 2500); 
      } else {
         setJoinStatus(result.error || 'Failed to join project. Is the host online?');
      }
    } catch (error) {
       setJoinStatus('Network error.');
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
    <div className="flex h-screen bg-zinc-100 text-zinc-900 font-sans selection:bg-zinc-950 selection:text-white relative overflow-hidden">
      
      {/* ==================== DISTINCT ZINC GREY SIDEBAR ==================== */}
      <aside className="my-3 ml-3 w-[270px] bg-zinc-800 text-white flex flex-col z-20 py-4 px-3 border border-zinc-700/80 rounded-2xl shadow-xl shrink-0">
        
        {/* Header Card */}
        <div className="flex items-center justify-between px-3 py-2.5 mb-5 bg-zinc-900/90 rounded-xl border border-zinc-700/70 shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-zinc-950 font-black text-xs tracking-tighter shadow-2xs">
              AW
            </div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">AirWork</h1>
          </div>
          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-600 text-[9px] font-mono font-bold uppercase rounded-md">
            P2P
          </span>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto space-y-5 scrollbar-thin pr-0.5">
          {/* Main Views */}
          <div>
            <div className="space-y-1">
              <button 
                onClick={() => { setSelectedProject(null); setShowGlobalChat(false); setShowProfile(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  !selectedProject && !showGlobalChat && !showProfile 
                    ? 'bg-zinc-950 text-white shadow-sm border border-zinc-900 font-bold' 
                    : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Overview
              </button>
              
              <button 
                onClick={() => { setSelectedProject(null); setShowGlobalChat(true); setShowProfile(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  !selectedProject && showGlobalChat && !showProfile 
                    ? 'bg-zinc-950 text-white shadow-sm border border-zinc-900 font-bold' 
                    : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                Global Chat
              </button>
            </div>
          </div>

          {/* Projects Menu */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Projects</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsJoinModalOpen(true)} className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-md transition-all" title="Join via Token">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </button>
                <button onClick={() => setIsModalOpen(true)} className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-md transition-all" title="New Project">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            
            <div className="space-y-1">
              {projects.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-zinc-400 italic">No projects created yet.</div>
              ) : (
                projects.map((project) => {
                  const isActive = selectedProject?.id === project.id;
                  return (
                    <button 
                      key={project.id} 
                      onClick={() => {
                        setSelectedProject(project);
                        setShowGlobalChat(false);
                        setShowProfile(false); 
                        setActiveTab('kanban');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                        isActive 
                          ? 'bg-zinc-950 text-white shadow-sm border border-zinc-900 font-bold' 
                          : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-zinc-400'}`}></span>
                        <span className="truncate">{project.name}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Network Radar UI */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                LAN Radar
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            
            <div className="space-y-1.5">
              {radarPeers.length === 0 ? (
                <div className="py-2.5 px-2.5 border border-dashed border-zinc-700/70 rounded-xl text-center">
                  <p className="text-[10px] text-zinc-400 font-mono animate-pulse">Scanning local network...</p>
                </div>
              ) : (
                radarPeers.map((peer, idx) => (
                  <div key={idx} className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/70 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-5 h-5 rounded bg-zinc-700 text-white flex items-center justify-center text-[10px] font-bold">
                        {peer.user?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span className="text-zinc-200 font-medium truncate">{peer.user}</span>
                    </div>
                    <button 
                      onClick={async () => {
                        const api = (window as any).electronAPI;
                        const result = await api.trustPeer(peer.id);
                        if (result.success) {
                          alert(`Peer ${peer.user} trusted!`);
                        } else {
                          alert(`Error trusting peer: ${result.error}`);
                        }
                      }}
                      className="text-[10px] font-bold bg-white text-zinc-950 hover:bg-zinc-200 px-2 py-0.5 rounded transition-all"
                    >
                      Trust
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Profile Footer */}
        <button 
          onClick={() => { setSelectedProject(null); setShowGlobalChat(false); setShowProfile(true); }}
          className={`w-full mt-3 p-2.5 rounded-xl shrink-0 text-left transition-all border ${
            showProfile 
              ? 'bg-zinc-950 border-zinc-900 text-white shadow-sm' 
              : 'bg-zinc-900/80 border-zinc-700/70 hover:bg-zinc-950 hover:border-zinc-900 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-black text-xs shadow-2xs">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left truncate">
              <div className="text-xs font-bold text-white capitalize truncate">{username}</div>
              <div className="text-[10px] text-zinc-400 font-mono">Local Vault Admin</div>
            </div>
          </div>
        </button>
      </aside>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-zinc-100">
        
        {/* Top Navbar Header */}
        <header className="h-16 border-b border-zinc-200 bg-white px-6 flex items-center justify-between shrink-0 z-10">
          
          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-zinc-950 font-bold">
                {selectedProject ? selectedProject.name : (showGlobalChat ? 'Global Chat' : (showProfile ? 'User Settings' : 'Overview'))}
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New Project
            </button>
          </div>

        </header>

        {/* Main Body View */}
        <main className="flex-1 overflow-auto p-6 flex flex-col min-h-0 min-w-0">
          {showProfile ? (
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 flex-1">
              <Profile 
                currentUsername={username} 
                onLogout={async () => {
                  const api = (window as any).electronAPI;
                  await api.logout();
                  localStorage.removeItem('airwork_user');
                  window.location.href = '/'; 
                }} 
              />
            </div>
          ) : !selectedProject ? (
            showGlobalChat ? (
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col min-h-0">
                 <LocalChat 
                   selectedProject={{ id: 'global', name: 'Global Watercooler' }} 
                   username={username} 
                 />
              </div>
            ) : (
              <div className="flex-1 max-w-6xl mx-auto w-full">
                 <div className="mb-8">
                   <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 mb-1">
                     Welcome, <span className="capitalize">{username}</span>
                   </h2>
                   <p className="text-zinc-500 font-medium text-sm">
                     Zero-cloud offline desktop node. Select or create a project to collaborate.
                   </p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Stat Card 1 */}
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-zinc-200 flex flex-col justify-between h-40">
                      <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-900">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <div>
                        <div className="text-3xl font-black text-zinc-950">{projects.length}</div>
                        <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mt-1">Local Projects</div>
                      </div>
                    </div>
                    
                    {/* Stat Card 2 */}
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-zinc-200 flex flex-col justify-between h-40">
                      <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-900">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      </div>
                      <div>
                        <div className="text-3xl font-black text-zinc-950">{totalTasksCount}</div>
                        <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mt-1">Pending Tasks</div>
                      </div>
                    </div>
                    
                    {/* Stat Card 3 (Network Status) */}
                    <div className="p-6 bg-zinc-950 text-white rounded-2xl shadow-sm border border-zinc-800 flex flex-col justify-between h-40">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-white">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                        </div>
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">Encrypted P2P</div>
                        <div className="text-zinc-400 text-xs font-mono mt-0.5">LAN Synchronization Ready</div>
                      </div>
                    </div>
                 </div>
              </div>
            )
          ) : (
            // PROJECT VIEW AREA
            <div className="flex flex-col h-full w-full min-h-0 min-w-0">
              
              {/* Project Sub-Header Navigation */}
              <div className="flex items-center gap-2 mb-4 bg-zinc-200/60 p-1 rounded-xl w-max border border-zinc-200">
                {[
                  { id: 'kanban', label: 'Kanban Tasks' },
                  { id: 'docs', label: 'Documents' },
                  { id: 'chat', label: 'P2P Chat' },
                  { id: 'settings', label: 'Settings' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.id 
                        ? 'bg-white shadow-xs text-zinc-950 border border-zinc-200' 
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* View Content Container */}
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-auto p-6 flex flex-col min-h-[500px]">
                
                {activeTab === 'kanban' && (
                  <KanbanBoard 
                    selectedProject={selectedProject} 
                    members={members} 
                    tasks={tasks} 
                    setTasks={setTasks} 
                    fetchTasksAndMembers={fetchTasksAndMembers} 
                    username={username}
                  />
                )}

                {activeTab === 'docs' && (
                  <Documents 
                    selectedProject={selectedProject} 
                    username={username} 
                  />
                )}
                
                {activeTab === 'chat' && (
                  <LocalChat 
                    selectedProject={selectedProject} 
                    username={username}
                    members={members} 
                  />
                )}
                
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

      {/* ==================== CREATE PROJECT MODAL ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-xl font-bold text-zinc-950 mb-1">Create Local Project</h3>
            <p className="text-xs text-zinc-500 mb-6">Initialize an encrypted project repository on your device.</p>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">Project Name</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)} 
                  placeholder="e.g. Apollo Protocol" 
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all" 
                  required 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-3 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 py-3 bg-zinc-950 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 hover:bg-black shadow-sm"
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== JOIN PROJECT MODAL ==================== */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-xl font-bold text-zinc-950 mb-1">Join Project Workspace</h3>
            <p className="text-xs text-zinc-500 mb-6">Paste a P2P invite token to synchronize with host peer.</p>
            
            <form onSubmit={handleJoinProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">Invite Token</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={joinToken} 
                  onChange={(e) => setJoinToken(e.target.value)} 
                  placeholder="e.g. aw-a1b2c3d4e5" 
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-mono text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all" 
                  required 
                />
              </div>

              {joinStatus && (
                <div className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${joinStatus.includes('Failed') || joinStatus.includes('error') ? 'bg-zinc-100 text-zinc-900 border-zinc-300' : 'bg-zinc-900 text-white border-zinc-950'}`}>
                  {joinStatus}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsJoinModalOpen(false); setJoinStatus(''); }} 
                  className="flex-1 py-3 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-zinc-950 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 hover:bg-black shadow-sm"
                >
                  Connect & Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}