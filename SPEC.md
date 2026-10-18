\# College GameDay Pick'em Web App — Master Specification (`SPEC.md`)



\## 1. Project Overview \& Aesthetic Direction

A self-hosted, mobile-first web application inspired by the ESPN College GameDay weekly pick'em segment. Friends join groups (max 8 players per group), view a custom pixel-art College GameDay broadcast booth header featuring their avatars behind the desk, and lock in straight-up winners for up to 8 featured college football matchups each week before Saturday at 11:30 AM ET.



\* \*\*Visual Style\*\*: Clean, modern sports/fantasy UI (high-contrast dark/slate theme with crisp typography and subtle turf-green/gold accents) paired with a nostalgic \*\*16-bit Pixel Art Broadcast Booth\*\* header at the top of each group page.

\* \*\*Simplicity\*\*: Fast, zero-bloat mobile experience. Simple, appealing fantasy-sports aesthetic without visual clutter.



\---



\## 2. Recommended Tech Stack (CasaOS Optimized)

\* \*\*Framework\*\*: Next.js (App Router, TypeScript) running in `standalone` output mode.

\* \*\*Styling\*\*: Tailwind CSS + Lucide Icons + custom pixel-art SVG assets (`image-rendering: pixelated`).

\* \*\*Database\*\*: SQLite via Prisma or Drizzle ORM, stored at `/app/data/pickem.db` for single-folder persistence in CasaOS.

\* \*\*Authentication\*\*: Custom JWT/Cookie session (`httpOnly`, `maxAge: 365 days` for permanent mobile "Remember Me" persistence) + `bcryptjs` password hashing.

\* \*\*Background Jobs\*\*: `node-cron` (or Next.js instrumentation hook) polling ESPN's public College Football Scoreboard API (`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`) for schedules, live betting odds, and final scores.



\---



\## 3. Core Features \& Functional Requirements



\### 3.1 Authentication, Persistent Login \& No-Email Recovery

\* \*\*Sign Up\*\*:

&#x20; \* Fields: `Username` (unique, case-insensitive), `Password`, and a \*\*Recovery Method\*\* toggle: user chooses either a \*\*4-Digit Secret PIN\*\* OR picks from 3 \*\*Security Questions\*\* with a custom answer (hashed with bcrypt).

\* \*\*Remember Me (Mobile First)\*\*:

&#x20; \* Login issues a rolling 365-day signed session cookie so mobile users stay logged in all season.

\* \*\*Self-Service Password Reset\*\*:

&#x20; \* On the login screen, clicking "Forgot Password?" prompts for `Username` and verifies their chosen 4-digit PIN or Security Question answer to immediately set a new password.

\* \*\*Terminal CLI Reset (Admin Fallback)\*\*:

&#x20; \* Include a CLI utility (`scripts/reset-password.ts`) so the host can run:

&#x20;   `docker exec -it gameday-pickem npm run reset-password -- <username> <tempPass>`



\### 3.2 User Profiles \& Avatar System

\* \*\*10 Built-In Pixel Art Football Avatars\*\*:

&#x20; \* Generate 10 distinct, crisp 16-bit style SVG avatars right out of the box and bundle them in `/public/avatars/default-1.svg` through `default-10.svg`:

&#x20;   1. Classic Headset Coach

&#x20;   2. Retro Mascot Head (Tiger/Bulldog style)

&#x20;   3. Gold Football Helmet with Visor

&#x20;   4. Foam Finger Fan

&#x20;   5. Broadcast Desk Commentator with Mic

&#x20;   6. Marching Band Drum Major Hat

&#x20;   7. Striped Referee Cap

&#x20;   8. Dual Eyeblack Linebacker

&#x20;   9. Trophy / Heisman Pose Silhouette

&#x20;   10. Tailgate Grill Master

\* \*\*Custom Image Upload \& Auto-Compression\*\*:

&#x20; \* Users can upload a custom photo from their phone or browser.

&#x20; \* \*\*Client-Side Compression\*\*: Before uploading, crop to a centered 1:1 square and scale down to `256x256px` max using an HTML5 `<canvas>` converted to WebP/JPEG (`quality: 0.8`, target `< 35KB`). Store as a compact data URI or in `/app/data/uploads/`.



\### 3.3 Post-Login Group Selection Hub \& The Pixel-Art Broadcast Booth Banner

\* \*\*Post-Login Group Selection Hub (`/groups`)\*\*:

&#x20; \* Every time a user logs in or opens the app, route them directly to the \*\*Group Selection Screen (`/groups`)\*\*—even if they only belong to one group—so they always have a clear entry point to select a group or create/join an additional group.

&#x20; \* Display each of the user's groups as a distinct card (e.g., `"Saturday Night Down South"`, `"Group B"`) showing member count and the user's current-week pick lock status for that specific group (`Locked In` vs `Picks Open`), alongside \*\*"+ Create New Group"\*\* and \*\*"Join Group with Code"\*\* actions.

&#x20; \* Clicking a group card enters that group's dedicated workspace (`/groups/\[groupId]`), keeping picks, leaderboards, and booth views strictly separated by group so multiple groups are never convolved.

&#x20; \* \*\*Back to Group Selection Navigation\*\*: Inside any group view (`/groups/\[groupId]`), render a persistent \*\*"← Back to Groups"\*\* button in the top navigation bar so users can return to the Group Selection screen at any time.

\* \*\*Group Creation \& Invites\*\*:

&#x20; \* Users can create a group (entering a custom `Group Name`, max 24 chars) or join via a 6-character invite code or shareable link (`/join/ABCDEF`).

&#x20; \* \*\*Hard Limit\*\*: Maximum \*\*8 members\*\* per group.

\* \*\*Pixel Art Broadcast Booth Header\*\*:

&#x20; \* Displayed at the top of the Group Dashboard.

&#x20; \* \*\*Background\*\*: 16-bit pixel art college football stadium backdrop with field goalposts, crowd, and studio lights.

&#x20; \* \*\*Foreground Desk\*\*: A pixel-art broadcast desk featuring a prominent front placard displaying the \*\*Group Name\*\* in retro pixel typography.

&#x20; \* \*\*Center-Outward Dynamic Scaling \& Staggered Seating (1 to 8 Players)\*\*:

&#x20;   \* Do NOT render empty placeholder chairs or leave an empty right half of the desk when a group has fewer than 8 members.

&#x20;   \* Avatars must \*\*start in the center of the desk and expand outward symmetrically\*\* as more members join, dynamically scaling avatar size and spacing based on total `memberCount` (1–8):

&#x20;     \* \*\*1–4 Members\*\*: Seated in a single centered row behind the desk (expanding outward from the center microphone, with slightly larger avatar frames since there is ample room).

&#x20;     \* \*\*5–8 Members\*\*: Automatically splits into \*\*two centered, diagonally staggered rows\*\* (`ceil(N/2)` in the front row, `floor(N/2)` in the elevated back row, up to 4x4 at full 8-player capacity). Both rows are horizontally centered over the desk and offset diagonally (`justify-center` with half-seat stagger) so no two avatars are stacked directly on top of each other and the booth always looks balanced and full.

&#x20;   \* Display each user's username pill and weekly pick status icon (`Locked In` checkmark vs. `Pending` dot) right below their avatar.



\### 3.4 Global Admin Console, Saturday-Only Filter \& Dynamic Postseason Window

\* \*\*Global Slate Model\*\*: The Admin sets a single official weekly slate (up to \*\*8 games max\*\* per week) that applies to all groups.

\* \*\*Game Day Filtering \& Dynamic Postseason Window\*\*:

&#x20; \* \*\*Regular Season (`REGULAR`)\*\*: Strictly filter fetched FBS games to \*\*Saturday games only\*\* (evaluated in `America/New\_York`). Automatically exclude Thursday and Friday night games.

&#x20; \* \*\*Postseason (`BOWL`, `PLAYOFF`, `CHAMPIONSHIP`)\*\*: Dynamically expand the week's date boundary to include games played across the entire postseason slate window—including \*\*Sunday, Monday (e.g., the Monday night CFP National Championship), and multi-day Bowl/Playoff rounds\*\*. The week remains active and continues grading until the final game on the slate reaches `FINAL` status.

\* \*\*Smart Auto-Recommendation ("Hype Score" Algorithm)\*\*:

&#x20; \* In `/admin/slate`, rank eligible games automatically by a calculated \*\*Hype Score\*\*:

&#x20;   \* \*\*SEC vs. SEC Matchup\*\*: `+50 pts` (automatically prioritized and flagged with an `SEC Matchup` badge).

&#x20;   \* \*\*Both Teams Ranked (Top 25)\*\*: `+40 pts` (plus bonus points for Top 10 matchups).

&#x20;   \* \*\*Single Ranked Team + Tight Spread (<= 7.5 pts)\*\*: `+25 pts`.

&#x20;   \* \*\*Close Betting Spread (<= 3.5 pts)\*\*: `+15 pts`.

&#x20; \* \*\*One-Click Auto-Fill + Manual Override\*\*:

&#x20;   \* The top 8 highest-scoring games are pre-highlighted as "Recommended Slate."

&#x20;   \* The Admin can click \*\*"Auto-Lock Top 8"\*\* OR manually check/uncheck any eligible game from the scoreboard to swap games in/out (up to 8 games max).

&#x20;   \* Admin sets the week's stage: `REGULAR`, `BOWL`, `PLAYOFF`, or `CHAMPIONSHIP`.



\### 3.5 Mobile Pick Flow, Review \& Permanent Lock Confirmation, and Group Pick Reveal

\* \*\*Selection Window \& Cutoff\*\*:

&#x20; \* Picks open Thursday morning (or immediately when the Admin publishes the week's slate).

&#x20; \* \*\*Standard Cutoff\*\*: \*\*Saturday at 11:30:00 AM Eastern Time (`America/New\_York`)\*\*. (If a postseason Bowl/Playoff week has a featured game kicking off earlier than Saturday 11:30 AM ET, the admin can toggle the slate lock to 30 minutes prior to the first kickoff, otherwise defaulting to Saturday 11:30 AM ET).

&#x20; \* Enforce the lock on both client UI (live countdown timer) and server API (reject mutations after lock).

&#x20; \* \*\*No-Pick Rule (`0-0`)\*\*: If a user does not lock in picks before the cutoff, their weekly score is recorded as `0-0` and adds `0` wins and `0` losses to their season record.

\* \*\*Mobile-Optimized Pick UI \& Final Lock-In Flow\*\*:

&#x20; \* Provide a clean toggle at the top of the "Make Picks" tab between:

&#x20;   1. \*\*Card Deck Mode (Default on Mobile)\*\*: Step through Game 1 of 8 -> tap Team A or Team B -> hit "Next" with a progress bar (`3 of 8 Picked`).

&#x20;   2. \*\*Quick List Mode\*\*: Vertical list of all 8 matchups down the page with a \*\*"Next: Review Picks"\*\* button at the bottom once all games are selected.

&#x20; \* Each matchup card displays: Team Logos, Team Names, Current Records, AP Rank, Kickoff Day/Time (ET), and \*\*Reference Betting Odds\*\* (e.g., `ALA -3.5 | O/U 52.5`).

&#x20; \* \*\*Step 2 — Review Picks Summary Screen\*\*:

&#x20;   \* After selecting all games and tapping \*\*Next\*\*, display a clean \*\*Review Your Picks\*\* summary screen listing all selected winners for the week so the user can double-check their choices (with a "Go Back \& Edit" button if they haven't locked yet, and a prominent \*\*"Lock In Picks"\*\* primary button).

&#x20; \* \*\*Step 3 — Permanent Lock Confirmation Modal\*\*:

&#x20;   \* When the user clicks \*\*"Lock In Picks"\*\*, display a confirmation dialog:

&#x20;     > \*"Picks will be locked in for the entire week. Are you sure?"\*

&#x20;     with \*\*\[Yes, Lock In]\*\* and \*\*\[No, Go Back]\*\* buttons.

&#x20;   \* \*\*Irreversible Weekly Lock\*\*: Once the user clicks \*\*Yes\*\*, mark their weekly submission for that group as permanently locked (`is\_locked = true`). They can view their locked picks in read-only mode, but \*\*cannot edit or change their picks again for the rest of the week\*\* (enforced on both UI and server API).

\* \*\*Real-Time Group Selections Feed (Post-Cutoff Reveal)\*\*:

&#x20; \* \*\*Before 11:30 AM ET Saturday\*\*: Users can only see their own picks and whether groupmates have locked in (`Locked In` vs `Waiting`). Other members' specific team selections remain hidden unless \*\*100% of group members\*\* have locked in their full slate early.

&#x20; \* \*\*At/After 11:30 AM ET Saturday (or 100% Group Lock)\*\*: Unlock the \*\*Group Picks Feed\*\*—a clean, mobile-friendly scrolling list of every featured matchup card (e.g., `LSU vs. Alabama`).

&#x20; \* Directly underneath each team on the matchup card, display two side-by-side columns showing the \*\*avatars and usernames of every group member who picked that team\*\*, plus live scores and green/red win/loss highlights as games finish.



\### 3.6 Automated Grading, Tie Rankings \& Expanded Postseason Leaderboard

\* \*\*Scoring\*\*:

&#x20; \* Straight-up winner only (`1 Win` for correct pick, `1 Loss` for incorrect pick on submitted games). No weighted points.

&#x20; \* Background cron checks final scores from the ESPN API every 15 minutes across the active slate window (Saturday through Monday night for postseason weeks) and marks games `FINAL`, immediately updating records.

\* \*\*Fantasy-Style Shared Tie Rankings\*\*:

&#x20; \* Sort the leaderboard by \*\*Total Wins (descending)\*\*, then \*\*Win Percentage (descending)\*\* (or allow toggling between Win % and Total Wins).

&#x20; \* \*\*Tie Display\*\*: When users have identical records, display shared ordinal rankings just like fantasy football (e.g., if three players are tied at the top, display `1st`, `1st`, `1st`, and the next player as `4th`).

\* \*\*Leaderboard Views\*\*:

&#x20; \* Standard columns: Rank (`1st`, `2nd`, etc.), Avatar, Username, \*\*Week Record\*\* (e.g., `6-2`, or `0-0` if missed), \*\*Overall Record\*\* (e.g., `68-20`), and \*\*Win %\*\*.

&#x20; \* \*\*Postseason Expanded Leaderboard\*\*: Once Bowl/Playoff weeks begin, expand the leaderboard with filter tabs and split columns:

&#x20;   \* `Overall Record` (Full Season + Postseason combined)

&#x20;   \* `Regular Season` (`W-L`)

&#x20;   \* `Bowl Games` (`W-L`)

&#x20;   \* `Playoffs \& National Championship` (`W-L`)

\* \*\*V2 Infrastructure (Built-In Under the Hood)\*\*:

&#x20; \* When a user submits a pick, freeze `locked\_spread\_at\_pick` in the `picks` table and compute `is\_ats\_correct` (`boolean`) when the game goes final so all data is ready for V2 odds/spread performance stats.



\### 3.7 Patch Number Display \& Live Auto-Update Mechanism

\* \*\*Top-Right Patch Badge\*\*:

&#x20; \* Display the current version in the top-right corner of the header (e.g., `v1.0.0`) pulled from `package.json`.

\* \*\*Stale Browser Auto-Updater\*\*:

&#x20; \* Expose `GET /api/version` returning `{ version: "1.0.0", buildTimestamp: "..." }` with `Cache-Control: no-store`.

&#x20; \* Poll `/api/version` on login, window focus, and every 60 seconds. If a new version is deployed, automatically refresh the browser (or show a one-tap \*"Update available — tap to refresh"\* banner if the user is mid-pick).



\---



\## 4. Database Schema Blueprint (SQLite)



Implement the following relational tables:

\* \*\*`users`\*\*: `id`, `username` (unique), `password\_hash`, `recovery\_type` (`PIN` | `QUESTION`), `recovery\_question`, `recovery\_hash`, `avatar\_type` (`DEFAULT` | `CUSTOM`), `avatar\_value` (default ID or compressed image URI), `is\_admin` (boolean), `created\_at`.

\* \*\*`groups`\*\*: `id`, `name`, `invite\_code` (unique), `owner\_id`, `created\_at`.

\* \*\*`group\_members`\*\*: `id`, `group\_id`, `user\_id`, `seat\_index` (0–7 for broadcast booth position), `joined\_at`.

\* \*\*`weeks`\*\*: `id`, `season\_year`, `week\_number`, `label` (e.g., "Week 8" or "CFP Quarterfinals"), `stage` (`REGULAR` | `BOWL` | `PLAYOFF` | `CHAMPIONSHIP`), `lock\_time\_utc` (Saturday 11:30 AM ET converted to UTC), `window\_end\_utc` (dynamically extended through Monday night / final game kickoff for postseason slates), `is\_published` (boolean), `sandbox\_state\_override` (nullable: `OPEN` | `ALL\_SUBMITTED` | `LOCKED` | `GRADED`).

\* \*\*`games`\*\*: `id`, `week\_id`, `external\_game\_id`, `home\_team`, `away\_team`, `home\_logo`, `away\_logo`, `home\_rank`, `away\_rank`, `is\_sec\_matchup` (boolean), `hype\_score` (int), `kickoff\_utc`, `spread\_home` (float, nullable), `over\_under` (float, nullable), `odds\_display` (string), `home\_score` (int, nullable), `away\_score` (int, nullable), `status` (`SCHEDULED` | `IN\_PROGRESS` | `FINAL`), `winner\_team` (nullable).

\* \*\*`picks`\*\*: `id`, `user\_id`, `group\_id`, `game\_id`, `week\_id`, `selected\_team`, `is\_locked` (boolean, default `false` — permanently set to `true` upon user confirmation), `locked\_at` (timestamp, nullable), `locked\_spread\_at\_pick` (float, nullable — V2 ready), `is\_correct` (boolean, nullable), `is\_ats\_correct` (boolean, nullable — V2 ready), `updated\_at`.



\---



\## 5. DevOps: GitHub Actions + CasaOS + Watchtower Setup

Generate the following files in the repository so updates deploy automatically whenever code is pushed to `main`:

1\. \*\*`Dockerfile`\*\*: Multi-stage Node 20 Alpine build for Next.js standalone mode, exposing port `3000` and mounting `/app/data` for SQLite persistence.

2\. \*\*`.github/workflows/deploy.yml`\*\*:

&#x20;  \* Triggers on push to `main`.

&#x20;  \* Automatically reads `package.json` version, builds the Docker image, and pushes it to \*\*GitHub Container Registry (`ghcr.io/<github\_username>/gameday-pickem:latest`)\*\*.

3\. \*\*`docker-compose.casaos.yml`\*\*:

&#x20;  \* Ready-to-import CasaOS compose file containing both the `gameday-pickem` app container and `containrrr/watchtower` configured to poll every 5 minutes (`--interval 300 --cleanup`) and auto-restart the web app when a new image hits `ghcr.io`.



\---



\## 6. Default Admin Account \& Interactive Testing Sandbox



\### 6.1 Auto-Seeded Admin Credentials

On initial database initialization/startup, automatically seed a default Global Commissioner account if no users exist:

\* \*\*Username\*\*: `admin`

\* \*\*Password\*\*: `admin` (hashed via `bcryptjs`)

\* \*\*Recovery PIN\*\*: `0000`

\* \*\*Role\*\*: `is\_admin = true`

\* \*\*Security Prompt\*\*: Display a subtle, dismissible banner in `/admin` reminding the admin to update their password from `admin` before exposing the CasaOS port to the public internet.



\### 6.2 Admin "Sandbox \& Time-Travel" Toolbar

Render a floating, collapsible \*\*"Sandbox Controls"\*\* drawer at the bottom of the screen (visible ONLY when logged in as `is\_admin = true`) so the admin can test every phase of the season in the browser immediately:

1\. \*\*"Load Demo Group \& Bots" + Booth Size Slider (1–8 Players)\*\*:

&#x20;  \* Creates two demo groups on the `/groups` hub (`"Saturday Night Down South"` and `"SEC Tailgate Crew"`) so the admin can immediately test switching between groups via the Group Selection screen, with `admin` + up to 7 simulated friend accounts (`Corso\_Headgear`, `Herbstreit\_Pick`, `SEC\_Tailgater`, `Bama\_Jones`, `Bayou\_Bengal`, `Dawg\_Pound`, `Vol\_Navy`), assigning each one a different default pixel-art football avatar (1–8).

&#x20;  \* Include a quick \*\*Booth Player Count toggle (`1` to `8` players)\*\* in the Sandbox drawer so the admin can visually test how the broadcast booth scales and centers avatars from the middle outward for any group size (e.g., 2, 3, 5, or 8 members), plus an \*\*"Unlock Admin Picks (Test Only)"\*\* button so the admin can repeatedly test the Review \& Lock-In confirmation modal.

&#x20;  \* Seeds a Saturday 8-game SEC/Top-25 slate with realistic spreads and O/U odds, plus mock Bowl, Playoff, and Monday National Championship slates.

2\. \*\*Time \& Lock Simulator Toggle\*\*:

&#x20;  \* Allows the admin to override the current week's lock state in real time without changing the system clock:

&#x20;    \* `OPEN (Thursday Mode)`: Countdown timer to Saturday 11:30 AM ET active; other members' picks hidden.

&#x20;    \* `ALL\_SUBMITTED (Early Reveal Mode)`: Simulates all group members locking in picks prior to Saturday 11:30 AM ET to verify early pick visibility.

&#x20;    \* `LOCKED (Saturday 11:30 AM ET Mode)`: Locks pick buttons and unlocks the scrollable \*\*Group Picks Feed\*\* showing every matchup (`LSU vs. Alabama`) with the avatars/usernames of who picked each team underneath.

&#x20;    \* `GRADED (Final Mode + Ties \& Postseason)`: Simulates final scores across Regular Season, Bowl, Playoff, and Monday National Championship weeks—including intentional tied records (`1st, 1st, 1st, 4th`) and a bot who missed picks (`0-0`)—so the admin can test the Expanded Postseason Leaderboard tabs.

3\. \*\*"Reset \& Wipe Sandbox Data" Button\*\*:

&#x20;  \* Cleanly deletes all bot accounts, demo groups, and simulated weeks while preserving real user accounts, preparing the database for production launch.



\---



\## 7. Mandatory Execution Order \& Model-Switch Checkpoints



To maximize architectural accuracy while conserving `Gemini 4 Argon` quota, execute the build using the following phased checkpoints and explicitly prompt the user whenever it is time to switch models in the Antigravity dropdown:



\* \*\*Phase 0 — Initial Implementation Plan Review (Run on `Gemini 4 Argon`)\*\*:

&#x20; \* Read `AGENTS.md` and `SPEC.md` in full. Do NOT ask clarifying questions.

&#x20; \* Output a complete \*\*Implementation Plan\*\* mapping out the file structure, database schema, component hierarchy, and build steps for Phases 1–6.

&#x20; \* \*\*STOP \& PROMPT USER\*\*: \*"Please review the Implementation Plan above. Keep your model set to \*\*Gemini 4 Argon\*\* and reply \*\*'Ready for Phase 1'\*\* to build the foundation and database."\*



\* \*\*Phase 1 — Foundation \& Database (Run on `Gemini 4 Argon`)\*\*:

&#x20; \* Initialize Next.js (App Router, TypeScript, Tailwind), configure SQLite (`better-sqlite3` + ORM) in `/app/data`, build the full schema (with group-scoped picks and `is\_locked`), and create the startup seed script for the `admin` / `admin` user and demo sandbox groups.

&#x20; \* \*\*STOP \& PROMPT USER FOR MODEL SWITCH\*\*:

&#x20;   > 🔄 \*\*MODEL SWITCH CHECKPOINT\*\*: Phase 1 is complete! To save your Argon quota, please switch your Antigravity model dropdown to \*\*Gemini 3.8 Flash (High)\*\* for Phases 2 and 3, then reply \*\*"Ready"\*\*.



\* \*\*Phase 2 \& Phase 3 (Run Continuously on `Gemini 3.8 Flash`)\*\*:

&#x20; \* \*\*Phase 2 — Pixel Art Assets \& Center-Outward Broadcast Booth UI\*\*: Generate the 10 custom 16-bit football SVG avatars (`/public/avatars/default-1.svg` to `default-10.svg`) and build the pixel-art College GameDay Broadcast Booth component featuring the stadium background, desk with the dynamic Group Name banner, and the dynamic center-outward avatar seating layout (scaling cleanly from 1 to 8 players with staggered diagonal rows for 5–8 players).

&#x20; \* \*\*Phase 3 — Auth, Post-Login Group Selection Hub, Profiles \& Client Image Compression\*\*: Build the 365-day persistent login, the mandatory post-login Group Selection Hub (`/groups`) with \*\*"← Back to Groups"\*\* navigation inside `/groups/\[groupId]`, Signup with PIN/Security Question recovery, the self-service "Forgot Password" screen, the HTML5 `<canvas>` custom avatar uploader/compressor, and the CLI password reset script.

&#x20; \* \*\*STOP \& PROMPT USER FOR MODEL SWITCH\*\*:

&#x20;   > 🔄 \*\*MODEL SWITCH CHECKPOINT\*\*: Phases 2 and 3 are complete! Because Phase 4 involves complex Eastern Time filtering, dynamic postseason windows, and the Hype Score algorithm, please switch your model dropdown back to \*\*Gemini 4 Argon\*\*, then reply \*\*"Ready"\*\*.



\* \*\*Phase 4 — ESPN API Sync, Saturday Filter, Postseason Window \& Admin Console (Run on `Gemini 4 Argon`)\*\*:

&#x20; \* Build the ESPN scoreboard fetcher (strictly Saturday-only for Regular Season; dynamically expanded through Monday night for Bowl/Playoff/Championship slates), the Hype Score calculator (prioritizing SEC vs. SEC + Top 25 matchups), the `/admin` slate selector, and the bottom "Sandbox \& Time-Travel" testing toolbar (including the 1–8 player count preview toggle and test pick-unlock button).

&#x20; \* \*\*STOP \& PROMPT USER FOR MODEL SWITCH\*\*:

&#x20;   > 🔄 \*\*MODEL SWITCH CHECKPOINT\*\*: Phase 4 is complete! Please switch your model dropdown back to \*\*Gemini 3.8 Flash (High)\*\* to finish Phases 5 and 6, then reply \*\*"Ready"\*\*.



\* \*\*Phase 5 \& Phase 6 (Run Continuously on `Gemini 3.8 Flash`)\*\*:

&#x20; \* \*\*Phase 5 — Mobile Pick Flow, Review/Lock Confirmation Modal, Matchup Pick Reveal \& Postseason Leaderboards\*\*: Build the Card Deck / Quick List pick views, the \*\*Review Your Picks\*\* summary screen, the \*\*"Lock In Picks"\*\* confirmation warning modal (\*"Picks will be locked in for the entire week. Are you sure?"\* -> Yes/No) that permanently locks picks for the week, Eastern Time (`America/New\_York`) Saturday 11:30 AM ET cutoff, the scrollable Group Picks Feed (showing who picked which team underneath each matchup), `0-0` handling for missed weeks, shared tie rankings (`1st, 1st, 1st, 4th`), and the Regular/Bowl/Playoff expanded leaderboard.

&#x20; \* \*\*Phase 6 — Version Auto-Updater, Docker \& Verification\*\*: Add `/api/version` and the top-right patch badge + auto-reload poller, create `Dockerfile`, `.github/workflows/deploy.yml`, and `docker-compose.casaos.yml`, then run `npm run build` and start the local dev server so the user can log in with `admin` / `admin` in the browser.

