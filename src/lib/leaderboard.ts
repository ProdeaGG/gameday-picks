import { db, ensureDbInitialized } from '@/db';
import { groupMembers, users, weeks, games, picks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { SeasonStage } from './time';

export interface MemberLeaderboardRow {
  userId: number;
  username: string;
  avatarType: 'DEFAULT' | 'CUSTOM';
  avatarValue: string;
  seatIndex: number;
  isLockedThisWeek: boolean;
  picksCountThisWeek: number;
  // Current Week Record
  weekWins: number;
  weekLosses: number;
  weekDisplay: string; // e.g. "6-2" or "0-0"
  // Overall Record (Full Season + Postseason)
  overallWins: number;
  overallLosses: number;
  overallWinPct: number;
  // Stage splits
  regularWins: number;
  regularLosses: number;
  regularWinPct: number;
  bowlWins: number;
  bowlLosses: number;
  bowlWinPct: number;
  playoffWins: number;
  playoffLosses: number;
  playoffWinPct: number;
  // V2 ATS Stats
  atsWins: number;
  atsLosses: number;
  // Computed Rank
  rank: number;
  rankDisplay: string; // e.g. "1st", "2nd", "T-1st"
}

function formatOrdinal(n: number): string {
  const pr = new Intl.PluralRules('en-US', { type: 'ordinal' });
  const suffixes: Record<string, string> = {
    one: 'st',
    two: 'nd',
    few: 'rd',
    other: 'th',
  };
  return `${n}${suffixes[pr.select(n)] || 'th'}`;
}

export async function calculateGroupLeaderboard(
  groupId: number,
  sortBy: 'WINS' | 'WIN_PCT' = 'WINS'
): Promise<MemberLeaderboardRow[]> {
  await ensureDbInitialized();

  // 1. Fetch group members
  const members = await db
    .select({
      memberId: groupMembers.id,
      seatIndex: groupMembers.seat_index,
      userId: users.id,
      username: users.username,
      avatarType: users.avatar_type,
      avatarValue: users.avatar_value,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.user_id, users.id))
    .where(eq(groupMembers.group_id, groupId));

  if (members.length === 0) return [];

  // 2. Fetch all weeks (for full season/postseason tally) and published weeks (for active week)
  const allWeeks = await db.select().from(weeks);
  const publishedWeeks = allWeeks.filter((w) => w.is_published);

  const activeWeek =
    publishedWeeks.find((w) => w.stage === 'REGULAR') || publishedWeeks[0] || allWeeks[0] || null;

  // 3. Fetch all picks in this group
  const groupPicks = await db
    .select({
      pickId: picks.id,
      userId: picks.user_id,
      gameId: picks.game_id,
      weekId: picks.week_id,
      selectedTeam: picks.selected_team,
      isLocked: picks.is_locked,
      isCorrect: picks.is_correct,
      isAtsCorrect: picks.is_ats_correct,
    })
    .from(picks)
    .where(eq(picks.group_id, groupId));

  // Map games by ID to know stage & status
  const allGames = await db.select().from(games);
  const gameMap = new Map<number, typeof games.$inferSelect>();
  for (const g of allGames) {
    gameMap.set(g.id, g);
  }

  const weekMap = new Map<number, typeof weeks.$inferSelect>();
  for (const w of allWeeks) {
    weekMap.set(w.id, w);
  }

  // 4. Compute records per member
  const rows: MemberLeaderboardRow[] = members.map((m) => {
    const userPicks = groupPicks.filter((p) => p.userId === m.userId);

    let weekWins = 0;
    let weekLosses = 0;
    let picksCountThisWeek = 0;
    let isLockedThisWeek = false;

    let overallWins = 0;
    let overallLosses = 0;
    let atsWins = 0;
    let atsLosses = 0;

    let regularWins = 0;
    let regularLosses = 0;
    let bowlWins = 0;
    let bowlLosses = 0;
    let playoffWins = 0;
    let playoffLosses = 0;

    // Active week evaluation
    if (activeWeek) {
      const activeWeekPicks = userPicks.filter((p) => p.weekId === activeWeek.id);
      picksCountThisWeek = activeWeekPicks.length;
      isLockedThisWeek =
        activeWeek.sandbox_state_override === 'ALL_SUBMITTED' ||
        (activeWeekPicks.length > 0 && activeWeekPicks.every((p) => Boolean(p.isLocked)));

      // If active week is GRADED, tally current week score
      for (const p of activeWeekPicks) {
        const gm = gameMap.get(p.gameId);
        if (gm && gm.status === 'FINAL') {
          if (p.isCorrect === true) weekWins++;
          else if (p.isCorrect === false) weekLosses++;
        }
      }
    }

    // Tally all weeks across the season
    for (const p of userPicks) {
      const gm = gameMap.get(p.gameId);
      const wk = weekMap.get(p.weekId);
      if (!gm || !wk || gm.status !== 'FINAL') continue;

      if (p.isCorrect === true) {
        overallWins++;
        if (wk.stage === 'REGULAR') regularWins++;
        else if (wk.stage === 'BOWL') bowlWins++;
        else if (wk.stage === 'PLAYOFF' || wk.stage === 'CHAMPIONSHIP') playoffWins++;
      } else if (p.isCorrect === false) {
        overallLosses++;
        if (wk.stage === 'REGULAR') regularLosses++;
        else if (wk.stage === 'BOWL') bowlLosses++;
        else if (wk.stage === 'PLAYOFF' || wk.stage === 'CHAMPIONSHIP') playoffLosses++;
      }

      if (p.isAtsCorrect === true) atsWins++;
      else if (p.isAtsCorrect === false) atsLosses++;
    }

    // Directives: Missed picks = 0-0. Never penalize missed picks with automatic losses.
    // If a user has no submitted picks for a week, 0 wins and 0 losses are added.
    const overallTotal = overallWins + overallLosses;
    const overallWinPct = overallTotal > 0 ? (overallWins / overallTotal) * 100 : 0;

    const regularTotal = regularWins + regularLosses;
    const regularWinPct = regularTotal > 0 ? (regularWins / regularTotal) * 100 : 0;

    const bowlTotal = bowlWins + bowlLosses;
    const bowlWinPct = bowlTotal > 0 ? (bowlWins / bowlTotal) * 100 : 0;

    const playoffTotal = playoffWins + playoffLosses;
    const playoffWinPct = playoffTotal > 0 ? (playoffWins / playoffTotal) * 100 : 0;

    // Week display: if user didn't make picks, show "0-0"
    const weekDisplay = `${weekWins}-${weekLosses}`;

    return {
      userId: m.userId,
      username: m.username,
      avatarType: m.avatarType as 'DEFAULT' | 'CUSTOM',
      avatarValue: m.avatarValue,
      seatIndex: m.seatIndex,
      isLockedThisWeek,
      picksCountThisWeek,
      weekWins,
      weekLosses,
      weekDisplay,
      overallWins,
      overallLosses,
      overallWinPct,
      regularWins,
      regularLosses,
      regularWinPct,
      bowlWins,
      bowlLosses,
      bowlWinPct,
      playoffWins,
      playoffLosses,
      playoffWinPct,
      atsWins,
      atsLosses,
      rank: 1,
      rankDisplay: '1st',
    };
  });

  // 5. Sort Rows:
  // Primary: Wins (desc) then Win % (desc) OR Win % (desc) then Wins (desc)
  rows.sort((a, b) => {
    if (sortBy === 'WIN_PCT') {
      if (b.overallWinPct !== a.overallWinPct) return b.overallWinPct - a.overallWinPct;
      if (b.overallWins !== a.overallWins) return b.overallWins - a.overallWins;
    } else {
      if (b.overallWins !== a.overallWins) return b.overallWins - a.overallWins;
      if (b.overallWinPct !== a.overallWinPct) return b.overallWinPct - a.overallWinPct;
    }
    return a.overallLosses - b.overallLosses;
  });

  // 6. Assign Fantasy-Style Shared Ordinal Ties (e.g. 1st, 1st, 1st, 4th)
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) {
      rows[0].rank = 1;
      rows[0].rankDisplay = formatOrdinal(1);
    } else {
      const prev = rows[i - 1];
      const curr = rows[i];
      const isTied =
        curr.overallWins === prev.overallWins &&
        curr.overallLosses === prev.overallLosses &&
        Math.abs(curr.overallWinPct - prev.overallWinPct) < 0.01;

      if (isTied) {
        curr.rank = prev.rank;
        curr.rankDisplay = formatOrdinal(prev.rank);
      } else {
        // Next rank jumps by index + 1 (e.g. 1st, 1st, 1st -> 4th)
        curr.rank = i + 1;
        curr.rankDisplay = formatOrdinal(i + 1);
      }
    }
  }

  return rows;
}
