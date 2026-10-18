import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db, ensureDbInitialized } from './index';
import { users, groups, groupMembers, weeks, games, picks } from './schema';

export const BOT_DEFINITIONS = [
  { username: 'Corso_Headgear', avatar: 'default-2' },
  { username: 'Herbstreit_Pick', avatar: 'default-3' },
  { username: 'SEC_Tailgater', avatar: 'default-4' },
  { username: 'Bama_Jones', avatar: 'default-5' },
  { username: 'Bayou_Bengal', avatar: 'default-6' },
  { username: 'Dawg_Pound', avatar: 'default-7' },
  { username: 'Vol_Navy', avatar: 'default-8' },
];

export async function ensureDefaultAdmin() {
  await ensureDbInitialized();

  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) {
    return existingUsers[0];
  }

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync('admin', 10);
  const recoveryHash = bcrypt.hashSync('0000', 10);

  const [adminUser] = await db
    .insert(users)
    .values({
      username: 'admin',
      password_hash: passwordHash,
      recovery_type: 'PIN',
      recovery_question: null,
      recovery_hash: recoveryHash,
      avatar_type: 'DEFAULT',
      avatar_value: 'default-1',
      is_admin: true,
      is_bot: false,
      created_at: now,
    })
    .returning();

  return adminUser;
}

export async function seedSandboxDemoData() {
  await ensureDbInitialized();

  // Ensure admin exists first
  const adminUsers = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = 'admin'`);

  let adminUser = adminUsers[0];
  if (!adminUser) {
    adminUser = await ensureDefaultAdmin();
  }

  // Wipe existing sandbox data first so re-seeding is clean and idempotent
  await wipeSandboxData();

  const now = new Date().toISOString();
  const botPassHash = bcrypt.hashSync('botpass123', 8);
  const botPinHash = bcrypt.hashSync('1234', 8);

  const createdBots = [];
  for (const bot of BOT_DEFINITIONS) {
    const [inserted] = await db
      .insert(users)
      .values({
        username: bot.username,
        password_hash: botPassHash,
        recovery_type: 'PIN',
        recovery_question: null,
        recovery_hash: botPinHash,
        avatar_type: 'DEFAULT',
        avatar_value: bot.avatar,
        is_admin: false,
        is_bot: true,
        created_at: now,
      })
      .returning();
    createdBots.push(inserted);
  }

  const allDemoUsers = [adminUser, ...createdBots];

  // 1. "Saturday Night Down South" (8 members: admin + 7 bots)
  // 2. "SEC Tailgate Crew" (5 members: admin + first 4 bots)
  const [group1] = await db
    .insert(groups)
    .values({
      name: 'Saturday Night Down South',
      invite_code: 'SEC888',
      owner_id: adminUser.id,
      is_sandbox: true,
      sandbox_player_count: 8,
      created_at: now,
    })
    .returning();

  const [group2] = await db
    .insert(groups)
    .values({
      name: 'SEC Tailgate Crew',
      invite_code: 'TAILG8',
      owner_id: adminUser.id,
      is_sandbox: true,
      sandbox_player_count: 5,
      created_at: now,
    })
    .returning();

  // Seat all 8 members in Group 1
  for (let idx = 0; idx < allDemoUsers.length; idx++) {
    await db.insert(groupMembers).values({
      group_id: group1.id,
      user_id: allDemoUsers[idx].id,
      seat_index: idx,
      joined_at: now,
    });
  }

  // Seat 5 members in Group 2
  for (let idx = 0; idx < 5; idx++) {
    await db.insert(groupMembers).values({
      group_id: group2.id,
      user_id: allDemoUsers[idx].id,
      seat_index: idx,
      joined_at: now,
    });
  }

  const activeLockUtc = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const activeWindowEndUtc = new Date(Date.now() + 60 * 3600 * 1000).toISOString();

  // 1. Active Regular Season Week (Week 8)
  const [activeWeek] = await db
    .insert(weeks)
    .values({
      season_year: 2026,
      week_number: 8,
      label: 'Week 8',
      stage: 'REGULAR',
      lock_time_utc: activeLockUtc,
      window_end_utc: activeWindowEndUtc,
      is_published: true,
      sandbox_state_override: 'OPEN',
      is_sandbox: true,
    })
    .returning();

  const week8GamesData = [
    {
      external_game_id: 'reg-w8-1',
      home_team: 'Texas',
      away_team: 'Georgia',
      home_record: '6-0',
      away_record: '5-1',
      home_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
      away_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
      home_rank: 1,
      away_rank: 5,
      is_sec_matchup: true,
      hype_score: 120,
      kickoff_utc: '2026-10-17T23:30:00Z',
      spread_home: -4.5,
      over_under: 56.5,
      odds_display: 'TEX -4.5 | O/U 56.5',
      home_score: 15,
      away_score: 30,
      winner_team: 'Georgia',
    },
    {
      external_game_id: 'reg-w8-2',
      home_team: 'Tennessee',
      away_team: 'Alabama',
      home_record: '5-1',
      away_record: '5-1',
      home_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
      away_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
      home_rank: 11,
      away_rank: 7,
      is_sec_matchup: true,
      hype_score: 105,
      kickoff_utc: '2026-10-17T19:30:00Z',
      spread_home: 3.0,
      over_under: 57.5,
      odds_display: 'ALA -3.0 | O/U 57.5',
      home_score: 24,
      away_score: 17,
      winner_team: 'Tennessee',
    },
    {
      external_game_id: 'reg-w8-3',
      home_team: 'Arkansas',
      away_team: 'LSU',
      home_record: '4-2',
      away_record: '5-1',
      home_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
      away_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
      home_rank: null,
      away_rank: 8,
      is_sec_matchup: true,
      hype_score: 90,
      kickoff_utc: '2026-10-17T23:00:00Z',
      spread_home: 2.5,
      over_under: 54.5,
      odds_display: 'LSU -2.5 | O/U 54.5',
      home_score: 10,
      away_score: 34,
      winner_team: 'LSU',
    },
    {
      external_game_id: 'reg-w8-4',
      home_team: 'Missouri',
      away_team: 'Auburn',
      home_record: '5-1',
      away_record: '2-4',
      home_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
      away_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
      home_rank: 19,
      away_rank: null,
      is_sec_matchup: true,
      hype_score: 75,
      kickoff_utc: '2026-10-17T16:00:00Z',
      spread_home: -4.0,
      over_under: 49.5,
      odds_display: 'MIZ -4.0 | O/U 49.5',
      home_score: 21,
      away_score: 17,
      winner_team: 'Missouri',
    },
    {
      external_game_id: 'reg-w8-5',
      home_team: 'Florida',
      away_team: 'Kentucky',
      home_record: '3-3',
      away_record: '3-3',
      home_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
      away_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
      home_rank: null,
      away_rank: null,
      is_sec_matchup: true,
      hype_score: 65,
      kickoff_utc: '2026-10-17T23:45:00Z',
      spread_home: 1.5,
      over_under: 42.5,
      odds_display: 'UK -1.5 | O/U 42.5',
      home_score: 48,
      away_score: 20,
      winner_team: 'Florida',
    },
    {
      external_game_id: 'reg-w8-6',
      home_team: 'Oklahoma',
      away_team: 'South Carolina',
      home_record: '4-2',
      away_record: '3-3',
      home_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
      away_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
      home_rank: null,
      away_rank: null,
      is_sec_matchup: true,
      hype_score: 65,
      kickoff_utc: '2026-10-17T16:45:00Z',
      spread_home: -1.5,
      over_under: 41.5,
      odds_display: 'OU -1.5 | O/U 41.5',
      home_score: 9,
      away_score: 35,
      winner_team: 'South Carolina',
    },
    {
      external_game_id: 'reg-w8-7',
      home_team: 'Mississippi State',
      away_team: 'Texas A&M',
      home_record: '1-5',
      away_record: '5-1',
      home_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
      away_logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
      home_rank: null,
      away_rank: 14,
      is_sec_matchup: true,
      hype_score: 60,
      kickoff_utc: '2026-10-17T20:15:00Z',
      spread_home: 14.5,
      over_under: 55.5,
      odds_display: 'TAMU -14.5 | O/U 55.5',
      home_score: 24,
      away_score: 34,
      winner_team: 'Texas A&M',
    },
  ];

  const insertedWeek8Games = [];
  for (const g of week8GamesData) {
    const [gameRow] = await db
      .insert(games)
      .values({
        week_id: activeWeek.id,
        external_game_id: g.external_game_id,
        home_team: g.home_team,
        away_team: g.away_team,
        home_record: g.home_record,
        away_record: g.away_record,
        home_logo: g.home_logo,
        away_logo: g.away_logo,
        home_rank: g.home_rank,
        away_rank: g.away_rank,
        is_sec_matchup: g.is_sec_matchup,
        hype_score: g.hype_score,
        kickoff_utc: g.kickoff_utc,
        spread_home: g.spread_home,
        over_under: g.over_under,
        odds_display: g.odds_display,
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        winner_team: null,
        is_selected: true,
      })
      .returning();
    insertedWeek8Games.push({
      ...gameRow,
      mockHomeScore: g.home_score,
      mockAwayScore: g.away_score,
      mockWinner: g.winner_team,
    });
  }

  // Seed bot picks for Week 8 (7-game slate) in both groups
  const botTargetCorrectCounts = [5, 5, 5, 4, 3, 2, 0];

  for (const grp of [group1, group2]) {
    for (let botIdx = 0; botIdx < createdBots.length; botIdx++) {
      if (grp.id === group2.id && botIdx >= 4) continue;
      const bot = createdBots[botIdx];
      const targetCorrect = botTargetCorrectCounts[botIdx];
      if (targetCorrect === 0) continue; // Vol_Navy missed picks = 0-0

      for (let gameIdx = 0; gameIdx < insertedWeek8Games.length; gameIdx++) {
        const g = insertedWeek8Games[gameIdx];
        const shouldPickWinner = gameIdx < targetCorrect;
        const loserTeam = g.mockWinner === g.home_team ? g.away_team : g.home_team;
        const selectedTeam = shouldPickWinner ? g.mockWinner! : loserTeam;

        await db.insert(picks).values({
          user_id: bot.id,
          group_id: grp.id,
          game_id: g.id,
          week_id: activeWeek.id,
          selected_team: selectedTeam,
          is_locked: true,
          locked_at: now,
          locked_spread_at_pick: g.spread_home,
          is_correct: null,
          is_ats_correct: null,
          updated_at: now,
        });
      }
    }
  }

  // Seed Postseason Weeks (BOWL, PLAYOFF, CHAMPIONSHIP)
  const postseasonStages: Array<{
    week_number: number;
    label: string;
    stage: 'BOWL' | 'PLAYOFF' | 'CHAMPIONSHIP';
    games: Array<{
      extId: string;
      home: string;
      away: string;
      homeLogo: string;
      awayLogo: string;
      homeRank: number;
      awayRank: number;
      spread: number;
      ou: number;
      odds: string;
      homeScore: number;
      awayScore: number;
      winner: string;
      kickoff: string;
    }>;
  }> = [
    {
      week_number: 16,
      label: 'Bowl Season — New Year Six',
      stage: 'BOWL',
      games: [
        {
          extId: 'espn-bowl-1',
          home: 'Ole Miss',
          away: 'Penn State',
          homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
          awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
          homeRank: 11,
          awayRank: 10,
          spread: 3.5,
          ou: 51.5,
          odds: 'PSU -3.5 | O/U 51.5',
          homeScore: 38,
          awayScore: 25,
          winner: 'Ole Miss',
          kickoff: '2026-12-30T17:00:00Z',
        },
        {
          extId: 'espn-bowl-2',
          home: 'Georgia',
          away: 'Florida State',
          homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
          awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
          homeRank: 6,
          awayRank: 5,
          spread: -14.0,
          ou: 46.5,
          odds: 'UGA -14.0 | O/U 46.5',
          homeScore: 63,
          awayScore: 3,
          winner: 'Georgia',
          kickoff: '2026-12-30T21:00:00Z',
        },
      ],
    },
    {
      week_number: 17,
      label: 'CFP Semifinals — Rose & Sugar Bowl',
      stage: 'PLAYOFF',
      games: [
        {
          extId: 'espn-cfp-1',
          home: 'Michigan',
          away: 'Alabama',
          homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
          awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
          homeRank: 1,
          awayRank: 4,
          spread: -1.5,
          ou: 45.5,
          odds: 'MICH -1.5 | O/U 45.5',
          homeScore: 27,
          awayScore: 20,
          winner: 'Michigan',
          kickoff: '2027-01-01T22:00:00Z',
        },
        {
          extId: 'espn-cfp-2',
          home: 'Texas',
          away: 'Washington',
          homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
          awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
          homeRank: 3,
          awayRank: 2,
          spread: -4.0,
          ou: 61.5,
          odds: 'TEX -4.0 | O/U 61.5',
          homeScore: 31,
          awayScore: 37,
          winner: 'Washington',
          kickoff: '2027-01-02T01:45:00Z',
        },
      ],
    },
    {
      week_number: 18,
      label: 'CFP National Championship (Monday Night)',
      stage: 'CHAMPIONSHIP',
      games: [
        {
          extId: 'espn-natty-1',
          home: 'Michigan',
          away: 'Washington',
          homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
          awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
          homeRank: 1,
          awayRank: 2,
          spread: -4.5,
          ou: 55.5,
          odds: 'MICH -4.5 | O/U 55.5',
          homeScore: 34,
          awayScore: 13,
          winner: 'Michigan',
          kickoff: '2027-01-09T00:30:00Z',
        },
      ],
    },
  ];

  for (const ps of postseasonStages) {
    const [psWeek] = await db
      .insert(weeks)
      .values({
        season_year: 2026,
        week_number: ps.week_number,
        label: ps.label,
        stage: ps.stage,
        lock_time_utc: '2026-12-30T16:30:00Z',
        window_end_utc: '2027-01-10T06:00:00Z',
        is_published: true,
        sandbox_state_override: 'GRADED',
        is_sandbox: true,
      })
      .returning();

    for (let gIdx = 0; gIdx < ps.games.length; gIdx++) {
      const g = ps.games[gIdx];
      const [insertedGame] = await db
        .insert(games)
        .values({
          week_id: psWeek.id,
          external_game_id: g.extId,
          home_team: g.home,
          away_team: g.away,
          home_record: '12-1',
          away_record: '12-1',
          home_logo: g.homeLogo,
          away_logo: g.awayLogo,
          home_rank: g.homeRank,
          away_rank: g.awayRank,
          is_sec_matchup: false,
          hype_score: 110,
          kickoff_utc: g.kickoff,
          spread_home: g.spread,
          over_under: g.ou,
          odds_display: g.odds,
          home_score: g.homeScore,
          away_score: g.awayScore,
          status: 'FINAL',
          winner_team: g.winner,
          is_selected: true,
        })
        .returning();

      for (const grp of [group1, group2]) {
        for (let uIdx = 0; uIdx < allDemoUsers.length; uIdx++) {
          if (grp.id === group2.id && uIdx >= 5) continue;
          const u = allDemoUsers[uIdx];
          if (u.username === 'Vol_Navy') continue;

          const isWinner =
            uIdx === 0
              ? true
              : uIdx <= 3
              ? gIdx === 0
              : uIdx === 4
              ? gIdx === 1
              : false;
          const loser = g.winner === g.home ? g.away : g.home;
          const chosen = isWinner ? g.winner : loser;

          const margin = g.homeScore - g.awayScore;
          const homeCovered = g.spread !== null ? margin + g.spread > 0 : true;
          const atsCorrect = chosen === g.home ? homeCovered : !homeCovered;

          await db.insert(picks).values({
            user_id: u.id,
            group_id: grp.id,
            game_id: insertedGame.id,
            week_id: psWeek.id,
            selected_team: chosen,
            is_locked: true,
            locked_at: now,
            locked_spread_at_pick: g.spread,
            is_correct: isWinner,
            is_ats_correct: atsCorrect,
            updated_at: now,
          });
        }
      }
    }
  }

  return { group1, group2, activeWeek };
}

export async function wipeSandboxData() {
  await ensureDbInitialized();
  await db.delete(weeks).where(eq(weeks.is_sandbox, true));
  await db.delete(groups).where(eq(groups.is_sandbox, true));
  await db.delete(users).where(eq(users.is_bot, true));
}
