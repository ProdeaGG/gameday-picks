import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

function resolveDbUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (process.env.DATABASE_PATH) {
    const p = process.env.DATABASE_PATH.replace(/\\/g, '/');
    return `file:${p}`;
  }
  // In CasaOS / Docker container
  if (process.platform !== 'win32') {
    try {
      fs.mkdirSync('/app/data', { recursive: true });
      return 'file:/app/data/pickem.db';
    } catch {
      // fallback to local dir
    }
  }
  const localDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, 'pickem.db').replace(/\\/g, '/');
  return `file:${localPath}`;
}

const dbUrl = resolveDbUrl();
export const client = createClient({ url: dbUrl });
export const db = drizzle(client, { schema });

let initPromise: Promise<void> | null = null;

export async function ensureDbInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        recovery_type TEXT NOT NULL DEFAULT 'PIN',
        recovery_question TEXT,
        recovery_hash TEXT NOT NULL,
        avatar_type TEXT NOT NULL DEFAULT 'DEFAULT',
        avatar_value TEXT NOT NULL DEFAULT 'default-1',
        is_admin INTEGER NOT NULL DEFAULT 0,
        is_bot INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        invite_code TEXT NOT NULL,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_sandbox INTEGER NOT NULL DEFAULT 0,
        sandbox_player_count INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS groups_invite_code_idx ON groups(invite_code);

      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seat_index INTEGER NOT NULL,
        joined_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_user_idx ON group_members(group_id, user_id);

      CREATE TABLE IF NOT EXISTS weeks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season_year INTEGER NOT NULL,
        week_number INTEGER NOT NULL,
        label TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT 'REGULAR',
        lock_time_utc TEXT NOT NULL,
        window_end_utc TEXT NOT NULL,
        is_published INTEGER NOT NULL DEFAULT 0,
        sandbox_state_override TEXT,
        is_sandbox INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
        external_game_id TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        home_record TEXT DEFAULT '0-0',
        away_record TEXT DEFAULT '0-0',
        home_logo TEXT NOT NULL,
        away_logo TEXT NOT NULL,
        home_rank INTEGER,
        away_rank INTEGER,
        is_sec_matchup INTEGER NOT NULL DEFAULT 0,
        hype_score INTEGER NOT NULL DEFAULT 0,
        kickoff_utc TEXT NOT NULL,
        spread_home REAL,
        over_under REAL,
        odds_display TEXT NOT NULL DEFAULT 'EVEN',
        home_score INTEGER,
        away_score INTEGER,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        winner_team TEXT,
        is_selected INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
        selected_team TEXT NOT NULL,
        is_locked INTEGER NOT NULL DEFAULT 0,
        locked_at TEXT,
        locked_spread_at_pick REAL,
        is_correct INTEGER,
        is_ats_correct INTEGER,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS picks_user_group_game_idx ON picks(user_id, group_id, game_id);
    `);
  })();

  return initPromise;
}
