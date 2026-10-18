\# Antigravity Workspace Rules \& Architecture Constraints



@\[Project Specification](SPEC.md)



\## Core Directives

1\. \*\*Single-Container Simplicity\*\*: Build this project as a unified full-stack Next.js (App Router, TypeScript, Tailwind CSS) application using SQLite (`better-sqlite3` + Drizzle ORM or Prisma) stored in a persistent `/app/data` volume for seamless single-container deployment on CasaOS.

2\. \*\*Timezone \& Dynamic Window Strictness\*\*:

&#x20;  \* ALL game lock checks, slate windows, and cron schedules MUST explicitly evaluate in `America/New\_York` (Eastern Time).

&#x20;  \* During `REGULAR` season weeks, strictly filter the game fetcher to \*\*Saturday games only\*\* (ignore Thursday/Friday games).

&#x20;  \* During `BOWL`, `PLAYOFF`, and `CHAMPIONSHIP` stages, dynamically expand the week's active game window through Monday night (or the final kickoff of the selected slate) so Sunday/Monday/mid-week postseason games are fetched, displayed, and graded properly while keeping the standard Saturday 11:30 AM ET pick lock (or 30 minutes prior to the first postseason game if the slate begins earlier).

3\. \*\*Missed Picks = 0-0\*\*: Never penalize missed picks with automatic losses, and do not build an admin proxy-pick override. Users who fail to submit picks before the cutoff receive a `0-0` record for that week, adding `0` wins and `0` losses to their overall record.

4\. \*\*Database Forward-Compatibility (V2 ATS Ready)\*\*: Every `Game` and `Pick` record must capture and freeze `spread` and `overUnder` values at the time of pick/lock so V2 Against-The-Spread (ATS) analytics can be enabled later without schema migrations.

5\. \*\*No-Email Auth \& CLI Escape Hatch\*\*: Never integrate external email providers. Password recovery must work via user-configured 4-digit PIN or Security Question, plus a standalone Node CLI script (`npm run reset-password -- <username> <new\_password>`) executable via Docker exec.

6\. \*\*Client-Side Image Compression\*\*: Enforce client-side HTML5 `<canvas>` resizing (1:1 square crop, max 256x256px, WebP/JPEG at 0.8 quality) before saving custom avatars.

7\. \*\*Version Visibility \& Auto-Reload\*\*: Expose `/api/version` reading from `package.json`. Render the patch badge in the top-right UI header and poll every 60 seconds to auto-refresh stale mobile browser sessions.

8\. \*\*Model-Switch Checkpoints (`Gemini 4 Argon` <-> `Gemini 3.8 Flash`)\*\*: Follow the exact phase checkpoints in Section 7 of `SPEC.md`. Do NOT ask clarifying questions about app requirements. Only pause at the designated \*\*Model-Switch Checkpoints\*\* to display a bold reminder banner telling the user which model (`Gemini 4 Argon` or `Gemini 3.8 Flash`) to select in the Antigravity model dropdown before replying `"Ready"`.

9\. \*\*Group-Isolated Context \& Irreversible Pick Lock\*\*: Always route authenticated users to the Group Selection Hub (`/groups`) first so groups are never convolved. Once a user reviews their picks and confirms the final lock warning modal within a group, those picks are permanently locked (`is\_locked = true`) for the entire week and cannot be modified again, even before the Saturday 11:30 AM ET cutoff.

