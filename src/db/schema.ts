import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    password_hash: text('password_hash').notNull(),
    recovery_type: text('recovery_type', { enum: ['PIN', 'QUESTION'] }).notNull(),
    recovery_question: text('recovery_question'),
    recovery_hash: text('recovery_hash').notNull(),
    avatar_type: text('avatar_type', { enum: ['DEFAULT', 'CUSTOM'] }).notNull().default('DEFAULT'),
    avatar_value: text('avatar_value').notNull().default('default-1'),
    is_admin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
    is_bot: integer('is_bot', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    usernameIdx: uniqueIndex('users_username_idx').on(table.username),
  })
);

export const groups = sqliteTable(
  'groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    invite_code: text('invite_code').notNull(),
    owner_id: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    is_sandbox: integer('is_sandbox', { mode: 'boolean' }).notNull().default(false),
    sandbox_player_count: integer('sandbox_player_count'),
    created_at: text('created_at').notNull(),
  },
  (table) => ({
    inviteCodeIdx: uniqueIndex('groups_invite_code_idx').on(table.invite_code),
  })
);

export const groupMembers = sqliteTable(
  'group_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    group_id: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seat_index: integer('seat_index').notNull(),
    joined_at: text('joined_at').notNull(),
  },
  (table) => ({
    groupUserIdx: uniqueIndex('group_members_group_user_idx').on(table.group_id, table.user_id),
  })
);

export const weeks = sqliteTable('weeks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  season_year: integer('season_year').notNull(),
  week_number: integer('week_number').notNull(),
  label: text('label').notNull(),
  stage: text('stage', { enum: ['REGULAR', 'BOWL', 'PLAYOFF', 'CHAMPIONSHIP'] })
    .notNull()
    .default('REGULAR'),
  lock_time_utc: text('lock_time_utc').notNull(),
  window_end_utc: text('window_end_utc').notNull(),
  is_published: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  sandbox_state_override: text('sandbox_state_override', {
    enum: ['OPEN', 'ALL_SUBMITTED', 'LOCKED', 'GRADED'],
  }),
  is_sandbox: integer('is_sandbox', { mode: 'boolean' }).notNull().default(false),
});

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  week_id: integer('week_id')
    .notNull()
    .references(() => weeks.id, { onDelete: 'cascade' }),
  external_game_id: text('external_game_id').notNull(),
  home_team: text('home_team').notNull(),
  away_team: text('away_team').notNull(),
  home_record: text('home_record').default('0-0'),
  away_record: text('away_record').default('0-0'),
  home_logo: text('home_logo').notNull(),
  away_logo: text('away_logo').notNull(),
  home_rank: integer('home_rank'),
  away_rank: integer('away_rank'),
  is_sec_matchup: integer('is_sec_matchup', { mode: 'boolean' }).notNull().default(false),
  hype_score: integer('hype_score').notNull().default(0),
  kickoff_utc: text('kickoff_utc').notNull(),
  spread_home: real('spread_home'),
  over_under: real('over_under'),
  odds_display: text('odds_display').notNull().default('EVEN'),
  home_score: integer('home_score'),
  away_score: integer('away_score'),
  status: text('status', { enum: ['SCHEDULED', 'IN_PROGRESS', 'FINAL'] })
    .notNull()
    .default('SCHEDULED'),
  winner_team: text('winner_team'),
  is_selected: integer('is_selected', { mode: 'boolean' }).notNull().default(true),
});

export const picks = sqliteTable(
  'picks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    group_id: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    game_id: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    week_id: integer('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    selected_team: text('selected_team').notNull(),
    is_locked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    locked_at: text('locked_at'),
    locked_spread_at_pick: real('locked_spread_at_pick'),
    is_correct: integer('is_correct', { mode: 'boolean' }),
    is_ats_correct: integer('is_ats_correct', { mode: 'boolean' }),
    updated_at: text('updated_at').notNull(),
  },
  (table) => ({
    userGroupGameIdx: uniqueIndex('picks_user_group_game_idx').on(
      table.user_id,
      table.group_id,
      table.game_id
    ),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Week = typeof weeks.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Pick = typeof picks.$inferSelect;
