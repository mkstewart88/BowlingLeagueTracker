import {
  AppState,
  ArchivedWeek,
  BowlerEntry,
  EightPlayerBracket,
  BracketMatchNode,
  LaneMatchup,
  LeagueSettings,
  PatchRelease,
  RosterPlayer,
  WeeklyDuesRecord,
} from '../types/bowling';

export const CURRENT_APP_VERSION = '1.0.14';
export const LATEST_AVAILABLE_VERSION = '1.0.14';

export const DEFAULT_SETTINGS: LeagueSettings = {
  leagueId: 'my-bowling-league',
  leagueStatus: 'active',
  leagueName: 'My Bowling League',
  seasonName: '2026-2027 Season',
  weekNumber: '1',
  totalWeeks: 31,
  bowlersPerTeam: 4,
  customCsvName: '',
  formatMode: 'individual',
  entryMode: 'three',
  scoringType: 'handicap',
  absentRuleType: 'fixed',
  absentScore: 150,
  absentPenaltyPins: 10,
  absentPercent: 90,
  vacantScore: 150,
  maxGameScore: 300,
  showAbsent: 'yes',
  highlightFirst: 'yes',
  showTeamSummary: 'yes',
  topNote: '',
  bottomNote: '',
  handicapBasis: 220,
  handicapPercent: 90,
  maxHandicapPerGame: 0,
  autoCalculateHandicap: 'yes',
  pointSystem: '7pt',
  customPointsPerGame: 2,
  customPointsPerSeries: 1,
  weeklyDuesPerBowler: 22,
  lineageCostPerBowler: 12,
  secretaryFeePerBowler: 1,
  startingLane: 1,
  bracketEntryFee: 5,
  bracketFirstPlacePayout: 25,
  bracketSecondPlacePayout: 10,
  sidePotEntryFee: 5,
  honorGameThreshold: 215,
  honorSeriesThreshold: 625,
  autoBackupEnabled: true,
  autoBackupInterval: 'on_finish_week',
  autoBackupFormat: 'json',
  autoBackupDirectoryLabel: '',
  lastLocalBackupAt: null,
  lastAutoBackupAt: null,
  githubRepo: 'mkstewart88/BowlingLeagueTracker',
  githubBranch: 'main',
  lastGithubUpdateCheckAt: null,
};

export const PATCH_NOTES_HISTORY: PatchRelease[] = [
  {
    version: '1.0.14',
    date: 'November 14, 2026',
    title: 'Desktop Program (Windows 11 & Linux), Auto-Save on Close, Week Notes & Print to PDF',
    isLatest: true,
    highlights: [
      'Desktop Program & Installer (Windows 11 installer.exe + Linux installer): Installs to C:\\BowlingLeagueHelper\\ on Windows 11 or ~/BowlingLeagueHelper/ on Linux with a custom Bowling Ball & Pins desktop icon.',
      'Auto-Save on Closing (BowlingLeagueTrackerSave.json): Launches cleanly as a single window and automatically updates BowlingLeagueTrackerSave.json on close—or pauses with a Save / Don\'t Save prompt if no save file is found.',
      'Week Notes & Print to PDF (Tab 1A): Document tournament details or special league events in Quick Entry Week Notes (saved inside each weekly archive), and export formatted landscape Standing Sheet PDFs directly via Print to PDF.',
    ],
    changes: [
      {
        category: 'New Feature',
        description:
          'Added Week Notes section in Quick Entry (saved with each Weekly Archive and shown in Season History) plus a dedicated Print to PDF button backed by the landscape Standing Sheet report.',
      },
      {
        category: 'Data & Backup',
        description:
          'Standardized persistent save files to BowlingLeagueTrackerSave.json with automatic save-on-close protection and a recovery modal when the save file is missing or not yet selected.',
      },
      {
        category: 'Improvement',
        description:
          'In-app updater installs releases directly into your program directory (C:\\BowlingLeagueHelper\\ on Windows 11), and outdated single-file HTML download buttons were removed from Update & Patch Notes.',
      },
    ],
  },
  {
    version: '1.0.13',
    date: 'November 14, 2026',
    title: 'Zero-Prompt Automatic Self-Updater & Unified BowlingLeagueHelper.html',
    isLatest: false,
    highlights: [
      'True 1-Click "Update and Restart" (Zero File Pickers): Clicking Update and Restart downloads the new release directly into persistent app storage and automatically restarts into the new version—no choosing files or save locations required.',
      'Unified Filename Everywhere: Uses BowlingLeagueHelper.html consistently on GitHub, AI Studio web downloads, and inside the app footer and backup hub.',
      '100% League Data Preserved: Scores, teams, rosters, brackets, dues, and season histories automatically stay intact across every update and restart.',
    ],
    changes: [
      {
        category: 'New Feature',
        description:
          'Added persistent IndexedDB runtime self-updating so BowlingLeagueHelper.html installs newer GitHub releases and boots directly into the new version on reload with zero save dialogs.',
      },
      {
        category: 'Data & Backup',
        description:
          'Standardized desktop bundle filename to BowlingLeagueHelper.html across GitHub releases, AI Studio hosting, Tab 5C backups, and app footer downloads.',
      },
      {
        category: 'Improvement',
        description:
          'Kept optional Download BowlingLeagueHelper.html copy action available without interrupting the 1-click Update and Restart experience.',
      },
    ],
  },
  {
    version: '1.0.12',
    date: 'November 14, 2026',
    title: 'Clean "Update and Restart" Button, Version-Free Filename & Remembered File Location',
    isLatest: false,
    highlights: [
      'Clean "Update and Restart" Button: Simplified the update action button to read simply "Update and Restart" with zero version clutter.',
      'Consistent "Bowling League Helper.html" Filename: Removed version numbers from the saved desktop file name so restarting launches the exact same file name cleanly.',
      'Remembered Save Location Across Restarts: Persists your granted file handle in browser IndexedDB so once linked, future updates overwrite "Bowling League Helper.html" in place without prompting for a folder again.',
    ],
    changes: [
      {
        category: 'Improvement',
        description:
          'Changed the primary updater action label to "Update and Restart" and removed version tags from default saved .html filenames.',
      },
      {
        category: 'Data & Backup',
        description:
          'Added persistent IndexedDB FileSystemFileHandle storage with readwrite permission reuse so subsequent updates overwrite your existing "Bowling League Helper.html" directly at its launch location.',
      },
      {
        category: 'Improvement',
        description:
          'Normalized default single-file program downloads and saves to "Bowling League Helper.html" across the updater and backup hub.',
      },
    ],
  },
  {
    version: '1.0.11',
    date: 'November 14, 2026',
    title: 'Direct Overwrite & Auto-Restart Updater + GitHub Diagnostics',
    isLatest: false,
    highlights: [
      'Direct HTML File Overwrite & Automatic Restart: Removed the confusing in-memory "Update Live App" button. Updating now downloads the new build, preserves 100% of your league data, overwrites your opened HTML file, and restarts directly into the new version.',
      'Pre-Filled Active Filename: Automatically detects the exact .html filename you opened so saving overwrites your existing desktop file cleanly instead of creating duplicate copies.',
      'Honest GitHub Update Diagnostics: Clearly reports HTTP 404 (Private repository / missing version.json) or network errors when checking for updates instead of silently showing the old version.',
    ],
    changes: [
      {
        category: 'Improvement',
        description:
          'Removed the in-memory Update Live App button; updates now require overwriting/saving the actual single-HTML program file and automatically restart the app upon overwrite.',
      },
      {
        category: 'Data & Backup',
        description:
          'Updater now pre-selects your currently opened HTML filename and uses the GitHub API raw endpoint first to avoid CDN cache lag on newly pushed releases.',
      },
      {
        category: 'Improvement',
        description:
          'Fixed installed version tracking to always reflect the compiled HTML file running in your browser and added clear error messages if GitHub returns 404.',
      },
    ],
  },
  {
    version: '1.0.10',
    date: 'November 14, 2026',
    title: 'Clear Framed Section Borders & Color-Coded Headers Across All 5 Tabs',
    isLatest: false,
    highlights: [
      'Distinct Framed Section Borders Across Every Tab: Upgraded every section container across Tabs 1–5 with crisp 2px borders, elevated frame contrast, and color-tinted header bands so each section stands out at a glance.',
      'Color-Coded Section Headers & Rule Groups: Separated League Rules (Tab 1D), Team Performance & Averages (Tab 2), Brackets & Side Pots (Tab 3), Dues & Prize Fund (Tab 4), and Multi-League & Backups (Tab 5) into individually framed panels.',
      'High-Contrast Dark Sub-Tab Bar: Added a dark slate sub-tab navigation bar at the top of each workspace to clearly anchor sub-sections above the framed content panels.',
    ],
    changes: [
      {
        category: 'Improvement',
        description:
          'Added 2px structural borders and color-tinted top header bands (Blue, Emerald, Amber, Slate) to every frame across all 5 tabs for instant visual separation.',
      },
      {
        category: 'Improvement',
        description:
          'Split League Rules & Sheet Options (Tab 1D) into 4 individually framed cards with distinct colored headers instead of a single combined box.',
      },
      {
        category: 'Improvement',
        description:
          'Upgraded sub-tab bars and KPI metric cards with distinct borders and surface tints so every frame is easy to distinguish.',
      },
    ],
  },
  {
    version: '1.0.09',
    date: 'November 14, 2026',
    title: 'Natural Instant Undo, Streamlined Non-Duplicated Tabs & Automatic Update Sync',
    highlights: [
      'Natural Undo Placement & Toast Undo Button: Added an instant "Undo" button right inside the bottom notification banner AND directly above the Currently Entered bowler list and Score Entry form.',
      'Eliminated Duplicate Controls & Legacy Comparison Clutter: Removed the V1/V2 comparison view, consolidated League Officers & Birthdays into the Master Roster tab, and kept all Backup/Download actions cleanly in Tab 5C.',
      'Seamless Single-File Updater: Downloaded .html files now automatically stamp the latest version so a freshly downloaded latest build never falsely asks for an update.',
    ],
    changes: [
      {
        category: 'Improvement',
        description:
          'Moved Undo Last Action right next to Score Entry and Currently Entered lists, plus added an inline [Undo] button inside toast notifications.',
      },
      {
        category: 'Improvement',
        description:
          'Removed V1 vs V2 comparison clutter from Tab 5 and eliminated duplicate backup/download buttons from Tab 1.',
      },
      {
        category: 'Data & Backup',
        description:
          'Streamlined single-file updater to check for the latest release automatically in the background with a direct GitHub icon link.',
      },
    ],
  },
  {
    version: '1.0.08',
    date: 'November 14, 2026',
    title: 'Team Performance Bar Charts, Clean Sub-Tab Workspace, League-Agnostic Rules & Delete Protection',
    highlights: [
      'New Team Performance & Consistency Section (Tab 2A): Displays a bar chart of total team scores per week across the season to identify the most consistent teams.',
      'Reorganized all 5 primary tabs into clean, focused Sub-Tabs so score entry, recap grids, rosters, league rules, charts, side pots, prize funds, and backups never clutter a single page.',
      'League-Agnostic Customization (BLS 2026 Parity): Configurable Bowlers Per Team (1–5), Absentee Rules (Fixed vs. Avg Minus Penalty Pins vs. % of Avg), Max Handicap Cap, Custom Match Points, Mystery Score & High-Game Side Pots, and End-of-Season Prize Fund Calculator.',
      'Added Mandatory "Are You Sure?" Confirmation Modal before deleting any league, roster bowler, or archived week.',
    ],
    changes: [
      {
        category: 'New Feature',
        description:
          'Team Performance Weekly Bar Chart & Consistency Analyzer: Visualizes total team scores per week against season weekly averages with variance (± pins), high/low spread, and CSV export.',
      },
      {
        category: 'Improvement',
        description:
          'Dedicated Sub-Tab Bars inside all 5 main tabs (1A–1D, 2A–2D, 3A–3C, 4A–4B, 5A–5D) for easy reading and zero screen clutter.',
      },
      {
        category: 'Data & Backup',
        description:
          'Added "Are you sure you want to delete this league?" confirmation popup modal so leagues cannot be accidentally deleted with a single click.',
      },
      {
        category: 'League Rules',
        description:
          'Removed center/league assumptions: customize team size (1–5), absent score calculation formula, handicap caps, custom match point values, and honor roll thresholds.',
      },
    ],
  },
  {
    version: '1.0.07',
    date: 'November 12, 2026',
    title: 'Multi-League Database Manager, Auto-Backup Scheduler & Single-File HTML Fix',
    highlights: [
      'Added Multi-League Database Manager to run and switch between unlimited leagues inside one program.',
      'Added Automatic Backup Scheduler & 1-click Universal Import from a single .json or .html file.',
    ],
    changes: [
      {
        category: 'New Feature',
        description:
          'Multi-League Switcher & Master Bowler Database metrics (active/inactive bowlers, cross-league duplicates, and backup status).',
      },
      {
        category: 'Data & Backup',
        description:
          'Fixed standalone .html export escaping so pre-compiled single-file desktop builds open cleanly in any browser.',
      },
    ],
  },
  {
    version: '1.0.06',
    date: 'November 10, 2026',
    title: 'Unified Score Entry, Treasurer Ledger & Multi-Tab Foundation',
    highlights: [
      'Combined the clean rapid keyboard entry of Version 1 with the live standings and 30-step Undo Stack (Ctrl+Z) of Version 2.',
      'Added Treasurer Dues, Lineage & Prize Fund Ledger and Round-Robin Lane Schedule Generator.',
    ],
    changes: [
      {
        category: 'Improvement',
        description:
          'Fast Enter-key score entry workflow with automatic roster lookup and team completion.',
      },
      {
        category: 'Data & Backup',
        description:
          'Single-File HTML Self-Updater and backwards-compatible migration from legacy storage keys.',
      },
    ],
  },
  {
    version: '1.0.05',
    date: 'October 18, 2026',
    title: 'Thursday Night Rollers Live Leaderboard Edition',
    highlights: [
      'Added Top 10 Live Bar Chart leaderboard and responsive mobile layout.',
      'Added Season History archiving and previous week reloading.',
    ],
    changes: [
      {
        category: 'New Feature',
        description: 'Added visual bar chart for current week high scores.',
      },
      {
        category: 'Improvement',
        description: 'Added Substitute player checkbox so subs do not clutter the master roster.',
      },
    ],
  },
  {
    version: '1.0.01',
    date: 'September 25, 2026',
    title: 'Original Bowling League Helper Base',
    highlights: [
      'Core score entry for Single Game or 3-Game Series (Scratch & Handicap).',
      'Landscape Printout Standing Sheet & Automatic CSV Spreadsheet Export.',
    ],
    changes: [
      {
        category: 'New Feature',
        description: 'Side-by-side Currently Entered and Missing from Roster lists.',
      },
    ],
  },
];

/**
 * Pure function: Calculates a bowler's single-game and series handicap
 * using standard USBC / league formula: floor((Basis - Average) * (Percent / 100))
 * with optional maximum handicap per game cap.
 */
export function calculateBowlerHandicap(
  average: number,
  basis: number,
  percent: number,
  entryMode: 'single' | 'three',
  maxPerGameCap = 0
): { perGame: number; totalHandicap: number } {
  if (!Number.isFinite(average) || average <= 0 || average >= basis) {
    return { perGame: 0, totalHandicap: 0 };
  }
  const rawDiff = basis - average;
  let perGame = Math.max(0, Math.floor(rawDiff * (percent / 100) + 1e-9));
  if (maxPerGameCap > 0) {
    perGame = Math.min(perGame, maxPerGameCap);
  }
  const multiplier = entryMode === 'three' ? 3 : 1;
  return {
    perGame,
    totalHandicap: perGame * multiplier,
  };
}

/**
 * Pure function: Calculates a bowler's per-game absent score based on the league's configured rule
 * ('fixed' e.g. 150, 'avg_minus_pins' e.g. Book Avg - 10, or 'avg_percent' e.g. 90% of Book Avg).
 */
export function computeBowlerAbsentScore(
  bookAverage: number | undefined,
  settings: LeagueSettings
): { perGame: number; totalSeries: number; ruleDescription: string } {
  const rule = settings.absentRuleType || 'fixed';
  const fallbackFixed = settings.absentScore ?? 150;
  const avg = bookAverage && bookAverage > 0 ? bookAverage : fallbackFixed;
  let perGame = fallbackFixed;
  let ruleDescription = `Fixed ${fallbackFixed}/gm`;

  if (rule === 'avg_minus_pins') {
    const penalty = settings.absentPenaltyPins ?? 10;
    perGame = Math.max(0, avg - penalty);
    ruleDescription = `Avg (${avg}) - ${penalty} = ${perGame}/gm`;
  } else if (rule === 'avg_percent') {
    const pct = settings.absentPercent ?? 90;
    perGame = Math.max(0, Math.floor(avg * (pct / 100)));
    ruleDescription = `${pct}% of Avg (${avg}) = ${perGame}/gm`;
  }

  const multiplier = settings.entryMode === 'three' ? 3 : 1;
  return {
    perGame,
    totalSeries: perGame * multiplier,
    ruleDescription,
  };
}

/**
 * Pure function: Computes a player's rolling season statistics across archived weeks
 * plus optionally the current active week.
 */
export interface PlayerSeasonStats {
  name: string;
  team: string;
  bowlerNumber?: number;
  gender?: 'M' | 'W' | 'Jr';
  weeksBowled: number;
  gamesBowled: number;
  totalScratchPins: number;
  totalHandicapPins: number;
  totalGrandPins: number;
  enteringAverage: number;
  currentAverage: number;
  averageImprovement: number;
  computedHandicapPerGame: number;
  computedSeriesHandicap: number;
  highScratchGame: number;
  highScratchSeries: number;
  highHandicapGame: number;
  highHandicapSeries: number;
  maxPinsOverAverageGame: number;
  maxPinsOverAverageSeries: number;
  honorGamesCount: number;
  honorSeriesCount: number;
  weeklySeriesHistory: { week: string; scratch: number; grand: number; average: number }[];
}

export function computeSeasonPlayerStats(
  roster: RosterPlayer[],
  history: ArchivedWeek[],
  currentBowlers: BowlerEntry[],
  settings: LeagueSettings,
  includeCurrentWeek = true
): PlayerSeasonStats[] {
  const playerMap = new Map<
    string,
    {
      name: string;
      team: string;
      bowlerNumber?: number;
      gender?: 'M' | 'W' | 'Jr';
      bookAvg: number;
      weeks: {
        weekLabel: string;
        entryMode: 'single' | 'three';
        g1: number;
        g2: number;
        g3: number;
        scratch: number;
        hdcp: number;
        grand: number;
      }[];
    }
  >();

  roster.forEach((r, idx) => {
    const key = r.name.trim().toLowerCase();
    if (!key) return;
    playerMap.set(key, {
      name: r.name.trim(),
      team: r.team.trim(),
      bowlerNumber: r.bowlerNumber ?? 101 + idx,
      gender: r.gender ?? 'M',
      bookAvg: r.bookAverage ?? 165,
      weeks: [],
    });
  });

  const allWeeks: { weekLabel: string; bowlers: BowlerEntry[] }[] = history.map((h, idx) => ({
    weekLabel: h.week ? `Wk ${h.week}` : `Wk ${idx + 1}`,
    bowlers: h.bowlers,
  }));

  if (includeCurrentWeek && currentBowlers.length > 0) {
    const currentWeekLabel = settings.weekNumber ? `Wk ${settings.weekNumber}` : 'Current';
    const alreadyInHistory = history.some(
      (h) => h.week === settings.weekNumber && h.league === settings.leagueName
    );
    if (!alreadyInHistory) {
      allWeeks.push({
        weekLabel: currentWeekLabel,
        bowlers: currentBowlers,
      });
    }
  }

  for (const wk of allWeeks) {
    for (const b of wk.bowlers) {
      if (b.isAbsent) continue;
      const key = b.name.trim().toLowerCase();
      if (!key) continue;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          name: b.name.trim(),
          team: b.team.trim(),
          bowlerNumber: 200 + playerMap.size,
          gender: 'M',
          bookAvg: 165,
          weeks: [],
        });
      }
      const record = playerMap.get(key)!;
      if (b.team && !record.team) {
        record.team = b.team.trim();
      }
      record.weeks.push({
        weekLabel: wk.weekLabel,
        entryMode: b.entryMode,
        g1: b.entryMode === 'three' ? b.g1 : b.scratchScore,
        g2: b.entryMode === 'three' ? b.g2 : 0,
        g3: b.entryMode === 'three' ? b.g3 : 0,
        scratch: b.scratchScore,
        hdcp: b.handicap,
        grand: b.grandTotal,
      });
    }
  }

  const honorGameMin = settings.honorGameThreshold ?? 215;
  const honorSeriesMin = settings.honorSeriesThreshold ?? 625;
  const results: PlayerSeasonStats[] = [];

  for (const p of playerMap.values()) {
    let gamesBowled = 0;
    let totalScratchPins = 0;
    let totalHandicapPins = 0;
    let totalGrandPins = 0;
    let highScratchGame = 0;
    let highScratchSeries = 0;
    let highHandicapGame = 0;
    let highHandicapSeries = 0;
    let maxPinsOverAverageGame = 0;
    let maxPinsOverAverageSeries = 0;
    let honorGamesCount = 0;
    let honorSeriesCount = 0;

    const weeklySeriesHistory: { week: string; scratch: number; grand: number; average: number }[] =
      [];

    for (const w of p.weeks) {
      const gamesInWeek = w.entryMode === 'three' ? 3 : 1;
      gamesBowled += gamesInWeek;
      totalScratchPins += w.scratch;
      totalHandicapPins += w.hdcp;
      totalGrandPins += w.grand;

      const perGameHdcp = Math.round(w.hdcp / gamesInWeek);
      const gamesArr = w.entryMode === 'three' ? [w.g1, w.g2, w.g3] : [w.scratch];
      const maxGameScratch = Math.max(...gamesArr);
      const maxGameHdcp = maxGameScratch + perGameHdcp;

      for (const gm of gamesArr) {
        if (gm >= honorGameMin) honorGamesCount++;
        const diffGm = gm - (p.bookAvg || 165);
        if (diffGm > maxPinsOverAverageGame) maxPinsOverAverageGame = diffGm;
      }

      if (w.scratch >= honorSeriesMin) honorSeriesCount++;
      const expectedSeries = (p.bookAvg || 165) * gamesInWeek;
      const diffSer = w.scratch - expectedSeries;
      if (diffSer > maxPinsOverAverageSeries) maxPinsOverAverageSeries = diffSer;

      if (maxGameScratch > highScratchGame) highScratchGame = maxGameScratch;
      if (w.scratch > highScratchSeries) highScratchSeries = w.scratch;
      if (maxGameHdcp > highHandicapGame) highHandicapGame = maxGameHdcp;
      if (w.grand > highHandicapSeries) highHandicapSeries = w.grand;

      weeklySeriesHistory.push({
        week: w.weekLabel,
        scratch: w.scratch,
        grand: w.grand,
        average: Math.round(w.scratch / gamesInWeek),
      });
    }

    const currentAverage =
      gamesBowled > 0 ? Math.floor(totalScratchPins / gamesBowled) : p.bookAvg;
    const firstWeekAvg =
      p.weeks.length > 0
        ? Math.floor(p.weeks[0].scratch / (p.weeks[0].entryMode === 'three' ? 3 : 1))
        : p.bookAvg;
    const enteringAverage = p.bookAvg || firstWeekAvg || 165;
    const averageImprovement =
      gamesBowled > 0 ? currentAverage - enteringAverage : 0;

    const hdcpCalc = calculateBowlerHandicap(
      currentAverage,
      settings.handicapBasis,
      settings.handicapPercent,
      settings.entryMode,
      settings.maxHandicapPerGame || 0
    );

    results.push({
      name: p.name,
      team: p.team || 'Unassigned',
      bowlerNumber: p.bowlerNumber,
      gender: p.gender,
      weeksBowled: p.weeks.length,
      gamesBowled,
      totalScratchPins,
      totalHandicapPins,
      totalGrandPins,
      enteringAverage,
      currentAverage,
      averageImprovement,
      computedHandicapPerGame: hdcpCalc.perGame,
      computedSeriesHandicap: hdcpCalc.totalHandicap,
      highScratchGame,
      highScratchSeries,
      highHandicapGame,
      highHandicapSeries,
      maxPinsOverAverageGame,
      maxPinsOverAverageSeries,
      honorGamesCount,
      honorSeriesCount,
      weeklySeriesHistory,
    });
  }

  return results.sort(
    (a, b) =>
      b.currentAverage - a.currentAverage ||
      b.totalGrandPins - a.totalGrandPins ||
      a.name.localeCompare(b.name)
  );
}

/**
 * Pure function: Computes week-by-week Team Performance & Consistency metrics across the season
 * so users can visualize a Bar Chart of total team scores per week and identify the most consistent teams.
 */
export interface TeamWeeklyPerformancePoint {
  weekLabel: string;
  scratchTotal: number;
  handicapTotal: number;
  grandTotal: number;
  bowlerCount: number;
}

export interface SeasonTeamPerformanceRow {
  teamName: string;
  weeksPlayed: number;
  weeklyScores: TeamWeeklyPerformancePoint[];
  seasonScratchPins: number;
  seasonHandicapPins: number;
  seasonGrandPins: number;
  weeklyAverageGrand: number;
  weeklyAverageScratch: number;
  highWeekGrand: number;
  lowWeekGrand: number;
  highLowSpread: number; // Lower spread = more consistent week to week
  stdDeviation: number; // Standard deviation of weekly grand totals
  consistencyScore: number; // 0-100 rating (100 = zero variance)
  consistencyRank: number;
}

export interface SeasonTeamPerformanceSummary {
  weekLabels: string[];
  teams: SeasonTeamPerformanceRow[];
  mostConsistentTeam: SeasonTeamPerformanceRow | null;
  highestAverageTeam: SeasonTeamPerformanceRow | null;
  highestSingleWeekTeam: { teamName: string; weekLabel: string; score: number } | null;
}

export function computeSeasonTeamPerformance(
  history: ArchivedWeek[],
  currentBowlers: BowlerEntry[],
  settings: LeagueSettings,
  includeCurrentWeek = true
): SeasonTeamPerformanceSummary {
  const allWeeks: { weekLabel: string; bowlers: BowlerEntry[] }[] = history.map((h, idx) => ({
    weekLabel: h.week ? `Week ${h.week}` : `Week ${idx + 1}`,
    bowlers: h.bowlers || [],
  }));

  if (includeCurrentWeek && currentBowlers.length > 0) {
    const currentWeekLabel = settings.weekNumber ? `Week ${settings.weekNumber}` : 'Current Week';
    const alreadyInHistory = history.some(
      (h) => h.week === settings.weekNumber && h.league === settings.leagueName
    );
    if (!alreadyInHistory) {
      allWeeks.push({
        weekLabel: currentWeekLabel,
        bowlers: currentBowlers,
      });
    }
  }

  const weekLabels = allWeeks.map((w) => w.weekLabel);
  const teamNamesSet = new Set<string>();

  for (const wk of allWeeks) {
    for (const b of wk.bowlers) {
      const tName = (b.team || '').trim() || 'Unassigned';
      teamNamesSet.add(tName);
    }
  }

  const teamRows: SeasonTeamPerformanceRow[] = [];
  let highestSingleWeekTeam: { teamName: string; weekLabel: string; score: number } | null = null;

  for (const teamName of [...teamNamesSet].sort()) {
    const weeklyScores: TeamWeeklyPerformancePoint[] = [];

    for (const wk of allWeeks) {
      const teamBowlers = wk.bowlers.filter(
        (b) => ((b.team || '').trim() || 'Unassigned') === teamName
      );
      if (teamBowlers.length === 0) continue;

      let scratchTotal = 0;
      let handicapTotal = 0;
      let grandTotal = 0;

      for (const b of teamBowlers) {
        scratchTotal += b.scratchScore;
        handicapTotal += b.isAbsent ? 0 : b.handicap;
        grandTotal += b.grandTotal;
      }

      weeklyScores.push({
        weekLabel: wk.weekLabel,
        scratchTotal,
        handicapTotal,
        grandTotal,
        bowlerCount: teamBowlers.length,
      });

      if (!highestSingleWeekTeam || grandTotal > highestSingleWeekTeam.score) {
        highestSingleWeekTeam = {
          teamName,
          weekLabel: wk.weekLabel,
          score: grandTotal,
        };
      }
    }

    const weeksPlayed = weeklyScores.length;
    const seasonScratchPins = weeklyScores.reduce((acc, w) => acc + w.scratchTotal, 0);
    const seasonHandicapPins = weeklyScores.reduce((acc, w) => acc + w.handicapTotal, 0);
    const seasonGrandPins = weeklyScores.reduce((acc, w) => acc + w.grandTotal, 0);

    const weeklyAverageGrand =
      weeksPlayed > 0 ? Math.round(seasonGrandPins / weeksPlayed) : 0;
    const weeklyAverageScratch =
      weeksPlayed > 0 ? Math.round(seasonScratchPins / weeksPlayed) : 0;

    const grandValues = weeklyScores.map((w) => w.grandTotal);
    const highWeekGrand = grandValues.length > 0 ? Math.max(...grandValues) : 0;
    const lowWeekGrand = grandValues.length > 0 ? Math.min(...grandValues) : 0;
    const highLowSpread = highWeekGrand - lowWeekGrand;

    let stdDeviation = 0;
    if (grandValues.length > 1) {
      const mean = seasonGrandPins / grandValues.length;
      const variance =
        grandValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        grandValues.length;
      stdDeviation = Math.round(Math.sqrt(variance) * 10) / 10;
    }

    // Consistency score: 100 minus coefficient of variation scaled so typical bowling team variance (15-60 pins) maps to 75%-99%
    const coeffVarPct =
      weeklyAverageGrand > 0 ? (stdDeviation / weeklyAverageGrand) * 100 : 0;
    const consistencyScore =
      weeksPlayed > 0
        ? Math.max(50, Math.min(100, Math.round((100 - coeffVarPct * 4) * 10) / 10))
        : 0;

    teamRows.push({
      teamName,
      weeksPlayed,
      weeklyScores,
      seasonScratchPins,
      seasonHandicapPins,
      seasonGrandPins,
      weeklyAverageGrand,
      weeklyAverageScratch,
      highWeekGrand,
      lowWeekGrand,
      highLowSpread,
      stdDeviation,
      consistencyScore,
      consistencyRank: 1,
    });
  }

  // Assign consistencyRank (lowest stdDeviation / spread among teams with >= 1 week)
  const byConsistency = [...teamRows].sort(
    (a, b) =>
      a.stdDeviation - b.stdDeviation ||
      a.highLowSpread - b.highLowSpread ||
      b.seasonGrandPins - a.seasonGrandPins
  );
  byConsistency.forEach((row, idx) => {
    row.consistencyRank = idx + 1;
  });

  // Sort main list by Season Grand Pins descending
  teamRows.sort(
    (a, b) => b.seasonGrandPins - a.seasonGrandPins || a.teamName.localeCompare(b.teamName)
  );

  const mostConsistentTeam = byConsistency[0] || null;
  const highestAverageTeam =
    [...teamRows].sort((a, b) => b.weeklyAverageGrand - a.weeklyAverageGrand)[0] || null;

  return {
    weekLabels,
    teams: teamRows,
    mostConsistentTeam,
    highestAverageTeam,
    highestSingleWeekTeam,
  };
}

/**
 * Pure function: Ranks weekly bowler entries with standard competition tie-breaking
 * (e.g., 1, 2, 2, 4) and places absent bowlers at the bottom.
 */
export function rankWeeklyBowlers(entries: BowlerEntry[]): BowlerEntry[] {
  const active = entries
    .filter((b) => !b.isAbsent)
    .slice()
    .sort((a, b) => b.grandTotal - a.grandTotal || a.name.localeCompare(b.name));

  let currentRank = 0;
  let lastScore: number | null = null;

  const rankedActive = active.map((b, idx) => {
    if (lastScore === null || b.grandTotal < lastScore) {
      currentRank = idx + 1;
    }
    lastScore = b.grandTotal;
    return { ...b, placement: currentRank };
  });

  const absent = entries
    .filter((b) => b.isAbsent)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({ ...b, placement: null }));

  return [...rankedActive, ...absent];
}

/**
 * Pure function: Builds team standings for the current week with game-by-game breakdowns
 */
export interface TeamStandingRow {
  placement: number;
  name: string;
  g1Scratch: number;
  g2Scratch: number;
  g3Scratch: number;
  g1Hdcp: number;
  g2Hdcp: number;
  g3Hdcp: number;
  g1Total: number;
  g2Total: number;
  g3Total: number;
  scratchTotal: number;
  handicapTotal: number;
  total: number;
  players: BowlerEntry[];
}

export function buildTeamStandings(entries: BowlerEntry[]): TeamStandingRow[] {
  const groups = new Map<string, TeamStandingRow>();

  for (const b of entries) {
    const teamName = b.team.trim() || 'Unassigned';
    if (!groups.has(teamName)) {
      groups.set(teamName, {
        placement: 1,
        name: teamName,
        g1Scratch: 0,
        g2Scratch: 0,
        g3Scratch: 0,
        g1Hdcp: 0,
        g2Hdcp: 0,
        g3Hdcp: 0,
        g1Total: 0,
        g2Total: 0,
        g3Total: 0,
        scratchTotal: 0,
        handicapTotal: 0,
        total: 0,
        players: [],
      });
    }
    const group = groups.get(teamName)!;
    group.players.push(b);
    const perGameHdcp = b.isAbsent
      ? 0
      : b.entryMode === 'three'
      ? Math.round(b.handicap / 3)
      : b.handicap;

    const g1Scr = b.entryMode === 'three' ? b.g1 : b.scratchScore;
    const g2Scr = b.entryMode === 'three' ? b.g2 : 0;
    const g3Scr = b.entryMode === 'three' ? b.g3 : 0;

    group.g1Scratch += g1Scr;
    group.g2Scratch += g2Scr;
    group.g3Scratch += g3Scr;

    group.g1Hdcp += perGameHdcp;
    group.g2Hdcp += b.entryMode === 'three' ? perGameHdcp : 0;
    group.g3Hdcp += b.entryMode === 'three' ? perGameHdcp : 0;

    group.g1Total += g1Scr + perGameHdcp;
    group.g2Total += b.entryMode === 'three' ? g2Scr + perGameHdcp : 0;
    group.g3Total += b.entryMode === 'three' ? g3Scr + perGameHdcp : 0;
    group.scratchTotal += b.scratchScore;
    group.handicapTotal += b.isAbsent ? 0 : b.handicap;
    group.total += b.grandTotal;
  }

  const sortedTeams = [...groups.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name)
  );

  let rank = 0;
  let lastTotal: number | null = null;
  for (let i = 0; i < sortedTeams.length; i++) {
    const t = sortedTeams[i];
    if (lastTotal === null || t.total < lastTotal) {
      rank = i + 1;
    }
    t.placement = rank;
    lastTotal = t.total;
    t.players = rankWeeklyBowlers(t.players);
  }

  return sortedTeams;
}

/**
 * Pure function: Calculates Head-to-Head Matchup Points (7pt, 8pt, 9pt, 5pt, 4pt, or custom)
 * between two teams.
 */
export interface MatchupPointsResult {
  teamAPoints: number;
  teamBPoints: number;
  gamePtsEarnedA: [number, number, number];
  gamePtsEarnedB: [number, number, number];
  seriesPtsEarnedA: number;
  seriesPtsEarnedB: number;
  wonFlagsA: ['W' | 'L' | 'T', 'W' | 'L' | 'T', 'W' | 'L' | 'T', 'W' | 'L' | 'T'];
  wonFlagsB: ['W' | 'L' | 'T', 'W' | 'L' | 'T', 'W' | 'L' | 'T', 'W' | 'L' | 'T'];
  breakdown: string;
}

export function calculateMatchupPoints(
  teamA: TeamStandingRow,
  teamB: TeamStandingRow,
  system: LeagueSettings['pointSystem'],
  customGamePts = 2,
  customSeriesPts = 1
): MatchupPointsResult {
  let gamePts = 2;
  let seriesPts = 1;

  if (system === '7pt') {
    gamePts = 2;
    seriesPts = 1;
  } else if (system === '8pt') {
    gamePts = 2;
    seriesPts = 2;
  } else if (system === '9pt') {
    gamePts = 2;
    seriesPts = 3;
  } else if (system === '5pt') {
    gamePts = 1;
    seriesPts = 2;
  } else if (system === '4pt') {
    gamePts = 1;
    seriesPts = 1;
  } else if (system === 'custom') {
    gamePts = customGamePts;
    seriesPts = customSeriesPts;
  }

  const evalGame = (a: number, b: number, pts: number) => {
    if (a > b) return { aPts: pts, bPts: 0, flagA: 'W' as const, flagB: 'L' as const };
    if (b > a) return { aPts: 0, bPts: pts, flagA: 'L' as const, flagB: 'W' as const };
    return { aPts: pts / 2, bPts: pts / 2, flagA: 'T' as const, flagB: 'T' as const };
  };

  const g1 = evalGame(teamA.g1Total, teamB.g1Total, gamePts);
  const g2 = evalGame(teamA.g2Total, teamB.g2Total, gamePts);
  const g3 = evalGame(teamA.g3Total, teamB.g3Total, gamePts);
  const ser = evalGame(teamA.total, teamB.total, seriesPts);

  const teamAPoints = g1.aPts + g2.aPts + g3.aPts + ser.aPts;
  const teamBPoints = g1.bPts + g2.bPts + g3.bPts + ser.bPts;

  return {
    teamAPoints,
    teamBPoints,
    gamePtsEarnedA: [g1.aPts, g2.aPts, g3.aPts],
    gamePtsEarnedB: [g1.bPts, g2.bPts, g3.bPts],
    seriesPtsEarnedA: ser.aPts,
    seriesPtsEarnedB: ser.bPts,
    wonFlagsA: [g1.flagA, g2.flagA, g3.flagA, ser.flagA],
    wonFlagsB: [g1.flagB, g2.flagB, g3.flagB, ser.flagB],
    breakdown: `G1 (${teamA.g1Total}-${teamB.g1Total}) · G2 (${teamA.g2Total}-${teamB.g2Total}) · G3 (${teamA.g3Total}-${teamB.g3Total}) · Tot (${teamA.total}-${teamB.total})`,
  };
}

/**
 * Pure function: Generates an 8-Player Single-Elimination Bowling Bracket
 */
export function buildEightPlayerBracket(
  entrants: BowlerEntry[],
  mode: 'handicap' | 'scratch',
  title = 'Bracket #1',
  entryFee = 5,
  firstPrize = 25,
  secondPrize = 10,
  startingLane = 1
): EightPlayerBracket | null {
  const valid = entrants.filter((b) => !b.isAbsent);
  if (valid.length < 2) return null;

  const slots: BowlerEntry[] = [];
  for (let i = 0; i < 8; i++) {
    if (i < valid.length) {
      slots.push(valid[i]);
    } else {
      slots.push({
        id: `bye-${i}`,
        name: `BYE Slot #${i + 1}`,
        team: 'Vacant',
        entryMode: 'three',
        scoringType: mode,
        g1: 0,
        g2: 0,
        g3: 0,
        scratchScore: 0,
        handicap: 0,
        grandTotal: 0,
        isAbsent: true,
        isSub: false,
        createdAt: '',
      });
    }
  }

  const getHdcpPerGame = (b: BowlerEntry) =>
    mode === 'handicap' && !b.isAbsent
      ? b.entryMode === 'three'
        ? Math.round(b.handicap / 3)
        : b.handicap
      : 0;

  const getGameTotal = (b: BowlerEntry, gameNum: 1 | 2 | 3) => {
    if (b.isAbsent) return 0;
    const raw =
      b.entryMode === 'three'
        ? gameNum === 1
          ? b.g1
          : gameNum === 2
          ? b.g2
          : b.g3
        : b.scratchScore;
    return raw + getHdcpPerGame(b);
  };

  const quarterfinals: BracketMatchNode[] = [];
  const r1Winners: BowlerEntry[] = [];

  for (let m = 0; m < 4; m++) {
    const pA = slots[m * 2];
    const pB = slots[m * 2 + 1];
    const aG1 = getGameTotal(pA, 1);
    const bG1 = getGameTotal(pB, 1);

    const winner = aG1 >= bG1 ? pA : pB;
    r1Winners.push(winner);

    quarterfinals.push({
      slotIndex: m + 1,
      playerA: {
        name: pA.name,
        team: pA.team,
        lane: startingLane + (m % 4),
        hdcpPerGame: getHdcpPerGame(pA),
        g1Score: aG1,
      },
      playerB: {
        name: pB.name,
        team: pB.team,
        lane: startingLane + ((m + 1) % 4),
        hdcpPerGame: getHdcpPerGame(pB),
        g1Score: bG1,
      },
      round1Winner: {
        name: winner.name,
        g1Total: Math.max(aG1, bG1),
        g2Score: winner.entryMode === 'three' ? winner.g2 : winner.scratchScore,
        hdcpPerGame: getHdcpPerGame(winner),
        g2Total: getGameTotal(winner, 2),
      },
    });
  }

  const sf1A = r1Winners[0];
  const sf1B = r1Winners[1];
  const sf1Winner = getGameTotal(sf1A, 2) >= getGameTotal(sf1B, 2) ? sf1A : sf1B;

  const sf2A = r1Winners[2];
  const sf2B = r1Winners[3];
  const sf2Winner = getGameTotal(sf2A, 2) >= getGameTotal(sf2B, 2) ? sf2A : sf2B;

  const finalAG3 = getGameTotal(sf1Winner, 3);
  const finalBG3 = getGameTotal(sf2Winner, 3);
  const champ = finalAG3 >= finalBG3 ? sf1Winner : sf2Winner;
  const runner = finalAG3 >= finalBG3 ? sf2Winner : sf1Winner;

  return {
    id: `brk-${title.replace(/\s+/g, '-').toLowerCase()}`,
    title,
    mode,
    entryFee,
    firstPrize,
    secondPrize,
    quarterfinals,
    semifinals: {
      match1Winner: {
        name: sf1Winner.name,
        g2Total: getGameTotal(sf1Winner, 2),
        g3Score: sf1Winner.entryMode === 'three' ? sf1Winner.g3 : sf1Winner.scratchScore,
        g3Total: getGameTotal(sf1Winner, 3),
      },
      match2Winner: {
        name: sf2Winner.name,
        g2Total: getGameTotal(sf2Winner, 2),
        g3Score: sf2Winner.entryMode === 'three' ? sf2Winner.g3 : sf2Winner.scratchScore,
        g3Total: getGameTotal(sf2Winner, 3),
      },
    },
    champion: {
      name: champ.name,
      g3Total: getGameTotal(champ, 3),
      payout: firstPrize,
    },
    runnerUp: {
      name: runner.name,
      g3Total: getGameTotal(runner, 3),
      payout: secondPrize,
    },
  };
}

/**
 * Pure function: Generates a full round-robin lane assignment schedule
 */
export function generateRoundRobinSchedule(
  teams: string[],
  startingLane = 1,
  weeksCount = 12
): LaneMatchup[] {
  const cleanTeams = teams.map((t) => t.trim()).filter(Boolean);
  if (cleanTeams.length < 2) return [];

  const pool = [...cleanTeams];
  if (pool.length % 2 !== 0) {
    pool.push('BYE (Vacant)');
  }

  const n = pool.length;
  const pairsCount = n / 2;
  const matchups: LaneMatchup[] = [];

  for (let w = 0; w < weeksCount; w++) {
    const weekNum = w + 1;
    const rotated = [pool[0]];
    for (let i = 1; i < n; i++) {
      const idx = 1 + ((i - 1 + w) % (n - 1));
      rotated.push(pool[idx]);
    }

    for (let p = 0; p < pairsCount; p++) {
      const pairShift = (p + w) % pairsCount;
      const oddLane = startingLane + pairShift * 2;
      const evenLane = oddLane + 1;
      const teamA = rotated[p];
      const teamB = rotated[n - 1 - p];

      matchups.push({
        week: weekNum,
        oddLane,
        evenLane,
        teamA: w % 2 === 0 ? teamA : teamB,
        teamB: w % 2 === 0 ? teamB : teamA,
        isPositionRound: false,
      });
    }
  }

  return matchups.sort((a, b) => a.week - b.week || a.oddLane - b.oddLane);
}

/**
 * Pure function: Generates a Position Round lane pairing (1st vs 2nd, 3rd vs 4th, etc.)
 */
export function generatePositionRoundMatchups(
  standings: TeamStandingRow[],
  weekNumber: number,
  startingLane = 1
): LaneMatchup[] {
  const matchups: LaneMatchup[] = [];
  for (let i = 0; i < standings.length; i += 2) {
    const pairIndex = Math.floor(i / 2);
    const oddLane = startingLane + pairIndex * 2;
    const evenLane = oddLane + 1;
    const teamA = standings[i]?.name || 'BYE';
    const teamB = standings[i + 1]?.name || 'BYE';
    matchups.push({
      week: weekNumber,
      oddLane,
      evenLane,
      teamA,
      teamB,
      isPositionRound: true,
    });
  }
  return matchups;
}

/**
 * Pure function: Computes financial ledger summary for Treasurer / Dues tab
 */
export interface TreasurySummary {
  totalActiveBowlers: number;
  paidCount: number;
  owesCount: number;
  expectedGrossDues: number;
  collectedGrossDues: number;
  outstandingArrears: number;
  houseLineageCut: number;
  secretarySalaryCut: number;
  netPrizeFundContribution: number;
  strikePotCollected: number;
  highGamePotCollected: number;
}

export function calculateTreasurySummary(
  roster: RosterPlayer[],
  duesMap: Record<string, WeeklyDuesRecord>,
  settings: LeagueSettings
): TreasurySummary {
  const totalActiveBowlers = roster.length;
  let paidCount = 0;
  let owesCount = 0;
  let collectedGrossDues = 0;
  let strikePotCollected = 0;
  let highGamePotCollected = 0;
  const sidePotFee = settings.sidePotEntryFee ?? 5;

  for (const player of roster) {
    const rec = duesMap[player.id];
    const status = rec?.status || 'paid';
    const paidAmt = rec !== undefined ? rec.amountPaid : settings.weeklyDuesPerBowler;

    if (status === 'paid' || status === 'paid_ahead') {
      paidCount++;
      collectedGrossDues += paidAmt;
    } else if (status === 'owes') {
      owesCount++;
      collectedGrossDues += paidAmt;
    }

    if (rec?.sidePotStrike) strikePotCollected += sidePotFee;
    if (rec?.sidePotHighGame) highGamePotCollected += sidePotFee;
  }

  const expectedGrossDues = totalActiveBowlers * settings.weeklyDuesPerBowler;
  const outstandingArrears = Math.max(0, expectedGrossDues - collectedGrossDues);
  const houseLineageCut = paidCount * settings.lineageCostPerBowler;
  const secretarySalaryCut = paidCount * (settings.secretaryFeePerBowler ?? 0);
  const netPrizeFundContribution = Math.max(
    0,
    collectedGrossDues - houseLineageCut - secretarySalaryCut
  );

  return {
    totalActiveBowlers,
    paidCount,
    owesCount,
    expectedGrossDues,
    collectedGrossDues,
    outstandingArrears,
    houseLineageCut,
    secretarySalaryCut,
    netPrizeFundContribution,
    strikePotCollected,
    highGamePotCollected,
  };
}

/**
 * Pure function: Extracts and validates a complete AppState from EITHER a .json or .html backup
 */
export function parseUniversalBackupPayload(
  rawText: string,
  fallbackState: AppState
): { restoredState: AppState; sourceType: 'json' | 'html_bundle'; summary: string } {
  const trimmed = rawText.trim();
  let jsonString = trimmed;
  let sourceType: 'json' | 'html_bundle' = 'json';

  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('embedded-league-state')
  ) {
    const match = trimmed.match(
      /<script[^>]*id=["']embedded-league-state["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!match || !match[1]) {
      throw new Error('The selected HTML file does not contain an embedded league backup payload.');
    }
    jsonString = match[1]
      .replace(/<\\\/script>/gi, '</script>')
      .replace(/\\u003c\//gi, '</')
      .trim();
    sourceType = 'html_bundle';
  }

  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is not a valid JSON object.');
  }

  const rawBowlers: BowlerEntry[] = Array.isArray(parsed.bowlers) ? parsed.bowlers : [];
  const rawRoster: RosterPlayer[] = Array.isArray(parsed.roster)
    ? parsed.roster.map((r: RosterPlayer | string, idx: number) =>
        typeof r === 'string'
          ? { id: `roster-${idx}`, name: r, team: '', bookAverage: 165 }
          : r
      )
    : [];

  if (
    !Array.isArray(parsed.bowlers) &&
    !Array.isArray(parsed.roster) &&
    !Array.isArray(parsed.history)
  ) {
    throw new Error('File does not contain valid bowlers, roster, or season history data.');
  }

  const rawHistory: ArchivedWeek[] = Array.isArray(parsed.history) ? parsed.history : [];
  const rawDues: Record<string, WeeklyDuesRecord> =
    parsed.currentDues && typeof parsed.currentDues === 'object' ? parsed.currentDues : {};
  const rawSchedule: LaneMatchup[] = Array.isArray(parsed.schedule)
    ? parsed.schedule
    : fallbackState.schedule;
  const rawBrackets: string[] = Array.isArray(parsed.bracketEntrantIds)
    ? parsed.bracketEntrantIds
    : rawBowlers.filter((b) => !b.isAbsent).map((b) => b.id);

  const restoredState: AppState = {
    version: parsed.version || fallbackState.version || CURRENT_APP_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(fallbackState.settings || {}),
      ...(parsed.settings || {}),
    },
    bowlers: rawBowlers,
    roster: rawRoster,
    history: rawHistory,
    currentDues: rawDues,
    schedule: rawSchedule,
    bracketEntrantIds: rawBrackets,
    weekNotes: typeof parsed.weekNotes === 'string' ? parsed.weekNotes : '',
    weekArchived: Boolean(parsed.weekArchived),
    weekArchiveId: parsed.weekArchiveId || null,
    activeLeagueId:
      parsed.activeLeagueId ||
      parsed.settings?.leagueId ||
      fallbackState.activeLeagueId ||
      'my-bowling-league',
    allLeaguesRegistry:
      parsed.allLeaguesRegistry && typeof parsed.allLeaguesRegistry === 'object'
        ? parsed.allLeaguesRegistry
        : fallbackState.allLeaguesRegistry,
  };

  const leagueCount = restoredState.allLeaguesRegistry
    ? Object.keys(restoredState.allLeaguesRegistry).length
    : 1;
  const duesCount = Object.keys(rawDues).length;
  const summary = `Restored ${
    sourceType === 'html_bundle' ? 'Single-HTML Program' : 'Master Backup'
  } (${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}): ${
    rawBowlers.length
  } active scores, ${rawRoster.length} roster bowlers, ${
    rawHistory.length
  } archived weeks, ${duesCount} dues records, and ${rawSchedule.length} lane matchups.`;

  return { restoredState, sourceType, summary };
}

export interface MasterDatabaseMetrics {
  activeBowlers: number;
  inactiveBowlers: number;
  totalBowlers: number;
  duplicateBowlersCount: number;
  duplicateNames: string[];
  activeLeagues: number;
  inactiveLeagues: number;
  totalLeagues: number;
  daysSinceLocalBackup: string;
  daysSinceAutoBackup: string;
}

export function computeMasterDatabaseMetrics(
  leaguesMap: Record<string, Omit<AppState, 'allLeaguesRegistry'>>,
  lastLocalBackupAt?: string | null,
  lastAutoBackupAt?: string | null,
  nowMs: number = Date.now()
): MasterDatabaseMetrics {
  const leagueEntries = Object.values(leaguesMap);
  let activeLeagues = 0;
  let inactiveLeagues = 0;
  let activeBowlers = 0;
  let inactiveBowlers = 0;
  const nameFrequency = new Map<string, { displayName: string; count: number }>();

  for (const lg of leagueEntries) {
    if (lg.settings?.leagueStatus === 'inactive') {
      inactiveLeagues++;
    } else {
      activeLeagues++;
    }

    const absentNamesInWeek = new Set(
      (lg.bowlers || [])
        .filter((b) => b.isAbsent)
        .map((b) => b.name.trim().toLowerCase())
    );

    for (const r of lg.roster || []) {
      const norm = r.name.trim().toLowerCase();
      if (!norm) continue;
      if (absentNamesInWeek.has(norm)) {
        inactiveBowlers++;
      } else {
        activeBowlers++;
      }
      const existing = nameFrequency.get(norm);
      if (existing) {
        existing.count += 1;
      } else {
        nameFrequency.set(norm, { displayName: r.name.trim(), count: 1 });
      }
    }
  }

  const duplicateNames: string[] = [];
  for (const val of nameFrequency.values()) {
    if (val.count > 1) {
      duplicateNames.push(val.displayName);
    }
  }

  const formatDaysSince = (iso?: string | null): string => {
    if (!iso) return 'None Found!';
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return 'None Found!';
    const diffDays = Math.max(0, Math.floor((nowMs - parsed) / (1000 * 60 * 60 * 24)));
    return diffDays === 0 ? '0 Days (Today)' : `${diffDays} Day${diffDays === 1 ? '' : 's'} Ago`;
  };

  return {
    activeBowlers,
    inactiveBowlers,
    totalBowlers: activeBowlers + inactiveBowlers,
    duplicateBowlersCount: duplicateNames.length,
    duplicateNames,
    activeLeagues,
    inactiveLeagues,
    totalLeagues: activeLeagues + inactiveLeagues,
    daysSinceLocalBackup: formatDaysSince(lastLocalBackupAt),
    daysSinceAutoBackup: formatDaysSince(lastAutoBackupAt),
  };
}
