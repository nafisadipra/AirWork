'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, LayoutGrid, FileText } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });

  // Emergency Kit Modal States
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'sentence' | 'grid'>('sentence');

  const handleCopyPhrase = () => {
    if (recoveryPhrase) {
      navigator.clipboard.writeText(recoveryPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'info', message: isRecoveryMode ? 'Recovering vault...' : 'Authenticating...' });

    try {
      const api = (window as any).electronAPI;
      
      const result = isLogin
        ? await api.login({ userId, password })
        : await api.register({ userId, email, password });

      if (result.success) {
        localStorage.setItem('airwork_user', userId);

        if (!isLogin && result.recoveryPhrase) {
          setRecoveryPhrase(result.recoveryPhrase);
          setShowRecoveryModal(true);
        } else {
          setStatus({ type: 'success', message: 'Success! Decrypting vault...' });
          setTimeout(() => {
            router.push('/dashboard');
          }, 800);
        }

      } else {
        setStatus({ type: 'error', message: result.error || 'Authentication failed' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Bridge connection error' });
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setIsRecoveryMode(false);
    setStatus({ type: '', message: '' });
  };

  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-zinc-900 selection:text-white overflow-hidden flex">
      
      {/* ==================== FORM PANEL ==================== */}
      <div 
        className={`absolute top-0 left-0 w-full lg:w-1/2 h-full flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white z-10 transition-transform duration-700 ease-in-out ${
          isLogin ? 'translate-x-0' : 'lg:translate-x-full'
        }`}
      >
        {/* Top Left Branding */}
        <div className="absolute top-10 left-8 sm:left-16 lg:left-24 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-white font-black text-sm tracking-tighter">
            AW
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 uppercase">
            AirWork
          </h1>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-sm mx-auto mt-12">
          <h2 className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tight mb-2 transition-all">
            {isRecoveryMode ? 'Vault Recovery' : isLogin ? 'Welcome Back' : 'Get Started'}
          </h2>
          <p className="text-zinc-500 font-medium mb-8 text-sm">
            {isRecoveryMode 
              ? 'Enter your 24-word emergency recovery phrase to restore your vault.' 
              : isLogin 
                ? 'Sign in to access your offline-first encrypted workspace' 
                : 'Create your local identity with Signal Protocol security'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* User ID Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">User ID</label>
              <input 
                type="text" 
                placeholder="e.g. alex_dev"
                value={userId} 
                onChange={(e) => setUserId(e.target.value)} 
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-medium" 
                required 
              />
            </div>

            {/* Email Input (Only on Sign Up) */}
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  placeholder="alex@example.com"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-medium" 
                  required={!isLogin} 
                />
              </div>
            )}
            
            {/* Password / Recovery Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                {isRecoveryMode ? '24-Word Recovery Phrase' : 'Master Password'}
              </label>
              {isRecoveryMode ? (
                <textarea 
                  placeholder="Paste your 24-word seed phrase..."
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-mono resize-none" 
                  rows={3}
                  required 
                />
              ) : (
                <input 
                  type="password" 
                  placeholder="••••••••••••"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-medium" 
                  required 
                />
              )}
            </div>

            {/* Forgot Password Link */}
            {isLogin && !isRecoveryMode && (
              <div className="flex justify-end pt-0.5">
                <button 
                  type="button" 
                  onClick={() => setIsRecoveryMode(true)}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
                >
                  Use 24-Word Recovery Phrase?
                </button>
              </div>
            )}

            {/* Cancel Recovery Link */}
            {isRecoveryMode && (
              <div className="flex justify-end pt-0.5">
                <button 
                  type="button" 
                  onClick={() => setIsRecoveryMode(false)}
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition-colors"
                >
                  Back to Password Login
                </button>
              </div>
            )}

            {/* Status Banner */}
            {status.message && (
              <div className={`p-3 text-xs font-semibold rounded-xl mt-2 border ${
                status.type === 'error' ? 'bg-zinc-100 text-zinc-900 border-zinc-300' : 
                status.type === 'success' ? 'bg-zinc-900 text-white border-zinc-950' : 
                'bg-zinc-100 text-zinc-800 border-zinc-200'
              }`}>
                {status.message}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button 
                type="submit" 
                className="w-full py-3.5 bg-zinc-950 hover:bg-black text-white rounded-xl text-sm font-bold shadow-lg shadow-zinc-950/10 transition-all active:scale-[0.98]"
              >
                {isRecoveryMode ? 'Restore Vault' : isLogin ? 'Sign In' : 'Create Vault & Account'}
              </button>
            </div>
          </form>

          {/* Mobile-only toggle fallback */}
          <div className="mt-8 text-center text-sm text-zinc-500 lg:hidden">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              onClick={toggleMode} 
              className="font-bold text-zinc-950 underline underline-offset-4"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== SLIDING GRADIENT PANEL ==================== */}
      <div 
        className={`absolute top-0 left-1/2 w-1/2 h-full hidden lg:flex flex-col justify-center items-center p-16 z-20 transition-transform duration-700 ease-in-out ${
          isLogin ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute inset-0 bg-zinc-950 shadow-2xl border-l border-zinc-800 flex flex-col justify-between p-12">
          {/* Background subtle noise/grid patterns */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <div className="relative z-10 flex justify-end">
            <span className="text-xs font-mono tracking-widest text-zinc-500 uppercase border border-zinc-800 px-3 py-1.5 rounded-full bg-zinc-900/50">
              Signal Protocol AES-256
            </span>
          </div>

          <div className="relative z-10 max-w-md text-center flex flex-col items-center mx-auto">
            <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
              {isLogin ? 'New to AirWork?' : 'Welcome Back'}
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              {isLogin 
                ? 'Offline-first, end-to-end encrypted collaboration. Initialize your local identity and manage projects without cloud servers.' 
                : 'Connect with your local P2P mesh network, share documents, and collaborate in real-time.'}
            </p>
            
            <button 
              onClick={toggleMode}
              className="px-8 py-3 bg-zinc-900 border border-zinc-700 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 hover:border-zinc-500 transition-all active:scale-95 shadow-lg"
            >
              {isLogin ? 'Create Account' : 'Sign In'}
            </button>
          </div>

          <div className="relative z-10 text-center text-xs text-zinc-600 font-mono">
            AirWork Encrypted Desktop Core • Zero Cloud Tracking
          </div>
        </div>
      </div>

      {/* ==================== EMERGENCY KIT MODAL ==================== */}
      {showRecoveryModal && recoveryPhrase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-8 shadow-2xl border border-zinc-200 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-950 flex items-center justify-center rounded-xl text-white font-bold text-lg">
                  🔑
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-950">Emergency Recovery Kit</h2>
                  <p className="text-xs text-zinc-500 font-medium">Store your 24-word recovery phrase securely offline</p>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('sentence')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === 'sentence'
                      ? 'bg-white text-zinc-950 shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Sentence View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-zinc-950 shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Word Grid
                </button>
              </div>
            </div>

            <p className="text-zinc-600 mb-6 text-xs leading-relaxed border-l-2 border-zinc-950 pl-3">
              If you lose your master password, this <strong>24-word phrase</strong> is the only method to decrypt your vault data. 
              AirWork zero-knowledge architecture cannot reset passwords for you.
            </p>

            {/* Sentence View */}
            {viewMode === 'sentence' ? (
              <div className="relative mb-6 bg-zinc-50 p-5 rounded-xl border border-zinc-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Full Seed Phrase (Sentence)</span>
                  <button
                    type="button"
                    onClick={handleCopyPhrase}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-950 hover:text-zinc-700 bg-white border border-zinc-200 px-3 py-1 rounded-lg shadow-2xs hover:bg-zinc-50 transition-all active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Copy Sentence</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 bg-white border border-zinc-200 rounded-lg text-sm font-mono text-zinc-900 font-medium leading-relaxed tracking-wide select-all shadow-2xs break-words">
                  {recoveryPhrase}
                </div>
              </div>
            ) : (
              /* Grid View */
              <div className="relative mb-6 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={handleCopyPhrase}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-950 hover:text-zinc-700 bg-white border border-zinc-200 px-3 py-1 rounded-lg shadow-2xs hover:bg-zinc-50 transition-all active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Copy All Words</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {recoveryPhrase.split(' ').map((word, i) => (
                    <div key={i} className="flex gap-2 items-center px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-2xs">
                      <span className="text-[10px] font-mono text-zinc-400 w-4">{i + 1}</span>
                      <span className="text-xs font-mono font-bold text-zinc-900">{word}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCopyPhrase}
                className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  copied
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-300'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    Phrase Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-zinc-700" />
                    Copy Recovery Phrase
                  </>
                )}
              </button>

              <button 
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-3.5 px-4 bg-zinc-950 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-black transition-all active:scale-95"
              >
                I Have Saved My Recovery Phrase
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}