# Changelog

All notable changes to **Bowling League Helper** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), synchronized with `version.json`.

---

## [1.0.14] - 2026-11-14

### Added
- **Windows 11 Native Desktop App & Installer (`installer.exe`):** Installs `BowlingLeagueHelper.exe` and support files directly into `C:\BowlingLeagueHelper\` with a custom bowling ball & pins Desktop shortcut inside a single clean window.
- **Linux Desktop Support & Installer (`install-linux.sh` + `linux-host.mjs`):** Installs the isolated Linux desktop runtime into `~/BowlingLeagueHelper/` with Desktop and Application Menu shortcuts.
- **Week Notes (`Tab 1A`):** Added an editable Week Notes card for documenting tournament details or special league events—saved with each archived week (`Tab 2D`), cleared on New Week, and printed on standing sheets.
- **Print to PDF (`Tab 1A`):** Added a dedicated **Print to PDF** action using the formatted landscape standing sheet (`PrintStandingSheet`) with clean file naming and exact print color rendering.
- Custom multi-resolution bowling ball & pins application icon (`.ico` and `.png`).
- Persistent full-league save workflow (`BowlingLeagueTrackerSave.json` with no date suffix) that keeps writing to your last chosen save file on every close unless you click **Save New File (.json)...** to choose a new file.
- Automatic save-on-closing verification: closing automatically saves to the last used save file (including large multi-league payloads), or pauses closing and prompts (**Pick New Save Location & Close**, **Don't Save**, or **Cancel (Stay Open)**) if that file cannot be located.
- Professional GitHub documentation suite (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `docs/USER_GUIDE.md`, and issue/PR templates).

### Changed
- **Update and Restart** in desktop mode overwrites `BowlingLeagueHelper.html` and `version.json` directly inside the installation directory (`C:\BowlingLeagueHelper\` on Windows 11 or `~/BowlingLeagueHelper/` on Linux) and restarts cleanly without reliance on browser cache.
- Streamlined in-app Update modal, Tab `5C`, and app footer copy/buttons to reflect the installed desktop workflow (removed redundant standalone HTML / `.exe` download buttons while keeping **Open GitHub Repository**).
- Cross-platform (`mingw-w64` + `makensis`) and GitHub Actions CI build pipeline configured to output `installer.exe` directly to repository root.

---

## [1.0.13] - 2026-11-14

### Added
- Persistent IndexedDB runtime bundle storage enabling zero-prompt **Update and Restart** inside standalone HTML mode.
- Standardized program bundle filename (`BowlingLeagueHelper.html`) across repository builds, web hosting, and backup exports.

---

## [1.0.12] - 2026-11-14

### Changed
- Simplified update button text to **Update and Restart** and removed version numbers from downloaded HTML filenames.
- Persisted File System Access handles across sessions for direct file replacement.

---

## [1.0.11] - 2026-11-14

### Changed
- Replaced separate live-update path with direct HTML file replacement + reload workflow.
- Added pre-filled filename detection and detailed GitHub HTTP diagnostic errors (`404` / rate-limit / network feedback).

---

## [1.0.10] - 2026-11-14

### Changed
- Upgraded visual framing across all 5 workspaces (`Tabs 1–5`) with 2px borders, color-tinted header bands, and high-contrast dark sub-tab navigation bars.
- Split League Rules (`Tab 1D`) into four dedicated framed cards.

---

## [1.0.09] - 2026-11-14

### Added
- Inline **Undo** button inside toast notifications and right beside score entry and entered-bowler lists.
- Consolidated officers and birthdays management into the Master Roster workflow.

---

## [1.0.08] - 2026-11-14

### Added
- **Team Performance & Consistency** bar chart and variance analyzer (`Tab 2A`).
- Focused sub-tab navigation across all five workspaces (`1A–1D`, `2A–2D`, `3A–3C`, `4A–4B`, `5A–5C`).
- League-agnostic configuration options (team sizes `1–5`, absentee scoring formulas, handicap caps, custom match point rules, Mystery Score & High-Game side pots, and Prize Fund Calculator).
- Confirmation modal before deleting any league, roster member, or archived week.

---

## [1.0.07] - 2026-11-12

### Added
- **Multi-League Hub** (`Tab 5A`) to manage multiple leagues in a single database.
- Automatic backup scheduler (`Tab 5C`) and universal `.json` / `.html` import parser.

---

## [1.0.06] - 2026-11-10

### Added
- Unified fast-keyboard score entry with 30-step Undo stack (`Ctrl+Z`), Treasurer Dues Ledger, and Round-Robin Lane Schedule Generator.

---

## [1.0.05] - 2026-10-18

### Added
- Top 10 Live Bar Chart leaderboard, substitute player flag, and Season History archiving.

---

## [1.0.01] - 2026-09-25

### Added
- Initial **Bowling League Helper** foundation with 3-game/single-game scoring, handicap computation, landscape print standing sheets, and CSV exports.
