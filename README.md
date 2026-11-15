<div align="center">
  <img src="public/bowling-icon.png" alt="Bowling League Helper Icon" width="112" height="112" />
  <h1>Bowling League Helper</h1>
  <p>
    <strong>An offline-ready Windows 11 &amp; Linux desktop application for bowling league secretaries, treasurers, and league coordinators.</strong>
  </p>
  <p>
    <a href="CHANGELOG.md">
      <img src="https://img.shields.io/badge/version-v1.0.22-1d4ed8?style=for-the-badge" alt="Version v1.0.22" />
    </a>
    <img src="https://img.shields.io/badge/platform-Windows%2011%20%7C%20Linux-0f172a?style=for-the-badge" alt="Supported Platforms: Windows 11 and Linux" />
    <img src="https://img.shields.io/badge/offline--first-Zero%20Server%20Required-047857?style=for-the-badge" alt="Offline First" />
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-475569?style=for-the-badge" alt="MIT License" />
    </a>
  </p>
</div>

---

## Table of Contents

- [Quick Installation (Windows 11 &amp; Linux)](#quick-installation-windows-11--linux)
- [Core Modules &amp; Features](#core-modules--features)
- [Data Safety, Persistent Save File &amp; Auto-Save on Closing](#data-safety-persistent-save-file--auto-save-on-closing)
- [Built-In Self-Updater](#built-in-self-updater)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Repository Architecture](#repository-architecture)
- [Building from Source](#building-from-source)
- [Documentation &amp; Community](#documentation--community)
- [License](#license)

---

## Quick Installation (Windows 11 & Linux)

**Bowling League Helper** ships with ready-to-run installers directly inside this repository (`installer.exe` for Windows 11 and `install-linux.sh` for Linux) so no manual compilation is needed.

### Windows 11
1. Click [**installer.exe**](https://github.com/mkstewart88/BowlingLeagueTracker/raw/main/installer.exe) directly, or download the full repository ZIP (**Code → Download ZIP**) and extract it anywhere.
2. Double-click **`installer.exe`** in the root folder.
3. The installer copies all required program files to **`C:\BowlingLeagueHelper\`**, grants update write permissions, and places a **Bowling League Helper** shortcut (with the custom bowling ball &amp; pins icon) on your **Desktop** and **Start Menu**.
4. Delete the downloaded `.zip` and extracted folder—launch **Bowling League Helper** anytime from your Desktop icon.

### Linux (Desktop & App Mode)
*Requires Node.js 20+ installed.*
1. Download the repository ZIP (**Code → Download ZIP**), or clone it:
   ```bash
   git clone https://github.com/mkstewart88/BowlingLeagueTracker.git
   cd BowlingLeagueTracker
   ```
2. Run the Linux installer from the extracted folder:
   ```bash
   chmod +x install-linux.sh
   ./install-linux.sh
   ```
3. The installer copies the application files into **`~/BowlingLeagueHelper/`**, sets up `bowling-league-helper` in `~/.local/bin`, and creates a **Bowling League Helper** Desktop &amp; Application Menu launcher with the custom icon (`bowling-icon.png`).
4. You may delete the downloaded ZIP/extracted folder afterward and launch **Bowling League Helper** from your Desktop/Application Menu (or run `bowling-league-helper`).

> **Browser Cache Independence:** On both **Windows 11** (`C:\BowlingLeagueHelper\`) and **Linux** (`~/BowlingLeagueHelper/`), the application runs through its dedicated desktop host with isolated storage outside your regular web browser. Clearing Google Chrome, Microsoft Edge, or Chromium browsing history, cookies, or cache will never remove updates or saved league data.

---

## Core Modules & Features

Bowling League Helper organizes every weekly night-of-league task into five structured workspaces with dedicated sub-tabs (`1A–1D`, `2A–2D`, `3A–3C`, `4A–4B`, `5A–5C`), ordered naturally from **Top (Step 1: Setup &amp; Inputs)** → **Middle (Step 2: Active Lists &amp; Live Charts)** → **Bottom (Step 3: Generated Standings &amp; Exports)**, with scores entered in Tab 1 automatically populating all downstream modules:

| Workspace | Sub-Tabs | Capabilities |
|---|---|---|
| **1. Quick Score Entry** | `1A` Entry &amp; Live Charts<br>`1B` Team Recap Grid<br>`1C` Master Roster<br>`1D` League Rules | • Rapid keyboard-driven entry for **3-Game Series** or **Single-Game** leagues (**Handicap** or **Scratch**)<br>• Live **Top 10 Individual Leaderboard Chart** + **Live Team Standings Bar Chart**, search/filter/sort, **Missing from Roster** quick-fill &amp; one-click Absent toggle<br>• **Automatic Cross-Tab Sync:** Bowlers and teams entered in `1A` automatically populate `1B` Recap Grid, `Tab 2` Averages, `Tab 3` Brackets, `Tab 4` Dues, and `Tab 5B` Lane Schedules<br>• **Week Notes** card for recording tournament details, lane conditions, or special league events (archived weekly &amp; printed on standing sheets)<br>• **30-Step Undo History (`Ctrl+Z`)** + inline Toast **Undo** button<br>• **Team vs. Team Recap Grid** with `7pt`, `8pt`, or custom matchup point rules<br>• Configurable handicap formulas (basis score, %, max cap), absentee rules (Fixed / Avg Minus Pins / % of Avg), team size (`1–5` bowlers), and **USBC ID** roster tracking<br>• **One-Click Finish Week, Print &amp; PDF:** Archives results + Week Notes to Season History, exports an Excel-ready `.csv` sheet, and generates a formatted landscape **Print to PDF** / **Print Standing Sheet** |
| **2. Averages &amp; High Scores** | `2A` Team Performance<br>`2B` Bowler Averages<br>`2C` High Games / Series<br>`2D` Season History | • Weekly team score trend bar charts, season variance (`± pins`), high/low spread, and consistency rankings<br>• Rolling season averages, recalculated handicaps, Honor Roll thresholds, and individual high scratch/handicap series<br>• Reload or manage archived weeks (including saved **Week Notes**) across the season |
| **3. Brackets** | `3A` Active Brackets<br>`3B` Multi-Bracket Manager<br>`3C` Side Pots | • Single and simultaneous **8-Player Knockout Brackets** (Game 1 Quarterfinals → Game 2 Semifinals → Game 3 Finals, Scratch or Handicap)<br>• Automatic champion &amp; runner-up payout calculation<br>• **Strike**, **High Game**, and **Mystery Score** side pot tracking |
| **4. Dues &amp; Treasurer** | `4A` Weekly Dues Ledger<br>`4B` Prize Fund Calculator | • Track Paid / Owing status per bowler, house lineage vs. secretary fees, and weekly arrears<br>• End-of-season prize pool projection and team payout breakdown calculator |
| **5. Schedule &amp; League Hub** | `5A` Multi-League Manager<br>`5B` Lane Schedule<br>`5C` Backups &amp; Restore | • Manage and switch between unlimited active or inactive leagues in a single database<br>• **Round-Robin Lane Schedule Generator** starting on any lane pair plus live **Position Round** pairings<br>• Universal import/export for full multi-league `.json` saves, spreadsheet `.csv` rosters, and configurable **Automatic Backup** schedules including **On Closing Program** |

---

## Data Safety, Persistent Save File & Auto-Save on Closing

Bowling League Helper protects league records across **Windows 11** and **Linux** with redundant local persistence, 1-click top-bar saves, automatic startup loading, and close-time verification:

- **Top-Bar `Save` Button & Missing-File Fallback:** Click the green **Save** button next to the version/update button in the top bar anytime to overwrite your linked `BowlingLeagueTrackerSave.json` file in one click (shows `Save *` whenever you have unsaved edits). If no save file is linked or found yet, the app displays *"No save file found. Please choose where to save."* and opens the system Save As dialog so you can pick where to save `BowlingLeagueTrackerSave.json`.
- **Automatic Save-File Load on Startup:** Whenever you launch **Bowling League Helper**, it automatically opens and restores your linked `BowlingLeagueTrackerSave.json` file (all leagues, rosters, scores, Week Notes, dues, brackets, and season history).
- **Persistent Save File (`BowlingLeagueTrackerSave.json`):** You can also click **Save New File (.json)...** in the footer or Tab `5C` at any time to choose a new folder or filename. That file stays linked and continues to be updated on Save.
- **Unsaved-Changes Close Prompt & `"On Closing Program"` Auto-Backup (`Tab 5C`):**
  - If you make a change and close the program, it prompts you to **Save Changes &amp; Close**, **Save As...**, **Don't Save**, or **Cancel (Stay Open)** so you never lose edits by accident.
  - Or, select **`On Closing Program (Auto-Save When Exiting)`** in **Tab 5C → Automatic Backup Schedule Frequency** to automatically save to your linked `BowlingLeagueTrackerSave.json` file every time you exit without being prompted.
- **Missing-File Close Protection:** If your last save file cannot be found when closing (e.g., moved, deleted, disconnected drive, or not yet configured), the program **cancels closing**, keeps your data intact on screen, and prompts you to:
  1. **Pick New Save Location &amp; Close** — select a valid folder/file to save and exit cleanly.
  2. **Don't Save** — exit immediately without writing a backup file.
  3. **Cancel (Stay Open)** — abort closing and return to your league data.

---

## Built-In Self-Updater

Click the version button in the top bar (or **Check for Updates &amp; Patch Notes** in the footer) to check this GitHub repository for newer versions and browse full patch notes:

- Clicking **`Update and Restart`** saves your current league state, downloads the latest verified release bundle (`BowlingLeagueHelper.html` and `version.json`), overwrites the program files directly inside your installation directory (**`C:\BowlingLeagueHelper\`** on Windows 11 or **`~/BowlingLeagueHelper/`** on Linux), **automatically closes the old running program window**, and launches the updated version.
- All scores, rosters, schedules, financial records, and archived weeks remain preserved across updates.

---

## Keyboard Shortcuts

| Shortcut / Key | Action |
|---|---|
| `Enter` | Advance through score entry fields and submit bowler scores |
| `Ctrl + Z` | Undo last score edit, deletion, absent toggle, or roster change (up to 30 steps) |
| `Ctrl + P` | Open Landscape Print Standing Sheet view |

---

## Repository Architecture

```text
.
├── installer.exe                        # Windows 11 installer (installs to C:\BowlingLeagueHelper\)
├── install-linux.sh                     # Linux installer (installs to ~/BowlingLeagueHelper/)
├── BowlingLeagueHelper.html             # Compiled standalone single-file HTML/JS UI bundle
├── version.json                         # Release manifest & patch notes checked by the auto-updater
├── README.md                            # Project overview & quick start
├── CHANGELOG.md                         # Release history (Keep a Changelog format)
├── CONTRIBUTING.md                      # Contribution workflow, coding standards & testing guide
├── SECURITY.md                          # Offline privacy model & vulnerability disclosure policy
├── LICENSE                              # MIT License
├── docs/
│   └── USER_GUIDE.md                    # Complete step-by-step coordinator & treasurer manual
├── desktop/
│   ├── assets/                          # Application icon assets (icon.ico, icon.png)
│   ├── host/                            # Desktop hosts: Windows 11 Win32/WebView2 (main.cpp) & Linux Node host (linux-host.mjs)
│   ├── installer/                       # NSIS Windows installer script (installer.nsi)
│   ├── scripts/                         # Build scripts for Windows 11 & Linux installer packaging
│   ├── vendor/                          # Redistributable WebView2Loader.dll & license notice
│   └── README-Windows.txt               # Windows 11 setup quick reference
├── public/                              # Static icons & web template assets
├── src/
│   ├── components/                      # Modular workspace tabs, standing sheets, and modals
│   ├── types/                           # TypeScript domain models
│   └── utils/                           # Scoring engine, updater, backups, desktop bridge & unit tests
└── .github/
    ├── ISSUE_TEMPLATE/                  # Bug report & feature request issue forms
    └── PULL_REQUEST_TEMPLATE.md         # Pull request verification checklist
```

---

## Building from Source

Both **Windows 11** and **Linux** can build the web bundle, run tests, and regenerate desktop packages cleanly from source:

### Prerequisites

- **Core App & Linux Host:** [Node.js](https://nodejs.org/) `20+` and `npm`
- **Rebuilding Windows 11 `installer.exe` (optional):**
  - *On Windows 11:* MinGW-w64 (`g++`, `windres`) and [NSIS 3.x](https://nsis.sourceforge.io/)
  - *Cross-compiling from Linux:* `mingw-w64` (`x86_64-w64-mingw32-g++`, `x86_64-w64-mingw32-windres`) and `nsis` (`makensis`)

### Commands (Windows 11 & Linux)

```bash
# 1. Install dependencies
npm install

# 2. Run local development server on http://localhost:3000
npm run dev

# 3. Type-check and run unit tests
npm run lint
npx tsx --test src/utils/bowlingLogic.test.ts

# 4. Build standalone single-file UI bundle (dist/index.html)
npm run build

# 5. Build native Windows 11 executable (BowlingLeagueHelper.exe) and regenerate root installer.exe
node desktop/scripts/build-installer.mjs
```

---

## Documentation & Community

- 📖 [**Full User Guide**](docs/USER_GUIDE.md) — Walkthroughs for Windows 11 & Linux setup, score entry, handicap formulas, brackets, dues, backups, and upgrades.
- 📋 [**Changelog**](CHANGELOG.md) — Detailed history of features and fixes per version.
- 🤝 [**Contributing Guide**](CONTRIBUTING.md) — Guidelines for local setup, unit testing, and pull requests.
- 🔒 [**Security Policy**](SECURITY.md) — Local-first data architecture details and vulnerability reporting instructions.
- 🐛 [**Report a Bug**](.github/ISSUE_TEMPLATE/bug_report.md) · 💡 [**Request a Feature**](.github/ISSUE_TEMPLATE/feature_request.md)

---

## License

Released under the [**MIT License**](LICENSE).
