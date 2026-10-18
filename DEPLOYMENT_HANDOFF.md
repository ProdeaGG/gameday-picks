# CasaOS Deployment, Watchtower & Laptop Handoff Guide

This document contains everything needed to resume this project on your laptop, configure CasaOS, and set up automated Watchtower updates.

---

## 1. How to Resume This Conversation on Your Laptop

When you switch to your laptop, follow these steps to get back to work seamlessly:

### Step 1.1: Clone the Repository to Your Laptop
Open your laptop's terminal (PowerShell, Command Prompt, or bash) in your desired directory and run:

```bash
git clone https://github.com/ProdeaGG/gameday-picks.git
cd gameday-picks
```

### Step 1.2: Install Dependencies (If Running Locally)
If you wish to test or run local dev commands on your laptop:
```bash
npm install
npm run dev
```

### Step 1.3: Open in Antigravity on Your Laptop
1. Open the **Antigravity IDE** on your laptop.
2. Open the cloned folder (`gameday-picks`).
3. Start a new session and simply prompt Antigravity with:
   > *"I just switched from my desktop to my laptop. Please reference `DEPLOYMENT_HANDOFF.md` to see where we left off and assist me with CasaOS deployment and Watchtower setup."*

---

## 2. CasaOS Deployment Steps

### Step 2.1: Make the GitHub Container Package Public
GitHub Packages default to private upon first build. To allow CasaOS and Watchtower to pull images without requiring a GitHub Personal Access Token on your server:

1. Open your browser to [github.com/ProdeaGG/gameday-picks](https://github.com/ProdeaGG/gameday-picks).
2. On the right sidebar, look for **Packages** (or visit `https://github.com/ProdeaGG?tab=packages`).
3. Click on the package named **`gameday-picks`**.
4. In the right column or header, click **Package settings**.
5. Scroll down to the **Danger Zone** -> **Change package visibility**.
6. Select **Public**, type the repository name to confirm, and save.

---

### Step 2.2: Install GameDay Picks on CasaOS

1. Open your **CasaOS Dashboard** in a web browser (`http://<casaos-ip>`).
2. Click the **`+`** icon at the top right of the App panel -> choose **Custom Install**.
3. In the top-right corner of the modal, click the **Import** icon.
4. Paste the following configuration:

```yaml
version: '3.8'

services:
  gameday-picks:
    image: ghcr.io/prodeagg/gameday-picks:latest
    container_name: gameday-picks
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - TZ=America/New_York
      - DATABASE_URL=file:/app/data/pickem.db
      - JWT_SECRET=change-this-to-any-random-string-12345
    volumes:
      - /DATA/AppData/gameday-picks/data:/app/data
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
```

5. Recommended UI field settings in CasaOS:
   - **Title**: `GameDay Pick'em`
   - **Icon URL**: `https://a.espncdn.com/i/teamlogos/ncaa/500/333.png`
   - **Web UI Port**: `3000`
6. Click **Submit / Install**.
7. Once running, access the web app at `http://<casaos-ip>:3000`.

---

### Step 2.3: Initial Commissioner Login Checklist

1. Log in at `http://<casaos-ip>:3000/login` with default seeded credentials:
   - **Username**: `admin`
   - **Password**: `admin`
   - **Recovery PIN**: `0000`
2. Immediately go to **Profile & Avatar** (`/profile` via top-right dropdown) and change both your password and 4-digit PIN.
3. Open the **Admin Console** (`/admin`) to verify the **7-Game Slate Selector** and confirm your first active week.

---

## 3. Setting Up Watchtower in CasaOS (Auto-Updater)

Watchtower checks for newly published container images on GitHub Container Registry and automatically updates the running container without losing your SQLite database (`/app/data/pickem.db`).

### Step 3.1: Install Watchtower via CasaOS Custom Install

1. In the CasaOS dashboard, click **`+`** -> **Custom Install**.
2. Click **Import** in the top right of the modal.
3. Paste the following:

```yaml
version: '3.8'

services:
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_LABEL_ENABLE=true
      - WATCHTOWER_POLL_INTERVAL=300
      - TZ=America/New_York
```

4. Recommended UI settings:
   - **Title**: `Watchtower`
   - **Icon URL**: `https://containrrr.dev/watchtower/assets/images/logo.png`
5. Click **Submit / Install**.

### Why This Configuration Is Safe:
- **`WATCHTOWER_LABEL_ENABLE=true`**: Restricts Watchtower to only touch containers with `com.centurylinklabs.watchtower.enable=true`. Your other CasaOS containers (Plex, Pi-hole, Nextcloud, etc.) will **never** be touched or rebooted.
- **`WATCHTOWER_POLL_INTERVAL=300`**: Checks for updates every 5 minutes.
- **`WATCHTOWER_CLEANUP=true`**: Automatically deletes stale, dangling Docker images so your server disk never fills up.

---

## 4. Emergency Password Reset (Docker CLI Escape Hatch)

If you ever forget both your password and your 4-digit PIN, you can reset any user's password directly from the server terminal without external email providers:

```bash
docker exec -it gameday-picks node scripts/reset-password.mjs <username> <new_password>
```

Example:
```bash
docker exec -it gameday-picks node scripts/reset-password.mjs admin SuperSecret2026!
```

---

## 5. Ongoing Development Workflow (From Your Laptop)

Whenever you make any change on your laptop:
1. Edit your code.
2. Commit and push:
   ```bash
   git add .
   git commit -m "feat: description of changes"
   git push origin main
   ```
3. GitHub Actions builds the image automatically.
4. Watchtower automatically updates your CasaOS container within 5 minutes.
5. Connected browser tabs will detect the new version badge within 60 seconds and prompt the user to refresh.
