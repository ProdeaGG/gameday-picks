'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function JoinCodePage() {
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string || '').toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (!code) return;

    const attemptJoin = async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push(`/login?redirect=/join/${code}`);
          return;
        }

        const res = await fetch('/api/groups/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: code }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to join group');
        } else {
          setGroup(data.group);
          setTimeout(() => {
            router.push(`/groups/${data.group.id}`);
          }, 1200);
        }
      } catch {
        setError('Network error processing invite code');
      } finally {
        setLoading(false);
      }
    };

    attemptJoin();
  }, [code, router]);

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 mb-3">
          <Trophy className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Joining Group</h2>
        <p className="text-xs text-slate-400 mb-6">Invite Code: <strong className="text-amber-400">{code}</strong></p>

        {loading ? (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Verifying seat availability...</p>
          </div>
        ) : error ? (
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-red-400 mb-4">
              <AlertCircle className="w-5 h-5" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
            <Link
              href="/groups"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              <span>Go to Groups</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-emerald-400 mb-3">
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-sm font-bold">Joined &ldquo;{group?.name}&rdquo;!</span>
            </div>
            <p className="text-xs text-slate-400">Taking your seat at the broadcast desk...</p>
          </div>
        )}
      </div>
    </div>
  );
}
