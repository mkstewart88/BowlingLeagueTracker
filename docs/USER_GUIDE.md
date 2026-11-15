# Bowling League Helper — Complete User Guide

This manual walks through installing **Bowling League Helper** on **Windows 11** or **Linux**, running weekly league nights, configuring league rules and payouts, managing backups, and keeping the program up to date.

---

## Table of Contents

1. [Installation & Removal (Windows 11 & Linux)](#1-installation--removal-windows-11--linux)
2. [Weekly League Night Workflow (Tab 1)](#2-weekly-league-night-workflow-tab-1)
3. [Team Performance, Averages & History (Tab 2)](#3-team-performance-averages--history-tab-2)
4. [8-Player Brackets & Side Pots (Tab 3)](#4-8-player-brackets--side-pots-tab-3)
5. [Treasurer Ledger & Prize Fund Calculator (Tab 4)](#5-treasurer-ledger--prize-fund-calculator-tab-4)
6. [Multi-League Hub, Lane Schedule & Backups (Tab 5)](#6-multi-league-hub-lane-schedule--backups-tab-5)
7. [Persistent Save File & Auto-Save on Closing](#7-persistent-save-file--auto-save-on-closing)
8. [Updating the Application](#8-updating-the-application)

---

## 1. Installation & Removal (Windows 11 & Linux)

### Windows 11
- **Install:** Download `installer.exe` (or download and extract the repository `.zip` via **Code → Download ZIP**) and double-click **`installer.exe`** in the root folder. It installs all program files into **`C:\BowlingLeagueHelper\`** and creates shortcuts on your **Desktop** and **Start Menu**. You can delete the `.zip` and extracted folder right after installation.
- **Uninstall:** Open **Windows Settings → Apps → Installed apps → Bowling League Helper → Uninstall**, or run `C:\BowlingLeagueHelper\Uninstall.exe`. Any `.json` backup files saved outside the install folder remain untouched.

### Linux
- **Install:** Requires Node.js 20+. Download and extract the repository ZIP (or `git clone`), then run:
  ```bash
  chmod +x install-linux.sh
  ./install-linux.sh
  ```
  This installs all application files into **`~/BowlingLeagueHelper/`**, places the `bowling-league-helper` launcher in `~/.local/bin`, and creates a Desktop / Application Menu shortcut with the custom bowling ball & pins icon. You can delete the downloaded `.zip` and extracted folder right afterward.
- **Uninstall:** Remove `~/BowlingLeagueHelper`, `~/.local/bin/bowling-league-helper`, `~/.local/share/applications/bowling-league-helper.desktop`, and `~/Desktop/Bowling League Helper.desktop`. External `.json` backup files remain untouched.

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

### Finishing the Week, Week Notes & Printing to PDF
- **Week Notes:** Record tournament notes, sweepers, holidays, or special league announcements in the **Week Notes** box on Tab `1A`. Notes are saved with the week's archive, printed in a callout box on the standing sheet, and automatically cleared when you start a new week.
- **Finish Week & Generate CSV + Printout:** Archives the completed week (including Week Notes) into **Season History** (`Tab 2D`), exports an Excel-compatible `.csv` results sheet, and opens the **Landscape Print Standing Sheet** preview.
- **Print to PDF / Print Only:** Click **Print to PDF** in Tab `1A` to open the landscape standing sheet pre-titled for clean PDF export (`Save as PDF` in the print dialog), or **Print Only** / **`Ctrl + P`** to print directly without archiving again.

---

## 3. Team Performance, Averages & History (Tab 2)

- **`2A` Team Performance Charts:** Compare week-by-week team totals, season average lines, pin variance (`±`), and consistency rankings.
- **`2B` Bowler Averages:** Rolling recalculated averages and updated per-game handicaps across all entered + archived weeks.
- **`2C` High Games & Series:** Tracks High Scratch Game, High Scratch Series, High Handicap Game, High Handicap Series, and configurable Honor Roll milestones.
- **`2D` Season History:** Inspect (including saved **Week Notes**), reload, or remove previously archived weeks.

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

- **`5A` Multi-League Manager:** Create and switch between multiple leagues (active or archived seasons) without overwriting one another, or click **Start Fresh (Clear All Data)...** to wipe all in-app leagues/scores and reset to a blank Week 1 league.
- **`5B` Round-Robin Lane Schedule:** Generates balanced week-by-week lane assignments starting on any odd/even lane pair and supports **Position Round** weeks.
- **`5C` Backups & Restore:** Import or export universal `.json` backups (all leagues included), `.csv` rosters, or reset all app data cleanly via **Start Fresh...** (previously saved `.json` files on your PC remain untouched).

---

## 7. Persistent Save File, Top-Bar Quick Save & Auto-Save on Closing

1. **Top-Bar `Save` Button:** Click the green **Save** button in the top bar (right next to the Update button) at any time to immediately save all leagues, scores, Week Notes, and settings to your linked **`BowlingLeagueTrackerSave.json`** file (shows `Save *` whenever you have unsaved edits).
   - If no save file is linked or found yet, the app displays *"No save file found. Please choose where to save."* and opens the system **Save As** dialog so you can choose where to save **`BowlingLeagueTrackerSave.json`**.
2. **Automatic Load on Startup:** Every time **Bowling League Helper** starts up, it automatically opens and loads your linked **`BowlingLeagueTrackerSave.json`** file so you pick up right where you left off.
3. **Choosing a Different Save File (`Save New File (.json)...`):** Click **Save New File (.json)...** in the footer or Tab `5C` whenever you want to save to a brand-new folder or file location.
4. **Unsaved-Changes Prompt on Closing & `"On Closing Program"` Auto-Backup (`Tab 5C`):**
   - When you make a change and go to close the program, it prompts you to **Save Changes & Close**, **Save As...**, **Don't Save**, or **Cancel (Stay Open)**.
   - Or, choose **`On Closing Program (Auto-Save When Exiting)`** under **Tab 5C → Automatic Backup Schedule Frequency** to automatically save to your linked `BowlingLeagueTrackerSave.json` file every time you close the program.
5. **If the file cannot be found on closing** (for example if it was deleted, moved, or not yet created):
   - The window **stays open** instead of closing silently.
   - Choose **Pick New Save Location & Close** to save safely before exiting, **Don't Save** to close immediately, or **Cancel (Stay Open)** to keep working.

---

## 8. Updating the Application

1. Click the blue version button in the top bar (e.g., `v1.0.20 · Updates & Patch Notes`) or **Check for Updates & Patch Notes** in the footer.
2. Click **Check for Updates** to query the latest release manifest (`version.json`).
3. When a newer release is available, click **Update and Restart**.
   - On the installed desktop program (`C:\BowlingLeagueHelper\` on Windows 11 or `~/BowlingLeagueHelper/` on Linux), the updater saves your data, downloads the new version files, overwrites `BowlingLeagueHelper.html` and `version.json` in place, and **replaces the current window in-place** (with zero old windows left open).
   - All league data, rosters, history, and save links stay 100% intact.

