export type SeasonStage = 'REGULAR' | 'BOWL' | 'PLAYOFF' | 'CHAMPIONSHIP';

export interface EasternDateParts {
  year: number;
  month: number;
  day: number;
  weekday: string; // 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  hour: number;
  minute: number;
  second: number;
}

const etPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const etDisplayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function getEasternDateParts(dateInput: Date | string | number): EasternDateParts {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const parts = etPartsFormatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  const rawHour = parseInt(map.hour || '0', 10);
  return {
    year: parseInt(map.year || '2026', 10),
    month: parseInt(map.month || '1', 10),
    day: parseInt(map.day || '1', 10),
    weekday: map.weekday || 'Sat',
    hour: rawHour === 24 ? 0 : rawHour,
    minute: parseInt(map.minute || '0', 10),
    second: parseInt(map.second || '0', 10),
  };
}

/**
 * Converts a target date/time in America/New_York (year, month 1-12, day, hour, minute, second)
 * to an exact UTC Date object, accurately accounting for EDT (-04:00) vs EST (-05:00).
 */
export function easternWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date {
  // Start with a UTC guess assuming -04:00 offset
  const guessMs = Date.UTC(year, month - 1, day, hour + 4, minute, second);
  const guessParts = getEasternDateParts(guessMs);

  // Measure any difference in hours/minutes due to DST (EST is -05:00)
  const targetMinutes = hour * 60 + minute;
  const actualMinutes = guessParts.hour * 60 + guessParts.minute;
  let diffMinutes = targetMinutes - actualMinutes;

  if (diffMinutes > 720) diffMinutes -= 1440;
  if (diffMinutes < -720) diffMinutes += 1440;

  return new Date(guessMs + diffMinutes * 60 * 1000);
}

/**
 * Strictly checks whether a given timestamp occurs on Saturday in America/New_York.
 */
export function isSaturdayInEasternTime(utcIso: string | Date): boolean {
  const parts = getEasternDateParts(utcIso);
  return parts.weekday === 'Sat';
}

/**
 * Evaluates whether a game kickoff is eligible for the given stage:
 * - REGULAR: Strictly Saturday games only in America/New_York (excludes Thu/Fri games).
 * - BOWL / PLAYOFF / CHAMPIONSHIP: All games in the slate window (including Sun/Mon/mid-week).
 */
export function isEligibleGameForStage(utcIso: string | Date, stage: SeasonStage): boolean {
  if (stage === 'REGULAR') {
    return isSaturdayInEasternTime(utcIso);
  }
  return true;
}

/**
 * Computes the Saturday 11:30:00 AM America/New_York cutoff in UTC for the week containing referenceDate.
 */
export function computeStandardSaturdayCutoffUtc(referenceDate?: Date | string): string {
  const base = referenceDate ? new Date(referenceDate) : new Date();
  const et = getEasternDateParts(base);

  const weekdayIndexMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDayIdx = weekdayIndexMap[et.weekday] ?? 6;
  // Find upcoming Saturday (or same day if already Saturday)
  const daysUntilSaturday = currentDayIdx === 6 ? 0 : 6 - currentDayIdx;

  const targetDate = new Date(Date.UTC(et.year, et.month - 1, et.day + daysUntilSaturday, 12, 0, 0));
  const satParts = getEasternDateParts(targetDate);

  const lockUtc = easternWallTimeToUtc(
    satParts.year,
    satParts.month,
    satParts.day,
    11,
    30,
    0
  );
  return lockUtc.toISOString();
}

/**
 * Dynamically calculates `lock_time_utc` and `window_end_utc` for Regular and Postseason weeks.
 * - Standard lock: Saturday 11:30:00 AM ET (or 30 minutes prior to first kickoff if `useEarlyKickoffLock` is true).
 * - Window end: Sunday 04:59 AM ET for REGULAR; dynamically extended through Monday night ET
 *   (or 6 hours after the final game kickoff) for BOWL, PLAYOFF, and CHAMPIONSHIP stages.
 */
export function computeDynamicLockAndWindow(
  kickoffsUtc: string[],
  stage: SeasonStage,
  useEarlyKickoffLock = false
): { lockTimeUtc: string; windowEndUtc: string } {
  const sortedKickoffs = [...kickoffsUtc]
    .map((k) => new Date(k).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  const referenceKickoff =
    sortedKickoffs.length > 0 ? new Date(sortedKickoffs[0]) : new Date();

  let lockTimeUtc = computeStandardSaturdayCutoffUtc(referenceKickoff);

  if (stage !== 'REGULAR' && useEarlyKickoffLock && sortedKickoffs.length > 0) {
    const thirtyMinsBeforeFirst = new Date(sortedKickoffs[0] - 30 * 60 * 1000);
    lockTimeUtc = thirtyMinsBeforeFirst.toISOString();
  }

  // Compute windowEndUtc
  const lockDateMs = new Date(lockTimeUtc).getTime();
  // Default regular season window ends Sunday morning after Saturday night games
  let windowEndMs = lockDateMs + 18 * 3600 * 1000;

  if (stage !== 'REGULAR') {
    // Expand through at least Monday night ET (lock + 64 hours)
    const mondayNightMs = lockDateMs + 64 * 3600 * 1000;
    const lastKickoffPlus6h =
      sortedKickoffs.length > 0
        ? sortedKickoffs[sortedKickoffs.length - 1] + 6 * 3600 * 1000
        : mondayNightMs;
    windowEndMs = Math.max(mondayNightMs, lastKickoffPlus6h);
  } else if (sortedKickoffs.length > 0) {
    const lastSatKickoffPlus6h = sortedKickoffs[sortedKickoffs.length - 1] + 6 * 3600 * 1000;
    windowEndMs = Math.max(windowEndMs, lastSatKickoffPlus6h);
  }

  return {
    lockTimeUtc,
    windowEndUtc: new Date(windowEndMs).toISOString(),
  };
}

export function formatEasternKickoff(utcIso: string): string {
  try {
    return `${etDisplayFormatter.format(new Date(utcIso))} ET`;
  } catch {
    return utcIso;
  }
}

export function isWeekPastCutoff(week: {
  lock_time_utc: string;
  sandbox_state_override?: string | null;
}): boolean {
  if (week.sandbox_state_override === 'OPEN') return false;
  if (week.sandbox_state_override === 'ALL_SUBMITTED') return false;
  if (week.sandbox_state_override === 'LOCKED') return true;
  if (week.sandbox_state_override === 'GRADED') return true;

  return Date.now() >= new Date(week.lock_time_utc).getTime();
}

export function getDefaultWeekLabel(weekNumber: number, stage: SeasonStage): string {
  if (stage === 'BOWL' || weekNumber === 16) return 'Bowl Season';
  if (stage === 'PLAYOFF' || weekNumber === 17) return 'CFP Playoffs';
  if (stage === 'CHAMPIONSHIP' || weekNumber === 18) return 'National Championship';
  return `Week ${weekNumber}`;
}

/**
 * Computes the Wednesday 9:00:00 AM America/New_York Commissioner Slate Selection Deadline
 * for the week containing referenceDate (3 days and 2.5 hours prior to Saturday 11:30 AM ET).
 */
export function computeWednesdayAdminDeadlineUtc(referenceDate?: Date | string): string {
  const satCutoffIso = computeStandardSaturdayCutoffUtc(referenceDate);
  const satParts = getEasternDateParts(satCutoffIso);
  // Wednesday is 3 days prior to Saturday at 09:00:00 AM ET
  const wedTarget = new Date(Date.UTC(satParts.year, satParts.month - 1, satParts.day - 3, 12, 0, 0));
  const wedParts = getEasternDateParts(wedTarget);
  const wedUtc = easternWallTimeToUtc(
    wedParts.year,
    wedParts.month,
    wedParts.day,
    9,
    0,
    0
  );
  return wedUtc.toISOString();
}

