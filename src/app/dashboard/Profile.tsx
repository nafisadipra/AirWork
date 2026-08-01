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
    setSaveStatus('Saving changes...');
    const api = (window as any).electronAPI;
    const result = await api.updateProfile({
      userId: currentUsername,
      username: profile.username,
      email: profile.email,
      about: profile.about_me
    });
    
    if (result.success) {
      setSaveStatus('Profile updated.');
      if (profile.username !== currentUsername) {
        localStorage.setItem('airwork_user', profile.username);
        window.location.reload();
      }
      setTimeout(() => setSaveStatus(''), 3000);
    } else {
      setSaveStatus('Failed to update profile.');
    }
  };

  const handleAliasUpdate = async (projectId: string, nickname: string) => {
    const api = (window as any).electronAPI;
    await api.updateProjectAlias({ userId: currentUsername, projectId, nickname });
    loadProfile();
  };

  const handleDeleteProfile = async () => {
    const confirmed = window.confirm("WARNING: Permanently delete local database and identity? This cannot be undone.");
    if (confirmed) {
      const api = (window as any).electronAPI;
      await api.deleteProfile(currentUsername);
      localStorage.removeItem('airwork_user');
      window.location.href = '/';
    }
  };

  if (loading) return <div className="p-6 text-zinc-400 text-xs font-mono">Loading profile securely...</div>;

  return (
    <div className="flex-1 p-2 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">Identity & Vault Security</h2>
        <p className="text-xs text-zinc-500 font-medium">Manage your cryptographic profile and local aliases</p>
      </div>

      {/* GLOBAL IDENTITY */}
      <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-2xs">
        <h3 className="text-xs font-bold text-zinc-950 mb-4 uppercase tracking-wider">Global Identity</h3>
        <form onSubmit={handleSaveGlobal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">Username</label>
              <input 
                type="text" 
                value={profile.username}
                onChange={(e) => setProfile({...profile, username: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 font-medium" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">Email Address</label>
              <input 
                type="email" 
                value={profile.email}
                onChange={(e) => setProfile({...profile, email: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 font-medium" 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">About Me</label>
            <textarea 
              value={profile.about_me}
              onChange={(e) => setProfile({...profile, about_me: e.target.value})}
              rows={3}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 resize-none font-medium" 
              placeholder="Your public role or skills..."
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="px-5 py-2.5 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-2xs">
              Save Profile
            </button>
            {saveStatus && <span className="text-xs font-semibold text-zinc-600">{saveStatus}</span>}
          </div>
        </form>
      </div>

      {/* PROJECT ALIASES */}
      <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-2xs">
        <h3 className="text-xs font-bold text-zinc-950 mb-1 uppercase tracking-wider">Workspace Nicknames</h3>
        <p className="text-xs text-zinc-500 mb-4 font-medium">Customize how your display name appears in individual project vaults.</p>
        
        {aliases.length === 0 ? (
           <p className="text-xs text-zinc-400 italic">No project memberships found.</p>
        ) : (
          <div className="space-y-2">
            {aliases.map(alias => (
              <div key={alias.project_id} className="flex items-center justify-between bg-zinc-50 p-3 border border-zinc-200 rounded-xl">
                <span className="text-xs font-bold text-zinc-950">{alias.project_name}</span>
                <input 
                  type="text"
                  defaultValue={alias.nickname || ''}
                  placeholder="Default username"
                  onBlur={(e) => handleAliasUpdate(alias.project_id, e.target.value)}
                  className="w-60 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 font-medium"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DANGER ZONE */}
      <div className="p-6 bg-zinc-50 border border-zinc-300 rounded-2xl">
        <h3 className="text-xs font-bold text-zinc-950 mb-3 uppercase tracking-wider">Vault Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={onLogout}
            className="px-5 py-2.5 border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-2xs"
          >
            Sign Out of Vault
          </button>
          <button 
            onClick={handleDeleteProfile}
            className="px-5 py-2.5 border border-zinc-950 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-2xs"
          >
            Delete Vault Identity
          </button>
        </div>
      </div>
    </div>
  );
}