// src/app/dashboard/dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import KanbanBoard from './KanbanBoard';
import Settings from './Settings'; 
import Documents from './Documents';
import LocalChat from './LocalChat';

export default function Dashboard() {
  const [username, setUsername] = useState('User');

  // Modal & Project States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('kanban');

  // <--- NEW: GLOBAL CHAT STATE --->
  const [showGlobalChat, setShowGlobalChat] = useState(false);

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
    if (api.onSyncRefresh) {
      api.onSyncRefresh(() => {
        if (selectedProject) {
          fetchTasksAndMembers(selectedProject.id);
        } else {
          fetchProjects(username);
        }
      });
    }
  }, [selectedProject, username]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api && api.onPeerDiscovered) {
      api.onPeerDiscovered((peerData: any) => {
        setRadarPeers((prev) => {
          if (prev.find(p => p.id === peerData.id)) return prev;
          return [...prev, peerData];
        });
      });
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
         setJoinStatus('Access Granted! Decrypting project...');
         setTimeout(() => {
           setIsJoinModalOpen(false);
           setJoinToken('');
           setJoinStatus('');
           fetchProjects(username);
         }, 1500);
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
              {/* OVERVIEW BUTTON */}
              <button 
                onClick={() => { setSelectedProject(null); setShowGlobalChat(false); }}
                className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm font-medium transition-none ${
                  !selectedProject && !showGlobalChat ? 'bg-[#1A2633] text-[#4DA6FF]' : 'text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-[#E0E0E0]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Overview
              </button>
              
              {/* NEW: GLOBAL CHAT BUTTON */}
              <button 
                onClick={() => { setSelectedProject(null); setShowGlobalChat(true); }}
                className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-sm text-sm font-medium transition-none ${
                  !selectedProject && showGlobalChat ? 'bg-[#1A2633] text-[#4DA6FF]' : 'text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-[#E0E0E0]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                Global Chat
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">Projects</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsJoinModalOpen(true)} className="text-[#666666] hover:text-white transition-none" title="Join via Token">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </button>
                <button onClick={() => setIsModalOpen(true)} className="text-[#666666] hover:text-white transition-none" title="New Project">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
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
                      setShowGlobalChat(false);
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

          {/* NETWORK RADAR UI */}
          <div className="mt-8 border-t border-[#2A2A2A] pt-4">
            <div className="flex items-center justify-between px-2 mb-3">
              <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider flex items-center gap-2">
                Network Radar
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066FF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0066FF]"></span>
              </span>
            </div>
            
            <div className="space-y-1 px-1">
              {radarPeers.length === 0 ? (
                <div className="py-3 border border-dashed border-[#2A2A2A] rounded-sm text-center bg-[#121212]">
                  <p className="text-[9px] text-[#666666] uppercase font-bold tracking-wider animate-pulse">Scanning local network...</p>
                </div>
              ) : (
                radarPeers.map((peer, idx) => (
                  <div key={idx} className="w-full flex items-center justify-between px-2 py-2 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A] group">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-[#0066FF] rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">
                        {peer.user?.charAt(0) || '?'}
                      </div>
                      <span className="text-xs font-bold text-[#E0E0E0] truncate">{peer.user}</span>
                    </div>
                    <button className="text-[9px] font-bold uppercase tracking-wider text-[#4DA6FF] hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                      Ping
                    </button>
                  </div>
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
        
        {/* <--- DYNAMIC HEADER ---> */}
        <header className="h-14 bg-[#121212] border-b border-[#2A2A2A] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#E0E0E0]">
              {selectedProject ? selectedProject.name : (showGlobalChat ? 'Global Watercooler' : 'Dashboard')}
            </h2>
            {selectedProject && (
              <span className="px-1.5 py-0.5 bg-green-900/30 text-green-500 border border-green-800 text-[10px] font-bold uppercase tracking-wider rounded-sm ml-2">
                {selectedProject.role}
              </span>
            )}
            {!selectedProject && showGlobalChat && (
              <span className="px-1.5 py-0.5 bg-[#0066FF]/20 text-[#4DA6FF] border border-[#0066FF]/30 text-[10px] font-bold uppercase tracking-wider rounded-sm ml-2">
                Public Network
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col bg-[#0A0A0A]">
          {!selectedProject ? (
            // <--- RENDER EITHER GLOBAL CHAT OR OVERVIEW GRID --->
            showGlobalChat ? (
              <div className="flex-1 p-6 overflow-hidden">
                 <LocalChat 
                   selectedProject={{ id: 'global', name: 'Global Watercooler' }} 
                   username={username} 
                 />
              </div>
            ) : (
              <div className="flex-1 p-8">
                 <h2 className="text-2xl font-bold text-white mb-6">Welcome back, <span className="capitalize">{username}</span>.</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* CARD 1 */}
                    <div className="p-5 border border-[#2A2A2A] bg-[#121212] rounded-sm">
                      <div className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-2">Total Projects</div>
                      <div className="text-3xl font-light text-white">{projects.length}</div>
                    </div>
                    {/* CARD 2 */}
                    <div className="p-5 border border-[#2A2A2A] bg-[#121212] rounded-sm">
                      <div className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-2">Active Tasks</div>
                      <div className="text-3xl font-light text-white">{totalTasksCount}</div>
                    </div>
                    {/* CARD 3 */}
                    <div className="p-5 border border-[#2A2A2A] bg-[#121212] rounded-sm flex items-center justify-between">
                      <div>
                        <div className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-2">Network Status</div>
                        <div className="text-xl font-light text-[#4DA6FF]">Online</div>
                      </div>
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066FF] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0066FF]"></span>
                      </span>
                    </div>
                 </div>
              </div>
            )
          ) : (
            // <--- PROJECT TABS AREA --->
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
                
                {activeTab === 'kanban' && (
                  <KanbanBoard 
                    selectedProject={selectedProject} 
                    members={members} 
                    tasks={tasks} 
                    setTasks={setTasks} 
                    fetchTasksAndMembers={fetchTasksAndMembers} 
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

      {/* JOIN PROJECT MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-1">Join Secure Workspace</h3>
            <p className="text-xs text-[#666666] mb-6 uppercase tracking-widest font-bold">Connect via P2P Token</p>
            
            <form onSubmit={handleJoinProject} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#666666] uppercase mb-1">Invite Token</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={joinToken} 
                  onChange={(e) => setJoinToken(e.target.value)} 
                  placeholder="e.g. aw-a1b2c3d4" 
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]" 
                  required 
                />
              </div>

              {joinStatus && (
                <p className={`text-xs font-bold ${joinStatus.includes('Failed') || joinStatus.includes('error') ? 'text-red-500' : 'text-[#4DA6FF]'}`}>
                  {joinStatus}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsJoinModalOpen(false); setJoinStatus(''); }} 
                  className="flex-1 py-2 text-xs font-bold text-[#A0A0A0] hover:text-white transition-none"
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-sm transition-none disabled:opacity-50"
                >
                  CONNECT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}