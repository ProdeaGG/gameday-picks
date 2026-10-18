'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MemberLeaderboardRow } from '@/lib/leaderboard';
import { ArrowUpDown } from 'lucide-react';

interface LeaderboardTableProps {
  groupId: number;
}

type TabFilter = 'OVERALL' | 'REGULAR' | 'BOWLS' | 'PLAYOFFS';

export default function LeaderboardTable({ groupId }: LeaderboardTableProps) {
  const [rows, setRows] = useState<MemberLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'WINS' | 'WIN_PCT'>('WINS');
  const [activeCategory, setActiveCategory] = useState<TabFilter>('OVERALL');

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/groups/${groupId}/leaderboard?sortBy=${sortBy}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setRows(data.leaderboard || []);
      }
    } catch {
      // leaderboard fetch error
    } finally {
      setLoading(false);
    }
  }, [groupId, sortBy]);

  useEffect(() => {
    fetchLeaderboard();
    const handler = () => fetchLeaderboard();
    window.addEventListener('gameday-sandbox-updated', handler);
    return () => window.removeEventListener('gameday-sandbox-updated', handler);
  }, [fetchLeaderboard]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold">Calculating standings &amp; shared ties...</p>
      </div>
    );
  }

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'WINS' ? 'WIN_PCT' : 'WINS'));
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs: Full Season + Postseason Splits */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveCategory('OVERALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeCategory === 'OVERALL'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Overall Record (Combined)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('REGULAR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeCategory === 'REGULAR'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Regular Season
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('BOWLS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeCategory === 'BOWLS'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bowl Games
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('PLAYOFFS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeCategory === 'PLAYOFFS'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Playoffs &amp; Championship
          </button>
        </div>

        <button
          type="button"
          onClick={toggleSort}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 transition-colors self-start sm:self-auto"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort: {sortBy === 'WINS' ? 'Total Wins First' : 'Win % First'}</span>
        </button>
      </div>

      {/* Leaderboard Standings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4 text-center">Week Record</th>
                <th className="py-3 px-4 text-center">
                  {activeCategory === 'OVERALL'
                    ? 'Overall (W-L)'
                    : activeCategory === 'REGULAR'
                    ? 'Regular (W-L)'
                    : activeCategory === 'BOWLS'
                    ? 'Bowls (W-L)'
                    : 'Playoffs (W-L)'}
                </th>
                <th className="py-3 px-4 text-center">Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => {
                const avatarSrc =
                  row.avatarType === 'CUSTOM'
                    ? row.avatarValue
                    : `/avatars/${row.avatarValue || 'default-1'}.svg`;

                const isFirst = row.rank === 1;

                // Category-specific display values
                const categoryRecord =
                  activeCategory === 'OVERALL'
                    ? `${row.overallWins}-${row.overallLosses}`
                    : activeCategory === 'REGULAR'
                    ? `${row.regularWins}-${row.regularLosses}`
                    : activeCategory === 'BOWLS'
                    ? `${row.bowlWins}-${row.bowlLosses}`
                    : `${row.playoffWins}-${row.playoffLosses}`;

                const categoryWinPct =
                  activeCategory === 'OVERALL'
                    ? row.overallWinPct
                    : activeCategory === 'REGULAR'
                    ? row.regularWinPct
                    : activeCategory === 'BOWLS'
                    ? row.bowlWinPct
                    : row.playoffWinPct;

                return (
                  <tr
                    key={row.userId}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isFirst ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    {/* Fantasy Shared Tie Ordinal Rank (1st, 1st, 1st, 4th) */}
                    <td className="py-3.5 px-4 text-center">
                      <div
                        className={`inline-flex items-center justify-center font-black rounded-lg px-2 py-0.5 text-xs ${
                          isFirst
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                            : row.rank <= 3
                            ? 'bg-slate-800 text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.rankDisplay}
                      </div>
                    </td>

                    {/* Avatar & Username */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarSrc}
                          alt={row.username}
                          className="w-8 h-8 rounded-lg pixelated object-cover border border-amber-400 bg-slate-900 flex-shrink-0"
                        />
                        <div>
                          <div className="font-bold text-white text-xs sm:text-sm">
                            {row.username}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Seat #{row.seatIndex + 1}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Week Record (0-0 if missed cutoff) */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-200">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          row.weekDisplay === '0-0'
                            ? 'bg-slate-800/80 text-slate-500'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                        }`}
                      >
                        {row.weekDisplay}
                      </span>
                    </td>

                    {/* Category W-L */}
                    <td className="py-3.5 px-4 text-center font-black text-slate-100 text-sm">
                      {categoryRecord}
                    </td>

                    {/* Win % */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">
                      {categoryWinPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
