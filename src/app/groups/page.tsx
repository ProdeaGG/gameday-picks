'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  Users,
  Plus,
  Key,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface GroupCardData {
  id: number;
  name: string;
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  isLockedIn: boolean;
  picksCount: number;
  activeWeekLabel: string;
}

interface CurrentUser {
  id: number;
  username: string;
  avatarType: 'DEFAULT' | 'CUSTOM';
  avatarValue: string;
  isAdmin: boolean;
}

export default function GroupsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [groupsList, setGroupsList] = useState<GroupCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const fetchData = async () => {
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/login');
        return;
      }
      const userData = await userRes.json();
      setCurrentUser(userData.user);

      const groupsRes = await fetch('/api/groups');
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroupsList(data.groups || []);
      }
    } catch {
      // fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const pendingCode = localStorage.getItem('pending_invite_code');
      if (pendingCode) {
        router.push(`/join/${pendingCode}`);
        return;
      }
    } catch {}

    fetchData();
    const handler = () => fetchData();
    window.addEventListener('gameday-sandbox-updated', handler);
    return () => window.removeEventListener('gameday-sandbox-updated', handler);
  }, [router]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create group');
      } else {
        setIsCreateOpen(false);
        setNewGroupName('');
        router.push(`/groups/${data.group.id}`);
      }
    } catch {
      setCreateError('Network error creating group');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Failed to join group');
      } else {
        setIsJoinOpen(false);
        setJoinCode('');
        router.push(`/groups/${data.group.id}`);
      }
    } catch {
      setJoinError('Network error joining group');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col">
      <Header currentUser={currentUser} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Group Selection Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Your Broadcast Groups
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Select a group desk below or create/join a crew (max 8 members each).
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsJoinOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold border border-slate-700 transition-all hover:border-slate-500"
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>Join with Code</span>
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Group</span>
            </button>
          </div>
        </div>

        {/* Groups Grid */}
        <div className="mt-8">
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Loading your groups...</p>
            </div>
          ) : groupsList.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Groups Yet</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto mb-6">
                You haven&apos;t joined any College GameDay pick&apos;em groups yet. Create a new group for your friends or join one with an invite code!
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  Create Your First Group
                </button>
                <button
                  onClick={() => setIsJoinOpen(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
                >
                  Enter Invite Code
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupsList.map((grp) => (
                <Link
                  key={grp.id}
                  href={`/groups/${grp.id}`}
                  className="group relative bg-slate-900/90 border border-slate-800 hover:border-amber-400/80 rounded-2xl p-5 shadow-xl hover:shadow-2xl hover:shadow-amber-500/10 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top status badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>
                          {grp.memberCount} / {grp.maxMembers}
                        </span>
                      </div>

                      {grp.isLockedIn ? (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-600/60 text-emerald-400 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Locked In</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/70 border border-amber-600/60 text-amber-400 text-[11px] font-bold">
                          <Clock className="w-3 h-3" />
                          <span>Picks Open</span>
                        </div>
                      )}
                    </div>

                    {/* Group Name & Slate label */}
                    <h2 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                      {grp.name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {grp.activeWeekLabel}
                    </p>
                  </div>

                  {/* Card Footer: Code & Enter button */}
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-500">
                      Code: <strong className="text-slate-300">{grp.inviteCode}</strong>
                    </span>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                      <span>Enter Desk</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Create New Group</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter a group name (max 24 chars). You will be assigned seat #1 behind the broadcast desk.
            </p>

            {createError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  maxLength={24}
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Saturday Night Crew"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Enter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <span>Join Group with Code</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the 6-character invite code from your commissioner.
            </p>

            {joinError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  6-Character Invite Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SEC888"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tracking-widest text-center uppercase focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {joining ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
