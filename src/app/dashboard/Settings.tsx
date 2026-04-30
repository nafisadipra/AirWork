// src/app/dashboard/Settings.tsx
'use client';

interface SettingsProps {
  members: any[];
  inviteToken: string | null;
  handleGenerateInvite: () => void;
}

export default function Settings({ members, inviteToken, handleGenerateInvite }: SettingsProps) {
  
  // Helper to colorize members uniquely with pastel colors
  const getAvatarColor = (index: number) => {
    const colors = ['bg-[#e0e7ff]', 'bg-[#fce4ec]', 'bg-[#e8f5e9]', 'bg-[#fff3e0]', 'bg-[#f3e5f5]'];
    return colors[index % colors.length];
  };

  const getAvatarTextColor = (index: number) => {
    const colors = ['text-[#3730a3]', 'text-[#880e4f]', 'text-[#1b5e20]', 'text-[#e65100]', 'text-[#4a148c]'];
    return colors[index % colors.length];
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300 pb-10">
      
      {/* Invite Section */}
      <div className="bg-white border border-neutral-100 shadow-sm rounded-[32px] p-10">
        <h3 className="text-2xl font-bold text-black mb-3 tracking-tight">Team Access</h3>
        <p className="text-sm font-medium text-neutral-500 mb-8 max-w-2xl">
          AirWork connects directly peer-to-peer. Generate a temporary, encrypted invite token to allow a collaborator to sync with this project vault over your local network.
        </p>
        
        {inviteToken ? (
          <div className="p-6 bg-[#e8f5e9] border border-[#c8e6c9] rounded-2xl shadow-inner relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white rounded-full blur-3xl opacity-40"></div>
            <p className="text-xs font-bold text-[#1b5e20] uppercase tracking-widest mb-3 relative z-10">Active Invite Token (Expires in 24h)</p>
            <div className="flex gap-4 relative z-10">
              <code className="flex-1 px-5 py-4 bg-white border border-[#a5d6a7] text-black font-mono text-lg rounded-xl shadow-sm selection:bg-[#c8e6c9]">
                {inviteToken}
              </code>
              <button 
                onClick={() => { navigator.clipboard.writeText(inviteToken); alert("Copied to clipboard!"); }}
                className="px-8 py-4 bg-[#2e7d32] hover:bg-[#1b5e20] text-white text-sm font-bold rounded-xl transition-all shadow-sm"
              >
                Copy Token
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleGenerateInvite}
            className="px-8 py-3.5 bg-black hover:bg-neutral-800 text-white text-sm font-bold rounded-full flex items-center gap-3 transition-all shadow-md"
          >
            <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Generate Invite Token
          </button>
        )}
      </div>

      {/* Roster Section */}
      <div className="bg-white border border-neutral-100 shadow-sm rounded-[32px] p-10">
        <h3 className="text-2xl font-bold text-black mb-8 tracking-tight">Active Roster</h3>
        
        <div className="space-y-4">
          {members.length === 0 ? (
            <p className="text-sm font-medium text-neutral-400 italic">No members have joined yet.</p>
          ) : (
            members.map((member, index) => (
              <div key={member.id} className="flex items-center justify-between p-4 bg-[#f4f5f8] rounded-2xl border border-transparent hover:border-neutral-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${getAvatarColor(index)} ${getAvatarTextColor(index)} rounded-xl flex items-center justify-center font-bold text-lg shadow-sm uppercase`}>
                    {member.username.charAt(0)}
                  </div>
                  <div>
                    <div className="text-base font-bold text-black capitalize">{member.username}</div>
                    <div className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-0.5">
                      Joined {new Date(member.joined_at + 'Z').toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <span className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-full shadow-inner ${
                  member.role === 'admin' ? 'bg-[#e8f2ff] text-[#0066FF] border border-blue-100' : 'bg-white text-neutral-500 border border-neutral-200'
                }`}>
                  {member.role}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#fff5f5] border border-[#ffcdd2] shadow-sm rounded-[32px] p-10">
        <h3 className="text-xl font-bold text-[#c62828] mb-3 tracking-tight">Danger Zone</h3>
        <p className="text-sm font-medium text-[#ef5350] mb-8">
          Deleting a project will permanently destroy all underlying SQLite rows and tasks from your local machine. This action cannot be undone.
        </p>
        <button className="px-6 py-3 bg-[#ffebee] hover:bg-[#ffcdd2] text-[#c62828] border border-[#ffcdd2] text-sm font-bold rounded-full transition-colors shadow-sm">
          Delete Project Vault
        </button>
      </div>

    </div>
  );
}