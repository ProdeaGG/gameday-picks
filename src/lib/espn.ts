import { db, ensureDbInitialized } from '@/db';
import { games, picks, weeks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isEligibleGameForStage, SeasonStage } from './time';

const SEC_TEAMS = new Set([
  'alabama',
  'arkansas',
  'auburn',
  'florida',
  'georgia',
  'kentucky',
  'lsu',
  'mississippi state',
  'missouri',
  'oklahoma',
  'ole miss',
  'south carolina',
  'tennessee',
  'texas',
  'texas a&m',
  'vanderbilt',
]);

// SEC conference ID in ESPN API is "8"
export function isSecTeam(teamName: string, conferenceId?: string | number | null): boolean {
  if (String(conferenceId) === '8') return true;
  const normalized = teamName.trim().toLowerCase();
  return SEC_TEAMS.has(normalized);
}

/**
 * Calculates the GameDay Hype Score per Section 3.4 of SPEC.md:
 * - SEC vs. SEC Matchup: +50 pts
 * - Both Teams Ranked (Top 25): +40 pts (plus bonus points for Top 10 matchups)
 * - Single Ranked Team + Tight Spread (<= 7.5 pts): +25 pts
 * - Close Betting Spread (<= 3.5 pts): +15 pts
 */
export function calculateHypeScore(params: {
  isSecMatchup: boolean;
  homeRank: number | null;
  awayRank: number | null;
  spreadHome: number | null;
}): number {
  let score = 0;
  const { isSecMatchup, homeRank, awayRank, spreadHome } = params;

  const isHomeRanked = homeRank !== null && homeRank >= 1 && homeRank <= 25;
  const isAwayRanked = awayRank !== null && awayRank >= 1 && awayRank <= 25;
  const absSpread = spreadHome !== null ? Math.abs(spreadHome) : null;

  // 1. SEC vs. SEC Matchup (+50 pts)
  if (isSecMatchup) {
    score += 50;
  }

  // 2. Both Teams Ranked (Top 25) (+40 pts + Top 10 bonus)
  if (isHomeRanked && isAwayRanked) {
    score += 40;
    const isHomeTop10 = homeRank! <= 10;
    const isAwayTop10 = awayRank! <= 10;
    if (isHomeTop10 && isAwayTop10) {
      score += 20;
    } else if (isHomeTop10 || isAwayTop10) {
      score += 10;
    }
  } else if ((isHomeRanked || isAwayRanked) && absSpread !== null && absSpread <= 7.5) {
    // 3. Single Ranked Team + Tight Spread (<= 7.5 pts) (+25 pts)
    score += 25;
  } else if (isHomeRanked || isAwayRanked) {
    // Minor baseline boost for single ranked team with wider spread
    score += 10;
  }

  // 4. Close Betting Spread (<= 3.5 pts) (+15 pts)
  if (absSpread !== null && absSpread <= 3.5) {
    score += 15;
  }

  return score;
}

export interface FetchedMatchup {
  external_game_id: string;
  home_team: string;
  away_team: string;
  home_record: string;
  away_record: string;
  home_logo: string;
  away_logo: string;
  home_rank: number | null;
  away_rank: number | null;
  is_sec_matchup: boolean;
  hype_score: number;
  kickoff_utc: string;
  spread_home: number | null;
  over_under: number | null;
  odds_display: string;
  home_score: number | null;
  away_score: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL';
  winner_team: string | null;
}

/**
 * Fetches scoreboard games from ESPN's public College Football API,
 * applies the strict Saturday-only filter in America/New_York for REGULAR weeks
 * (or dynamic multi-day window through Monday night for BOWL/PLAYOFF/CHAMPIONSHIP),
 * computes Hype Scores, and sorts descending by Hype Score.
 */
export async function fetchEspnScoreboardForSlate(options: {
  weekNumber: number;
  stage: SeasonStage;
  seasonYear?: number;
}): Promise<{ games: FetchedMatchup[]; excludedNonSaturdayCount: number; source: 'ESPN_LIVE' | 'FALLBACK' }> {
  const { weekNumber, stage } = options;
  const seasonType = stage === 'REGULAR' ? 2 : 3;

  let rawEvents: any[] = [];
  let source: 'ESPN_LIVE' | 'FALLBACK' = 'ESPN_LIVE';

  try {
    const url = new URL(
      'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
    );
    url.searchParams.set('groups', '80'); // FBS
    url.searchParams.set('limit', '100');
    if (stage === 'REGULAR') {
      url.searchParams.set('seasontype', String(seasonType));
      url.searchParams.set('week', String(weekNumber));
    } else {
      url.searchParams.set('seasontype', '3');
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length > 0) {
        rawEvents = data.events;
      }
    }
  } catch {
    // Fallback to curated slate if offline or ESPN unreachable
  }

  let excludedNonSaturdayCount = 0;
  const parsedGames: FetchedMatchup[] = [];

  if (rawEvents.length > 0) {
    for (const ev of rawEvents) {
      const competition = ev.competitions?.[0];
      if (!competition) continue;

      const kickoffUtc = competition.date || ev.date;
      if (!kickoffUtc) continue;

      // Enforce Timezone & Dynamic Window Strictness (America/New_York)
      if (!isEligibleGameForStage(kickoffUtc, stage)) {
        excludedNonSaturdayCount++;
        continue;
      }

      const competitors = competition.competitors || [];
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
      if (!homeComp || !awayComp) continue;

      const homeTeam = homeComp.team?.location || homeComp.team?.shortDisplayName || homeComp.team?.displayName || 'Home';
      const awayTeam = awayComp.team?.location || awayComp.team?.shortDisplayName || awayComp.team?.displayName || 'Away';

      const homeLogo =
        homeComp.team?.logo ||
        `https://a.espncdn.com/i/teamlogos/ncaa/500/${homeComp.team?.id || 333}.png`;
      const awayLogo =
        awayComp.team?.logo ||
        `https://a.espncdn.com/i/teamlogos/ncaa/500/${awayComp.team?.id || 61}.png`;

      const homeRecord = homeComp.records?.[0]?.summary || '0-0';
      const awayRecord = awayComp.records?.[0]?.summary || '0-0';

      const rawHomeRank = homeComp.curatedRank?.current;
      const rawAwayRank = awayComp.curatedRank?.current;
      const homeRank = typeof rawHomeRank === 'number' && rawHomeRank >= 1 && rawHomeRank <= 25 ? rawHomeRank : null;
      const awayRank = typeof rawAwayRank === 'number' && rawAwayRank >= 1 && rawAwayRank <= 25 ? rawAwayRank : null;

      const isHomeSec = isSecTeam(homeTeam, homeComp.team?.conferenceId);
      const isAwaySec = isSecTeam(awayTeam, awayComp.team?.conferenceId);
      const isSecMatchup = isHomeSec && isAwaySec;

      // Extract betting odds & spread
      const oddsObj = competition.odds?.[0];
      let spreadHome: number | null = null;
      let overUnder: number | null = null;
      let oddsDisplay = 'EVEN';

      if (oddsObj) {
        if (typeof oddsObj.overUnder === 'number') {
          overUnder = oddsObj.overUnder;
        }
        const details: string = oddsObj.details || '';
        if (typeof oddsObj.spread === 'number') {
          const homeAbbrev = (homeComp.team?.abbreviation || '').toUpperCase();
          if (details && homeAbbrev && details.toUpperCase().startsWith(homeAbbrev)) {
            spreadHome = -Math.abs(oddsObj.spread);
          } else if (details && details.includes('-')) {
            spreadHome = Math.abs(oddsObj.spread);
          } else {
            spreadHome = oddsObj.spread;
          }
        }
        if (details && overUnder) {
          oddsDisplay = `${details} | O/U ${overUnder}`;
        } else if (details) {
          oddsDisplay = details;
        } else if (overUnder) {
          oddsDisplay = `O/U ${overUnder}`;
        }
      }

      const hypeScore = calculateHypeScore({
        isSecMatchup,
        homeRank,
        awayRank,
        spreadHome,
      });

      const statusName = competition.status?.type?.name || '';
      const completed = Boolean(competition.status?.type?.completed);
      let status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL' = 'SCHEDULED';
      if (completed || statusName.includes('FINAL')) {
        status = 'FINAL';
      } else if (statusName.includes('IN_PROGRESS') || competition.status?.type?.state === 'in') {
        status = 'IN_PROGRESS';
      }

      const homeScore = status !== 'SCHEDULED' ? parseInt(homeComp.score || '0', 10) : null;
      const awayScore = status !== 'SCHEDULED' ? parseInt(awayComp.score || '0', 10) : null;
      let winnerTeam: string | null = null;
      if (status === 'FINAL' && homeScore !== null && awayScore !== null && homeScore !== awayScore) {
        winnerTeam = homeScore > awayScore ? homeTeam : awayTeam;
      }

      parsedGames.push({
        external_game_id: `espn-${ev.id}`,
        home_team: homeTeam,
        away_team: awayTeam,
        home_record: homeRecord,
        away_record: awayRecord,
        home_logo: homeLogo,
        away_logo: awayLogo,
        home_rank: homeRank,
        away_rank: awayRank,
        is_sec_matchup: isSecMatchup,
        hype_score: hypeScore,
        kickoff_utc: new Date(kickoffUtc).toISOString(),
        spread_home: spreadHome,
        over_under: overUnder,
        odds_display: oddsDisplay,
        home_score: homeScore,
        away_score: awayScore,
        status,
        winner_team: winnerTeam,
      });
    }
  }

  // If ESPN returned no eligible games for the requested week/stage, provide rich fallback matchups
  if (parsedGames.length === 0) {
    source = 'FALLBACK';
    const fallbackPool = getFallbackMatchupsForStage(stage, weekNumber);
    for (const fb of fallbackPool) {
      if (!isEligibleGameForStage(fb.kickoff_utc, stage)) {
        excludedNonSaturdayCount++;
        continue;
      }
      parsedGames.push(fb);
    }
  }

  // Sort descending by Hype Score
  parsedGames.sort((a, b) => b.hype_score - a.hype_score);

  return {
    games: parsedGames,
    excludedNonSaturdayCount,
    source,
  };
}

function getFallbackMatchupsForStage(stage: SeasonStage, weekNumber: number): FetchedMatchup[] {
  if (stage === 'BOWL' || stage === 'PLAYOFF' || stage === 'CHAMPIONSHIP') {
    const rawPostseason = [
      {
        extId: `ps-${stage.toLowerCase()}-1`,
        home: 'Georgia',
        away: 'Texas',
        homeRec: '11-1',
        awayRec: '11-1',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        homeRank: 2,
        awayRank: 3,
        isSec: true,
        kickoff: '2027-01-01T22:00:00Z', // Friday night
        spread: -2.5,
        ou: 54.5,
        odds: 'UGA -2.5 | O/U 54.5',
      },
      {
        extId: `ps-${stage.toLowerCase()}-2`,
        home: 'Ohio State',
        away: 'Oregon',
        homeRec: '11-1',
        awayRec: '12-0',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        homeRank: 4,
        awayRank: 1,
        isSec: false,
        kickoff: '2027-01-02T01:45:00Z', // Rose Bowl
        spread: 1.5,
        ou: 58.5,
        odds: 'ORE -1.5 | O/U 58.5',
      },
      {
        extId: `ps-${stage.toLowerCase()}-3`,
        home: 'Alabama',
        away: 'Notre Dame',
        homeRec: '10-2',
        awayRec: '11-1',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        homeRank: 7,
        awayRank: 6,
        isSec: false,
        kickoff: '2027-01-03T20:00:00Z', // Sunday postseason game
        spread: -3.0,
        ou: 49.5,
        odds: 'ALA -3.0 | O/U 49.5',
      },
      {
        extId: `ps-${stage.toLowerCase()}-4`,
        home: 'LSU',
        away: 'Tennessee',
        homeRec: '10-2',
        awayRec: '10-2',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        homeRank: 9,
        awayRank: 8,
        isSec: true,
        kickoff: '2027-01-05T00:30:00Z', // Monday Night National Championship / Bowl window
        spread: -1.5,
        ou: 61.5,
        odds: 'LSU -1.5 | O/U 61.5',
      },
      {
        extId: `ps-${stage.toLowerCase()}-5`,
        home: 'Ole Miss',
        away: 'Penn State',
        homeRec: '10-2',
        awayRec: '10-2',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        homeRank: 11,
        awayRank: 10,
        isSec: false,
        kickoff: '2026-12-31T17:00:00Z',
        spread: -3.5,
        ou: 52.5,
        odds: 'MISS -3.5 | O/U 52.5',
      },
      {
        extId: `ps-${stage.toLowerCase()}-6`,
        home: 'Clemson',
        away: 'Miami',
        homeRec: '10-2',
        awayRec: '10-2',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        homeRank: 12,
        awayRank: 14,
        isSec: false,
        kickoff: '2026-12-31T20:30:00Z',
        spread: 2.5,
        ou: 55.5,
        odds: 'MIA -2.5 | O/U 55.5',
      },
      {
        extId: `ps-${stage.toLowerCase()}-7`,
        home: 'Texas A&M',
        away: 'USC',
        homeRec: '9-3',
        awayRec: '9-3',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
        homeRank: 16,
        awayRank: 19,
        isSec: false,
        kickoff: '2027-01-02T18:00:00Z',
        spread: -4.5,
        ou: 53.5,
        odds: 'TAMU -4.5 | O/U 53.5',
      },
      {
        extId: `ps-${stage.toLowerCase()}-8`,
        home: 'South Carolina',
        away: 'Michigan',
        homeRec: '9-3',
        awayRec: '9-3',
        homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
        awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
        homeRank: 18,
        awayRank: 21,
        isSec: false,
        kickoff: '2027-01-01T18:00:00Z',
        spread: -3.0,
        ou: 44.5,
        odds: 'SCAR -3.0 | O/U 44.5',
      },
    ];

    return rawPostseason.map((g) => ({
      external_game_id: g.extId,
      home_team: g.home,
      away_team: g.away,
      home_record: g.homeRec,
      away_record: g.awayRec,
      home_logo: g.homeLogo,
      away_logo: g.awayLogo,
      home_rank: g.homeRank,
      away_rank: g.awayRank,
      is_sec_matchup: g.isSec,
      hype_score: calculateHypeScore({
        isSecMatchup: g.isSec,
        homeRank: g.homeRank,
        awayRank: g.awayRank,
        spreadHome: g.spread,
      }),
      kickoff_utc: g.kickoff,
      spread_home: g.spread,
      over_under: g.ou,
      odds_display: g.odds,
      home_score: null,
      away_score: null,
      status: 'SCHEDULED',
      winner_team: null,
    }));
  }

  // Regular season fallback pool (includes 2 Friday night games that get filtered out by Saturday-only rule!)
  const rawRegular = [
    {
      extId: `reg-w${weekNumber}-fri-1`,
      home: 'Miami',
      away: 'Louisville',
      homeRec: '6-0',
      awayRec: '4-2',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
      homeRank: 6,
      awayRank: null,
      isSec: false,
      kickoff: '2026-10-16T23:30:00Z', // Friday 7:30 PM ET -> Will be excluded by Saturday filter!
      spread: -5.0,
      ou: 60.5,
      odds: 'MIA -5.0 | O/U 60.5',
    },
    {
      extId: `reg-w${weekNumber}-1`,
      home: 'Texas',
      away: 'Georgia',
      homeRec: '6-0',
      awayRec: '5-1',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
      homeRank: 1,
      awayRank: 5,
      isSec: true,
      kickoff: '2026-10-17T23:30:00Z', // Saturday 7:30 PM ET
      spread: -4.5,
      ou: 56.5,
      odds: 'TEX -4.5 | O/U 56.5',
    },
    {
      extId: `reg-w${weekNumber}-2`,
      home: 'Tennessee',
      away: 'Alabama',
      homeRec: '5-1',
      awayRec: '5-1',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
      homeRank: 11,
      awayRank: 7,
      isSec: true,
      kickoff: '2026-10-17T19:30:00Z', // Saturday 3:30 PM ET
      spread: 3.0,
      ou: 57.5,
      odds: 'ALA -3.0 | O/U 57.5',
    },
    {
      extId: `reg-w${weekNumber}-3`,
      home: 'Arkansas',
      away: 'LSU',
      homeRec: '4-2',
      awayRec: '5-1',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
      homeRank: null,
      awayRank: 8,
      isSec: true,
      kickoff: '2026-10-17T23:00:00Z',
      spread: 2.5,
      ou: 54.5,
      odds: 'LSU -2.5 | O/U 54.5',
    },
    {
      extId: `reg-w${weekNumber}-4`,
      home: 'Missouri',
      away: 'Auburn',
      homeRec: '5-1',
      awayRec: '2-4',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
      homeRank: 19,
      awayRank: null,
      isSec: true,
      kickoff: '2026-10-17T16:00:00Z',
      spread: -4.0,
      ou: 49.5,
      odds: 'MIZ -4.0 | O/U 49.5',
    },
    {
      extId: `reg-w${weekNumber}-5`,
      home: 'Florida',
      away: 'Kentucky',
      homeRec: '3-3',
      awayRec: '3-3',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
      homeRank: null,
      awayRank: null,
      isSec: true,
      kickoff: '2026-10-17T23:45:00Z',
      spread: 1.5,
      ou: 42.5,
      odds: 'UK -1.5 | O/U 42.5',
    },
    {
      extId: `reg-w${weekNumber}-6`,
      home: 'Oklahoma',
      away: 'South Carolina',
      homeRec: '4-2',
      awayRec: '3-3',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
      homeRank: null,
      awayRank: null,
      isSec: true,
      kickoff: '2026-10-17T16:45:00Z',
      spread: -1.5,
      ou: 41.5,
      odds: 'OU -1.5 | O/U 41.5',
    },
    {
      extId: `reg-w${weekNumber}-7`,
      home: 'Mississippi State',
      away: 'Texas A&M',
      homeRec: '1-5',
      awayRec: '5-1',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
      homeRank: null,
      awayRank: 14,
      isSec: true,
      kickoff: '2026-10-17T20:15:00Z',
      spread: 14.5,
      ou: 55.5,
      odds: 'TAMU -14.5 | O/U 55.5',
    },
    {
      extId: `reg-w${weekNumber}-8`,
      home: 'Clemson',
      away: 'Virginia',
      homeRec: '5-1',
      awayRec: '4-2',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
      homeRank: 10,
      awayRank: 22,
      isSec: false,
      kickoff: '2026-10-17T16:00:00Z',
      spread: -7.0,
      ou: 48.5,
      odds: 'CLEM -7.0 | O/U 48.5',
    },
    {
      extId: `reg-w${weekNumber}-9`,
      home: 'Penn State',
      away: 'USC',
      homeRec: '5-0',
      awayRec: '3-2',
      homeLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
      awayLogo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
      homeRank: 4,
      awayRank: null,
      isSec: false,
      kickoff: '2026-10-17T19:30:00Z',
      spread: -4.5,
      ou: 50.5,
      odds: 'PSU -4.5 | O/U 50.5',
    },
  ];

  return rawRegular.map((g) => ({
    external_game_id: g.extId,
    home_team: g.home,
    away_team: g.away,
    home_record: g.homeRec,
    away_record: g.awayRec,
    home_logo: g.homeLogo,
    away_logo: g.awayLogo,
    home_rank: g.homeRank,
    away_rank: g.awayRank,
    is_sec_matchup: g.isSec,
    hype_score: calculateHypeScore({
      isSecMatchup: g.isSec,
      homeRank: g.homeRank,
      awayRank: g.awayRank,
      spreadHome: g.spread,
    }),
    kickoff_utc: g.kickoff,
    spread_home: g.spread,
    over_under: g.ou,
    odds_display: g.odds,
    home_score: null,
    away_score: null,
    status: 'SCHEDULED',
    winner_team: null,
  }));
}

/**
 * Grades all picks for a given game once it reaches FINAL status,
 * computing both straight-up `is_correct` and V2 ATS `is_ats_correct`.
 */
export async function gradePicksForFinalGame(gameId: number) {
  await ensureDbInitialized();
  const gameRows = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  const game = gameRows[0];
  if (!game || game.status !== 'FINAL' || !game.winner_team) return;

  const gamePicks = await db.select().from(picks).where(eq(picks.game_id, gameId));
  const now = new Date().toISOString();

  for (const p of gamePicks) {
    const isCorrect = p.selected_team === game.winner_team;

    // V2 ATS calculation using frozen `locked_spread_at_pick` (fallback to `game.spread_home`)
    const spreadToUse = p.locked_spread_at_pick ?? game.spread_home;
    let isAtsCorrect: boolean | null = null;
    if (
      spreadToUse !== null &&
      spreadToUse !== undefined &&
      game.home_score !== null &&
      game.away_score !== null
    ) {
      const margin = game.home_score - game.away_score;
      const homeCovered = margin + spreadToUse > 0;
      isAtsCorrect = p.selected_team === game.home_team ? homeCovered : !homeCovered;
    } else {
      isAtsCorrect = isCorrect;
    }

    await db
      .update(picks)
      .set({
        is_correct: isCorrect,
        is_ats_correct: isAtsCorrect,
        updated_at: now,
      })
      .where(eq(picks.id, p.id));
  }
}

/**
 * Polls ESPN for active published weeks whose `window_end_utc` has not yet closed
 * (or still has non-final games) and updates scores + grades FINAL games.
 */
export async function syncLiveScoresFromEspn(): Promise<{ updatedGames: number }> {
  await ensureDbInitialized();
  const publishedWeeks = await db
    .select()
    .from(weeks)
    .where(eq(weeks.is_published, true));

  let updatedGames = 0;

  for (const wk of publishedWeeks) {
    // Do not overwrite sandbox GRADED simulated scores
    if (wk.sandbox_state_override === 'GRADED') continue;

    const weekGames = await db
      .select()
      .from(games)
      .where(eq(games.week_id, wk.id));

    const hasUnfinished = weekGames.some((g) => g.status !== 'FINAL');
    if (!hasUnfinished) continue;

    const { games: espnGames, source } = await fetchEspnScoreboardForSlate({
      weekNumber: wk.week_number,
      stage: wk.stage as SeasonStage,
      seasonYear: wk.season_year,
    });

    if (source !== 'ESPN_LIVE') continue;

    for (const dbGame of weekGames) {
      const match = espnGames.find(
        (eg) =>
          eg.external_game_id === dbGame.external_game_id ||
          (eg.home_team.toLowerCase() === dbGame.home_team.toLowerCase() &&
            eg.away_team.toLowerCase() === dbGame.away_team.toLowerCase())
      );

      if (match && (match.status !== dbGame.status || match.home_score !== dbGame.home_score)) {
        await db
          .update(games)
          .set({
            home_score: match.home_score,
            away_score: match.away_score,
            status: match.status,
            winner_team: match.winner_team,
          })
          .where(eq(games.id, dbGame.id));

        updatedGames++;

        if (match.status === 'FINAL' && match.winner_team) {
          await gradePicksForFinalGame(dbGame.id);
        }
      }
    }
  }

  return { updatedGames };
}
