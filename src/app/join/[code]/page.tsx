'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Users,
  Check,
  X,
} from 'lucide-react';

interface GroupPreview {
  id: number;
  name: string;
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  isFull: boolean;
  isMember?: boolean;
}

export default function JoinCodePage() {
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string || '').trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [joinedSuccess, setJoinedSuccess] = useState(false);

  useEffect(() => {
    if (!code) return;

    // Persist pending invite code to localStorage so user registration / login never forgets it
    try {
      localStorage.setItem('pending_invite_code', code);
    } catch {
      // ignore localStorage errors
    }

    const verifySessionAndGroup = async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          // User is not logged in: route to login/signup page with redirect parameters
          router.push(`/login?redirect=/join/${code}&join=${code}`);
          return;
        }

        // User is logged in: fetch group preview info
        const groupRes = await fetch(`/api/groups/join?code=${code}`);
        const groupData = await groupRes.json();

        if (!groupRes.ok) {
          setError(groupData.error || 'No group found with that invite code');
          try {
            localStorage.removeItem('pending_invite_code');
          } catch {}
        } else {
          setGroup(groupData.group);
        }
      } catch {
        setError('Network error verifying invite code');
      } finally {
        setLoading(false);
      }
    };

    verifySessionAndGroup();
  }, [code, router]);

  const handleConfirmJoin = async () => {
    setJoining(true);
    setError(null);

    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to join group');
      } else {
        try {
          localStorage.removeItem('pending_invite_code');
        } catch {}
        setJoinedSuccess(true);
        setTimeout(() => {
          router.push(`/groups/${data.group.id}`);
        }, 1200);
      }
    } catch {
      setError('Network error joining group');
    } finally {
      setJoining(false);
    }
  };

  const handleDecline = () => {
    try {
      localStorage.removeItem('pending_invite_code');
    } catch {}
    router.push('/groups');
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Top Trophy Header */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
          <Trophy className="w-7 h-7 stroke-[2.5]" />
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
          Group Invitation
        </h1>
        <p className="text-xs text-slate-400 mb-6 font-mono">
          Invite Code: <strong className="text-amber-400">{code}</strong>
        </p>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Checking group details...</p>
          </div>
        ) : error ? (
          <div className="py-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <Link
              href="/groups"
              className="inline-flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              <span>Go to Groups</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : joinedSuccess ? (
          <div className="py-6 space-y-2">
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-black text-white">
              Joined &ldquo;{group?.name}&rdquo;!
            </h2>
            <p className="text-xs text-slate-400">Taking your seat at the broadcast desk...</p>
          </div>
        ) : group ? (
          <div className="space-y-6">
            {/* Group Preview Card */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Broadcast Desk Invitation
              </span>
              <h2 className="text-lg font-black text-white leading-tight">
                {group.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {group.memberCount} of {group.maxMembers} Members
                </span>
                {group.isFull && (
                  <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 text-[10px] font-bold">
                    Group Full
                  </span>
                )}
              </div>
            </div>

            {/* Prompt Question */}
            <div className="text-center space-y-1">
              <p className="text-sm sm:text-base font-bold text-slate-200">
                {group.isMember
                  ? "You're already a member of this group!"
                  : "You've been invited to join this group."}
              </p>
              <p className="text-xs text-amber-400/90 font-semibold">
                {group.isMember
                  ? "Head over to your broadcast desk."
                  : "Do you want to join it?"}
              </p>
            </div>

            {/* Confirmation Buttons */}
            <div className="flex flex-col gap-2.5">
              {group.isMember ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem('pending_invite_code');
                    } catch {}
                    router.push(`/groups/${group.id}`);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all"
                >
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                  <span>Go to Broadcast Desk</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={joining || group.isFull}
                    onClick={handleConfirmJoin}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{joining ? 'Joining Desk...' : 'Yes, Join Group'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={joining}
                    onClick={handleDecline}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>No, Go to My Groups</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
