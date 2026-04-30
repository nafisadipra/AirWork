// src/app/dashboard/dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import KanbanBoard from './KanbanBoard';
import Settings from './Settings'; 
import Documents from './Documents';
import LocalChat from './LocalChat';
import Profile from './Profile'; 

// Helper function to map name to a pastel color
const getPastelColor = (name: string) => {
  const colors = [
    '#e0e7ff', // pastel indigo
    '#e8f5e9', // pastel green
    '#fff3e0', // pastel orange
    '#fce4ec', // pastel pink
    '#e3f2fd', // pastel blue
    '#f3e5f5', // pastel purple
    '#fff9c4', // pastel yellow
    '#eceff1', // pastel blue-grey
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Text color mapper for pastel backgrounds
const getPastelTextColor = (name: string) => {
  const colors = [
    '#3730a3', // indigo
    '#1b5e20', // green
    '#e65100', // orange
    '#880e4f', // pink
    '#0d47a1', // blue
    '#4a148c', // purple
    '#f57f17', // yellow
    '#263238', // blue-grey
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

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
      api.onSyncRefresh(handleSync);
    }
    return () => {
      if (api && api.removeSyncRefresh) {
        api.removeSyncRefresh(handleSync);
      }
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
    // Material 3 / Modern Background - solid pastel light grey
    <div className="flex h-screen bg-[#f4f5f8] text-neutral-900 font-sans selection:bg-[#e8f5e9] selection:text-[#1b5e20] relative">
      
      {/* ==================== SIDEBAR ==================== */}
      <div className="w-[300px] flex flex-col z-10 py-6 px-4">
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-4 mb-8 shrink-0">
          <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center border border-neutral-100">
            <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-black">AirWork</h1>
          <span className="ml-auto px-2 py-1 bg-white text-neutral-500 shadow-sm border border-neutral-100 text-[10px] font-bold uppercase tracking-wider rounded-full">Local</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-8 scrollbar-hide">
          {/* Workspace Menu */}
          <div>
            <div className="space-y-2">
              <button 
                onClick={() => { setSelectedProject(null); setShowGlobalChat(false); setShowProfile(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                  !selectedProject && !showGlobalChat && !showProfile ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:bg-black/5 hover:text-black'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Overview
              </button>
              
              <button 
                onClick={() => { setSelectedProject(null); setShowGlobalChat(true); setShowProfile(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                  !selectedProject && showGlobalChat && !showProfile ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:bg-black/5 hover:text-black'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                Global Chat
              </button>
            </div>
          </div>

          {/* Projects Menu */}
          <div>
            <div className="flex items-center justify-between px-4 mb-3">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Projects</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsJoinModalOpen(true)} className="p-1.5 text-neutral-400 hover:text-black hover:bg-black/5 rounded-full transition-all" title="Join via Token">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </button>
                <button onClick={() => setIsModalOpen(true)} className="p-1.5 text-neutral-400 hover:text-black hover:bg-black/5 rounded-full transition-all" title="New Project">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              {projects.length === 0 ? (
                <div className="px-5 py-3 text-sm text-neutral-400 font-medium">No projects created.</div>
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
                      className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                        isActive ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:bg-black/5 hover:text-black'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-[#2e7d32]' : 'bg-neutral-300'}`}></span>
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
            <div className="flex items-center justify-between px-4 mb-3">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                Network Radar
              </h3>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1b5e20] opacity-50"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4caf50]"></span>
              </span>
            </div>
            
            <div className="space-y-2">
              {radarPeers.length === 0 ? (
                <div className="py-5 px-4 border-2 border-dashed border-neutral-200/60 rounded-2xl text-center bg-transparent">
                  <p className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider animate-pulse">Scanning network...</p>
                </div>
              ) : (
                radarPeers.map((peer, idx) => (
                  <div key={idx} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white shadow-sm border border-neutral-100 group transition-all hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm" style={{ backgroundColor: getPastelColor(peer.user || ''), color: getPastelTextColor(peer.user || '') }}>
                        {peer.user?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-bold text-black truncate">{peer.user}</span>
                    </div>
                    <button 
                      onClick={async () => {
                        const api = (window as any).electronAPI;
                        const result = await api.trustPeer(peer.id);
                        if (result.success) {
                          alert(`Peer ${peer.user} is now trusted!`);
                        } else {
                          alert(`Failed to trust peer: ${result.error}`);
                        }
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider bg-black/5 hover:bg-black text-black hover:text-white px-3 py-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100"
                      >
                      Trust
                      </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Profile Badge */}
        <button 
          onClick={() => { setSelectedProject(null); setShowGlobalChat(false); setShowProfile(true); }}
          className={`w-full mt-4 p-4 rounded-2xl shrink-0 text-left transition-all border border-transparent hover:border-neutral-200 cursor-pointer ${showProfile ? 'bg-white shadow-sm' : 'bg-transparent hover:bg-black/5'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center text-sm font-bold rounded-xl uppercase shadow-sm" style={{ backgroundColor: getPastelColor(username), color: getPastelTextColor(username) }}>
              {username.charAt(0)}
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold text-black capitalize truncate">{username}</div>
              <div className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider">Administrator</div>
            </div>
          </div>
        </button>
      </div>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* Floating Top Nav */}
        <header className="h-24 flex items-center justify-between px-8 shrink-0 z-10">
          
          {/* Left Actions */}
          <div className="flex items-center gap-3">
             <div className="bg-white rounded-full px-5 py-3 shadow-sm border border-neutral-100 flex items-center gap-2 text-neutral-500 text-sm font-medium cursor-text">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Search...
             </div>
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white border border-neutral-100 text-black hover:bg-neutral-50 rounded-full text-sm font-bold shadow-sm transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Create Job
             </button>
          </div>

          {/* Right Floating Tabs */}
          <div className="flex items-center gap-2">
            <div className="bg-white rounded-full shadow-sm border border-neutral-100 flex items-center p-1">
               <div className="px-5 py-2 text-sm font-bold text-black flex items-center gap-2">
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {selectedProject ? selectedProject.name : (showGlobalChat ? 'Global Network' : 'Overview')}
               </div>
            </div>
            <button className="w-11 h-11 bg-white rounded-full shadow-sm border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
            </button>
          </div>

        </header>

        {/* FIX: Ensured main allows natural layout bounds using min-h-0 min-w-0 */}
        <main className="flex-1 overflow-auto px-8 pb-8 flex flex-col min-h-0 min-w-0">
          {showProfile ? (
            <div className="bg-white rounded-[32px] shadow-sm border border-neutral-100 p-8 flex-1">
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
              <div className="flex-1 bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-hidden flex flex-col min-h-0">
                 <LocalChat 
                   selectedProject={{ id: 'global', name: 'Global Watercooler' }} 
                   username={username} 
                 />
              </div>
            ) : (
              <div className="flex-1">
                 <div className="mb-10">
                   <h2 className="text-4xl font-bold tracking-tight text-black mb-2">Welcome back, <span className="capitalize">{username}</span>.</h2>
                   <p className="text-neutral-500 font-medium">Here's what's happening in your local workspace today.</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Stat Card 1 */}
                    <div className="p-8 bg-white rounded-[32px] shadow-sm border border-neutral-100 flex flex-col justify-between h-48 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-[#f4f5f8] rounded-2xl flex items-center justify-center text-black mb-4">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-black">{projects.length}</div>
                        <div className="text-neutral-500 text-sm font-bold uppercase tracking-wider mt-1">Total Projects</div>
                      </div>
                    </div>
                    {/* Stat Card 2 */}
                    <div className="p-8 bg-white rounded-[32px] shadow-sm border border-neutral-100 flex flex-col justify-between h-48 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-[#f4f5f8] rounded-2xl flex items-center justify-center text-black mb-4">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-black">{totalTasksCount}</div>
                        <div className="text-neutral-500 text-sm font-bold uppercase tracking-wider mt-1">Active Tasks</div>
                      </div>
                    </div>
                    {/* Stat Card 3 (Network Status) */}
                    <div className="p-8 bg-white rounded-[32px] shadow-sm border border-neutral-100 flex flex-col justify-between h-48 hover:shadow-md transition-shadow relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-[#e8f5e9] rounded-full blur-3xl opacity-60"></div>
                      <div className="w-12 h-12 bg-[#e8f5e9] text-[#1b5e20] rounded-2xl flex items-center justify-center mb-4 z-10 relative">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                      </div>
                      <div className="z-10 relative flex items-end justify-between">
                        <div>
                          <div className="text-3xl font-bold text-[#1b5e20]">Secure P2P</div>
                          <div className="text-neutral-500 text-sm font-bold uppercase tracking-wider mt-1">Network Status</div>
                        </div>
                        <span className="flex h-4 w-4 relative mb-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4caf50] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-[#2e7d32]"></span>
                        </span>
                      </div>
                    </div>
                 </div>
              </div>
            )
          ) : (
            // PROJECT TABS AREA 
            <div className="flex flex-col h-full w-full animate-in fade-in duration-300 min-h-0 min-w-0">
              
              <div className="flex items-center gap-3 mb-6 bg-[#ebecf0] w-max p-1.5 rounded-full shrink-0">
                {[
                  { id: 'kanban', label: 'Kanban Board' },
                  { id: 'docs', label: 'Documents' },
                  { id: 'chat', label: 'Local Chat' },
                  { id: 'settings', label: 'Settings' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
                      activeTab === tab.id ? 'bg-white shadow-sm text-black' : 'text-neutral-500 hover:text-black'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* FIX: Changed overflow-hidden to overflow-auto to fix nested scroll clipping */}
              <div className="flex-1 bg-white rounded-[32px] shadow-sm border border-neutral-100 overflow-auto p-6 flex flex-col min-h-[500px]">
                
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

      {/* ==================== INITIALIZE PROJECT MODAL ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-black mb-2 tracking-tight">Initialize New Project</h3>
            <p className="text-sm text-neutral-500 font-medium mb-8">Set up a secure, local workspace on your machine.</p>
            
            <form onSubmit={handleCreateProject} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Project Name</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)} 
                  placeholder="e.g. Project Apollo" 
                  className="w-full bg-[#f4f5f8] rounded-2xl px-5 py-4 text-sm font-semibold text-black placeholder-neutral-400 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-200 transition-all" 
                  required 
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-4 text-sm font-bold text-neutral-600 bg-[#f4f5f8] hover:bg-neutral-200 transition-colors rounded-full"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 py-4 bg-black text-white text-sm font-bold rounded-full transition-colors disabled:opacity-50 hover:bg-neutral-800 shadow-md"
                >
                  {loading ? 'Initializing...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN PROJECT MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-black mb-2 tracking-tight">Join Workspace</h3>
            <p className="text-sm text-neutral-500 font-medium mb-8">Enter a P2P Invite Token to connect on the local network.</p>
            
            <form onSubmit={handleJoinProject} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Invite Token</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={joinToken} 
                  onChange={(e) => setJoinToken(e.target.value)} 
                  placeholder="e.g. aw-a1b2c3d4e5" 
                  className="w-full bg-[#f4f5f8] rounded-2xl px-5 py-4 text-sm font-semibold text-black placeholder-neutral-400 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-200 transition-all" 
                  required 
                />
              </div>

              {joinStatus && (
                <div className={`px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 ${joinStatus.includes('Failed') || joinStatus.includes('error') ? 'bg-[#ffebee] text-[#c62828]' : 'bg-[#e8f5e9] text-[#1b5e20]'}`}>
                  {joinStatus}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsJoinModalOpen(false); setJoinStatus(''); }} 
                  className="flex-1 py-4 text-sm font-bold text-neutral-600 bg-[#f4f5f8] hover:bg-neutral-200 transition-colors rounded-full"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-black text-white text-sm font-bold rounded-full transition-colors disabled:opacity-50 hover:bg-neutral-800 shadow-md"
                >
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}