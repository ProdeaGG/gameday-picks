import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { groups, groupMembers, weeks, games, picks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isWeekPastCutoff, sortGamesChronologically } from '@/lib/time';
import { syncLiveScoresFromEspnIfStale } from '@/lib/espn';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = parseInt(searchParams.get('groupId') || '', 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: 'Invalid groupId' }, { status: 400 });
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
      week: null,
      games: [],
      userPicks: [],
      isLocked: false,
      isCutoffPassed: false,
    });
  }

  // If week is not past cutoff, check ESPN for kickoff time shifts or score updates (throttled to 5 mins)
  if (!isWeekPastCutoff(activeWeek)) {
    await syncLiveScoresFromEspnIfStale(5 * 60 * 1000);
  }

  const rawWeekGames = await db
    .select()
    .from(games)
    .where(eq(games.week_id, activeWeek.id));

  // Sort games chronologically (confirmed kickoff times in order, TBD games at end of day)
  const weekGames = sortGamesChronologically(rawWeekGames);

  const userPicks = await db
    .select()
    .from(picks)
    .where(
      and(
        eq(picks.group_id, groupId),
        eq(picks.user_id, currentUser.id),
        eq(picks.week_id, activeWeek.id)
      )
    );

  const isCutoffPassed = isWeekPastCutoff(activeWeek);
  const isLocked =
    activeWeek.sandbox_state_override === 'ALL_SUBMITTED' ||
    (userPicks.length > 0 && userPicks.every((p) => Boolean(p.is_locked)));

  return NextResponse.json({
    week: activeWeek,
    games: weekGames,
    userPicks,
    isLocked,
    isCutoffPassed,
    lockTimeUtc: activeWeek.lock_time_utc,
  });
}

export async function POST(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { groupId, weekId, selections, action } = (await req.json()) as {
      groupId: number;
      weekId: number;
      selections: Record<number, string>; // gameId -> selectedTeam
      action: 'SAVE_DRAFT' | 'LOCK_IN';
    };

    if (!groupId || !weekId || !selections) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify membership
    const membership = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.group_id, groupId),
          eq(groupMembers.user_id, currentUser.id)
        )
      )
      .limit(1);

    if (membership.length === 0 && !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 403 }
      );
    }

    // Check week lock cutoff
    const weekRows = await db.select().from(weeks).where(eq(weeks.id, weekId)).limit(1);
    const targetWeek = weekRows[0];
    if (!targetWeek) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    const pastCutoff = isWeekPastCutoff(targetWeek);
    if (pastCutoff) {
      return NextResponse.json(
        { error: 'The pick cutoff (Saturday 11:30 AM ET) has passed for this week.' },
        { status: 403 }
      );
    }

    // Check if user has already permanently locked picks for this group/week
    const existingPicks = await db
      .select()
      .from(picks)
      .where(
        and(
          eq(picks.group_id, groupId),
          eq(picks.user_id, currentUser.id),
          eq(picks.week_id, weekId)
        )
      );

    const alreadyLocked =
      existingPicks.length > 0 && existingPicks.every((p) => Boolean(p.is_locked));

    if (alreadyLocked) {
      return NextResponse.json(
        {
          error:
            'Your picks are permanently locked for the entire week and cannot be modified.',
        },
        { status: 403 }
      );
    }

    const isLockIn = action === 'LOCK_IN';
    const now = new Date().toISOString();

    // Fetch games for this week to freeze spreads at pick
    const weekGames = await db.select().from(games).where(eq(games.week_id, weekId));
    const gameSpreadMap = new Map<number, number | null>();
    for (const g of weekGames) {
      gameSpreadMap.set(g.id, g.spread_home);
    }

    for (const [gameIdStr, selectedTeam] of Object.entries(selections)) {
      const gId = parseInt(gameIdStr, 10);
      if (isNaN(gId)) continue;

      const frozenSpread = gameSpreadMap.get(gId) ?? null;
      const existing = existingPicks.find((p) => p.game_id === gId);

      if (existing) {
        await db
          .update(picks)
          .set({
            selected_team: selectedTeam,
            is_locked: isLockIn,
            locked_at: isLockIn ? now : null,
            locked_spread_at_pick: isLockIn ? frozenSpread : existing.locked_spread_at_pick,
            updated_at: now,
          })
          .where(eq(picks.id, existing.id));
      } else {
        await db.insert(picks).values({
          user_id: currentUser.id,
          group_id: groupId,
          game_id: gId,
          week_id: weekId,
          selected_team: selectedTeam,
          is_locked: isLockIn,
          locked_at: isLockIn ? now : null,
          locked_spread_at_pick: isLockIn ? frozenSpread : null,
          updated_at: now,
        });
      }
    }

    return NextResponse.json({
      success: true,
      isLocked: isLockIn,
      message: isLockIn
        ? 'Your picks are permanently locked in for the week!'
        : 'Draft picks saved.',
    });
  } catch (error) {
    console.error('Pick mutation error:', error);
    return NextResponse.json({ error: 'Failed to save picks' }, { status: 500 });
  }
}
