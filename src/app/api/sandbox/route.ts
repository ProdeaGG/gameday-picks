import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { groups, weeks, games, picks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { seedSandboxDemoData, wipeSandboxData } from '@/db/seed';
import { gradePicksForFinalGame } from '@/lib/espn';

export const dynamic = 'force-dynamic';

// Realistic final score table for the 7 seeded Week 8 games (plus candidate swaps) when GRADED mode is triggered
const MOCK_FINAL_SCORES: Record<string, { homeScore: number; awayScore: number; winner: string }> = {
  Texas: { homeScore: 15, awayScore: 30, winner: 'Georgia' },
  Tennessee: { homeScore: 24, awayScore: 17, winner: 'Tennessee' },
  Arkansas: { homeScore: 10, awayScore: 34, winner: 'LSU' },
  Missouri: { homeScore: 21, awayScore: 17, winner: 'Missouri' },
  Florida: { homeScore: 48, awayScore: 20, winner: 'Florida' },
  Oklahoma: { homeScore: 9, awayScore: 35, winner: 'South Carolina' },
  'Mississippi State': { homeScore: 24, awayScore: 34, winner: 'Texas A&M' },
  Clemson: { homeScore: 48, awayScore: 31, winner: 'Clemson' },
  'Penn State': { homeScore: 33, awayScore: 30, winner: 'Penn State' },
};

export async function GET(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.isAdmin) {
    return NextResponse.json({ isAdmin: false }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const groupIdParam = searchParams.get('groupId');

  // Find active Regular Season week (Week 8) or latest published week
  const allWeeks = await db
    .select()
    .from(weeks)
    .where(eq(weeks.is_published, true))
    .orderBy(desc(weeks.week_number));

  const regularWeek = allWeeks.find((w) => w.stage === 'REGULAR') || allWeeks[0] || null;

  let currentBoothSize = 8;
  if (groupIdParam) {
    const gId = parseInt(groupIdParam, 10);
    if (!isNaN(gId)) {
      const grp = await db.select().from(groups).where(eq(groups.id, gId)).limit(1);
      if (grp[0]?.sandbox_player_count) {
        currentBoothSize = grp[0].sandbox_player_count;
      }
    }
  } else {
    const firstGrp = await db.select().from(groups).limit(1);
    if (firstGrp[0]?.sandbox_player_count) {
      currentBoothSize = firstGrp[0].sandbox_player_count;
    }
  }

  return NextResponse.json({
    isAdmin: true,
    activeWeekId: regularWeek?.id || null,
    activeWeekLabel: regularWeek?.label || 'No Active Slate',
    sandboxState: regularWeek?.sandbox_state_override || 'OPEN',
    boothSize: currentBoothSize,
  });
}

export async function POST(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.isAdmin) {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, groupId, boothSize, sandboxState } = body;

    if (action === 'LOAD_DEMO') {
      const seeded = await seedSandboxDemoData();
      return NextResponse.json({
        success: true,
        message: 'Loaded Demo Groups ("Saturday Night Down South" & "SEC Tailgate Crew"), 7 Bots, and Slates!',
        group1Id: seeded.group1.id,
        group2Id: seeded.group2.id,
      });
    }

    if (action === 'SET_BOOTH_SIZE') {
      const count = Math.max(1, Math.min(8, Number(boothSize) || 8));
      if (groupId) {
        await db
          .update(groups)
          .set({ sandbox_player_count: count })
          .where(eq(groups.id, Number(groupId)));
      } else {
        await db.update(groups).set({ sandbox_player_count: count });
      }
      return NextResponse.json({
        success: true,
        boothSize: count,
      });
    }

    if (action === 'UNLOCK_ADMIN_PICKS') {
      await db
        .update(picks)
        .set({ is_locked: false, locked_at: null })
        .where(eq(picks.user_id, currentUser.id));

      return NextResponse.json({
        success: true,
        message: 'Admin picks unlocked for testing!',
      });
    }

    if (action === 'SET_TIME_STATE') {
      const validStates = ['OPEN', 'ALL_SUBMITTED', 'LOCKED', 'GRADED'] as const;
      if (!validStates.includes(sandboxState)) {
        return NextResponse.json({ error: 'Invalid sandbox state' }, { status: 400 });
      }

      // Apply state override to the active regular season week (or latest week)
      const allWeeks = await db
        .select()
        .from(weeks)
        .where(eq(weeks.is_published, true));

      const targetWeek = allWeeks.find((w) => w.stage === 'REGULAR') || allWeeks[0];
      if (!targetWeek) {
        return NextResponse.json({ error: 'No active week found. Load Demo Data first.' }, { status: 404 });
      }

      await db
        .update(weeks)
        .set({ sandbox_state_override: sandboxState })
        .where(eq(weeks.id, targetWeek.id));

      const weekGames = await db
        .select()
        .from(games)
        .where(eq(games.week_id, targetWeek.id));

      if (sandboxState === 'GRADED') {
        // Simulate final scores and grade all picks (including V2 ATS)
        for (const g of weekGames) {
          const mock = MOCK_FINAL_SCORES[g.home_team] || {
            homeScore: 28,
            awayScore: 24,
            winner: g.home_team,
          };

          await db
            .update(games)
            .set({
              home_score: mock.homeScore,
              away_score: mock.awayScore,
              status: 'FINAL',
              winner_team: mock.winner,
            })
            .where(eq(games.id, g.id));

          await gradePicksForFinalGame(g.id);
        }
      } else {
        // Reset active week games to SCHEDULED so OPEN / ALL_SUBMITTED / LOCKED can be tested cleanly
        for (const g of weekGames) {
          await db
            .update(games)
            .set({
              home_score: null,
              away_score: null,
              status: 'SCHEDULED',
              winner_team: null,
            })
            .where(eq(games.id, g.id));

          await db
            .update(picks)
            .set({
              is_correct: null,
              is_ats_correct: null,
            })
            .where(eq(picks.game_id, g.id));
        }

        // If ALL_SUBMITTED is selected, ensure admin has locked picks in the group so 100% lock is simulated
        if (sandboxState === 'ALL_SUBMITTED') {
          const allGrps = await db.select().from(groups);
          const now = new Date().toISOString();
          for (const grp of allGrps) {
            for (const g of weekGames) {
              const existing = await db
                .select()
                .from(picks)
                .where(
                  and(
                    eq(picks.user_id, currentUser.id),
                    eq(picks.group_id, grp.id),
                    eq(picks.game_id, g.id)
                  )
                )
                .limit(1);

              if (existing.length === 0) {
                await db.insert(picks).values({
                  user_id: currentUser.id,
                  group_id: grp.id,
                  game_id: g.id,
                  week_id: targetWeek.id,
                  selected_team: g.home_team,
                  is_locked: true,
                  locked_at: now,
                  locked_spread_at_pick: g.spread_home,
                  updated_at: now,
                });
              } else {
                await db
                  .update(picks)
                  .set({ is_locked: true, locked_at: now })
                  .where(eq(picks.id, existing[0].id));
              }
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        sandboxState,
      });
    }

    if (action === 'RESET_SANDBOX') {
      await wipeSandboxData();
      return NextResponse.json({
        success: true,
        message: 'All sandbox bots, demo groups, and simulated weeks have been wiped!',
      });
    }

    return NextResponse.json({ error: 'Unknown sandbox action' }, { status: 400 });
  } catch (error) {
    console.error('Sandbox API error:', error);
    return NextResponse.json({ error: 'Failed to run sandbox command' }, { status: 500 });
  }
}
