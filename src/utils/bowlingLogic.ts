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

export const CURRENT_APP_VERSION = '1.0.06';
export const LATEST_AVAILABLE_VERSION = '1.0.07';

export const DEFAULT_SETTINGS: LeagueSettings = {
  leagueId: 'thursday-night-rollers',
  leagueStatus: 'active',
  leagueName: 'Thursday Night Rollers',
  seasonName: 'Fall / Winter 2026-2027',
  weekNumber: '4',
  totalWeeks: 31,
  customCsvName: '',
  formatMode: 'individual',
  entryMode: 'three',
  scoringType: 'handicap',
  absentScore: 150,
  maxGameScore: 300,
  showAbsent: 'yes',
  highlightFirst: 'yes',
  showTeamSummary: 'yes',
  topNote: 'Position Round Next Week - Arrive 15 Minutes Early',
  bottomNote: 'Please turn in weekly envelopes and dues to the League Secretary.',
  handicapBasis: 220,
  handicapPercent: 90,
  autoCalculateHandicap: 'yes',
  pointSystem: '7pt',
  weeklyDuesPerBowler: 22,
  lineageCostPerBowler: 12,
  startingLane: 1,
  bracketEntryFee: 5,
  bracketFirstPlacePayout: 25,
  bracketSecondPlacePayout: 10,
  autoBackupEnabled: true,
  autoBackupInterval: 'on_finish_week',
  autoBackupFormat: 'json',
  autoBackupDirectoryLabel: 'Downloads / Chosen PC Folder',
  lastLocalBackupAt: null,
  lastAutoBackupAt: null,
};

export const PATCH_NOTES_HISTORY: PatchRelease[] = [
  {
    version: '1.0.07',
    date: 'November 14, 2026',
    title: 'Multi-League Database Manager, Auto-Backup Scheduler & Full Suite',
    isLatest: true,
    highlights: [
      'Added Multi-League Database Manager: Create, switch between, and manage multiple leagues inside the same single HTML program.',
      'Added Automatic Backup Scheduler with optional folder/file location picker (.json or .html) and 1-click full restore if browser history is cleared or a new PC is needed.',
      'Added 8-Player Handicap & Scratch Tournament Brackets (Game 1 Quarterfinals → Game 2 Semifinals → Game 3 Finals with automatic $25 / $10 payouts).',
      'Added Team vs. Team Lane Pair Recap Sheet Mode (Scratch Total, Handicap, Total w/ HDCP, HDCP Won/Lost, Team Points Won, and Opponent Points).',
      'Added USBC Book Average & Automatic Handicap Calculator (configurable e.g. 90% of 220) plus Season Highs & Customizable CSV Builder.',
    ],
    changes: [
      {
        category: 'New Feature',
        description:
          'Multi-League Switcher & Master Bowler Database Manager: Track Bowler Counts (Active, Inactive, Total, Duplicates across leagues) and League Counts.',
      },
      {
        category: 'Data & Backup',
        description:
          'Auto-Backup Scheduler & Universal Import: Schedule automatic backups (every score change, 5m, 15m, 30m, or on Finish Week) to an optional computer location and restore 100% of all leagues from a single .json or .html file.',
      },
      {
        category: 'League Rules',
        description:
          'Added 8-Player Elimination Brackets with automatic Game 1 / Game 2 / Game 3 advancement, opponent view, and payout summaries.',
      },
      {
        category: 'League Rules',
        description:
          'Added Team vs. Team Lane Pair Recap Sheet view with 7-Point, 8-Point (2-2-2+2), 5-Point, and 4-Point matchup rows.',
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
 * using standard USBC / BLS formula: floor((Basis - Average) * (Percent / 100))
 */
export function calculateBowlerHandicap(
  average: number,
  basis: number,
  percent: number,
  entryMode: 'single' | 'three'
): { perGame: number; totalHandicap: number } {
  if (!Number.isFinite(average) || average <= 0 || average >= basis) {
    return { perGame: 0, totalHandicap: 0 };
  }
  const rawDiff = basis - average;
  const perGame = Math.max(0, Math.floor(rawDiff * (percent / 100) + 1e-9));
  const multiplier = entryMode === 'three' ? 3 : 1;
  return {
    perGame,
    totalHandicap: perGame * multiplier,
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

  // Seed from master roster
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
    const weeklySeriesHistory: { week: string; scratch: number; grand: number; average: number }[] =
      [];

    for (const w of p.weeks) {
      const gamesInWeek = w.entryMode === 'three' ? 3 : 1;
      gamesBowled += gamesInWeek;
      totalScratchPins += w.scratch;
      totalHandicapPins += w.hdcp;
      totalGrandPins += w.grand;

      const perGameHdcp = Math.round(w.hdcp / gamesInWeek);
      const maxGameScratch =
        w.entryMode === 'three' ? Math.max(w.g1, w.g2, w.g3) : w.scratch;
      const maxGameHdcp = maxGameScratch + perGameHdcp;

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
      settings.entryMode
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
 * (both Scratch per game and Handicap per game for the BLS Recap Sheet).
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
 * Pure function: Calculates BLS Head-to-Head Matchup Points (7-pt, 8-pt, 5-pt, or 4-pt system)
 * between two teams, including per-game Won/Lost/Tie indicators for the BLS Recap Sheet.
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
  system: '7pt' | '8pt' | '5pt' | '4pt'
): MatchupPointsResult {
  const gamePts = system === '7pt' || system === '8pt' ? 2 : 1;
  const seriesPts = system === '8pt' || system === '5pt' ? 2 : 1;

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
 * Pure function: Generates an 8-Player Single-Elimination Bowling Bracket (BLS style)
 * Game 1 = Quarterfinals (8 players -> 4 winners)
 * Game 2 = Semifinals (4 winners -> 2 finalists)
 * Game 3 = Championship Final (2 finalists -> 1st Place & 2nd Place Payout)
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

  // Fill up to 8 slots (repeating or padding with BYE if < 8)
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

  // Semifinal 1: Winner of QF 0 vs QF 1 in Game 2
  const sf1A = r1Winners[0];
  const sf1B = r1Winners[1];
  const sf1Winner = getGameTotal(sf1A, 2) >= getGameTotal(sf1B, 2) ? sf1A : sf1B;

  // Semifinal 2: Winner of QF 2 vs QF 3 in Game 2
  const sf2A = r1Winners[2];
  const sf2B = r1Winners[3];
  const sf2Winner = getGameTotal(sf2A, 2) >= getGameTotal(sf2B, 2) ? sf2A : sf2B;

  // Finals in Game 3
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
 * using standard circle-method rotation across lane pairs.
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

    if (rec?.sidePotStrike) strikePotCollected += 5;
    if (rec?.sidePotHighGame) highGamePotCollected += 5;
  }

  const expectedGrossDues = totalActiveBowlers * settings.weeklyDuesPerBowler;
  const outstandingArrears = Math.max(0, expectedGrossDues - collectedGrossDues);
  const houseLineageCut = paidCount * settings.lineageCostPerBowler;
  const netPrizeFundContribution = Math.max(0, collectedGrossDues - houseLineageCut);

  return {
    totalActiveBowlers,
    paidCount,
    owesCount,
    expectedGrossDues,
    collectedGrossDues,
    outstandingArrears,
    houseLineageCut,
    netPrizeFundContribution,
    strikePotCollected,
    highGamePotCollected,
  };
}

/**
 * Pure function: Extracts and validates a complete AppState from EITHER:
 * 1. A standard .json Master League Backup file
 * 2. A standalone Single-HTML program file (<script id="embedded-league-state" type="application/json">...</script>)
 * 3. A legacy V1/V2 JSON backup file
 * Ensures 100% of bowlers, master roster, archived weeks, dues, schedule, brackets, and settings are restored
 * if browser history is cleared or the user moves to a new PC.
 */
export function parseUniversalBackupPayload(
  rawText: string,
  fallbackState: AppState
): { restoredState: AppState; sourceType: 'json' | 'html_bundle'; summary: string } {
  const trimmed = rawText.trim();
  let jsonString = trimmed;
  let sourceType: 'json' | 'html_bundle' = 'json';

  // Detect if the user imported a Single-File HTML program (.html)
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('embedded-league-state')) {
    const match = trimmed.match(
      /<script[^>]*id=["']embedded-league-state["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!match || !match[1]) {
      throw new Error('The selected HTML file does not contain an embedded league backup payload.');
    }
    jsonString = match[1].replace(/<\\\/script>/gi, '</script>').trim();
    sourceType = 'html_bundle';
  }

  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is not a valid JSON object.');
  }

  // Support both full v4 schema and legacy V1/V2 schemas
  const rawBowlers: BowlerEntry[] = Array.isArray(parsed.bowlers) ? parsed.bowlers : [];
  const rawRoster: RosterPlayer[] = Array.isArray(parsed.roster)
    ? parsed.roster.map((r: RosterPlayer | string, idx: number) =>
        typeof r === 'string'
          ? { id: `roster-${idx}`, name: r, team: '', bookAverage: 165 }
          : r
      )
    : [];

  if (!Array.isArray(parsed.bowlers) && !Array.isArray(parsed.roster) && !Array.isArray(parsed.history)) {
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
    weekArchived: Boolean(parsed.weekArchived),
    weekArchiveId: parsed.weekArchiveId || null,
    activeLeagueId: parsed.activeLeagueId || parsed.settings?.leagueId || fallbackState.activeLeagueId || 'thursday-night-rollers',
    allLeaguesRegistry:
      parsed.allLeaguesRegistry && typeof parsed.allLeaguesRegistry === 'object'
        ? parsed.allLeaguesRegistry
        : fallbackState.allLeaguesRegistry,
  };

  const leagueCount = restoredState.allLeaguesRegistry
    ? Object.keys(restoredState.allLeaguesRegistry).length
    : 1;
  const duesCount = Object.keys(rawDues).length;
  const summary = `Restored ${sourceType === 'html_bundle' ? 'Single-HTML Program' : 'Master Backup'} (${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}): ${rawBowlers.length} active scores, ${rawRoster.length} roster bowlers, ${rawHistory.length} archived weeks, ${duesCount} dues records, and ${rawSchedule.length} lane matchups.`;

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

/**
 * Pure function: Computes Master Bowler Database Manager summary statistics across all leagues
 * in the program (Bowler Count, League Count, Cross-League Duplicates, and Days Since Backup).
 */
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


