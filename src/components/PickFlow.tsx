'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { formatEasternKickoff } from '@/lib/time';
import {
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  List,
  Layers,
  Clock,
  Sparkles,
  HelpCircle,
  Trophy,
  ShieldCheck,
} from 'lucide-react';

interface GameItem {
  id: number;
  home_team: string;
  away_team: string;
  home_record: string;
  away_record: string;
  home_logo: string;
  away_logo: string;
  home_rank: number | null;
  away_rank: number | null;
  is_sec_matchup: boolean;
  kickoff_utc: string;
  odds_display: string;
  spread_home: number | null;
  home_score: number | null;
  away_score: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL';
  winner_team: string | null;
}

interface PickFlowProps {
  groupId: number;
  onPicksLocked?: () => void;
}

export default function PickFlow({ groupId, onPicksLocked }: PickFlowProps) {
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState<any>(null);
  const [gamesList, setGamesList] = useState<GameItem[]>([]);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [isCutoffPassed, setIsCutoffPassed] = useState(false);

  // Pick Mode: 'CARD_DECK' vs 'QUICK_LIST'
  const [viewMode, setViewMode] = useState<'CARD_DECK' | 'QUICK_LIST'>('CARD_DECK');
  const [cardDeckIndex, setCardDeckIndex] = useState(0);

  // Multi-step flow: 'SELECTING' -> 'REVIEW' -> 'CONFIRM_MODAL'
  const [step, setStep] = useState<'SELECTING' | 'REVIEW'>('SELECTING');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSavingDraft, setAutoSavingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPicksData = useCallback(async () => {
    try {
      const res = await fetch(`/api/picks?groupId=${groupId}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setWeek(data.week);
        const loadedGames: GameItem[] = data.games || [];
        setGamesList(loadedGames);
        setIsLocked(Boolean(data.isLocked));
        setIsCutoffPassed(Boolean(data.isCutoffPassed));

        const existingMap: Record<number, string> = {};
        for (const p of data.userPicks || []) {
          existingMap[p.game_id] = p.selected_team;
        }
        setSelections(existingMap);

        // Position Card Deck at the first unpicked game (or game 0 if none/all picked)
        const firstUnpickedIdx = loadedGames.findIndex((g) => !existingMap[g.id]);
        if (firstUnpickedIdx !== -1) {
          setCardDeckIndex(firstUnpickedIdx);
        }
      }
    } catch {
      // fetch error
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchPicksData();
    const handler = () => fetchPicksData();
    window.addEventListener('gameday-sandbox-updated', handler);
    return () => window.removeEventListener('gameday-sandbox-updated', handler);
  }, [fetchPicksData]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Loading matchups...</p>
      </div>
    );
  }

  if (!week || gamesList.length === 0) {
    return (
      <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <HelpCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white mb-1">No Active Slate Published</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          The commissioner has not published an official slate for this week yet. Check back soon!
        </p>
      </div>
    );
  }

  const totalGames = gamesList.length;
  const pickedCount = gamesList.filter((g) => Boolean(selections[g.id])).length;
  const allPicked = pickedCount === totalGames && totalGames > 0;

  // Dynamically save draft picks to the database on every selection so switching tabs never loses work
  const persistDraftSelections = async (updatedSelections: Record<number, string>) => {
    if (!week?.id || isLocked || isCutoffPassed) return;
    setAutoSavingDraft(true);
    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          weekId: week.id,
          selections: updatedSelections,
          action: 'SAVE_DRAFT',
        }),
      });
    } catch {
      // background draft save error
    } finally {
      setAutoSavingDraft(false);
    }
  };

  const handleSelectTeam = (gameId: number, team: string) => {
    if (isLocked || isCutoffPassed) return;
    const nextSelections = { ...selections, [gameId]: team };
    setSelections(nextSelections);
    persistDraftSelections(nextSelections);
  };

  const handleConfirmLockIn = async () => {
    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          weekId: week.id,
          selections,
          action: 'LOCK_IN',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to lock in picks');
      } else {
        setIsLocked(true);
        setIsConfirmModalOpen(false);
        setStep('SELECTING');
        if (onPicksLocked) onPicksLocked();
        window.dispatchEvent(new CustomEvent('gameday-sandbox-updated'));
      }
    } catch {
      setErrorMessage('Network error locking in picks');
    } finally {
      setSaving(false);
    }
  };

  // If picks are permanently locked (or cutoff passed), show the clean locked review view
  if (isLocked || isCutoffPassed) {
    return (
      <div className="space-y-4">
        {/* Permanent Lock Banner */}
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/60 shadow-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">
                Picks Locked In for the Week
              </h4>
              <p className="text-xs text-emerald-300/80">
                Your {totalGames}-game slate is locked in. Good luck on GameDay!
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-semibold text-emerald-300">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Locked In</span>
          </div>
        </div>

        {/* Read-Only Locked Matchup Cards */}
        <div className="space-y-3">
          {gamesList.map((game, idx) => {
            const chosen = selections[game.id];
            const isHomeChosen = chosen === game.home_team;
            const isAwayChosen = chosen === game.away_team;
            const isFinal = game.status === 'FINAL';
            const awayWon = isFinal && game.winner_team === game.away_team;
            const homeWon = isFinal && game.winner_team === game.home_team;
            const userWonPick = isFinal && chosen && game.winner_team === chosen;

            return (
              <div
                key={game.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-[11px] font-black text-slate-400 flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Away Team */}
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all ${
                        awayWon
                          ? 'border-emerald-400 bg-emerald-500/15 text-white font-black shadow-md shadow-emerald-500/10'
                          : isAwayChosen
                          ? 'border-amber-400 bg-amber-500/15 text-white font-black'
                          : 'border-transparent text-slate-400 opacity-60'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={game.away_logo} alt={game.away_team} className="w-6 h-6 object-contain" />
                      <span className="text-sm">{game.away_team}</span>
                      {game.away_score !== null && (
                        <span className="ml-1 font-mono text-xs font-black text-slate-200">
                          ({game.away_score})
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-600 font-black">@</span>

                    {/* Home Team */}
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all ${
                        homeWon
                          ? 'border-emerald-400 bg-emerald-500/15 text-white font-black shadow-md shadow-emerald-500/10'
                          : isHomeChosen
                          ? 'border-amber-400 bg-amber-500/15 text-white font-black'
                          : 'border-transparent text-slate-400 opacity-60'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={game.home_logo} alt={game.home_team} className="w-6 h-6 object-contain" />
                      <span className="text-sm">{game.home_team}</span>
                      {game.home_score !== null && (
                        <span className="ml-1 font-mono text-xs font-black text-slate-200">
                          ({game.home_score})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                  <span className="text-slate-400 font-medium">
                    {formatEasternKickoff(game.kickoff_utc)}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg font-bold border ${
                      isFinal
                        ? userWonPick
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-red-500/15 text-red-300 border-red-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    Your Pick: {chosen || 'None'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // STEP 2: Review Picks Summary Screen
  if (step === 'REVIEW') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Step 2: Review Your Picks</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Double-check your {totalGames} selected winners before locking them in for the week.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep('SELECTING')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Go Back &amp; Edit</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Review Matchups Summary List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gamesList.map((game, idx) => {
            const chosen = selections[game.id];
            const chosenLogo = chosen === game.home_team ? game.home_logo : game.away_logo;
            const oppTeam = chosen === game.home_team ? game.away_team : game.home_team;

            return (
              <div
                key={game.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-[11px] font-black text-slate-400 flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={chosenLogo} alt={chosen} className="w-9 h-9 object-contain" />
                  <div>
                    <span className="text-sm font-black text-white block">
                      {chosen}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      vs. {oppTeam}
                    </span>
                  </div>
                </div>

                <div className="text-right text-[11px]">
                  <span className="font-mono text-amber-400 block font-semibold">
                    {game.odds_display}
                  </span>
                  <span className="text-slate-400">
                    {formatEasternKickoff(game.kickoff_utc)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button: Triggers Permanent Lock Modal */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Standard Cutoff: Saturday 11:30:00 AM ET</span>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm tracking-wide shadow-2xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4 stroke-[3]" />
            <span>Lock In Picks</span>
          </button>
        </div>

        {/* STEP 3: Sleek User-Friendly Permanent Lock Confirmation Modal */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/50 rounded-3xl shadow-2xl p-6 sm:p-7 text-center relative overflow-hidden">
              {/* Top subtle glow bar */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-lg shadow-amber-500/10">
                <Trophy className="w-7 h-7 stroke-[2.2]" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {totalGames} of {totalGames} Matchups Selected
                </span>
              </div>

              <h3 className="text-xl font-black text-white tracking-tight mb-2">
                Ready to Lock In Your Picks?
              </h3>

              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 mb-4 text-sm text-amber-300 font-bold leading-relaxed">
                Picks will be locked in for the entire week. Are you sure?
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-6 px-2">
                Once confirmed, your selections for this group are final for the week and cannot be changed before Saturday kickoff.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold border border-slate-700 transition-colors"
                >
                  No, Go Back
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmLockIn}
                  className="py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50"
                >
                  {saving ? 'Locking In...' : 'Yes, Lock In'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STEP 1: Making Picks (Card Deck vs Quick List)
  const currentCardGame = gamesList[cardDeckIndex] || gamesList[0];
  const isCurrentCardPicked = Boolean(currentCardGame && selections[currentCardGame.id]);

  return (
    <div className="space-y-6">
      {/* Top Controls: Mode Switcher & Progress Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-700 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('CARD_DECK')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'CARD_DECK'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Card Deck</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('QUICK_LIST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'QUICK_LIST'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Quick List</span>
            </button>
          </div>

          <span className="text-xs font-bold text-slate-300">
            {pickedCount} of {totalGames} Picked
          </span>
          {autoSavingDraft && (
            <span className="text-[11px] text-emerald-400/90 font-medium animate-pulse">
              Saving draft...
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full sm:w-48 bg-slate-900 border border-slate-800 h-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${(pickedCount / totalGames) * 100}%` }}
          />
        </div>
      </div>

      {/* CARD DECK MODE (Default on mobile) */}
      {viewMode === 'CARD_DECK' && currentCardGame && (
        <div className="max-w-xl mx-auto space-y-5">
          {/* Interactive Game Stepper Dots (1..7) */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {gamesList.map((g, idx) => {
              const hasPick = Boolean(selections[g.id]);
              const isCurrent = idx === cardDeckIndex;
              // Allow clicking any previous/picked game, or the immediate next unpicked game
              const canJump =
                idx <= cardDeckIndex ||
                hasPick ||
                gamesList.slice(0, idx).every((prevG) => Boolean(selections[prevG.id]));

              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!canJump}
                  onClick={() => canJump && setCardDeckIndex(idx)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-black border transition-all flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-105'
                      : hasPick
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60 hover:border-emerald-400'
                      : 'bg-slate-900/70 text-slate-500 border-slate-800 disabled:opacity-40'
                  }`}
                >
                  <span>{idx + 1}</span>
                  {hasPick && !isCurrent && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Card Step Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-amber-400 uppercase tracking-wider">
              Game {cardDeckIndex + 1} of {totalGames}
            </span>
            <span>{formatEasternKickoff(currentCardGame.kickoff_utc)}</span>
          </div>

          {/* Big Matchup Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            {currentCardGame.is_sec_matchup && (
              <div className="absolute top-3 right-4 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase">
                SEC Matchup
              </div>
            )}

            <div className="text-center mb-6">
              <span className="text-xs font-mono text-amber-400 font-bold">
                {currentCardGame.odds_display}
              </span>
            </div>

            {/* Team A vs Team B Tap Targets */}
            <div className="grid grid-cols-2 gap-4">
              {/* Away Team */}
              <button
                type="button"
                onClick={() => handleSelectTeam(currentCardGame.id, currentCardGame.away_team)}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all group ${
                  selections[currentCardGame.id] === currentCardGame.away_team
                    ? 'border-amber-400 bg-amber-500/15 shadow-xl shadow-amber-500/20 scale-[1.02]'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-600 hover:bg-slate-950'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentCardGame.away_logo}
                  alt={currentCardGame.away_team}
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-3 group-hover:scale-105 transition-transform"
                />
                {currentCardGame.away_rank && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 mb-1">
                    #{currentCardGame.away_rank}
                  </span>
                )}
                <span className="text-base sm:text-lg font-black text-white text-center leading-tight">
                  {currentCardGame.away_team}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  {currentCardGame.away_record}
                </span>
              </button>

              {/* Home Team */}
              <button
                type="button"
                onClick={() => handleSelectTeam(currentCardGame.id, currentCardGame.home_team)}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all group ${
                  selections[currentCardGame.id] === currentCardGame.home_team
                    ? 'border-amber-400 bg-amber-500/15 shadow-xl shadow-amber-500/20 scale-[1.02]'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-600 hover:bg-slate-950'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentCardGame.home_logo}
                  alt={currentCardGame.home_team}
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-3 group-hover:scale-105 transition-transform"
                />
                {currentCardGame.home_rank && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 mb-1">
                    #{currentCardGame.home_rank}
                  </span>
                )}
                <span className="text-base sm:text-lg font-black text-white text-center leading-tight">
                  {currentCardGame.home_team}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  {currentCardGame.home_record}
                </span>
              </button>
            </div>
          </div>

          {/* Deck Navigation Buttons — Next Game requires a pick on the current card! */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={cardDeckIndex === 0}
              onClick={() => setCardDeckIndex((prev) => Math.max(0, prev - 1))}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {!isCurrentCardPicked && (
              <span className="text-[11px] text-amber-400/90 font-semibold">
                Select a team above to continue
              </span>
            )}

            {cardDeckIndex < totalGames - 1 ? (
              <button
                type="button"
                disabled={!isCurrentCardPicked}
                onClick={() =>
                  isCurrentCardPicked &&
                  setCardDeckIndex((prev) => Math.min(totalGames - 1, prev + 1))
                }
                className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <span>Next Game</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!allPicked}
                onClick={() => setStep('REVIEW')}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Next: Review Picks</span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* QUICK LIST MODE */}
      {viewMode === 'QUICK_LIST' && (
        <div className="space-y-4">
          {gamesList.map((game, idx) => {
            const isHomeSelected = selections[game.id] === game.home_team;
            const isAwaySelected = selections[game.id] === game.away_team;

            return (
              <div
                key={game.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-[11px] font-black text-slate-400 flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-200 block">
                      {formatEasternKickoff(game.kickoff_utc)}
                    </span>
                    <span className="font-mono text-[11px] text-amber-400">
                      {game.odds_display}
                    </span>
                  </div>
                </div>

                {/* Team Buttons */}
                <div className="grid grid-cols-2 gap-3 flex-1 sm:max-w-md">
                  <button
                    type="button"
                    onClick={() => handleSelectTeam(game.id, game.away_team)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                      isAwaySelected
                        ? 'border-amber-400 bg-amber-500/15 shadow-md scale-[1.02]'
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={game.away_logo} alt={game.away_team} className="w-6 h-6 object-contain" />
                      <span className="text-xs font-bold text-white truncate">{game.away_team}</span>
                    </div>
                    {isAwaySelected && <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 ml-1" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTeam(game.id, game.home_team)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                      isHomeSelected
                        ? 'border-amber-400 bg-amber-500/15 shadow-md scale-[1.02]'
                        : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={game.home_logo} alt={game.home_team} className="w-6 h-6 object-contain" />
                      <span className="text-xs font-bold text-white truncate">{game.home_team}</span>
                    </div>
                    {isHomeSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 ml-1" />}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              disabled={!allPicked}
              onClick={() => setStep('REVIEW')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              <span>Next: Review Picks ({pickedCount}/{totalGames})</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
