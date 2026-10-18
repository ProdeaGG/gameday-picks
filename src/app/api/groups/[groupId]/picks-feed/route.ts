import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { groups, groupMembers, users, weeks, games, picks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isWeekPastCutoff, sortGamesChronologically } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const groupId = parseInt(params.groupId, 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
  }

  // Active regular week (or latest published week)
  const publishedWeeks = await db
    .select()
    .from(weeks)
    .where(eq(weeks.is_published, true))
    .orderBy(desc(weeks.week_number));

  const activeWeek =
    publishedWeeks.find((w) => w.stage === 'REGULAR') || publishedWeeks[0] || null;

  if (!activeWeek) {
    return NextResponse.json({
      isFullReveal: false,
      isCutoffPassed: false,
      lockTimeUtc: null,
      matchups: [],
    });
  }

  const rawWeekGames = await db
    .select()
    .from(games)
    .where(eq(games.week_id, activeWeek.id));

  const weekGames = sortGamesChronologically(rawWeekGames);

  // Fetch all group members
  const members = await db
    .select({
      userId: users.id,
      username: users.username,
      avatarType: users.avatar_type,
      avatarValue: users.avatar_value,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.user_id, users.id))
    .where(eq(groupMembers.group_id, groupId));

  // Fetch all picks in this group for this week
  const allGroupPicks = await db
    .select()
    .from(picks)
    .where(
      and(eq(picks.group_id, groupId), eq(picks.week_id, activeWeek.id))
    );

  // Determine member lock status
  const memberLockStatus = members.map((m) => {
    const userPicks = allGroupPicks.filter((p) => p.user_id === m.userId);
    const hasPicks = userPicks.length > 0;
    const isLocked =
      activeWeek.sandbox_state_override === 'ALL_SUBMITTED' ||
      (hasPicks && userPicks.every((p) => Boolean(p.is_locked)));
    return {
      userId: m.userId,
      username: m.username,
      avatarType: m.avatarType,
      avatarValue: m.avatarValue,
      isLocked,
    };
  });

  const allMembersLocked =
    memberLockStatus.length > 0 &&
    memberLockStatus.every((m) => m.isLocked);

  const isCutoffPassed = isWeekPastCutoff(activeWeek);

  // Full pick reveal occurs when either cutoff has passed OR 100% of group members locked early
  const isFullReveal =
    activeWeek.sandbox_state_override === 'ALL_SUBMITTED' ||
    activeWeek.sandbox_state_override === 'LOCKED' ||
    activeWeek.sandbox_state_override === 'GRADED' ||
    isCutoffPassed ||
    allMembersLocked;

  // Build matchup cards
  const matchups = weekGames.map((g) => {
    const gamePicks = allGroupPicks.filter((p) => p.game_id === g.id);

    const homePickers: Array<{
      userId: number;
      username: string;
      avatarType: string;
      avatarValue: string;
    }> = [];

    const awayPickers: Array<{
      userId: number;
      username: string;
      avatarType: string;
      avatarValue: string;
    }> = [];

    if (isFullReveal) {
      for (const p of gamePicks) {
        const member = members.find((m) => m.userId === p.user_id);
        if (!member) continue;

        const entry = {
          userId: member.userId,
          username: member.username,
          avatarType: member.avatarType,
          avatarValue: member.avatarValue,
        };

        if (p.selected_team === g.home_team) {
          homePickers.push(entry);
        } else if (p.selected_team === g.away_team) {
          awayPickers.push(entry);
        }
      }
    } else {
      // Prior to reveal, current user can see their own pick on this matchup
      const myPick = gamePicks.find((p) => p.user_id === currentUser.id);
      if (myPick) {
        const entry = {
          userId: currentUser.id,
          username: currentUser.username,
          avatarType: currentUser.avatarType,
          avatarValue: currentUser.avatarValue,
        };
        if (myPick.selected_team === g.home_team) {
          homePickers.push(entry);
        } else if (myPick.selected_team === g.away_team) {
          awayPickers.push(entry);
        }
      }
    }

    return {
      game: g,
      homePickers,
      awayPickers,
    };
  });

  return NextResponse.json({
    isFullReveal,
    isCutoffPassed,
    allMembersLocked,
    lockTimeUtc: activeWeek.lock_time_utc,
    memberLockStatus,
    matchups,
  });
}
