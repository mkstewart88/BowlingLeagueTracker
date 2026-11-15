import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBowlerHandicap,
  rankWeeklyBowlers,
  buildTeamStandings,
  calculateMatchupPoints,
  buildEightPlayerBracket,
  generateRoundRobinSchedule,
  calculateTreasurySummary,
  parseUniversalBackupPayload,
  computeMasterDatabaseMetrics,
  computeSeasonTeamPerformance,
  computeBowlerAbsentScore,
  CURRENT_APP_VERSION,
  LATEST_AVAILABLE_VERSION,
  DEFAULT_SETTINGS,
} from './bowlingLogic';
import { createInitialSeedState } from './seedData';
import { generateStandaloneSingleHtmlBundle, getCurrentOpenedHtmlFilename } from './fileExport';
import {
  injectBootFromCacheFlag,
  stripBootFromCacheFlag,
} from './runtimeUpdater';
import {
  DEFAULT_SAVE_FILENAME,
  getDefaultSaveFilename,
  serializeMasterSavePayload,
} from './desktopBridge';
import {
  compareSemverVersions,
  parseGithubRepoSpec,
  mergePatchNotesHistory,
} from './githubUpdater';
import { BowlerEntry, RosterPlayer, WeeklyDuesRecord } from '../types/bowling';

test('version is set to 1.0.14 as the latest release', () => {
  assert.equal(CURRENT_APP_VERSION, '1.0.14');
  assert.equal(LATEST_AVAILABLE_VERSION, '1.0.14');
});

test('getCurrentOpenedHtmlFilename defaults to BowlingLeagueHelper.html and preserves opened filenames', () => {
  assert.equal(getCurrentOpenedHtmlFilename('/'), 'BowlingLeagueHelper.html');
  assert.equal(getCurrentOpenedHtmlFilename('/index.html'), 'BowlingLeagueHelper.html');
  assert.equal(
    getCurrentOpenedHtmlFilename('/Users/bowler/Desktop/BowlingLeagueHelper.html'),
    'BowlingLeagueHelper.html'
  );
  assert.equal(
    getCurrentOpenedHtmlFilename('/C:/Bowling/ThursdayLeague.html'),
    'ThursdayLeague.html'
  );
});

test('runtimeUpdater injects and strips cached runtime boot flag cleanly', () => {
  const sampleHtml = '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>';
  const injected = injectBootFromCacheFlag(sampleHtml, '1.0.14');
  assert.ok(injected.includes('id="bowling-runtime-boot-flag"'));
  assert.ok(injected.includes('"1.0.14"'));
  const stripped = stripBootFromCacheFlag(injected);
  assert.ok(!stripped.includes('bowling-runtime-boot-flag'));
  assert.equal(stripped, sampleHtml);
});

test('getDefaultSaveFilename returns BowlingLeagueTrackerSave.json without dates and serializeMasterSavePayload includes all leagues', () => {
  assert.equal(DEFAULT_SAVE_FILENAME, 'BowlingLeagueTrackerSave.json');
  assert.equal(getDefaultSaveFilename(), 'BowlingLeagueTrackerSave.json');
  const seed = createInitialSeedState();
  const payload = serializeMasterSavePayload(seed);
  const parsed = JSON.parse(payload);
  assert.equal(parsed.app, 'Bowling League Helper');
  assert.equal(Object.keys(parsed.allLeaguesRegistry || {}).length, 3);
});

test('calculateBowlerHandicap computes 90% of 220 accurately for 3-game series and single game', () => {
  const hdcp180 = calculateBowlerHandicap(180, 220, 90, 'three');
  assert.equal(hdcp180.perGame, 36);
  assert.equal(hdcp180.totalHandicap, 108);

  const hdcpSingle = calculateBowlerHandicap(195, 220, 90, 'single');
  assert.equal(hdcpSingle.perGame, 22);
  assert.equal(hdcpSingle.totalHandicap, 22);

  const hdcpAboveBasis = calculateBowlerHandicap(225, 220, 90, 'three');
  assert.equal(hdcpAboveBasis.perGame, 0);
  assert.equal(hdcpAboveBasis.totalHandicap, 0);
});

test('rankWeeklyBowlers handles ties and places absent bowlers at the bottom', () => {
  const entries: BowlerEntry[] = [
    {
      id: '1',
      name: 'Bob',
      team: 'A',
      entryMode: 'three',
      scoringType: 'handicap',
      g1: 200,
      g2: 200,
      g3: 200,
      scratchScore: 600,
      handicap: 60,
      grandTotal: 660,
      isAbsent: false,
      isSub: false,
      createdAt: '',
    },
    {
      id: '2',
      name: 'Alice',
      team: 'A',
      entryMode: 'three',
      scoringType: 'handicap',
      g1: 200,
      g2: 200,
      g3: 200,
      scratchScore: 600,
      handicap: 60,
      grandTotal: 660,
      isAbsent: false,
      isSub: false,
      createdAt: '',
    },
    {
      id: '3',
      name: 'Charlie',
      team: 'B',
      entryMode: 'three',
      scoringType: 'handicap',
      g1: 150,
      g2: 150,
      g3: 150,
      scratchScore: 450,
      handicap: 0,
      grandTotal: 450,
      isAbsent: true,
      isSub: false,
      createdAt: '',
    },
    {
      id: '4',
      name: 'Dave',
      team: 'B',
      entryMode: 'three',
      scoringType: 'handicap',
      g1: 190,
      g2: 190,
      g3: 190,
      scratchScore: 570,
      handicap: 30,
      grandTotal: 600,
      isAbsent: false,
      isSub: false,
      createdAt: '',
    },
  ];

  const ranked = rankWeeklyBowlers(entries);
  assert.equal(ranked[0].name, 'Alice');
  assert.equal(ranked[0].placement, 1);
  assert.equal(ranked[1].name, 'Bob');
  assert.equal(ranked[1].placement, 1);
  assert.equal(ranked[2].name, 'Dave');
  assert.equal(ranked[2].placement, 3);
  assert.equal(ranked[3].name, 'Charlie');
  assert.equal(ranked[3].placement, null);
});

test('buildTeamStandings and calculateMatchupPoints compute 7-point and 8-point rules', () => {
  const entries: BowlerEntry[] = [
    {
      id: '1',
      name: 'Pin King',
      team: 'Pin Crushers',
      entryMode: 'three',
      scoringType: 'handicap',
      g1: 210,
      g2: 180,
      g3: 220,
      scratchScore: 610,
      handicap: 60,
      grandTotal: 670,
      isAbsent: false,
      isSub: false,
      createdAt: '',
    },
    {
      id: '2',
      name: 'Split Happens',
      team: 'Alley Cats',
      entryMode: 'three',
      scoringType: 'handicap',
      g1: 190,
      g2: 210,
      g3: 190,
      scratchScore: 590,
      handicap: 60,
      grandTotal: 650,
      isAbsent: false,
      isSub: false,
      createdAt: '',
    },
  ];

  const teams = buildTeamStandings(entries);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].name, 'Pin Crushers');
  assert.equal(teams[0].placement, 1);

  const matchup7 = calculateMatchupPoints(teams[0], teams[1], '7pt');
  assert.equal(matchup7.teamAPoints, 5);
  assert.equal(matchup7.teamBPoints, 2);

  const matchup8 = calculateMatchupPoints(teams[0], teams[1], '8pt');
  assert.equal(matchup8.teamAPoints, 6);
  assert.equal(matchup8.teamBPoints, 2);
  assert.deepEqual(matchup8.wonFlagsA, ['W', 'L', 'W', 'W']);
});

test('buildEightPlayerBracket resolves Quarterfinals (G1), Semifinals (G2), and Finals (G3) with payouts', () => {
  const entrants: BowlerEntry[] = Array.from({ length: 8 }, (_, idx) => ({
    id: `b-${idx + 1}`,
    name: `Bowler ${idx + 1}`,
    team: `Team ${(idx % 4) + 1}`,
    entryMode: 'three' as const,
    scoringType: 'handicap' as const,
    g1: 180 + idx * 5,
    g2: 190 + idx * 5,
    g3: 200 + idx * 5,
    scratchScore: 570 + idx * 15,
    handicap: 30,
    grandTotal: 600 + idx * 15,
    isAbsent: false,
    isSub: false,
    createdAt: '',
  }));

  const bracket = buildEightPlayerBracket(entrants, 'handicap', 'Bracket #1', 5, 25, 10);
  assert.ok(bracket);
  assert.equal(bracket.quarterfinals.length, 4);
  assert.equal(bracket.champion.name, 'Bowler 8');
  assert.equal(bracket.champion.payout, 25);
  assert.equal(bracket.runnerUp.name, 'Bowler 4');
  assert.equal(bracket.runnerUp.payout, 10);
});

test('generateRoundRobinSchedule produces valid lane pairs for each week', () => {
  const teams = ['Pin Crushers', 'Split Happens', 'Gutter Gang', 'Pocket Pounders'];
  const schedule = generateRoundRobinSchedule(teams, 1, 6);
  assert.equal(schedule.length, 12);
  const week1 = schedule.filter((m) => m.week === 1);
  assert.equal(week1.length, 2);
  assert.equal(week1[0].oddLane, 1);
  assert.equal(week1[0].evenLane, 2);
  assert.equal(week1[1].oddLane, 3);
  assert.equal(week1[1].evenLane, 4);
});

test('calculateTreasurySummary splits house lineage and prize fund accurately', () => {
  const roster: RosterPlayer[] = [
    { id: 'p1', name: 'Bowler 1', team: 'T1' },
    { id: 'p2', name: 'Bowler 2', team: 'T1' },
  ];
  const dues: Record<string, WeeklyDuesRecord> = {
    p1: {
      playerId: 'p1',
      playerName: 'Bowler 1',
      team: 'T1',
      status: 'paid',
      amountPaid: 22,
      sidePotStrike: true,
      sidePotHighGame: false,
    },
    p2: {
      playerId: 'p2',
      playerName: 'Bowler 2',
      team: 'T1',
      status: 'owes',
      amountPaid: 0,
      sidePotStrike: false,
      sidePotHighGame: false,
    },
  };

  const summary = calculateTreasurySummary(roster, dues, {
    ...DEFAULT_SETTINGS,
    weeklyDuesPerBowler: 22,
    lineageCostPerBowler: 12,
    secretaryFeePerBowler: 0,
  });

  assert.equal(summary.expectedGrossDues, 44);
  assert.equal(summary.collectedGrossDues, 22);
  assert.equal(summary.outstandingArrears, 22);
  assert.equal(summary.houseLineageCut, 12);
  assert.equal(summary.netPrizeFundContribution, 10);
  assert.equal(summary.strikePotCollected, 5);
});

test('computeSeasonTeamPerformance and computeBowlerAbsentScore calculate weekly team consistency and league-agnostic absent scores', () => {
  const seed = createInitialSeedState();
  const teamPerf = computeSeasonTeamPerformance(
    seed.history,
    seed.bowlers,
    seed.settings,
    true
  );

  assert.equal(teamPerf.weekLabels.length, 4);
  assert.equal(teamPerf.teams.length, 4);
  assert.ok(teamPerf.mostConsistentTeam);
  assert.equal(teamPerf.mostConsistentTeam.consistencyRank, 1);

  const absFixed = computeBowlerAbsentScore(180, {
    ...DEFAULT_SETTINGS,
    absentRuleType: 'fixed',
    absentScore: 150,
    entryMode: 'three',
  });
  assert.equal(absFixed.perGame, 150);
  assert.equal(absFixed.totalSeries, 450);

  const absMinusPins = computeBowlerAbsentScore(180, {
    ...DEFAULT_SETTINGS,
    absentRuleType: 'avg_minus_pins',
    absentPenaltyPins: 10,
    entryMode: 'three',
  });
  assert.equal(absMinusPins.perGame, 170);
  assert.equal(absMinusPins.totalSeries, 510);
});

test('parseUniversalBackupPayload and computeMasterDatabaseMetrics preserve all leagues across JSON and Single-HTML backups', () => {
  const seed = createInitialSeedState();
  assert.ok(seed.allLeaguesRegistry);
  assert.equal(Object.keys(seed.allLeaguesRegistry).length, 3);

  const metrics = computeMasterDatabaseMetrics(seed.allLeaguesRegistry, null, null);
  assert.equal(metrics.totalLeagues, 3);
  assert.equal(metrics.activeLeagues, 3);
  assert.equal(metrics.duplicateBowlersCount, 2);

  const htmlBundle = generateStandaloneSingleHtmlBundle(seed, '1.0.07');
  const emptyFallback = { ...seed, bowlers: [], roster: [], history: [], allLeaguesRegistry: {} };

  const restoredFromHtml = parseUniversalBackupPayload(htmlBundle, emptyFallback);
  assert.equal(restoredFromHtml.sourceType, 'html_bundle');
  assert.equal(restoredFromHtml.restoredState.version, '1.0.07');
  assert.equal(restoredFromHtml.restoredState.bowlers.length, seed.bowlers.length);
  assert.equal(restoredFromHtml.restoredState.roster.length, seed.roster.length);
  assert.equal(restoredFromHtml.restoredState.history.length, seed.history.length);
  assert.equal(
    Object.keys(restoredFromHtml.restoredState.allLeaguesRegistry || {}).length,
    3
  );
});

test('compareSemverVersions and parseGithubRepoSpec accurately track GitHub version.json updates', () => {
  assert.equal(compareSemverVersions('1.0.08', '1.0.07'), 1);
  assert.equal(compareSemverVersions('1.0.09', '1.0.08'), 1);
  assert.equal(compareSemverVersions('1.0.06', '1.0.08'), -1);
  assert.equal(compareSemverVersions('1.0.08', '1.0.08'), 0);

  const shortSpec = parseGithubRepoSpec('MKStewart88/bowling-league-helper', 'main');
  assert.deepEqual(shortSpec, {
    owner: 'MKStewart88',
    repo: 'bowling-league-helper',
    branch: 'main',
  });

  const urlSpec = parseGithubRepoSpec(
    'https://github.com/MKStewart88/bowling-league-helper/tree/release',
    'main'
  );
  assert.deepEqual(urlSpec, {
    owner: 'MKStewart88',
    repo: 'bowling-league-helper',
    branch: 'release',
  });

  const merged = mergePatchNotesHistory([
    {
      version: '1.0.14',
      date: 'November 20, 2026',
      title: 'Remote GitHub Test Release',
      highlights: ['Tested live GitHub version.json update'],
      changes: [{ category: 'New Feature', description: 'Live GitHub update' }],
    },
  ]);
  assert.equal(merged[0].version, '1.0.14');
  assert.equal(merged[0].isLatest, true);
});

test('createHttpDesktopBridge communicates with native desktop host HTTP endpoints', async () => {
  const { createHttpDesktopBridge } = await import('./desktopBridge');
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const origFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    const body = typeof init?.body === 'string' ? init.body : undefined;
    calls.push({ url, method, body });

    if (url.endsWith('/api/desktop/info')) {
      return new Response(
        JSON.stringify({
          isDesktopApp: true,
          installDir: 'C:\\BowlingLeagueHelper',
          defaultSaveDir: 'C:\\Users\\League\\Documents',
          desktopVersion: '1.0.14',
          lastSaveFilePath: '',
          lastSavedAt: null,
          lastSaveExists: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/desktop/close-attempt')) {
      return new Response(
        JSON.stringify({
          ok: false,
          missing: true,
          missingPath: null,
          reason: 'No save file location has been selected yet.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const bridge = createHttpDesktopBridge('http://127.0.0.1:45123');
    const info = await bridge.getDesktopInfo();
    assert.equal(info.isDesktopApp, true);
    assert.equal(info.installDir, 'C:\\BowlingLeagueHelper');

    const closeRes = await bridge.attemptCloseWithSave('{"test":1}');
    assert.equal(closeRes.ok, false);
    assert.equal(closeRes.missing, true);

    const updRes = await bridge.installUpdateToProgramFolder({
      targetVersion: '1.0.15',
      htmlContent: '<html><div id="root"></div></html>',
      versionJsonContent: '{"latestVersion":"1.0.15"}',
    });
    assert.equal(updRes.ok, true);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].method, 'POST');
    assert.ok(calls[2].url.endsWith('/api/desktop/install-update'));
  } finally {
    globalThis.fetch = origFetch;
  }
});



