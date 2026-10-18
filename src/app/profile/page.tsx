'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import AvatarPickerModal from '@/components/AvatarPickerModal';
import {
  User,
  Sparkles,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

interface UserData {
  id: number;
  username: string;
  avatarType: 'DEFAULT' | 'CUSTOM';
  avatarValue: string;
  isAdmin: boolean;
  recoveryType: 'PIN' | 'QUESTION';
  recoveryQuestion: string | null;
}

const SECURITY_QUESTIONS = [
  'What was your first favorite college football team?',
  'What was the name of your first pet?',
  'What high school mascot did you play for?',
];

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Avatar state
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [avatarType, setAvatarType] = useState<'DEFAULT' | 'CUSTOM'>('DEFAULT');
  const [avatarValue, setAvatarValue] = useState('default-1');

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Recovery state
  const [recoveryType, setRecoveryType] = useState<'PIN' | 'QUESTION'>('PIN');
  const [recoveryQuestion, setRecoveryQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [recoverySecret, setRecoverySecret] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setCurrentUser(data.user);
        setAvatarType(data.user.avatarType);
        setAvatarValue(data.user.avatarValue);
        setRecoveryType(data.user.recoveryType || 'PIN');
        if (data.user.recoveryQuestion) {
          setRecoveryQuestion(data.user.recoveryQuestion);
        }
      } catch {
        // user fetch error
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        avatarType,
        avatarValue,
      };

      if (newPassword) {
        payload.newPassword = newPassword;
      }

      if (recoverySecret) {
        payload.recoveryType = recoveryType;
        payload.recoveryQuestion = recoveryType === 'QUESTION' ? recoveryQuestion : null;
        payload.recoverySecret = recoverySecret;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setNewPassword('');
        setConfirmPassword('');
        setRecoverySecret('');
        // Refresh local user state
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            avatarType,
            avatarValue,
            recoveryType,
            recoveryQuestion: recoveryType === 'QUESTION' ? recoveryQuestion : null,
          });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error saving profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avatarSrc =
    avatarType === 'CUSTOM' ? avatarValue : `/avatars/${avatarValue}.svg`;

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col">
      <Header currentUser={currentUser} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Groups Hub</span>
          </Link>
          <span className="text-xs text-slate-500 font-mono">
            ID: #{currentUser?.id}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 pb-6 border-b border-slate-800 mb-6">
            <User className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Profile & Preferences</h1>
              <p className="text-xs text-slate-400">
                Manage your avatar, password, and security recovery
              </p>
            </div>
          </div>

          {message && (
            <div
              className={`mb-6 p-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/60 border-red-800 text-red-300'
              }`}
            >
              {message.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Avatar Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Broadcast Booth Avatar
              </label>
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt={currentUser?.username || 'Avatar'}
                    className="w-16 h-16 rounded-xl pixelated object-cover border-2 border-amber-400 bg-slate-900 shadow-md"
                  />
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {currentUser?.username}
                    </span>
                    <span className="text-xs text-slate-400">
                      {avatarType === 'CUSTOM' ? 'Custom Upload (WebP)' : `Preset: ${avatarValue}`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAvatarPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Change Avatar</span>
                </button>
              </div>
            </div>

            {/* Change Password */}
            <div className="pt-4 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Change Password (Optional)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (leave blank to keep)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Update Recovery Method */}
            <div className="pt-4 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Update Password Recovery Secret (Optional)</span>
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
                  <input
                    type="password"
                    maxLength={4}
                    value={recoverySecret}
                    onChange={(e) => setRecoverySecret(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter new 4-digit PIN (e.g. 9922)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono tracking-widest focus:outline-none focus:border-emerald-400"
                  />
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
                  <input
                    type="text"
                    value={recoverySecret}
                    onChange={(e) => setRecoverySecret(e.target.value)}
                    placeholder="Enter new secret answer"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>

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
