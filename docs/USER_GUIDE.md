# Bowling League Helper — Complete User Guide

This manual walks through installing **Bowling League Helper** on Windows, running weekly league nights, configuring league rules and payouts, managing backups, and keeping the program up to date.

---

## Table of Contents

1. [Windows Installation & Removal](#1-windows-installation--removal)
2. [Weekly League Night Workflow (Tab 1)](#2-weekly-league-night-workflow-tab-1)
3. [Team Performance, Averages & History (Tab 2)](#3-team-performance-averages--history-tab-2)
4. [8-Player Brackets & Side Pots (Tab 3)](#4-8-player-brackets--side-pots-tab-3)
5. [Treasurer Ledger & Prize Fund Calculator (Tab 4)](#5-treasurer-ledger--prize-fund-calculator-tab-4)
6. [Multi-League Hub, Lane Schedule & Backups (Tab 5)](#6-multi-league-hub-lane-schedule--backups-tab-5)
7. [Dated Backups & Auto-Save on Closing](#7-dated-backups--auto-save-on-closing)
8. [Updating the Application](#8-updating-the-application)

---

## 1. Windows Installation & Removal

### Installing
1. Download and extract the repository `.zip` (or release archive).
2. Double-click **`installer.exe`** in the root folder.
3. The installer places the executable and support files in **`C:\BowlingLeagueHelper\`** and creates shortcuts on your **Desktop** and **Start Menu**.
4. You may delete the downloaded `.zip` and extracted folder right after installation completes.

### Uninstalling
- Open **Windows Settings → Apps → Installed apps → Bowling League Helper → Uninstall**, or run `C:\BowlingLeagueHelper\Uninstall.exe`.
- Removing the program folder does not delete any `.json` backup files saved to your Documents or custom backup folders.

---

## 2. Weekly League Night Workflow (Tab 1)

### `1A` Quick Score Entry & Active Roster
1. Select or type a bowler name in **Bowler Name**—existing roster bowlers auto-fill their Team and Book Average.
2. Enter **Game 1**, **Game 2**, and **Game 3** (or a single score in **Single-Game Mode**) and press **`Enter`** or click **Save Score**.
3. If someone is absent, click **Mark Absent** directly inside the **Missing from Roster** list to automatically compute their legal absentee score based on your League Rules.
4. Made a typo? Click **Undo** right above the list (or inside the bottom toast notice), or press **`Ctrl + Z`**.

### `1B` Team vs. Team Recap Grid
- Displays lane assignments, game-by-game team totals, handicap adjustment, grand total series, and match points (`7pt` / `8pt` / custom).

### `1C` Master Roster
- Add or remove regular roster bowlers with their Team name, **Book Average**, and **USBC ID**, or export `Bowling_League_Master_Roster.csv`.

### `1D` League Rules
Customize every league calculation without hardcoding assumptions:
- **Entry Format:** `3-Game Series` vs. `Single Game`, **Scratch** vs. **Handicap**
- **Handicap Formula:** Handicap Basis (e.g., `220`), Percentage (`90%`), and optional Maximum Per-Game Cap
- **Absentee Rule:** Fixed Score, Season Average Minus Penalty Pins, or Percentage of Average
- **Team Roster Size:** `1` to `5` bowlers per team
- **Matchup Points:** Standard `7pt` (2 per game + 1 series), `8pt` (2 per game + 2 series), or custom point weights

### Finishing the Week
Click **Finish Week & Export Standing Sheet** when all scores are recorded:
1. Archives the completed week into **Season History** (`Tab 2D`).
2. Exports an Excel-compatible `.csv` results sheet.
3. Opens the **Landscape Print Standing Sheet** preview ready for printing (`Ctrl + P`).

---

## 3. Team Performance, Averages & History (Tab 2)

- **`2A` Team Performance Charts:** Compare week-by-week team totals, season average lines, pin variance (`±`), and consistency rankings.
- **`2B` Bowler Averages:** Rolling recalculated averages and updated per-game handicaps across all entered + archived weeks.
- **`2C` High Games & Series:** Tracks High Scratch Game, High Scratch Series, High Handicap Game, High Handicap Series, and configurable Honor Roll milestones.
- **`2D` Season History:** Inspect, reload, or remove previously archived weeks.

---

## 4. 8-Player Brackets & Side Pots (Tab 3)

- **`3A–3B` 8-Player Brackets:** Select entrants or auto-fill brackets using Game 1 (Quarterfinals), Game 2 (Semifinals), and Game 3 (Finals). Automatically calculates **Champion** and **Runner-Up** payouts in both Scratch and Handicap divisions.
- **`3C` Side Pots:** Record **Strike Pot**, **High Game Pot**, and **Mystery Score** entries with automatic collection totals and winner payout highlights.

---

## 5. Treasurer Ledger & Prize Fund Calculator (Tab 4)

- **`4A` Weekly Dues & Arrears Ledger:** Configure weekly bowler dues, house lineage cost per bowler, and secretary fees; track Paid vs. Owing balances and outstanding arrears per bowler.
- **`4B` End-of-Season Prize Fund Calculator:** Projects total season net prize pool and previews suggested team placement payouts across the standings table.

---

## 6. Multi-League Hub, Lane Schedule & Backups (Tab 5)

- **`5A` Multi-League Manager:** Create and switch between multiple leagues (active or archived seasons) without overwriting one another.
- **`5B` Round-Robin Lane Schedule:** Generates balanced week-by-week lane assignments starting on any odd/even lane pair and supports **Position Round** weeks.
- **`5C` Backups & Restore:** Import or export universal `.json` backups (all leagues included), `.csv` rosters, or portable standalone `.html` copies.

---

## 7. Dated Backups & Auto-Save on Closing

1. Click **Save Dated Backup (.json)...** in the footer or Tab `5C`.
2. Pick any folder on your PC, external drive, or synced folder—the filename automatically includes today's date (`BowlingLeagueHelper_Backup_YYYY-MM-DD.json`).
3. Every time you close **Bowling League Helper** afterward, the program automatically saves all current league data to that exact save file.
4. **If the file cannot be found on closing** (for example if it was deleted, moved, or not yet created):
   - The window **stays open** instead of closing silently.
   - Choose **Pick New Save Location & Close** to save safely before exiting, **Don't Save** to close immediately, or **Cancel (Stay Open)** to keep working.

---

## 8. Updating the Application

1. Click the blue version button in the top bar (e.g., `v1.0.14 · Updates & Patch Notes`) or **Check for Updates & Patch Notes** in the footer.
2. Click **Check for Updates** to query the latest release manifest (`version.json`).
3. When a newer release is available, click **Update and Restart**.
   - On the installed Windows desktop program, the updater downloads the new version files, overwrites `C:\BowlingLeagueHelper\BowlingLeagueHelper.html` and `C:\BowlingLeagueHelper\version.json`, and restarts automatically.
   - All your league data, rosters, history, and save links stay 100% intact.
