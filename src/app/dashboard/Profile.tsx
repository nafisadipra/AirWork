import { useState, useEffect } from 'react';

export default function Profile({ 
  currentUsername, 
  onLogout 
}: { 
  currentUsername: string, 
  onLogout: () => void 
}) {
  const [profile, setProfile] = useState({ username: '', email: '', about_me: '' });
  const [aliases, setAliases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    loadProfile();
  }, [currentUsername]);

  const loadProfile = async () => {
    const api = (window as any).electronAPI;
    const result = await api.getProfile(currentUsername);
    if (result.success) {
      setProfile({
        username: result.profile.username || '',
        email: result.profile.email || '',
        about_me: result.profile.about_me || ''
      });
      setAliases(result.aliases || []);
    }
    setLoading(false);
  };

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Saving...');
    const api = (window as any).electronAPI;
    const result = await api.updateProfile({
      userId: currentUsername,
      username: profile.username,
      email: profile.email,
      about: profile.about_me
    });
    
    if (result.success) {
      setSaveStatus('Profile updated successfully.');
      if (profile.username !== currentUsername) {
        localStorage.setItem('airwork_user', profile.username);
        window.location.reload(); // Reload to update global state
      }
      setTimeout(() => setSaveStatus(''), 3000);
    } else {
      setSaveStatus('Failed to update profile.');
    }
  };

  const handleAliasUpdate = async (projectId: string, nickname: string) => {
    const api = (window as any).electronAPI;
    await api.updateProjectAlias({ userId: currentUsername, projectId, nickname });
    loadProfile(); // Refresh
  };

  const handleDeleteProfile = async () => {
    const confirmed = window.confirm("WARNING: This will permanently delete your local database, encryption keys, and all projects you host. This action cannot be undone. Proceed?");
    if (confirmed) {
      const api = (window as any).electronAPI;
      await api.deleteProfile(currentUsername);
      localStorage.removeItem('airwork_user');
      window.location.href = '/'; // Redirect to login
    }
  };

  if (loading) return <div className="p-8 text-[#A0A0A0]">Loading profile securely...</div>;

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Identity & Security</h2>

      {/* GLOBAL IDENTITY */}
      <div className="mb-8 p-6 bg-[#121212] border border-[#2A2A2A] rounded-sm">
        <h3 className="text-sm font-bold text-[#E0E0E0] mb-4 uppercase tracking-wider">Global Profile</h3>
        <form onSubmit={handleSaveGlobal} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#666666] uppercase mb-1">Username</label>
              <input 
                type="text" 
                value={profile.username}
                onChange={(e) => setProfile({...profile, username: e.target.value})}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#666666] uppercase mb-1">Email (Optional)</label>
              <input 
                type="email" 
                value={profile.email}
                onChange={(e) => setProfile({...profile, email: e.target.value})}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]" 
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#666666] uppercase mb-1">About Me</label>
            <textarea 
              value={profile.about_me}
              onChange={(e) => setProfile({...profile, about_me: e.target.value})}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF] resize-none" 
              placeholder="A brief description about your role or skills..."
            />
          </div>
          <div className="flex items-center gap-4 pt-2">
            <button type="submit" className="px-6 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-sm transition-none">
              SAVE CHANGES
            </button>
            {saveStatus && <span className="text-xs font-medium text-[#4DA6FF]">{saveStatus}</span>}
          </div>
        </form>
      </div>

      {/* PROJECT ALIASES */}
      <div className="mb-8 p-6 bg-[#121212] border border-[#2A2A2A] rounded-sm">
        <h3 className="text-sm font-bold text-[#E0E0E0] mb-1 uppercase tracking-wider">Workspace Aliases</h3>
        <p className="text-xs text-[#808080] mb-4">Set specific nicknames for how you appear in individual projects.</p>
        
        {aliases.length === 0 ? (
           <p className="text-xs text-[#666666]">You haven't joined any projects yet.</p>
        ) : (
          <div className="space-y-3">
            {aliases.map(alias => (
              <div key={alias.project_id} className="flex items-center justify-between bg-[#0A0A0A] p-3 border border-[#2A2A2A] rounded-sm">
                <span className="text-sm font-bold text-white">{alias.project_name}</span>
                <input 
                  type="text"
                  defaultValue={alias.nickname || ''}
                  placeholder="Leave blank for global username"
                  onBlur={(e) => handleAliasUpdate(alias.project_id, e.target.value)}
                  className="w-64 bg-[#121212] border border-[#2A2A2A] rounded-sm px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0066FF]"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DANGER ZONE */}
      <div className="p-6 bg-[#1A0505] border border-red-900/50 rounded-sm">
        <h3 className="text-sm font-bold text-red-500 mb-4 uppercase tracking-wider">Danger Zone</h3>
        <div className="flex gap-4">
          <button 
            onClick={onLogout}
            className="px-6 py-2 border border-[#2A2A2A] bg-[#121212] hover:bg-[#1A1A1A] text-[#E0E0E0] text-xs font-bold rounded-sm transition-none"
          >
            LOG OUT OF VAULT
          </button>
          <button 
            onClick={handleDeleteProfile}
            className="px-6 py-2 border border-red-900/50 bg-red-900/20 hover:bg-red-900/40 text-red-500 text-xs font-bold rounded-sm transition-none"
          >
            DELETE IDENTITY FOREVER
          </button>
        </div>
      </div>
    </div>
  );
}