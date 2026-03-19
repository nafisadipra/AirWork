// src/app/dashboard/dashboard.tsx
'use client';

import { useState, useEffect } from 'react'; // <--- 1. Added React hooks

export default function Dashboard() {
  // <--- 2. Added state to hold the username
  const [username, setUsername] = useState('User');

  // <--- 3. Tell React to grab the name from localStorage when the page loads
  useEffect(() => {
    const storedUser = localStorage.getItem('airwork_user');
    if (storedUser) {
      setUsername(storedUser);
    }
  }, []);

  return (
    <div className="flex h-screen bg-[#121212] text-[#E0E0E0] font-sans selection:bg-blue-500/30">
      
      {/* SIDEBAR */}
      <div className="w-[260px] bg-[#0A0A0A] border-r border-[#2A2A2A] flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-[#2A2A2A]">
          <h1 className="text-sm font-bold tracking-wide text-white">AirWork</h1>
          <span className="ml-2 px-1.5 py-0.5 bg-[#2A2A2A] text-[#A0A0A0] text-[10px] font-bold uppercase tracking-wider rounded-sm">
            Local
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          <div>
            <h3 className="px-2 text-xs font-bold text-[#666666] uppercase tracking-wider mb-2">Workspace</h3>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-2 py-1.5 bg-[#1A2633] text-[#4DA6FF] rounded-sm text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Overview
              </button>
              <button className="w-full flex items-center gap-3 px-2 py-1.5 text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-[#E0E0E0] rounded-sm text-sm font-medium transition-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Recent Activity
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">Projects</h3>
              <button className="text-[#666666] hover:text-white transition-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            <div className="space-y-1">
              <div className="px-2 py-2 text-xs text-[#666666]">No projects created.</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#2A2A2A] bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            {/* <--- 4. Dynamic Avatar ---> */}
            <div className="w-8 h-8 bg-[#0066FF] flex items-center justify-center text-sm font-bold text-white rounded-sm uppercase">
              {username.charAt(0)}
            </div>
            <div className="flex-1 text-left">
              {/* <--- 5. Dynamic Username ---> */}
              <div className="text-sm font-bold text-white capitalize">{username}</div>
              <div className="text-[11px] text-[#808080] font-medium">Administrator</div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-14 bg-[#121212] border-b border-[#2A2A2A] flex items-center justify-between px-6">
          <h2 className="text-sm font-bold text-[#E0E0E0]">Dashboard</h2>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-2 text-[#666666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-64 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm pl-9 pr-3 py-1.5 text-sm text-white placeholder-[#666666] focus:outline-none focus:border-[#0066FF] transition-none"
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
          <div className="max-w-md w-full border border-[#2A2A2A] bg-[#0A0A0A] p-10 text-center">
            <div className="w-12 h-12 bg-[#1A1A1A] border border-[#2A2A2A] mx-auto mb-5 flex items-center justify-center rounded-sm">
              <svg className="w-6 h-6 text-[#A0A0A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Vault is Empty</h2>
            <p className="text-sm text-[#808080] mb-8 leading-relaxed">
              Create a new secure workspace to begin. All data remains encrypted on your local hardware.
            </p>
            <button className="w-full py-2.5 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-sm text-sm font-bold flex items-center justify-center gap-2 transition-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Initialize Project
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}