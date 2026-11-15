# Changelog

All notable changes to **Bowling League Helper** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), synchronized with `version.json`.

---

## [1.0.22] - 2026-11-15

### Changed
- **Compact Top-Bar Version / Update Button:** Updated the top navigation bar update button so it displays only the version number (`v1.0.22`) when up to date, and switches to `Update Available` whenever a newer version is detected.

---

## [1.0.21] - 2026-11-15

### Added
- **Cross-Port `127.0.0.1` Cookie Vault (`cookieVault.ts`) & Local Disk Auto-Save Cache (`autosave-state.json`):** Persists league state across all localhost ports via chunked RFC 6265 host cookies (`blh_v_0..14`) and `%LOCALAPPDATA%\BowlingLeagueHelper\autosave-state.json` so reopening the program always restores 100% of saved leagues, bowlers, rosters, and scores—even when running an older `BowlingLeagueHelper.exe` that binds to a different random port on each launch.
- **Top-Bar `Open` & `Exit` Buttons:** Added 1-click **Open** (load any `.json` or `.html` save file directly from the top navigation bar) and **Exit** (safely prompt to save unsaved changes before closing) buttons right beside **Save** and **Update**.
- **Weekly High Scores & Achievements Table on Printed Standing Sheet:** Added High Scratch Game, High Scratch Series, High Handicap Game, and High Handicap Series summary table to `PrintStandingSheet.tsx`.

### Changed
- **Print-Ready Active Table in Quick Score Entry (`Step 2C`) & Standing Sheet (`src/index.css`):** Converted `Step 2C: Currently Entered Week Scores` into a structured `<table class="quick-entry-active-table">` and added `@media print` rules in `src/index.css` so active tables in Quick Score Entry and the Standing Sheet print cleanly with crisp borders, repeating table headers, unclipped scroll containers, and hidden action buttons.
- **Embedded State Preservation on `Update and Restart`:** Updating now embeds the current league state directly into `<script id="embedded-league-state">` inside `BowlingLeagueHelper.html` before reloading.

### Fixed
- **Guaranteed Save Prompt on Closing (`Manual Only — Prompt on Close` & `On Closing Program`):** Removed the `!getDesktopBridge()` guard in `window.onbeforeunload` that previously suppressed close prompts inside the Edge `--app` window, and updated close handlers so closing with unsaved changes always prompts to save in both `"Manual Only — Prompt on Close"` and `"On Closing Program"` modes. Also automatically syncs changes to the linked save file when `"On Closing Program"` is active.
- **Fixed Initial Empty State Shadowing Saved Data on Startup:** Replaced `saved || embeddedScript` startup evaluation with `resolveBestInitialState()`, which compares `#embedded-league-state`, the cross-port Cookie Vault, and `localStorage` and always prioritizes populated user data over an empty initial state.

---

## [1.0.20] - 2026-11-15

### Added
- **`"On Closing Program"` Option in Automatic Backup (`Tab 5C`):** Added `"On Closing Program (Auto-Save When Exiting)"` (`'on_close'`) to the Automatic Backup Schedule Frequency selector so users can choose whether closing automatically overwrites `BowlingLeagueTrackerSave.json` or prompts before closing.
- **Unsaved-Changes Prompt on Close:** When a user makes any score, roster, bracket, dues, or rule change (`Save *` indicator in the top bar) and closes the program without `"On Closing Program"` auto-backup enabled, the application prompts to **Save Changes & Close**, **Save As...**, **Don't Save**, or **Cancel (Stay Open)**.
- **Live Team Standings Chart (`Tab 1A`) & Automatic Cross-Tab Population:** Added a live **Team Standings Bar Chart** right beside the **Live Top 10 Individual Leaderboard Bar Chart** in `Tab 1A`, and wired bowler/team entries in `Tab 1` to automatically populate `Tab 1B` (Team vs. Team Recap Grid), `Tab 2` (Season Averages & Handicaps), `Tab 3` (8-Bowler Tournament Brackets), `Tab 4` (Weekly Bowler Dues Checklist), and `Tab 5B` (Round-Robin Lane Schedule).

### Changed
- **Ordered Top-to-Bottom Workflow Across All 5 Tabs:** Reorganized `Tab 1A`, `Tab 2B`, `Tab 3A`, `Tab 4A`, and `Tab 5A–5C` so every screen flows naturally from **Step 1 (Top: Setup Rules & Score Entry)** → **Step 2 (Middle: Active Lists, Entrant Selection & Live Charts)** → **Step 3 (Bottom: Generated Standings, Summary Totals, Finish Week & CSV/PDF Exports)**.
- **Removed GitHub Actions Workflow:** Removed `.github/workflows` so repository pushes never trigger failed Actions runs or consume Actions tokens.

### Fixed
- **In-Place Single-Window `Update and Restart`:** Fixed `POST /api/desktop/install-update` and `UpdateModal.tsx` so clicking **Update and Restart** atomically updates `BowlingLeagueHelper.html` and `version.json` and reloads the existing window in-place (`needsPageReload: true`) instead of spawning a second `BowlingLeagueHelper.exe` / `msedge.exe --app` window that left the old version window open. Added Win32 `EnumWindows` cleanup on `--relaunch-wait` and non-blocking fallback window monitoring so upgrades from older binaries also close the previous window cleanly.

---

## [1.0.19] - 2026-11-15

### Fixed
- **Eliminated `Desktop host request failed (404)` on Quick Save:** Added backward-compatible fallback logic in `desktopBridge.ts` so clicking the top-bar **Save** button works seamlessly even if an older `BowlingLeagueHelper.exe` (`v1.0.14`) is running in `C:\BowlingLeagueHelper\`. When a save file is already linked, it falls back to `/api/desktop/autosave-beacon`; when no save file is linked or found, it displays `"No save file found. Please choose where to save."` and opens the native Save As dialog (`/api/desktop/save-backup`).
- **Guaranteed Automatic Save-File Loading on Startup:** Fixed a startup race condition where the initial empty league state could overwrite `localStorage` and staged desktop memory before `/api/desktop/load-save` finished reading `BowlingLeagueTrackerSave.json`. Injected the linked `BowlingLeagueTrackerSave.json` payload directly into `#embedded-league-state` on initial HTML load and bound the desktop host to a fixed loopback port range (`45820–45829`) so `localStorage` persists across restarts.
- **Automatic Old-Window Closing on `Update and Restart`:** Fixed `UpdateModal.tsx` and the native Windows/Linux hosts so clicking **Update and Restart** suppresses false unload prompts and cleanly closes the older running window (`window.close()` + Win32 `EnumWindows` `WM_CLOSE`) when launching the updated build.
- **Zero Lingering Background Processes on Exit:** Added explicit `ExitProcess(0)` cleanup at the end of `wWinMain` in `desktop/host/main.cpp` so `BowlingLeagueHelper.exe` terminates all background socket/COM threads immediately upon closing.
- **Restored Corrupted Release Manifest & Documentation:** Repaired corrupted `1.0.14–1.0.18` entries in `version.json` and `src/utils/bowlingLogic.ts`, updated `CHANGELOG.md`, `README.md`, `docs/USER_GUIDE.md`, and `desktop/README-Windows.txt`, and wired `npm run build` to automatically rebuild `BowlingLeagueHelper.exe`, `installer.exe`, and all standalone HTML/version bundles.

---

## [1.0.18] - 2026-11-14

### Changed
- Refined the desktop quick-save workflow to prompt for a destination file whenever no existing save file is linked yet.

---

## [1.0.17] - 2026-11-14

### Changed
- Updated the desktop **Update and Restart** process to close the previous window when spawning the newly updated application instance.

---

## [1.0.16] - 2026-11-14

### Changed
- Updated the top-bar **Save** button so that when no save file is linked or found on disk, the app notifies the user (`"No save file found. Please choose where to save."`) and opens the Save As file picker instead of reporting an error.

---

## [1.0.15] - 2026-11-14

### Added
- **Top-Bar Quick Save Button:** Added a dedicated green **Save** button directly beside the **Update** button in the top navigation bar for 1-click saving to `BowlingLeagueTrackerSave.json`.
- **Automatic Save-File Loading on Startup:** Added `/api/desktop/load-save` so the desktop application automatically loads the user's linked `BowlingLeagueTrackerSave.json` file when launched.

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
