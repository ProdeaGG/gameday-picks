'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import {
  formatEasternKickoff,
  getDefaultWeekLabel,
  SeasonStage,
} from '@/lib/time';
import {
  Shield,
  AlertTriangle,
  X,
  Flame,
  CheckSquare,
  Square,
  RefreshCw,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronLeft,
  Award,
  Lock,
  Edit3,
  PlayCircle,
  Users,
  KeyRound,
  Trash2,
  FlaskConical,
  Terminal,
} from 'lucide-react';

interface CandidateGame {
  external_game_id: string;
  home_team: string;
  away_team: string;
  home_record: string;
  away_record: string;
  home_logo: string;
  away_logo: string;
  home_rank: number | null;
  away_rank: number | null;
  is_sec_matchup: boolean;
  hype_score: number;
  kickoff_utc: string;
  spread_home: number | null;
  over_under: number | null;
  odds_display: string;
  home_score: number | null;
  away_score: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL';
  winner_team: string | null;
}

interface WeekSummary {
  id: number;
  week_number: number;
  label: string;
  stage: SeasonStage;
  is_published: boolean;
  gamesCount: number;
}

interface AdminUserRow {
  id: number;
  username: string;
  avatarType: 'DEFAULT' | 'CUSTOM';
  avatarValue: string;
  recoveryType: string;
  isAdmin: boolean;
  isBot: boolean;
  createdAt: string;
  groupCount: number;
}

interface AdminGroupRow {
  id: number;
  name: string;
  inviteCode: string;
  ownerUsername: string;
  memberCount: number;
  isSandbox: boolean;
  createdAt: string;
}

const SLATE_SIZE = 7;

export default function AdminConsolePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    username: string;
    avatarType: 'DEFAULT' | 'CUSTOM';
    avatarValue: string;
    isAdmin: boolean;
  } | null>(null);

  const [activeAdminTab, setActiveAdminTab] = useState<'SLATE' | 'LEAGUE'>('SLATE');
  const [loading, setLoading] = useState(true);
  const [isDefaultPassword, setIsDefaultPassword] = useState(false);
  const [dismissedSecurityWarning, setDismissedSecurityWarning] = useState(false);

  // Slate Configuration State
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [stage, setStage] = useState<SeasonStage>('REGULAR');
  const [useEarlyKickoffLock, setUseEarlyKickoffLock] = useState<boolean>(false);
  const [makeActiveOnPublish, setMakeActiveOnPublish] = useState<boolean>(true);

  // Saved Weeks & Lock State
  const [allWeeks, setAllWeeks] = useState<WeekSummary[]>([]);
  const [activeWeekNumber, setActiveWeekNumber] = useState<number | null>(null);
  const [hasInitializedActiveWeek, setHasInitializedActiveWeek] = useState(false);
  const [isWeekLockedIn, setIsWeekLockedIn] = useState<boolean>(false);
  const [isEditingLockedSlate, setIsEditingLockedSlate] = useState<boolean>(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);

  // League Management State
  const [allUsers, setAllUsers] = useState<AdminUserRow[]>([]);
  const [allGroups, setAllGroups] = useState<AdminGroupRow[]>([]);
  const [hasSandboxData, setHasSandboxData] = useState<boolean>(false);
  const [showSandboxToolbar, setShowSandboxToolbar] = useState<boolean>(false);
  const [resetTargetUser, setResetTargetUser] = useState<AdminUserRow | null>(null);
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [resettingPassword, setResettingPassword] = useState<boolean>(false);

  // Fetched ESPN / Candidate Scoreboard State
  const [candidates, setCandidates] = useState<CandidateGame[]>([]);
  const [selectedExtIds, setSelectedExtIds] = useState<Set<string>>(new Set());
  const [excludedNonSaturdayCount, setExcludedNonSaturdayCount] = useState<number>(0);
  const [dataSource, setDataSource] = useState<'ESPN_LIVE' | 'FALLBACK'>('ESPN_LIVE');

  const [fetchingEspn, setFetchingEspn] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activatingWeek, setActivatingWeek] = useState(false);
  const [syncingScores, setSyncingScores] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowSandboxToolbar(
        localStorage.getItem('gameday_show_sandbox_toolbar') === 'true'
      );
    }
  }, []);

  const toggleSandboxToolbarVisibility = (enabled: boolean) => {
    setShowSandboxToolbar(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gameday_show_sandbox_toolbar', enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('gameday-sandbox-visibility'));
    }
  };

  const fetchAdminData = useCallback(
    async (wkNum: number, stg: SeasonStage, isFirstLoad = false) => {
      setFetchingEspn(true);
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/login');
          return;
        }
        const meData = await meRes.json();
        if (!meData.user?.isAdmin) {
          router.push('/groups');
          return;
        }
        setCurrentUser(meData.user);

        const queryWeekParam = isFirstLoad ? '' : `fetchWeek=${wkNum}&`;
        const res = await fetch(
          `/api/admin/slate?${queryWeekParam}stage=${stg}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          setIsDefaultPassword(Boolean(data.isDefaultPassword));
          setAllWeeks(data.allWeeks || []);
          setAllUsers(data.allUsers || []);
          setAllGroups(data.allGroups || []);
          setHasSandboxData(Boolean(data.hasSandboxData));

          if (data.activeWeek) {
            setActiveWeekNumber(data.activeWeek.week_number);
            if (isFirstLoad) {
              setWeekNumber(data.activeWeek.week_number);
              setStage(data.activeWeek.stage || 'REGULAR');
            }
          }

          const lockedIn = Boolean(data.isWeekLockedIn);
          setIsWeekLockedIn(lockedIn);
          setIsEditingLockedSlate(false);

          if (data.candidatePool) {
            const poolGames: CandidateGame[] = data.candidatePool.games || [];
            setCandidates(poolGames);
            setExcludedNonSaturdayCount(
              data.candidatePool.excludedNonSaturdayCount || 0
            );
            setDataSource(data.candidatePool.source || 'ESPN_LIVE');

            if (
              lockedIn &&
              Array.isArray(data.savedSelectedExtIds) &&
              data.savedSelectedExtIds.length > 0
            ) {
              setSelectedExtIds(new Set(data.savedSelectedExtIds));
            } else {
              const top7Ids = new Set(
                poolGames.slice(0, SLATE_SIZE).map((g) => g.external_game_id)
              );
              setSelectedExtIds(top7Ids);
            }
          }
        }
      } catch {
        setStatusMessage({
          type: 'error',
          text: 'Failed to load scoreboard data',
        });
      } finally {
        setLoading(false);
        setFetchingEspn(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!hasInitializedActiveWeek) {
      setHasInitializedActiveWeek(true);
      fetchAdminData(weekNumber, stage, true);
    } else {
      fetchAdminData(weekNumber, stage, false);
    }
  }, [fetchAdminData, weekNumber, stage, hasInitializedActiveWeek]);

  const handleStageChange = (newStage: SeasonStage) => {
    setStage(newStage);
    if (newStage === 'REGULAR') {
      if (weekNumber > 15) {
        setWeekNumber(activeWeekNumber && activeWeekNumber <= 15 ? activeWeekNumber : 1);
      }
      setUseEarlyKickoffLock(false);
    } else if (newStage === 'BOWL') {
      setWeekNumber(16);
    } else if (newStage === 'PLAYOFF') {
      setWeekNumber(17);
    } else if (newStage === 'CHAMPIONSHIP') {
      setWeekNumber(18);
    }
  };

  const handleSelectWeekNumber = (num: number) => {
    setWeekNumber(num);
    if (num <= 15 && stage !== 'REGULAR') {
      setStage('REGULAR');
    }
  };

  const isSelectionReadOnly = isWeekLockedIn && !isEditingLockedSlate;

  const handleAutoLockTop7 = () => {
    if (isSelectionReadOnly) {
      setIsAdjustModalOpen(true);
      return;
    }
    const top7 = new Set(
      candidates.slice(0, SLATE_SIZE).map((g) => g.external_game_id)
    );
    setSelectedExtIds(top7);
    setStatusMessage({
      type: 'success',
      text: `Auto-selected Top ${SLATE_SIZE} highest Hype Score matchups! Click "Lock In ${SLATE_SIZE}-Game Slate" to save.`,
    });
  };

  const toggleGameSelection = (extId: string) => {
    if (isSelectionReadOnly) {
      setIsAdjustModalOpen(true);
      return;
    }

    const next = new Set(selectedExtIds);
    if (next.has(extId)) {
      next.delete(extId);
      setSelectedExtIds(next);
    } else {
      if (next.size >= SLATE_SIZE) {
        setStatusMessage({
          type: 'error',
          text: `Maximum ${SLATE_SIZE} games allowed per weekly slate (odd number to prevent ties). Uncheck a game first to swap.`,
        });
        return;
      }
      next.add(extId);
      setSelectedExtIds(next);
    }
  };

  const handlePublishSlate = async () => {
    const chosenGames = candidates.filter((c) =>
      selectedExtIds.has(c.external_game_id)
    );
    if (chosenGames.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Select at least 1 game before locking in the slate.',
      });
      return;
    }

    setPublishing(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/slate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PUBLISH_SLATE',
          weekNumber,
          stage,
          useEarlyKickoffLock,
          makeActive: makeActiveOnPublish,
          selectedGames: chosenGames,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to lock in weekly slate',
        });
      } else {
        setIsWeekLockedIn(true);
        setIsEditingLockedSlate(false);
        if (makeActiveOnPublish) {
          setActiveWeekNumber(weekNumber);
        }
        await fetchAdminData(weekNumber, stage, false);
        setStatusMessage({
          type: 'success',
          text: makeActiveOnPublish
            ? `Locked in "${data.week.label}" (${chosenGames.length} games) and set as the Active Week across all groups!`
            : `Locked in "${data.week.label}" (${chosenGames.length} games) in advance!`,
        });
        window.dispatchEvent(new CustomEvent('gameday-sandbox-updated'));
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Network error locking weekly slate',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSetAsActiveWeek = async () => {
    setActivatingWeek(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/slate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SET_ACTIVE_WEEK',
          weekNumber,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveWeekNumber(weekNumber);
        await fetchAdminData(weekNumber, stage, false);
        setStatusMessage({
          type: 'success',
          text: `"${data.week.label}" is now the Active Week across all groups!`,
        });
        window.dispatchEvent(new CustomEvent('gameday-sandbox-updated'));
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to activate week',
        });
      }
    } finally {
      setActivatingWeek(false);
    }
  };

  const handleSyncScoresNow = async () => {
    setSyncingScores(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/slate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_SCORES' }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `Live ESPN score sync complete! (${data.updatedGames} games updated & graded)`,
        });
      }
    } finally {
      setSyncingScores(false);
    }
  };

  const handlePurgeSandboxData = async () => {
    setStatusMessage(null);
    const res = await fetch('/api/admin/slate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'PURGE_SANDBOX_DATA' }),
    });
    const data = await res.json();
    if (res.ok) {
      toggleSandboxToolbarVisibility(false);
      await fetchAdminData(weekNumber, stage, false);
      setStatusMessage({
        type: 'success',
        text: data.message || 'All sandbox demo data removed. Database is 100% live!',
      });
      window.dispatchEvent(new CustomEvent('gameday-sandbox-updated'));
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newResetPassword.trim()) return;
    setResettingPassword(true);
    try {
      const res = await fetch('/api/admin/slate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADMIN_RESET_USER_PASSWORD',
          userId: resetTargetUser.id,
          newPassword: newResetPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `Password for "${resetTargetUser.username}" has been reset!`,
        });
        setResetTargetUser(null);
        setNewResetPassword('');
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to reset user password',
        });
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleUserAdmin = async (u: AdminUserRow) => {
    const res = await fetch('/api/admin/slate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'TOGGLE_USER_ADMIN',
        userId: u.id,
        makeAdmin: !u.isAdmin,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchAdminData(weekNumber, stage, false);
      setStatusMessage({ type: 'success', text: data.message });
    } else {
      setStatusMessage({ type: 'error', text: data.error });
    }
  };

  const handleDeleteGroup = async (grp: AdminGroupRow) => {
    const res = await fetch('/api/admin/slate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE_GROUP',
        groupId: grp.id,
      }),
    });
    if (res.ok) {
      await fetchAdminData(weekNumber, stage, false);
      setStatusMessage({
        type: 'success',
        text: `Group "${grp.name}" deleted.`,
      });
    }
  };

  const handleDeleteUser = async (u: AdminUserRow) => {
    const res = await fetch('/api/admin/slate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE_USER',
        userId: u.id,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchAdminData(weekNumber, stage, false);
      setStatusMessage({
        type: 'success',
        text: `User "${u.username}" removed.`,
      });
    } else {
      setStatusMessage({ type: 'error', text: data.error });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentWeekDisplayLabel = getDefaultWeekLabel(weekNumber, stage);
  const top7RecommendedIds = new Set(
    candidates.slice(0, SLATE_SIZE).map((g) => g.external_game_id)
  );
  const lockedWeekMap = new Map<number, WeekSummary>();
  for (const w of allWeeks) {
    if (w.gamesCount > 0) {
      lockedWeekMap.set(w.week_number, w);
    }
  }

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col pb-24">
      <Header currentUser={currentUser} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-8">
        {/* Top Back Link */}
        <div className="mb-4">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" />
            <span>Back to Group Selection Hub</span>
          </Link>
        </div>

        {/* Dismissible Default Admin Password Security Prompt (Section 6.1) */}
        {isDefaultPassword && !dismissedSecurityWarning && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-200 flex items-start justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold text-amber-300">
                  Security Reminder: Default Commissioner Password Active
                </p>
                <p className="text-amber-200/80 mt-0.5">
                  Your account is currently using the default seeded password (
                  <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono">
                    admin
                  </code>
                  ). Before exposing your CasaOS port to the public internet,
                  please{' '}
                  <Link
                    href="/profile"
                    className="underline font-bold text-white hover:text-amber-300"
                  >
                    update your password in Profile &amp; Preferences
                  </Link>
                  .
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissedSecurityWarning(true)}
              className="p-1 rounded-lg text-amber-400 hover:text-white hover:bg-amber-900/40"
              aria-label="Dismiss security warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Commissioner Title Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Global Commissioner Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Commissioner Control Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Select <strong className="text-amber-400">7 featured games</strong> (odd number to prevent ties) by{' '}
              <strong className="text-emerald-400">Wednesday 9:00 AM ET</strong> and manage live groups &amp; users.
            </p>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveAdminTab('SLATE')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                activeAdminTab === 'SLATE'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>7-Game Slate Selector</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('LEAGUE')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                activeAdminTab === 'LEAGUE'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users &amp; Live League ({allUsers.length})</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mt-5 p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : 'bg-red-950/60 border-red-700 text-red-300'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeAdminTab === 'SLATE' ? (
          <>
            {/* Action Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-400">
                Active Group Week:{' '}
                <strong className="text-amber-400">
                  {activeWeekNumber ? `Week ${activeWeekNumber}` : 'Not Set Yet'}
                </strong>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSyncScoresNow}
                  disabled={syncingScores}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-emerald-400 ${
                      syncingScores ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {syncingScores ? 'Syncing ESPN...' : 'Sync Live Scores'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoLockTop7}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-amber-500/40 transition-all"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Select Top {SLATE_SIZE}</span>
                </button>

                {isSelectionReadOnly ? (
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs sm:text-sm font-black border border-amber-400/50 shadow-lg transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Adjust Game Selection</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublishSlate}
                    disabled={publishing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {publishing
                        ? 'Locking In...'
                        : `Lock In ${SLATE_SIZE}-Game Slate (${selectedExtIds.size}/${SLATE_SIZE})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Slate Parameters & Week Selector Controls */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              {/* 1. Stage Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  1. Season Stage
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    ['REGULAR', 'BOWL', 'PLAYOFF', 'CHAMPIONSHIP'] as SeasonStage[]
                  ).map((stg) => (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => handleStageChange(stg)}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                        stage === stg
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300 shadow-md'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {stg}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Week Selector (Current & Future Weeks in Advance — No Manual Naming Needed) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    2. Select Week (Current or Future)
                  </label>
                  <span className="text-[11px] font-bold text-amber-400">
                    Reviewing: {currentWeekDisplayLabel}
                  </span>
                </div>

                {stage === 'REGULAR' ? (
                  <>
                    <div className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 15 }, (_, idx) => idx + 1).map(
                        (wk) => {
                          const isSelectedWk = weekNumber === wk;
                          const isSaved = lockedWeekMap.has(wk);
                          const isLiveActive = activeWeekNumber === wk;

                          return (
                            <button
                              key={wk}
                              type="button"
                              onClick={() => handleSelectWeekNumber(wk)}
                              className={`relative py-1.5 px-2 rounded-lg text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                                isSelectedWk
                                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                                  : isSaved
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/70 hover:border-emerald-500'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                              }`}
                              title={
                                isLiveActive
                                  ? `Week ${wk} (Active Week for Groups)`
                                  : isSaved
                                  ? `Week ${wk} (7-Game Slate Locked in Advance)`
                                  : `Week ${wk} (Not Locked Yet)`
                              }
                            >
                              <span>W{wk}</span>
                              {isSaved && (
                                <CheckCircle2
                                  className={`w-3 h-3 ${
                                    isSelectedWk
                                      ? 'text-slate-950'
                                      : 'text-emerald-400'
                                  }`}
                                />
                              )}
                              {isLiveActive && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        <span>
                          Active Group Week:{' '}
                          {activeWeekNumber ? `Week ${activeWeekNumber}` : 'None'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Locked in Advance</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <div className="font-black text-amber-400">
                      {currentWeekDisplayLabel}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Postseason stage selected. Pick up to {SLATE_SIZE} bowl/playoff games below.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Deadlines & Active Window Policy Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-black uppercase text-amber-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Admin Deadline: Wed 9:00 AM ET</span>
                    </span>
                    <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      America/New_York
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Admin must lock in the {SLATE_SIZE}-game slate by{' '}
                    <strong className="text-slate-200">
                      Wednesday at 9:00 AM ET
                    </strong>
                    .
                    {stage === 'REGULAR' ? (
                      <>
                        {' '}
                        Strictly filtered to{' '}
                        <strong>Saturday games only</strong> (
                        {excludedNonSaturdayCount} non-Saturday games excluded).
                      </>
                    ) : (
                      <>
                        {' '}
                        Expanded postseason window through{' '}
                        <strong>Monday Night</strong>.
                      </>
                    )}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                  {stage !== 'REGULAR' && (
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-purple-300">
                      <input
                        type="checkbox"
                        checked={useEarlyKickoffLock}
                        onChange={(e) => setUseEarlyKickoffLock(e.target.checked)}
                        disabled={isSelectionReadOnly}
                        className="rounded border-slate-600 text-amber-500 focus:ring-amber-400"
                      />
                      <span>
                        Lock 30 mins prior to first kickoff (if before Sat 11:30 AM ET)
                      </span>
                    </label>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-emerald-300">
                    <input
                      type="checkbox"
                      checked={makeActiveOnPublish}
                      onChange={(e) => setMakeActiveOnPublish(e.target.checked)}
                      className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-400"
                    />
                    <span>
                      Set {currentWeekDisplayLabel} as Active Group Week upon lock
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Locked-In Status Banner for Selected Week */}
            {isWeekLockedIn && (
              <div
                className={`mt-5 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isEditingLockedSlate
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isEditingLockedSlate
                        ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300'
                        : 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                    }`}
                  >
                    {isEditingLockedSlate ? (
                      <Edit3 className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white">
                        {isEditingLockedSlate
                          ? `Editing ${currentWeekDisplayLabel} Selection (${selectedExtIds.size}/${SLATE_SIZE} Games)`
                          : `${currentWeekDisplayLabel} Slate Locked In (${selectedExtIds.size} Games)`}
                      </span>
                      {activeWeekNumber === weekNumber ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                          Active Week for Groups
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                          Saved in Advance
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isEditingLockedSlate
                        ? `Check or uncheck games below (up to ${SLATE_SIZE}) and click "Lock In ${SLATE_SIZE}-Game Slate" to save your changes.`
                        : `This week's ${SLATE_SIZE}-game slate is locked in. To modify the matchups, click "Adjust Game Selection".`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeWeekNumber !== weekNumber && !isEditingLockedSlate && (
                    <button
                      type="button"
                      onClick={handleSetAsActiveWeek}
                      disabled={activatingWeek}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-all disabled:opacity-50"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>
                        {activatingWeek
                          ? 'Activating...'
                          : 'Set as Active Week for Groups'}
                      </span>
                    </button>
                  )}

                  {!isEditingLockedSlate ? (
                    <button
                      type="button"
                      onClick={() => setIsAdjustModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/50 text-xs font-bold transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Adjust Game Selection</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fetchAdminData(weekNumber, stage, false)}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold"
                    >
                      Cancel Edits
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Hype Score Legend */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hype Score Formula:</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                  SEC vs. SEC +50
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 font-semibold">
                  Ranked vs. Ranked +40 (Top 10 Bonus)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
                  1 Ranked + Spread &le;7.5 +25
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold">
                  Spread &le;3.5 +15
                </span>
              </div>

              <span className="text-[11px] font-mono text-slate-500">
                Source:{' '}
                {dataSource === 'ESPN_LIVE'
                  ? 'ESPN Live Scoreboard API'
                  : 'Curated GameDay Pool'}
              </span>
            </div>

            {/* Eligible Matchups List */}
            <div className="mt-4 space-y-3">
              {fetchingEspn ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-semibold">
                    Evaluating games &amp; calculating Hype Scores...
                  </p>
                </div>
              ) : (
                candidates.map((game) => {
                  const isSelected = selectedExtIds.has(game.external_game_id);
                  const isRecommended = top7RecommendedIds.has(
                    game.external_game_id
                  );

                  return (
                    <div
                      key={game.external_game_id}
                      onClick={() => toggleGameSelection(game.external_game_id)}
                      className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-slate-900 border-amber-400/90 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {/* Left: Checkbox + Matchup Teams */}
                      <div className="flex items-center gap-3.5">
                        <div className="text-amber-400 flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 fill-amber-400 text-slate-950" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-600" />
                          )}
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                          {/* Away Team */}
                          <div className="flex items-center gap-2 min-w-[135px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={game.away_logo}
                              alt={game.away_team}
                              className="w-8 h-8 object-contain"
                            />
                            <div>
                              <div className="flex items-center gap-1">
                                {game.away_rank && (
                                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">
                                    #{game.away_rank}
                                  </span>
                                )}
                                <span className="text-sm font-black text-white">
                                  {game.away_team}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {game.away_record}
                              </span>
                            </div>
                          </div>

                          <span className="text-xs font-black text-slate-500">
                            @
                          </span>

                          {/* Home Team */}
                          <div className="flex items-center gap-2 min-w-[135px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={game.home_logo}
                              alt={game.home_team}
                              className="w-8 h-8 object-contain"
                            />
                            <div>
                              <div className="flex items-center gap-1">
                                {game.home_rank && (
                                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">
                                    #{game.home_rank}
                                  </span>
                                )}
                                <span className="text-sm font-black text-white">
                                  {game.home_team}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {game.home_record}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Badges, Kickoff ET, Odds & Hype Score */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-800">
                        {isSelected && isWeekLockedIn && !isEditingLockedSlate && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[10px] font-black uppercase">
                            <Lock className="w-3 h-3" />
                            <span>Locked In Slate</span>
                          </span>
                        )}

                        {isRecommended && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold uppercase">
                            <Award className="w-3 h-3" />
                            <span>Recommended Top {SLATE_SIZE}</span>
                          </span>
                        )}

                        {game.is_sec_matchup && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-[10px] font-black uppercase tracking-wide">
                            SEC Matchup
                          </span>
                        )}

                        <div className="text-right text-xs">
                          <div className="font-bold text-slate-200">
                            {formatEasternKickoff(game.kickoff_utc)}
                          </div>
                          <div className="text-[11px] font-mono text-amber-400/90">
                            {game.odds_display}
                          </div>
                        </div>

                        <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-center min-w-[68px]">
                          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                            Hype
                          </div>
                          <div className="text-sm font-black text-amber-400">
                            {game.hype_score}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* TAB 2: LIVE LEAGUE, USERS & GROUPS MANAGEMENT */
          <div className="mt-6 space-y-6">
            {/* Live Production Readiness & Sandbox Controls Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-400" />
                  <h2 className="text-base font-black text-white">
                    Live Service Mode &amp; Developer Sandbox Controls
                  </h2>
                  {!hasSandboxData ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black uppercase">
                      100% Live Database
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase">
                      Demo Data Present
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  The bottom Sandbox &amp; Time-Travel Toolbar is hidden by default for a clean live user experience. You can toggle it on anytime for testing or purge any demo data below.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs font-bold text-slate-200">
                  <input
                    type="checkbox"
                    checked={showSandboxToolbar}
                    onChange={(e) =>
                      toggleSandboxToolbarVisibility(e.target.checked)
                    }
                    className="rounded border-slate-600 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Show Sandbox Toolbar</span>
                </label>

                {hasSandboxData && (
                  <button
                    type="button"
                    onClick={handlePurgeSandboxData}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/70 text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Demo Bots &amp; Groups</span>
                  </button>
                )}
              </div>
            </div>

            {/* Registered Users & Commissioner Password Reset */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Registered Users ({allUsers.length})</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Reset a player&apos;s password directly here, or use the Docker CLI escape hatch below.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>npm run reset-password -- &lt;user&gt; &lt;pass&gt;</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Recovery</th>
                      <th className="py-2.5 px-3">Groups</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-bold text-white flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              u.avatarType === 'CUSTOM'
                                ? u.avatarValue
                                : `/avatars/${u.avatarValue || 'default-1'}.svg`
                            }
                            alt={u.username}
                            className="w-7 h-7 rounded-lg pixelated border border-slate-700 bg-slate-950 object-cover"
                          />
                          <span>{u.username}</span>
                          {u.isBot && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px] font-mono uppercase">
                              Bot
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {u.isAdmin ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase">
                              Commissioner
                            </span>
                          ) : (
                            <span className="text-slate-400">Player</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                          {u.recoveryType}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-bold">
                          {u.groupCount}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetUser(u);
                                setNewResetPassword('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-[11px]"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset Password</span>
                            </button>

                            {u.id !== currentUser?.id && !u.isBot && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserAdmin(u)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-[11px]"
                              >
                                {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                            )}

                            {u.id !== currentUser?.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 text-red-300 border border-red-800/60"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Groups Overview */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h2 className="text-base font-black text-white mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Broadcast Groups ({allGroups.length})</span>
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                All active groups on your server (max 8 members per group).
              </p>

              {allGroups.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No groups created yet. Head to the Group Selection Hub to create your first live group!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allGroups.map((grp) => (
                    <div
                      key={grp.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">
                            {grp.name}
                          </span>
                          {grp.isSandbox && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-bold uppercase">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Invite Code:{' '}
                          <strong className="font-mono text-amber-400">
                            {grp.inviteCode}
                          </strong>{' '}
                          • Members:{' '}
                          <strong className="text-slate-200">
                            {grp.memberCount}/8
                          </strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(grp)}
                        className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60"
                        title="Delete Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Admin Password Reset Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <span>Reset Password: {resetTargetUser.username}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Enter a new password for <strong>{resetTargetUser.username}</strong>.
            </p>
            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <input
                type="text"
                required
                minLength={4}
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
                placeholder="Enter new password (min 4 chars)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md disabled:opacity-50"
                >
                  {resettingPassword ? 'Saving...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Adjust Already-Locked Weekly Slate (Issue 8) */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400/80 rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-black text-white">
              Adjust {currentWeekDisplayLabel} Game Selection?
            </h3>

            <p className="text-sm text-slate-300 mt-2.5 leading-relaxed">
              The {SLATE_SIZE}-game slate for{' '}
              <strong className="text-amber-300">{currentWeekDisplayLabel}</strong>{' '}
              is already locked in. Please confirm that you want to unlock and
              adjust the game selection for this week.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400">
              Reminder: All commissioner slate selections must be finalized by{' '}
              <strong className="text-amber-400">
                Wednesday morning at 9:00 AM ET
              </strong>
              .
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Keep Current Slate
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdjustModalOpen(false);
                  setIsEditingLockedSlate(true);
                }}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/25 transition-all"
              >
                Confirm &amp; Adjust Games
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
