// src/app/dashboard/Settings.tsx
'use client';

interface SettingsProps {
  members: any[];
  inviteToken: string | null;
  handleGenerateInvite: () => void;
}

export default function Settings({ members, inviteToken, handleGenerateInvite }: SettingsProps) {
  
  // Helper to colorize members uniquely
  const getAvatarColor = (index: number) => {
    const colors = ['bg-[#0066FF]', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
    return colors[index % colors.length];
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Invite Section */}
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-sm p-6">
        <h3 className="text-lg font-bold text-white mb-2">Team Access</h3>
        <p className="text-sm text-[#808080] mb-6">
          AirWork connects directly peer-to-peer. Generate a temporary, encrypted invite token to allow a collaborator to sync with this project vault.
        </p>
        
        {inviteToken ? (
          <div className="p-4 bg-green-900/20 border border-green-800 rounded-sm">
            <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-2">Active Invite Token (Expires in 24h)</p>
            <div className="flex gap-3">
              <code className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-green-800 text-white font-mono text-lg rounded-sm selection:bg-green-500/30">
                {inviteToken}
              </code>
              <button 
                onClick={() => { navigator.clipboard.writeText(inviteToken); alert("Copied!"); }}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-sm transition-none"
              >
                Copy
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleGenerateInvite}
            className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-white text-sm font-bold rounded-sm flex items-center gap-2 transition-none"
          >
            <svg className="w-4 h-4 text-[#0066FF] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Generate Invite Token
          </button>
        )}
      </div>

      {/* Roster Section */}
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-sm p-6">
        <h3 className="text-lg font-bold text-white mb-6">Active Roster</h3>
        
        <div className="space-y-3">
          {members.map((member, index) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 ${getAvatarColor(index)} rounded-full flex items-center justify-center text-white font-bold uppercase`}>
                  {member.username.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-white capitalize">{member.username}</div>
                  <div className="text-[11px] text-[#666] font-medium uppercase tracking-wider">
                    Joined {new Date(member.joined_at + 'Z').toLocaleDateString()}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm ${
                member.role === 'admin' ? 'bg-[#0066FF]/20 text-[#4DA6FF] border border-[#0066FF]/50' : 'bg-[#2A2A2A] text-[#A0A0A0]'
              }`}>
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-900/50 rounded-sm p-6">
        <h3 className="text-lg font-bold text-red-500 mb-2">Danger Zone</h3>
        <p className="text-sm text-[#808080] mb-4">Deleting a project will permanently destroy all underlying SQLite rows.</p>
        <button className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900 text-sm font-bold rounded-sm transition-none">
          Delete Project Vault
        </button>
      </div>

    </div>
  );
}