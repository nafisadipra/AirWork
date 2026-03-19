'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // <--- Added Recovery State
  
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });

  // Emergency Kit Modal States
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'info', message: isRecoveryMode ? 'Recovering vault...' : 'Authenticating...' });

    try {
      const api = (window as any).electronAPI;
      
      // If we are in Login or Recovery mode, we call api.login.
      // The backend automatically detects if the password is 24 words!
      const result = isLogin
        ? await api.login({ userId, password })
        : await api.register({ userId, email, password });

      if (result.success) {
        localStorage.setItem('airwork_user', userId);

        if (!isLogin && result.recoveryPhrase) {
          // Registration: Show the Emergency Kit Modal
          setRecoveryPhrase(result.recoveryPhrase);
          setShowRecoveryModal(true);
        } else {
          // Login / Recovery: Proceed directly to Dashboard
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
    setIsRecoveryMode(false); // Reset recovery mode if they switch tabs
    setStatus({ type: '', message: '' });
  };

  return (
    <div className="relative min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-200 overflow-hidden flex">
      
      {/* ==================== FORM PANEL ==================== */}
      <div 
        className={`absolute top-0 left-0 w-full lg:w-1/2 h-full flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white z-10 transition-transform duration-700 ease-in-out ${
          isLogin ? 'translate-x-0' : 'lg:translate-x-full'
        }`}
      >
        {/* Top Left Branding */}
        <div className="absolute top-10 left-8 sm:left-16 lg:left-24">
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900">
            AirWork
          </h1>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-sm mx-auto mt-12">
          <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-2 transition-all">
            {isRecoveryMode ? 'Recovery' : isLogin ? 'Hello!' : 'Join Us!'}
          </h2>
          <p className="text-slate-500 font-medium mb-10">
            {isRecoveryMode 
              ? 'Enter your 24-word phrase to restore access.' 
              : isLogin 
                ? 'Welcome back to the community' 
                : 'Initialize your secure offline identity'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* User ID Input (Always visible) */}
            <div>
              <input 
                type="text" 
                placeholder="User ID"
                value={userId} 
                onChange={(e) => setUserId(e.target.value)} 
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-slate-900 placeholder-gray-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all" 
                required 
              />
            </div>

            {/* Email Input (Only visible on Sign Up) */}
            {!isLogin && (
              <div>
                <input 
                  type="email" 
                  placeholder="Email Address"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-slate-900 placeholder-gray-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all" 
                  required={!isLogin} 
                />
              </div>
            )}
            
            {/* Password / Recovery Input */}
            <div>
              {isRecoveryMode ? (
                <textarea 
                  placeholder="Paste your 24-word recovery phrase here..."
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-red-200 rounded-lg text-sm text-slate-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-none" 
                  rows={3}
                  required 
                />
              ) : (
                <input 
                  type="password" 
                  placeholder="Password"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-slate-900 placeholder-gray-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all" 
                  required 
                />
              )}
            </div>

            {/* Forgot Password Link (Only visible on normal Login) */}
            {isLogin && !isRecoveryMode && (
              <div className="flex justify-end pt-1">
                <button 
                  type="button" 
                  onClick={() => setIsRecoveryMode(true)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Cancel Recovery Link (Visible only in Recovery mode) */}
            {isRecoveryMode && (
              <div className="flex justify-end pt-1">
                <button 
                  type="button" 
                  onClick={() => setIsRecoveryMode(false)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Back to Password Login
                </button>
              </div>
            )}

            {/* Status Banner */}
            {status.message && (
              <div className={`p-3 text-sm font-semibold rounded-lg mt-2 ${
                status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 
                status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 
                'bg-blue-50 text-blue-600 border border-blue-100'
              }`}>
                {status.message}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button 
                type="submit" 
                className={`w-full py-3.5 text-white rounded-full text-sm font-bold shadow-lg transition-all active:scale-[0.98] ${
                  isRecoveryMode ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
                }`}
              >
                {isRecoveryMode ? 'Recover Vault' : isLogin ? 'Log In' : 'Create Account'}
              </button>
            </div>
          </form>

          {/* Mobile-only toggle fallback */}
          <div className="mt-8 text-center text-sm text-slate-600 lg:hidden">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              onClick={toggleMode} 
              className="font-bold text-blue-600 hover:text-blue-800 transition-colors"
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
        <div className="absolute inset-0 bg-gradient-to-br from-slate-500 via-slate-700 to-slate-900 shadow-2xl">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl mix-blend-overlay"></div>
          <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-black/10 rounded-full blur-2xl mix-blend-overlay"></div>
        </div>

        <div className="relative z-10 max-w-md text-center flex flex-col items-center">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            {isLogin ? 'New to AirWork?' : 'Welcome Back!'}
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            {isLogin 
              ? 'Discover secure offline-first collaboration. Sign up to initialize your identity and start building.' 
              : 'To keep connected with your peer-to-peer network, please log in with your personal info.'}
          </p>
          
          <button 
            onClick={toggleMode}
            className="px-10 py-3 border-2 border-slate-300/30 text-white rounded-full font-bold hover:bg-white/10 hover:border-white/50 transition-all active:scale-95"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>

      {/* ==================== EMERGENCY KIT MODAL ==================== */}
      {showRecoveryModal && recoveryPhrase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-50 flex items-center justify-center rounded-full text-red-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Emergency Recovery Kit</h2>
            </div>

            <p className="text-slate-600 mb-8 text-sm leading-relaxed">
              If you forget your master password, these <strong>24 words</strong> are the only way to recover your data. AirWork cannot reset your password for you. 
              <span className="text-red-600 font-bold ml-1">Write them down and store them offline.</span>
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {recoveryPhrase.split(' ').map((word, i) => (
                <div key={i} className="flex gap-2 items-center px-2 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                  <span className="text-xs font-mono font-bold text-slate-700">{word}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full py-4 bg-slate-900 text-white rounded-full font-bold shadow-xl hover:bg-slate-800 transition-all"
            >
              I have saved my recovery phrase
            </button>
          </div>
        </div>
      )}

    </div>
  );
}