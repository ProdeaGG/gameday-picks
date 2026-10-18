'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  FlaskConical,
  ChevronUp,
  ChevronDown,
  Users,
  Clock,
  Unlock,
  Trash2,
  Sparkles,
  CheckCircle2,
  Lock,
  Trophy,
} from 'lucide-react';

type SandboxStateMode = 'OPEN' | 'ALL_SUBMITTED' | 'LOCKED' | 'GRADED';

export default function SandboxToolbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sandboxState, setSandboxState] = useState<SandboxStateMode>('OPEN');
  const [boothSize, setBoothSize] = useState<number>(8);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const groupIdMatch = pathname.match(/^\/groups\/(\d+)/);
  const activeGroupId = groupIdMatch ? groupIdMatch[1] : null;

  useEffect(() => {
    const syncVisibility = () => {
      const enabled =
        typeof window !== 'undefined' &&
        localStorage.getItem('gameday_show_sandbox_toolbar') === 'true';
      setShowToolbar(enabled);
    };
    syncVisibility();
    window.addEventListener('gameday-sandbox-visibility', syncVisibility);
    return () =>
      window.removeEventListener('gameday-sandbox-visibility', syncVisibility);
  }, []);

  const fetchSandboxStatus = useCallback(async () => {
    try {
      const q = activeGroupId ? `?groupId=${activeGroupId}` : '';
      const res = await fetch(`/api/sandbox${q}`, { cache: 'no-store' });
      if (!res.ok) {
        setIsAdmin(false);
        return;
      }
      const data = await res.json();
      if (data.isAdmin) {
        setIsAdmin(true);
        setSandboxState(data.sandboxState || 'OPEN');
        setBoothSize(data.boothSize || 8);
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    fetchSandboxStatus();
  }, [fetchSandboxStatus, pathname]);

  if (!isAdmin || !showToolbar || pathname === '/login') {
    return null;
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const notifyPages = () => {
    window.dispatchEvent(new CustomEvent('gameday-sandbox-updated'));
    router.refresh();
  };

  const handleLoadDemo = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LOAD_DEMO' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSandboxState('OPEN');
        setBoothSize(8);
        showToast(data.message || 'Demo Groups, Bots & Slates loaded!');
        notifyPages();
        if (pathname !== '/groups') {
          router.push('/groups');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSetBoothSize = async (count: number) => {
    setBoothSize(count);
    setBusy(true);
    try {
      await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SET_BOOTH_SIZE',
          groupId: activeGroupId,
          boothSize: count,
        }),
      });
      showToast(`Broadcast Booth scaled to ${count} ${count === 1 ? 'player' : 'players'}!`);
      notifyPages();
    } finally {
      setBusy(false);
    }
  };

  const handleSetTimeState = async (mode: SandboxStateMode) => {
    setSandboxState(mode);
    setBusy(true);
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SET_TIME_STATE',
          sandboxState: mode,
        }),
      });
      if (res.ok) {
        const labels: Record<SandboxStateMode, string> = {
          OPEN: 'OPEN (Thursday Mode) — Picks open, countdown active',
          ALL_SUBMITTED: 'ALL_SUBMITTED — 100% group early lock reveal active',
          LOCKED: 'LOCKED (Sat 11:30 AM ET) — Group Picks Feed unlocked',
          GRADED: 'GRADED (Final Mode) — Scores graded, ties & Postseason tabs ready',
        };
        showToast(labels[mode]);
        notifyPages();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUnlockAdminPicks = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UNLOCK_ADMIN_PICKS' }),
      });
      if (res.ok) {
        showToast('Admin picks unlocked! You can test the Review & Lock modal again.');
        notifyPages();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetSandbox = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_SANDBOX' }),
      });
      if (res.ok) {
        showToast('Sandbox bots, demo groups & simulated weeks wiped!');
        notifyPages();
        router.push('/groups');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none flex flex-col items-center">
      {toast && (
        <div className="mb-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-2xl border border-amber-300 pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 pointer-events-auto">
        <div className="bg-slate-950/95 backdrop-blur-md border-t border-x border-amber-500/40 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.75)] overflow-hidden">
          {/* Header Toggle Bar */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 flex items-center justify-between text-left hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
                <FlaskConical className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black tracking-wide text-amber-400 uppercase">
                  Sandbox &amp; Time-Travel Controls
                </span>
                <span className="hidden sm:inline-block ml-2 text-[11px] text-slate-400">
                  (Admin Only • Mode: <strong className="text-white">{sandboxState}</strong> • Booth: <strong className="text-white">{boothSize}P</strong>)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                {isExpanded ? 'Hide Drawer' : 'Expand Toolbar'}
              </span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-amber-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-amber-400" />
              )}
            </div>
          </button>

          {/* Expanded Controls Body */}
          {isExpanded && (
            <div className="p-4 space-y-4 border-t border-slate-800 text-xs">
              {/* Row 1: Time & Lock Simulator Toggle */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Time &amp; Lock Simulator Toggle (Real-Time Override)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSetTimeState('OPEN')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      sandboxState === 'OPEN'
                        ? 'border-amber-400 bg-amber-500/15 text-white shadow-md'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-black text-amber-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>OPEN</span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      Thursday Mode (Countdown active, picks hidden)
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSetTimeState('ALL_SUBMITTED')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      sandboxState === 'ALL_SUBMITTED'
                        ? 'border-emerald-400 bg-emerald-500/15 text-white shadow-md'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-black text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ALL_SUBMITTED</span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      Early Reveal Mode (100% group locked early)
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSetTimeState('LOCKED')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      sandboxState === 'LOCKED'
                        ? 'border-sky-400 bg-sky-500/15 text-white shadow-md'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-black text-sky-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>LOCKED</span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      Sat 11:30 AM ET Mode (Unlocks Group Picks Feed)
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSetTimeState('GRADED')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      sandboxState === 'GRADED'
                        ? 'border-purple-400 bg-purple-500/15 text-white shadow-md'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-black text-purple-300 flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>GRADED</span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      Final Scores + Ties (1st, 1st, 1st, 4th) &amp; Postseason
                    </div>
                  </button>
                </div>
              </div>

              {/* Row 2: Booth Player Count Toggle (1 to 8 Players) + Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80 items-center">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Booth Player Count Toggle (1–8 Center-Outward Scaling)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        disabled={busy}
                        onClick={() => handleSetBoothSize(num)}
                        className={`w-8 h-8 rounded-lg font-black text-xs border transition-all ${
                          boothSize === num
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-105'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLoadDemo}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Demo Group &amp; Bots</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUnlockAdminPicks}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 transition-all disabled:opacity-50"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock Admin Picks (Test Only)</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleResetSandbox}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-900/80 text-red-300 font-bold text-xs border border-red-800/70 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset &amp; Wipe Sandbox Data</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
