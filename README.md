<div align="center">
  <img src="public/bowling-icon.png" alt="Bowling League Helper Icon" width="112" height="112" />
  <h1>Bowling League Helper</h1>
  <p>
    <strong>An offline-ready Windows desktop &amp; single-file league management suite for bowling secretaries, treasurers, and league coordinators.</strong>
  </p>
  <p>
    <a href="https://github.com/mkstewart88/BowlingLeagueTracker/releases">
      <img src="https://img.shields.io/badge/version-v1.0.14-1d4ed8?style=for-the-badge" alt="Version v1.0.14" />
    </a>
    <img src="https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0f172a?style=for-the-badge" alt="Windows 10 / 11" />
    <img src="https://img.shields.io/badge/offline--first-Zero%20Server%20Required-047857?style=for-the-badge" alt="Offline First" />
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-475569?style=for-the-badge" alt="MIT License" />
    </a>
  </p>
</div>

---

## Table of Contents

- [Quick Installation (Windows)](#quick-installation-windows)
- [Core Modules &amp; Features](#core-modules--features)
- [Data Safety, Dated Backups &amp; Auto-Save on Closing](#data-safety-dated-backups--auto-save-on-closing)
- [Built-In Self-Updater](#built-in-self-updater)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Repository Architecture](#repository-architecture)
- [Building from Source](#building-from-source)
- [Documentation &amp; Community](#documentation--community)
- [License](#license)

---

## Quick Installation (Windows)

**Bowling League Helper** ships with a standalone Windows installer directly in the repository root so no runtime setup, Node.js installation, or manual folder management is required.

1. Download the repository ZIP (**Code → Download ZIP**) or grab the latest release from [**Releases**](https://github.com/mkstewart88/BowlingLeagueTracker/releases).
2. Extract the downloaded `.zip` archive to any temporary location.
3. Open the extracted folder and double-click **`installer.exe`**.
4. The installer automatically copies all program files to **`C:\BowlingLeagueHelper\`**, configures write permissions for in-app self-updates, and creates a **Bowling League Helper** shortcut (with the custom bowling ball &amp; pins icon) on your **Desktop** and **Start Menu**.
5. Delete the downloaded `.zip` and extracted temporary folder—launch **Bowling League Helper** anytime straight from your **Desktop** icon.

> **Browser Cache Independence:** Once installed to `C:\BowlingLeagueHelper\`, the application runs inside its own dedicated Windows host with isolated data storage. Clearing Google Chrome or Microsoft Edge browsing history, cookies, or cache will never delete updates or league data.

---

## Core Modules & Features

Bowling League Helper organizes every weekly night-of-league task into five structured workspaces with dedicated sub-tabs (`1A–1D`, `2A–2D`, `3A–3C`, `4A–4B`, `5A–5C`):

| Workspace | Sub-Tabs | Capabilities |
|---|---|---|
| **1. Quick Score Entry** | `1A` Entry &amp; Roster<br>`1B` Team Recap Grid<br>`1C` Master Roster<br>`1D` League Rules | • Rapid keyboard-driven entry for **3-Game Series** or **Single-Game** leagues (**Handicap** or **Scratch**)<br>• Live **Top 10 Leaderboard**, search/filter/sort, **Missing from Roster** quick-fill &amp; one-click Absent toggle<br>• **30-Step Undo History (`Ctrl+Z`)** + inline Toast **Undo** button<br>• **Team vs. Team Recap Grid** with `7pt`, `8pt`, or custom matchup point rules<br>• Configurable handicap formulas (basis score, %, max cap), absentee rules (Fixed / Avg Minus Pins / % of Avg), team size (`1–5` bowlers), and **USBC ID** roster tracking<br>• **One-Click Finish Week:** Archives results to Season History, exports an Excel-ready `.csv` sheet, and opens the **Landscape Print Standing Sheet** |
| **2. Averages &amp; High Scores** | `2A` Team Performance<br>`2B` Bowler Averages<br>`2C` High Games / Series<br>`2D` Season History | • Weekly team score trend bar charts, season variance (`± pins`), high/low spread, and consistency rankings<br>• Rolling season averages, recalculated handicaps, Honor Roll thresholds, and individual high scratch/handicap series<br>• Reload or manage archived weeks across the season |
| **3. Brackets** | `3A` Active Brackets<br>`3B` Multi-Bracket Manager<br>`3C` Side Pots | • Single and simultaneous **8-Player Knockout Brackets** (Game 1 Quarterfinals → Game 2 Semifinals → Game 3 Finals, Scratch or Handicap)<br>• Automatic champion &amp; runner-up payout calculation<br>• **Strike**, **High Game**, and **Mystery Score** side pot tracking |
| **4. Dues &amp; Treasurer** | `4A` Weekly Dues Ledger<br>`4B` Prize Fund Calculator | • Track Paid / Owing status per bowler, house lineage vs. secretary fees, and weekly arrears<br>• End-of-season prize pool projection and team payout breakdown calculator |
| **5. Schedule &amp; League Hub** | `5A` Multi-League Manager<br>`5B` Lane Schedule<br>`5C` Backups &amp; Restore | • Manage and switch between unlimited active or inactive leagues in a single database<br>• **Round-Robin Lane Schedule Generator** starting on any lane pair plus live **Position Round** pairings<br>• Universal import/export for full multi-league `.json` saves, spreadsheet `.csv` rosters, and portable standalone `.html` copies |

---

## Data Safety, Dated Backups & Auto-Save on Closing

Bowling League Helper protects league records with redundant local persistence, user-directed file backups, and close-time verification:

- **Dated Backup Files:** Click **Save Dated Backup (.json)...** in the footer or Tab `5C` to write a complete multi-league snapshot named with today's date (`BowlingLeagueHelper_Backup_YYYY-MM-DD.json`) into any chosen folder (local drive, Documents, USB drive, or synced cloud folder). That location automatically becomes your active auto-save file.
- **Automatic Save on Closing:** Closing the window (`[X]`) or clicking **Save &amp; Close** automatically writes the latest state to your last used save file before exiting.
- **Missing-File Close Protection:** If your last save file cannot be found (e.g., moved, deleted, disconnected external drive, or not yet configured), the program **cancels closing**, keeps your unsaved data intact on screen, and prompts you to:
  1. **Pick New Save Location &amp; Close** — select a valid folder/file to save and exit cleanly.
  2. **Don't Save** — exit immediately without writing a backup file.
  3. **Cancel (Stay Open)** — abort closing and return to your league data.

---

## Built-In Self-Updater

Click the version button in the top bar (or **Check for Updates &amp; Patch Notes** in the footer) to check GitHub for newer releases and browse full version patch notes:

- Clicking **`Update and Restart`** downloads the latest verified release bundle (`BowlingLeagueHelper.html` and `version.json`), overwrites the program files directly inside **`C:\BowlingLeagueHelper\`**, and restarts the application automatically into the new version.
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
├── installer.exe                        # Prebuilt Windows installer (installs to C:\BowlingLeagueHelper\)
├── BowlingLeagueHelper.html             # Compiled standalone single-file HTML/JS UI bundle
├── version.json                         # Release manifest & patch notes checked by the updater
├── README.md                            # Project overview & quick start
├── CHANGELOG.md                         # Release history (Keep a Changelog format)
├── CONTRIBUTING.md                      # Contribution workflow, coding standards & testing guide
├── SECURITY.md                          # Offline privacy model & vulnerability disclosure policy
├── LICENSE                              # MIT License
├── docs/
│   └── USER_GUIDE.md                    # Complete step-by-step coordinator & treasurer manual
├── desktop/
│   ├── assets/                          # Application icon assets (icon.ico, icon.png)
│   ├── host/                            # Native Win64 C++ host runtime (WebView2 + loopback IPC + close guard)
│   ├── installer/                       # NSIS installer script (installer.nsi)
│   ├── scripts/                         # Cross-platform & Windows installer build scripts
│   ├── vendor/                          # Redistributable WebView2Loader.dll & license notice
│   ├── main.cjs / preload.cjs           # Optional Electron desktop wrapper
│   └── README-Windows.txt               # Bundled Windows setup notes
├── public/                              # Static icons & web template assets
├── src/
│   ├── components/                      # Modular workspace tabs, standing sheets, and modals
│   ├── types/                           # TypeScript domain models
│   └── utils/                           # Scoring engine, updater, backups, desktop bridge & unit tests
└── .github/
    ├── ISSUE_TEMPLATE/                  # Bug report & feature request issue forms
    ├── PULL_REQUEST_TEMPLATE.md         # Pull request verification checklist
    └── workflows/                       # CI build pipeline for installer & release ZIP
```

---

## Building from Source

### Prerequisites

- **Web / UI Bundle:** [Node.js](https://nodejs.org/) `20+` and `npm`
- **Windows Executable &amp; `installer.exe`:**
  - *On Linux / Debian / Ubuntu:* `mingw-w64` (`x86_64-w64-mingw32-g++`, `x86_64-w64-mingw32-windres`) and `nsis` (`makensis`)
  - *On Windows:* MinGW-w64 (`g++`, `windres`) and [NSIS 3.x](https://nsis.sourceforge.io/)

### Commands

```bash
# 1. Install dependencies
npm install

# 2. Run local development server on http://localhost:3000
npm run dev

# 3. Type-check and run deterministic unit tests
npm run lint
npx tsx --test src/utils/bowlingLogic.test.ts

# 4. Build standalone single-file UI bundle (dist/index.html)
npm run build

# 5. Compile Windows desktop host (BowlingLeagueHelper.exe) and regenerate root installer.exe
node desktop/scripts/build-installer.mjs
```

See [`.github/workflows/build-windows-release.yml`](.github/workflows/build-windows-release.yml) for the automated CI build pipeline.

---

## Documentation & Community

- 📖 [**Full User Guide**](docs/USER_GUIDE.md) — Walkthroughs for weekly score entry, handicap formulas, brackets, dues, backups, and upgrades.
- 📋 [**Changelog**](CHANGELOG.md) — Detailed history of features and fixes per version.
- 🤝 [**Contributing Guide**](CONTRIBUTING.md) — Guidelines for local setup, unit testing, and pull requests.
- 🔒 [**Security Policy**](SECURITY.md) — Local-first data architecture details and vulnerability reporting instructions.
- 🐛 [**Report a Bug**](.github/ISSUE_TEMPLATE/bug_report.md) · 💡 [**Request a Feature**](.github/ISSUE_TEMPLATE/feature_request.md)

---

## License

Released under the [**MIT License**](LICENSE).
