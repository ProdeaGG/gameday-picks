export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureDefaultAdmin, seedSandboxDemoData } = await import('./db/seed');
    const { db, ensureDbInitialized } = await import('./db');
    const { weeks, games } = await import('./db/schema');
    const {
      fetchEspnScoreboardForSlate,
      syncLiveScoresFromEspn,
    } = await import('./lib/espn');
    const {
      computeDynamicLockAndWindow,
      getDefaultWeekLabel,
    } = await import('./lib/time');
    const cron = await import('node-cron');

    await ensureDbInitialized();
    await ensureDefaultAdmin();

    // Only seed sandbox demo data on boot if explicitly requested via SEED_SANDBOX_ON_BOOT=true
    if (process.env.SEED_SANDBOX_ON_BOOT === 'true') {
      await seedSandboxDemoData();
    }

    // 1. Background cron polling ESPN every 15 minutes in America/New_York
    cron.default.schedule(
      '*/15 * * * *',
      async () => {
        try {
          await syncLiveScoresFromEspn();
        } catch (err) {
          console.error('Background ESPN score sync error:', err);
        }
      },
      {
        timezone: 'America/New_York',
      }
    );

    // 2. Wednesday 9:00 AM ET Admin Deadline Fallback Cron
    // Automatically locks in the Top 7 Hype Score games if no published slate exists yet
    cron.default.schedule(
      '0 9 * * 3',
      async () => {
        try {
          const allWeeks = await db.select().from(weeks);
          const hasPublished = allWeeks.some((w) => w.is_published);
          if (!hasPublished) {
            const wkNum = 1;
            const stage = 'REGULAR';
            const pool = await fetchEspnScoreboardForSlate({
              weekNumber: wkNum,
              stage,
            });
            const top7 = pool.games.slice(0, 7);
            if (top7.length > 0) {
              const { lockTimeUtc, windowEndUtc } = computeDynamicLockAndWindow(
                top7.map((g) => g.kickoff_utc),
                stage,
                false
              );
              const [createdWeek] = await db
                .insert(weeks)
                .values({
                  season_year: new Date().getFullYear(),
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
              console.log('Wednesday 9:00 AM ET Fallback: Auto-locked Top 7 games for Week 1.');
            }
          }
        } catch (err) {
          console.error('Wednesday 9:00 AM ET fallback cron error:', err);
        }
      },
      {
        timezone: 'America/New_York',
      }
    );
  }
}
