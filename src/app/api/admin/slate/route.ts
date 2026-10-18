import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, comparePassword, hashPassword } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { weeks, games, users, groups, groupMembers, picks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  fetchEspnScoreboardForSlate,
  gradePicksForFinalGame,
  syncLiveScoresFromEspn,
  FetchedMatchup,
} from '@/lib/espn';
import {
  computeDynamicLockAndWindow,
  computeWednesdayAdminDeadlineUtc,
  getDefaultWeekLabel,
  sortGamesChronologically,
  SeasonStage,
} from '@/lib/time';
import { wipeSandboxData } from '@/db/seed';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.isAdmin) {
    return NextResponse.json({ error: 'Forbidden — Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fetchCandidateWeek = searchParams.get('fetchWeek');
  const fetchCandidateStage = (searchParams.get('stage') || 'REGULAR') as SeasonStage;

  // Check if admin still has default password 'admin'
  const adminUserRow = await db
    .select()
    .from(users)
    .where(eq(users.id, currentUser.id))
    .limit(1);
  const isDefaultPassword =
    adminUserRow[0] ? comparePassword('admin', adminUserRow[0].password_hash) : false;

  // Fetch all weeks ordered by week_number desc
  const allWeeks = await db
    .select()
    .from(weeks)
    .orderBy(desc(weeks.week_number));

  // Find game counts per week so the Admin UI can show which weeks are locked in advance
  const allDbGames = await db.select().from(games);
  const weekGameCountMap: Record<number, number> = {};
  for (const g of allDbGames) {
    weekGameCountMap[g.week_id] = (weekGameCountMap[g.week_id] || 0) + 1;
  }

  const publishedWeeks = allWeeks.filter((w) => w.is_published);
  const activeWeek =
    publishedWeeks.find((w) => w.stage === 'REGULAR') ||
    publishedWeeks[0] ||
    allWeeks[0] ||
    null;

  const wkNum = fetchCandidateWeek
    ? parseInt(fetchCandidateWeek, 10) || (activeWeek?.week_number ?? 1)
    : activeWeek?.week_number ?? 1;

  const savedWeek = allWeeks.find((w) => w.week_number === wkNum) || null;
  const rawSavedWeekGames = savedWeek
    ? allDbGames.filter((g) => g.week_id === savedWeek.id)
    : [];
  const savedWeekGames = sortGamesChronologically(rawSavedWeekGames);

  const candidatePool = await fetchEspnScoreboardForSlate({
    weekNumber: wkNum,
    stage: fetchCandidateStage,
  });

  // Merge savedWeekGames with candidatePool.games so locked selections are always present & matched
  const mergedCandidates: FetchedMatchup[] = [...candidatePool.games];
  const savedSelectedExtIds: string[] = [];

  for (const sg of savedWeekGames) {
    const existingIdx = mergedCandidates.findIndex(
      (cg) =>
        cg.external_game_id === sg.external_game_id ||
        (cg.home_team.toLowerCase() === sg.home_team.toLowerCase() &&
          cg.away_team.toLowerCase() === sg.away_team.toLowerCase())
    );

    if (existingIdx !== -1) {
      const matchedExtId = mergedCandidates[existingIdx].external_game_id;
      savedSelectedExtIds.push(matchedExtId);
    } else {
      mergedCandidates.unshift({
        external_game_id: sg.external_game_id,
        home_team: sg.home_team,
        away_team: sg.away_team,
        home_record: sg.home_record || '0-0',
        away_record: sg.away_record || '0-0',
        home_logo: sg.home_logo || '',
        away_logo: sg.away_logo || '',
        home_rank: sg.home_rank,
        away_rank: sg.away_rank,
        is_sec_matchup: Boolean(sg.is_sec_matchup),
        hype_score: sg.hype_score,
        kickoff_utc: sg.kickoff_utc,
        spread_home: sg.spread_home,
        over_under: sg.over_under,
        odds_display: sg.odds_display || 'EVEN',
        home_score: sg.home_score,
        away_score: sg.away_score,
        status: (sg.status as 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL') || 'SCHEDULED',
        winner_team: sg.winner_team,
      });
      savedSelectedExtIds.push(sg.external_game_id);
    }
  }

  // Fetch all users & groups for the Live League Management tab
  const rawUsers = await db.select().from(users);
  const rawGroups = await db.select().from(groups);
  const rawMemberships = await db.select().from(groupMembers);

  const allUsersList = rawUsers.map((u) => ({
    id: u.id,
    username: u.username,
    avatarType: u.avatar_type,
    avatarValue: u.avatar_value,
    recoveryType: u.recovery_type,
    isAdmin: Boolean(u.is_admin),
    isBot: Boolean(u.is_bot),
    createdAt: u.created_at,
    groupCount: rawMemberships.filter((m) => m.user_id === u.id).length,
  }));

  const allGroupsList = rawGroups.map((g) => {
    const owner = rawUsers.find((u) => u.id === g.owner_id);
    const membersCount = rawMemberships.filter((m) => m.group_id === g.id).length;
    return {
      id: g.id,
      name: g.name,
      inviteCode: g.invite_code,
      ownerUsername: owner?.username || 'admin',
      memberCount: membersCount,
      isSandbox: Boolean(g.is_sandbox),
      createdAt: g.created_at,
    };
  });

  const hasSandboxData =
    rawUsers.some((u) => u.is_bot) ||
    rawGroups.some((g) => g.is_sandbox) ||
    allWeeks.some((w) => w.is_sandbox);

  return NextResponse.json({
    isDefaultPassword,
    hasSandboxData,
    allUsers: allUsersList,
    allGroups: allGroupsList,
    allWeeks: allWeeks.map((w) => ({
      ...w,
      gamesCount: weekGameCountMap[w.id] || 0,
    })),
    activeWeek,
    savedWeek,
    savedWeekGames,
    savedSelectedExtIds,
    isWeekLockedIn: savedWeekGames.length > 0,
    wednesdayDeadlineUtc: computeWednesdayAdminDeadlineUtc(),
    candidatePool: {
      ...candidatePool,
      games: mergedCandidates,
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.isAdmin) {
    return NextResponse.json({ error: 'Forbidden — Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'SYNC_SCORES') {
      const result = await syncLiveScoresFromEspn();
      return NextResponse.json({
        success: true,
        updatedGames: result.updatedGames,
      });
    }

    if (action === 'PURGE_SANDBOX_DATA') {
      await wipeSandboxData();
      return NextResponse.json({
        success: true,
        message: 'All sandbox demo groups, bot accounts, and simulated weeks have been removed.',
      });
    }

    if (action === 'ADMIN_RESET_USER_PASSWORD') {
      const { userId, newPassword } = body as {
        userId: number;
        newPassword: string;
      };
      if (!userId || !newPassword || String(newPassword).trim().length < 4) {
        return NextResponse.json(
          { error: 'New password must be at least 4 characters' },
          { status: 400 }
        );
      }
      const passwordHash = hashPassword(String(newPassword).trim());
      await db
        .update(users)
        .set({ password_hash: passwordHash })
        .where(eq(users.id, Number(userId)));

      return NextResponse.json({
        success: true,
        message: 'User password reset successfully!',
      });
    }

    if (action === 'TOGGLE_USER_ADMIN') {
      const { userId, makeAdmin } = body as {
        userId: number;
        makeAdmin: boolean;
      };
      if (Number(userId) === currentUser.id && !makeAdmin) {
        return NextResponse.json(
          { error: 'You cannot revoke your own commissioner privileges.' },
          { status: 400 }
        );
      }
      await db
        .update(users)
        .set({ is_admin: Boolean(makeAdmin) })
        .where(eq(users.id, Number(userId)));

      return NextResponse.json({
        success: true,
        message: makeAdmin
          ? 'User granted Commissioner (Admin) access.'
          : 'Commissioner access revoked.',
      });
    }

    if (action === 'DELETE_GROUP') {
      const { groupId } = body as { groupId: number };
      if (!groupId) {
        return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
      }
      await db.delete(groups).where(eq(groups.id, Number(groupId)));
      return NextResponse.json({
        success: true,
        message: 'Group deleted.',
      });
    }

    if (action === 'DELETE_USER') {
      const { userId } = body as { userId: number };
      if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
      }
      if (Number(userId) === currentUser.id) {
        return NextResponse.json(
          { error: 'You cannot delete your own active commissioner account.' },
          { status: 400 }
        );
      }
      await db.delete(users).where(eq(users.id, Number(userId)));
      return NextResponse.json({
        success: true,
        message: 'User removed.',
      });
    }

    if (action === 'SET_ACTIVE_WEEK') {
      const { weekNumber } = body as { weekNumber: number };
      const existingWeeks = await db
        .select()
        .from(weeks)
        .where(eq(weeks.week_number, Number(weekNumber)));
      const target = existingWeeks[0];
      if (!target) {
        return NextResponse.json(
          { error: 'Please lock in the 7-game slate for this week first.' },
          { status: 404 }
        );
      }

      // Unpublish other regular weeks so this becomes the active week for all groups
      const allWks = await db.select().from(weeks);
      for (const w of allWks) {
        if (w.stage === 'REGULAR' && w.id !== target.id && w.is_published) {
          await db
            .update(weeks)
            .set({ is_published: false })
            .where(eq(weeks.id, w.id));
        }
      }

      const [updated] = await db
        .update(weeks)
        .set({ is_published: true })
        .where(eq(weeks.id, target.id))
        .returning();

      return NextResponse.json({
        success: true,
        week: updated,
      });
    }

    if (action === 'PUBLISH_SLATE') {
      const {
        weekNumber = 1,
        seasonYear = new Date().getFullYear(),
        stage = 'REGULAR',
        useEarlyKickoffLock = false,
        makeActive = true,
        selectedGames = [],
      } = body as {
        weekNumber: number;
        seasonYear?: number;
        stage: SeasonStage;
        useEarlyKickoffLock?: boolean;
        makeActive?: boolean;
        selectedGames: FetchedMatchup[];
      };

      if (!Array.isArray(selectedGames) || selectedGames.length === 0) {
        return NextResponse.json(
          { error: 'Please select at least 1 game for the weekly slate' },
          { status: 400 }
        );
      }

      if (selectedGames.length > 7) {
        return NextResponse.json(
          { error: 'Maximum 7 games allowed per weekly slate' },
          { status: 400 }
        );
      }

      const cleanLabel = getDefaultWeekLabel(Number(weekNumber), stage);
      const kickoffs = selectedGames.map((g) => g.kickoff_utc);
      const { lockTimeUtc, windowEndUtc } = computeDynamicLockAndWindow(
        kickoffs,
        stage,
        Boolean(useEarlyKickoffLock)
      );

      // If makeActive is true and stage is REGULAR, unpublish other REGULAR weeks so this week is active
      if (makeActive && stage === 'REGULAR') {
        const allWks = await db.select().from(weeks);
        for (const w of allWks) {
          if (w.stage === 'REGULAR' && w.week_number !== Number(weekNumber) && w.is_published) {
            await db
              .update(weeks)
              .set({ is_published: false })
              .where(eq(weeks.id, w.id));
          }
        }
      }

      // Check if a week with this weekNumber already exists
      const existingWeeks = await db
        .select()
        .from(weeks)
        .where(eq(weeks.week_number, Number(weekNumber)));

      let targetWeek = existingWeeks[0];

      if (targetWeek) {
        const shouldPublish = makeActive ? true : targetWeek.is_published;
        const [updated] = await db
          .update(weeks)
          .set({
            label: cleanLabel,
            stage,
            lock_time_utc: lockTimeUtc,
            window_end_utc: windowEndUtc,
            is_published: shouldPublish,
            sandbox_state_override: 'OPEN',
          })
          .where(eq(weeks.id, targetWeek.id))
          .returning();
        targetWeek = updated;

        // Replace games for this week
        await db.delete(games).where(eq(games.week_id, targetWeek.id));
      } else {
        const [inserted] = await db
          .insert(weeks)
          .values({
            season_year: Number(seasonYear),
            week_number: Number(weekNumber),
            label: cleanLabel,
            stage,
            lock_time_utc: lockTimeUtc,
            window_end_utc: windowEndUtc,
            is_published: Boolean(makeActive),
            sandbox_state_override: 'OPEN',
            is_sandbox: false,
          })
          .returning();
        targetWeek = inserted;
      }

      const insertedGames = [];
      for (const g of selectedGames) {
        const [gRow] = await db
          .insert(games)
          .values({
            week_id: targetWeek.id,
            external_game_id: g.external_game_id,
            home_team: g.home_team,
            away_team: g.away_team,
            home_record: g.home_record || '0-0',
            away_record: g.away_record || '0-0',
            home_logo: g.home_logo,
            away_logo: g.away_logo,
            home_rank: g.home_rank,
            away_rank: g.away_rank,
            is_sec_matchup: Boolean(g.is_sec_matchup),
            hype_score: Number(g.hype_score || 0),
            kickoff_utc: g.kickoff_utc,
            spread_home: g.spread_home,
            over_under: g.over_under,
            odds_display: g.odds_display || 'EVEN',
            home_score: g.home_score,
            away_score: g.away_score,
            status: g.status || 'SCHEDULED',
            winner_team: g.winner_team,
            is_selected: true,
          })
          .returning();

        insertedGames.push(gRow);
        if (gRow.status === 'FINAL' && gRow.winner_team) {
          await gradePicksForFinalGame(gRow.id);
        }
      }

      // If sandbox bots exist, seed bot picks on this week's new games so sandbox groups stay populated
      const botUsers = await db.select().from(users).where(eq(users.is_bot, true));
      if (botUsers.length > 0 && stage === 'REGULAR') {
        const sandboxGroups = await db
          .select()
          .from(groups)
          .where(eq(groups.is_sandbox, true));
        const now = new Date().toISOString();
        const botTargetCorrectCounts = [5, 5, 5, 4, 3, 2, 0];

        for (const grp of sandboxGroups) {
          const grpMembers = await db
            .select()
            .from(groupMembers)
            .where(eq(groupMembers.group_id, grp.id));
          const memberIds = new Set(grpMembers.map((m) => m.user_id));

          for (let botIdx = 0; botIdx < botUsers.length; botIdx++) {
            const bot = botUsers[botIdx];
            if (!memberIds.has(bot.id)) continue;
            const targetCorrect = botTargetCorrectCounts[botIdx] ?? 4;
            if (targetCorrect === 0) continue; // Vol_Navy missed picks = 0-0

            for (let gameIdx = 0; gameIdx < insertedGames.length; gameIdx++) {
              const gm = insertedGames[gameIdx];
              const pickHome = gameIdx < targetCorrect;
              const selectedTeam = pickHome ? gm.home_team : gm.away_team;

              await db.insert(picks).values({
                user_id: bot.id,
                group_id: grp.id,
                game_id: gm.id,
                week_id: targetWeek.id,
                selected_team: selectedTeam,
                is_locked: true,
                locked_at: now,
                locked_spread_at_pick: gm.spread_home,
                is_correct: null,
                is_ats_correct: null,
                updated_at: now,
              });
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        week: targetWeek,
        games: insertedGames,
      });
    }

    return NextResponse.json({ error: 'Unknown admin action' }, { status: 400 });
  } catch (error) {
    console.error('Admin slate POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process admin slate action' },
      { status: 500 }
    );
  }
}
