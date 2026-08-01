// src/app/dashboard/Settings.tsx
'use client';

interface SettingsProps {
  members: any[];
  inviteToken: string | null;
  handleGenerateInvite: () => void;
}

export default function Settings({ members, inviteToken, handleGenerateInvite }: SettingsProps) {
  return (
    <div className="max-w-4xl w-full mx-auto space-y-6 animate-in fade-in duration-150 pb-6">
      
      {/* Invite Section */}
      <div className="bg-white border border-zinc-200 shadow-2xs rounded-2xl p-6">
        <h3 className="text-lg font-bold text-zinc-950 mb-1">Project Peer Access</h3>
        <p className="text-xs font-medium text-zinc-500 mb-6 max-w-2xl">
          Generate encrypted P2P invite tokens to sync this project vault directly over your local area network (LAN).
        </p>
        
        {inviteToken ? (
          <div className="p-5 bg-zinc-950 text-white rounded-xl shadow-sm border border-zinc-900">
            <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2">Active LAN Invite Token (24h validity)</p>
            <div className="flex gap-3 items-center">
              <code className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 text-white font-mono text-sm rounded-lg selection:bg-white selection:text-zinc-950">
                {inviteToken}
              </code>
              <button 
                onClick={() => { navigator.clipboard.writeText(inviteToken); alert("Copied to clipboard!"); }}
                className="px-5 py-3 bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold rounded-lg transition-all shadow-2xs"
              >
                Copy Token
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleGenerateInvite}
            className="px-6 py-3 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-2xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Generate Invite Token
          </button>
        )}
      </div>

      {/* Roster Section */}
      <div className="bg-white border border-zinc-200 shadow-2xs rounded-2xl p-6">
        <h3 className="text-lg font-bold text-zinc-950 mb-4">Active Roster</h3>
        
        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="text-xs font-medium text-zinc-400 italic">No members joined yet.</p>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-950 text-white rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                    {member.username.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-950 capitalize">{member.username}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Joined {new Date(member.joined_at + 'Z').toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                  member.role === 'admin' ? 'bg-zinc-950 text-white border-zinc-950' : 'bg-white text-zinc-700 border-zinc-200'
                }`}>
                  {member.role}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
        <h3 className="text-base font-bold text-zinc-950 mb-1">Danger Zone</h3>
        <p className="text-xs font-medium text-zinc-500 mb-4">
          Permanently remove project database tables and records from your local storage.
        </p>
        <button className="px-5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 border border-zinc-300 text-xs font-bold rounded-xl transition-all shadow-2xs">
          Delete Project Vault
        </button>
      </div>

    </div>
  );
}