'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { formatEasternKickoff } from '@/lib/time';
import {
  Lock,
  Unlock,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
} from 'lucide-react';

interface MemberPicker {
  userId: number;
  username: string;
  avatarType: string;
  avatarValue: string;
}

interface MatchupCardData {
  game: {
    id: number;
    home_team: string;
    away_team: string;
    home_logo: string;
    away_logo: string;
    home_rank: number | null;
    away_rank: number | null;
    home_score: number | null;
    away_score: number | null;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL';
    winner_team: string | null;
    odds_display: string;
    kickoff_utc: string;
    is_sec_matchup: boolean;
  };
  homePickers: MemberPicker[];
  awayPickers: MemberPicker[];
}

interface GroupPicksFeedProps {
  groupId: number;
}

export default function GroupPicksFeed({ groupId }: GroupPicksFeedProps) {
  const [loading, setLoading] = useState(true);
  const [isFullReveal, setIsFullReveal] = useState(false);
  const [allMembersLocked, setAllMembersLocked] = useState(false);
  const [matchups, setMatchups] = useState<MatchupCardData[]>([]);
  const [memberStatus, setMemberStatus] = useState<
    Array<{
      userId: number;
      username: string;
      avatarType: string;
      avatarValue: string;
      isLocked: boolean;
    }>
  >([]);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/picks-feed`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIsFullReveal(Boolean(data.isFullReveal));
        setAllMembersLocked(Boolean(data.allMembersLocked));
        setMatchups(data.matchups || []);
        setMemberStatus(data.memberLockStatus || []);
      }
    } catch {
      // feed fetch error
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchFeed();
    const handler = () => fetchFeed();
    window.addEventListener('gameday-sandbox-updated', handler);
    return () => window.removeEventListener('gameday-sandbox-updated', handler);
  }, [fetchFeed]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Loading group selections...</p>
      </div>
    );
  }

  const renderPickerAvatar = (p: MemberPicker, state: 'WIN' | 'LOSS' | 'NEUTRAL') => {
    const avatarSrc =
      p.avatarType === 'CUSTOM'
        ? p.avatarValue
        : `/avatars/${p.avatarValue || 'default-1'}.svg`;
    return (
      <div
        key={p.userId}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
          state === 'WIN'
            ? 'bg-emerald-950/80 border-emerald-400/90 text-emerald-200 shadow-sm shadow-emerald-500/20'
            : state === 'LOSS'
            ? 'bg-red-950/30 border-red-900/50 text-slate-400'
            : 'bg-slate-950/80 border-slate-800 text-slate-200'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt={p.username}
          className="w-5 h-5 rounded pixelated object-cover border border-amber-400/80 bg-slate-900"
        />
        <span className="text-[11px] font-bold truncate max-w-[80px]">
          {p.username}
        </span>
        {state === 'WIN' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
        {state === 'LOSS' && <XCircle className="w-3.5 h-3.5 text-red-400/70 flex-shrink-0" />}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Reveal Status */}
      {isFullReveal ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border border-emerald-500/60 shadow-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                <span>Group Selections Revealed</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  {allMembersLocked ? '100% Group Locked' : 'Cutoff Passed'}
                </span>
              </h4>
              <p className="text-xs text-emerald-300/80">
                Winning teams and correct group picks are highlighted in green as games finish.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/40 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wide">
                  Group Selections Hidden Until Saturday 11:30 AM ET
                </h4>
                <p className="text-xs text-amber-200/80">
                  Group selections remain secret until the Saturday cutoff or until 100% of members lock early.
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-amber-300 font-bold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
              Cutoff: Sat 11:30 AM ET
            </div>
          </div>

          {/* Member Lock Readiness Pills */}
          <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase mr-1">
              Lock Status:
            </span>
            {memberStatus.map((m) => {
              const src =
                m.avatarType === 'CUSTOM'
                  ? m.avatarValue
                  : `/avatars/${m.avatarValue || 'default-1'}.svg`;
              return (
                <div
                  key={m.userId}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold ${
                    m.isLocked
                      ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={m.username} className="w-4 h-4 rounded pixelated" />
                  <span className="truncate max-w-[60px]">{m.username}</span>
                  {m.isLocked ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Matchup Cards Feed */}
      <div className="space-y-4">
        {matchups.map(({ game, homePickers, awayPickers }) => {
          const isFinal = game.status === 'FINAL';
          const isLive = game.status === 'IN_PROGRESS';

          const awayWon =
            (isFinal && game.winner_team === game.away_team) ||
            (isFinal &&
              game.away_score !== null &&
              game.home_score !== null &&
              game.away_score > game.home_score);
          const homeWon =
            (isFinal && game.winner_team === game.home_team) ||
            (isFinal &&
              game.home_score !== null &&
              game.away_score !== null &&
              game.home_score > game.away_score);

          const awayLeadingLive =
            isLive &&
            game.away_score !== null &&
            game.home_score !== null &&
            game.away_score > game.home_score;
          const homeLeadingLive =
            isLive &&
            game.home_score !== null &&
            game.away_score !== null &&
            game.home_score > game.away_score;

          return (
            <div
              key={game.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4"
            >
              {/* Card Header: Kickoff ET, Live Status, Odds */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {game.is_sec_matchup && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black text-[9px] uppercase">
                      SEC Matchup
                    </span>
                  )}
                  <span className="text-slate-400 font-medium">
                    {formatEasternKickoff(game.kickoff_utc)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-amber-400 font-semibold">
                    {game.odds_display}
                  </span>
                  {isFinal ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-[10px]">
                      FINAL
                    </span>
                  ) : isLive ? (
                    <span className="px-2 py-0.5 rounded bg-red-500 text-white font-black text-[10px] animate-pulse">
                      LIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[10px]">
                      SCHEDULED
                    </span>
                  )}
                </div>
              </div>

              {/* Side-by-Side Team + Pickers Columns with Prominent Winning Team Border Highlight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* AWAY TEAM FULL BOX (Header + Pickers) */}
                <div
                  className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${
                    awayWon
                      ? 'border-emerald-400 bg-emerald-950/30 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/40'
                      : awayLeadingLive
                      ? 'border-amber-400/80 bg-amber-950/20'
                      : isFinal && homeWon
                      ? 'border-slate-800/70 bg-slate-950/40 opacity-65'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div>
                    {/* Away Team Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={game.away_logo}
                          alt={game.away_team}
                          className="w-9 h-9 sm:w-11 sm:h-11 object-contain"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {game.away_rank && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">
                                #{game.away_rank}
                              </span>
                            )}
                            <span className="text-sm sm:text-base font-black text-white">
                              {game.away_team}
                            </span>
                          </div>
                          {awayWon && (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                              <Trophy className="w-3 h-3 stroke-[2.5]" />
                              <span>Winner</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {game.away_score !== null && (
                        <span
                          className={`text-2xl sm:text-3xl font-black font-mono ${
                            awayWon ? 'text-emerald-400' : 'text-slate-300'
                          }`}
                        >
                          {game.away_score}
                        </span>
                      )}
                    </div>

                    {/* Away Pickers List */}
                    <div className="pt-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                        <span>
                          Picked {game.away_team} ({awayPickers.length})
                        </span>
                        {awayWon && (
                          <span className="text-emerald-400 font-black">+1 Win</span>
                        )}
                      </div>
                      {awayPickers.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic">
                          No picks
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {awayPickers.map((p) =>
                            renderPickerAvatar(
                              p,
                              awayWon ? 'WIN' : isFinal && homeWon ? 'LOSS' : 'NEUTRAL'
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* HOME TEAM FULL BOX (Header + Pickers) */}
                <div
                  className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${
                    homeWon
                      ? 'border-emerald-400 bg-emerald-950/30 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/40'
                      : homeLeadingLive
                      ? 'border-amber-400/80 bg-amber-950/20'
                      : isFinal && awayWon
                      ? 'border-slate-800/70 bg-slate-950/40 opacity-65'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div>
                    {/* Home Team Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={game.home_logo}
                          alt={game.home_team}
                          className="w-9 h-9 sm:w-11 sm:h-11 object-contain"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {game.home_rank && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">
                                #{game.home_rank}
                              </span>
                            )}
                            <span className="text-sm sm:text-base font-black text-white">
                              {game.home_team}
                            </span>
                          </div>
                          {homeWon && (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                              <Trophy className="w-3 h-3 stroke-[2.5]" />
                              <span>Winner</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {game.home_score !== null && (
                        <span
                          className={`text-2xl sm:text-3xl font-black font-mono ${
                            homeWon ? 'text-emerald-400' : 'text-slate-300'
                          }`}
                        >
                          {game.home_score}
                        </span>
                      )}
                    </div>

                    {/* Home Pickers List */}
                    <div className="pt-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                        <span>
                          Picked {game.home_team} ({homePickers.length})
                        </span>
                        {homeWon && (
                          <span className="text-emerald-400 font-black">+1 Win</span>
                        )}
                      </div>
                      {homePickers.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic">
                          No picks
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {homePickers.map((p) =>
                            renderPickerAvatar(
                              p,
                              homeWon ? 'WIN' : isFinal && awayWon ? 'LOSS' : 'NEUTRAL'
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
