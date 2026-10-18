import { ensureDefaultAdmin, seedSandboxDemoData, wipeSandboxData } from './seed';
import { db, ensureDbInitialized } from './index';
import { weeks, games } from './schema';
import { fetchEspnScoreboardForSlate } from '../lib/espn';
import { computeDynamicLockAndWindow, getDefaultWeekLabel } from '../lib/time';

async function main() {
  await ensureDbInitialized();
  console.log('Ensuring default admin (admin / admin, PIN 0000)...');
  const admin = await ensureDefaultAdmin();
  console.log('Default admin ready:', admin.username);

  if (process.argv.includes('--sandbox')) {
    console.log('Seeding Sandbox Demo Groups, Bots, and Slates...');
    const result = await seedSandboxDemoData();
    console.log('Sandbox Demo seeded:', result.group1.name, '&', result.group2.name);
    return;
  }

  // Default / --live mode: wipe any sandbox demo bots/groups and ensure a clean Week 1 7-game slate
  console.log('Cleaning any sandbox demo bots/groups for Live Production Mode...');
  await wipeSandboxData();

  const existingWeeks = await db.select().from(weeks);
  const hasPublishedWeek = existingWeeks.some((w) => w.is_published);
  if (!hasPublishedWeek) {
    console.log('Initializing Week 1 (7-game Saturday slate)...');
    const wkNum = 1;
    const stage = 'REGULAR';
    const pool = await fetchEspnScoreboardForSlate({
      weekNumber: wkNum,
      stage,
    });
    const top7 = pool.games.slice(0, 7);
    const { lockTimeUtc, windowEndUtc } = computeDynamicLockAndWindow(
      top7.map((g) => g.kickoff_utc),
      stage,
      false
    );

    const [createdWeek] = await db
      .insert(weeks)
      .values({
        season_year: 2026,
        week_number: wkNum,
        label: getDefaultWeekLabel(wkNum, stage),
        stage,
        lock_time_utc: lockTimeUtc,
        window_end_utc: windowEndUtc,
        is_published: true,
        sandbox_state_override: 'OPEN',
        is_sandbox: false,
      })
      .returning();

    for (const g of top7) {
      await db.insert(games).values({
        week_id: createdWeek.id,
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
      });
    }
    console.log(`Initialized Live "${createdWeek.label}" with ${top7.length} games.`);
  }
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
