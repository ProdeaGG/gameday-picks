# College GameDay Pick'em Web App (`v1.2.0`)

A single-container, full-stack **College Football Pick'em** web application built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **SQLite (`@libsql/client` + Drizzle ORM)** for deployment on **CasaOS**, Docker, or any Node.js web host.

---

## Key Features
- **Pixel-Art College GameDay Broadcast Booth**: Dynamic 1–8 player stadium desk (`1–4` single row, `5–8` two-tier elevated stadium desk with diagonal stagger and hover animations).
- **Group-Isolated Context (`/groups`)**: Users belong to private groups (up to 8 players per group via 6-character invite codes or `/join/[code]` links).
- **Odd 7-Game Weekly Slates**: Reduces ties while prioritizing SEC matchups, ranked showdowns, and tight spreads using the automated **GameDay Hype Score**.
- **Strict Eastern Time (`America/New_York`) Schedule & Cutoffs**:
  - **Admin Selection Deadline**: Wednesday 9:00 AM ET (with advance future-week locking and automatic Top-7 fallback if no slate is published).
  - **Regular Season Filter**: Strictly filters to Saturday FBS games only (excluding Thursday/Friday games).
  - **Postseason Dynamic Window**: Expands through Monday night for `BOWL`, `PLAYOFF`, and `CHAMPIONSHIP` stages.
  - **Pick Cutoff**: Saturday 11:30:00 AM ET (or 30 minutes prior to first kickoff for early postseason slates).
- **Draft Auto-Save & Irreversible Pick Lock**:
  - Selections auto-save as drafts while browsing; users advance card-by-card via explicit button click (`Next Game`) and confirm a final lock modal (`Picks will be locked in for the entire week. Are you sure?`).
  - Missed picks record as `0-0` (never penalized with automatic losses).
- **Winning Team Highlights & Live ESPN Score Sync**:
  - Background cron polls ESPN every 15 minutes (`America/New_York`) to update scores, highlight winning teams & correct pickers in emerald green on the **Group Selections** feed, and grade leaderboards.

---

## Quick Start (Docker / CasaOS Deployment)

1. **Build and launch the container**:
   ```bash
   docker compose up -d --build
   ```
   The SQLite database is automatically created and persisted at `./data/pickem.db` (mounted to `/app/data/pickem.db` inside the container).

2. **First-Time Commissioner Login**:
   - Open `http://<your-server-ip>:3000/login`
   - Default Commissioner credentials:
     - **Username**: `admin`
     - **Password**: `admin`
     - **Recovery PIN**: `0000`
   - Go to **Profile & Avatar** (`/profile`) immediately after logging in to change your password and 4-digit recovery PIN.

3. **Weekly Commissioner Workflow (`/admin`)**:
   - Open the **Admin Console** (`/admin`) from the top-right profile menu.
   - Select the **Week** (`W1`–`W15` or Postseason stage) — you can also lock in future weeks in advance.
   - Review the **7-game slate** (or click **Auto-Select Top 7**) and click **Lock In 7-Game Slate** before **Wednesday at 9:00 AM ET**.
   - Once locked in, the week's games are protected from accidental changes unless you confirm the **Adjust Game Selection** prompt.

---

## Password Recovery & Admin Escape Hatches

1. **Self-Service Recovery (`/forgot-password`)**: Users can reset their own password using their 4-digit PIN or Security Question answer.
2. **Admin Console UI (`/admin` -> `Users & Live League`)**: The Commissioner can reset any user's password directly in the web UI.
3. **CLI Escape Hatch (Docker Exec / Terminal)**:
   ```bash
   # Inside Docker / CasaOS:
   docker exec -it gameday-pickem npm run reset-password -- <username> <new_password>

   # Local Node terminal:
   npm run reset-password -- <username> <new_password>
   ```
