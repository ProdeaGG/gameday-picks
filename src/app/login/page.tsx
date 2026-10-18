'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Lock, User, KeyRound, HelpCircle, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import AvatarPickerModal from '@/components/AvatarPickerModal';

const SECURITY_QUESTIONS = [
  'What was your first favorite college football team?',
  'What was the name of your first pet?',
  'What high school mascot did you play for?',
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryType, setRecoveryType] = useState<'PIN' | 'QUESTION'>('PIN');
  const [recoverySecret, setRecoverySecret] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [avatarType, setAvatarType] = useState<'DEFAULT' | 'CUSTOM'>('DEFAULT');
  const [avatarValue, setAvatarValue] = useState('default-1');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password modal states
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotRecoveryType, setForgotRecoveryType] = useState<'PIN' | 'QUESTION'>('PIN');
  const [forgotQuestion, setForgotQuestion] = useState<string | null>(null);
  const [forgotSecret, setForgotSecret] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('...');

  React.useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setAppVersion(`v${data.version}`);
        }
      } catch {
        // ignore
      }
    };
    fetchVersion();
    const interval = setInterval(fetchVersion, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to log in');
      } else {
        router.push('/groups');
        router.refresh();
      }
    } catch {
      setError('Network error, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          recoveryType,
          recoveryQuestion: recoveryType === 'QUESTION' ? recoveryQuestion : null,
          recoverySecret,
          avatarType,
          avatarValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create account');
      } else {
        router.push('/groups');
        router.refresh();
      }
    } catch {
      setError('Network error, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/forgot-password?username=${encodeURIComponent(forgotUsername.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Account not found');
      } else {
        setForgotRecoveryType(data.recoveryType);
        setForgotQuestion(data.recoveryQuestion);
        setForgotStep(2);
      }
    } catch {
      setForgotError('Network error looking up account');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotUsername,
          recoverySecret: forgotSecret,
          newPassword: forgotNewPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Failed to reset password');
      } else {
        setForgotSuccess(data.message || 'Password reset! You can now log in.');
        setTimeout(() => {
          setIsForgotOpen(false);
          setForgotStep(1);
          setForgotSuccess(null);
          setMode('LOGIN');
          setUsername(forgotUsername);
        }, 1500);
      }
    } catch {
      setForgotError('Network error resetting password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col justify-center items-center p-4 relative">
      {/* Top-Right Version Badge */}
      <div className="fixed top-4 right-4 z-30 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-[11px] font-mono text-slate-300 shadow-lg flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{appVersion}</span>
      </div>

      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 p-2 shadow-2xl shadow-amber-500/20 mb-3">
          <Trophy className="w-8 h-8 text-slate-950 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          COLLEGE GAMEDAY <span className="text-amber-400">PICK&apos;EM</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
          Lock in your straight-up winners before Saturday 11:30 AM ET
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError(null);
            }}
            className={`py-3.5 text-xs sm:text-sm font-bold tracking-wide transition-all ${
              mode === 'LOGIN'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-900/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('SIGNUP');
              setError(null);
            }}
            className={`py-3.5 text-xs sm:text-sm font-bold tracking-wide transition-all ${
              mode === 'SIGNUP'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-900/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs sm:text-sm font-medium">
              {error}
            </div>
          )}

          {mode === 'LOGIN' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotUsername(username);
                      setForgotStep(1);
                      setForgotError(null);
                      setIsForgotOpen(true);
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  <span>{loading ? 'Logging In...' : 'Enter Broadcast Desk'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-500 pt-2">
                Mobile-persistent session keeps you logged in all season.
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Avatar Selector Preview Button */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarType === 'CUSTOM' ? avatarValue : `/avatars/${avatarValue}.svg`}
                    alt="Selected Avatar"
                    className="w-12 h-12 rounded-xl pixelated object-cover border-2 border-amber-400 bg-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Booth Avatar</span>
                    <span className="text-[10px] text-slate-400">10 Classics or Custom</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Choose</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose your handle"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all"
                  />
                </div>
              </div>

              {/* No-Email Recovery Method Toggle */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No-Email Password Recovery</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryType('PIN');
                      setRecoverySecret('');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      recoveryType === 'PIN'
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400'
                    }`}
                  >
                    4-Digit Secret PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryType('QUESTION');
                      setRecoverySecret('');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      recoveryType === 'QUESTION'
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Security Question
                  </button>
                </div>

                {recoveryType === 'PIN' ? (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Set a 4-Digit Secret PIN (for instant self-service recovery)
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={recoverySecret}
                        onChange={(e) => setRecoverySecret(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 7733"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 tracking-widest font-mono focus:outline-none focus:border-emerald-400 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={recoveryQuestion}
                      onChange={(e) => setRecoveryQuestion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                    >
                      {SECURITY_QUESTIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <HelpCircle className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={recoverySecret}
                        onChange={(e) => setRecoverySecret(e.target.value)}
                        placeholder="Your secret answer"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  <span>{loading ? 'Creating...' : 'Join GameDay Desk'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Self-Service Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Password Recovery</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {forgotStep === 1
                ? 'Enter your username to look up your recovery method.'
                : `Verify your ${forgotRecoveryType === 'PIN' ? '4-digit PIN' : 'Security Question'} to set a new password.`}
            </p>

            {forgotError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
                {forgotSuccess}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleLookupForgot} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Your Username
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
                  >
                    {loading ? 'Finding...' : 'Next'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {forgotRecoveryType === 'PIN' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Enter your 4-Digit Secret PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={forgotSecret}
                      onChange={(e) => setForgotSecret(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {forgotQuestion || 'Security Question'}
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotSecret}
                      onChange={(e) => setForgotSecret(e.target.value)}
                      placeholder="Your secret answer"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'Set New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        currentType={avatarType}
        currentValue={avatarValue}
        onSelect={(type, val) => {
          setAvatarType(type);
          setAvatarValue(val);
        }}
      />
    </div>
  );
}
