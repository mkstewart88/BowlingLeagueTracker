import { AppState, ArchivedWeek, BowlerEntry, RosterPlayer, WeeklyDuesRecord } from '../types/bowling';
import { CURRENT_APP_VERSION, DEFAULT_SETTINGS, generateRoundRobinSchedule } from './bowlingLogic';

const SEED_ROSTER: RosterPlayer[] = [
  { id: 'r1', bowlerNumber: 101, name: 'Frank Miller', gender: 'M', team: 'Pin Crushers', bookAverage: 188, usbcId: '8492-1044', birthday: '11/16', officerRole: 'President' },
  { id: 'r2', bowlerNumber: 102, name: 'Gary Stewart', gender: 'M', team: 'Pin Crushers', bookAverage: 196, usbcId: '8492-1089', birthday: '11/24', officerRole: 'Secretary' },
  { id: 'r3', bowlerNumber: 103, name: 'Diane Kowalski', gender: 'W', team: 'Split Happens', bookAverage: 172, usbcId: '8492-1192', birthday: '12/03', officerRole: 'Treasurer' },
  { id: 'r4', bowlerNumber: 104, name: 'Walter Sobchak', gender: 'M', team: 'Split Happens', bookAverage: 204, usbcId: '8492-1201', birthday: '01/19', officerRole: 'Vice President' },
  { id: 'r5', bowlerNumber: 105, name: 'Arthur Pendelton', gender: 'M', team: 'Pocket Pounders', bookAverage: 164, usbcId: '8492-1350', birthday: '02/14', officerRole: '' },
  { id: 'r6', bowlerNumber: 106, name: 'Linda Martinez', gender: 'W', team: 'Pocket Pounders', bookAverage: 179, usbcId: '8492-1411', birthday: '11/29', officerRole: '' },
  { id: 'r7', bowlerNumber: 107, name: 'Roy Munson', gender: 'M', team: 'Alley Cats', bookAverage: 211, usbcId: '8492-1502', birthday: '04/10', officerRole: '' },
  { id: 'r8', bowlerNumber: 108, name: 'Carl Esposito', gender: 'M', team: 'Alley Cats', bookAverage: 175, usbcId: '8492-1588', birthday: '05/22', officerRole: '' },
  { id: 'r9', bowlerNumber: 109, name: 'Norma Jean Baker', gender: 'W', team: 'Pin Crushers', bookAverage: 162, usbcId: '8492-1604', birthday: '06/01', officerRole: '' },
  { id: 'r10', bowlerNumber: 110, name: 'Harold Jenkins', gender: 'M', team: 'Split Happens', bookAverage: 168, usbcId: '8492-1690', birthday: '08/15', officerRole: '' },
];

const WEEK_1_BOWLERS: BowlerEntry[] = [
  { id: 'w1-1', name: 'Frank Miller', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 185, g2: 192, g3: 179, scratchScore: 556, handicap: 84, grandTotal: 640, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:00:00Z' },
  { id: 'w1-2', name: 'Gary Stewart', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 202, g2: 189, g3: 214, scratchScore: 605, handicap: 63, grandTotal: 668, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:02:00Z' },
  { id: 'w1-3', name: 'Diane Kowalski', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 168, g2: 175, g3: 181, scratchScore: 524, handicap: 129, grandTotal: 653, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:04:00Z' },
  { id: 'w1-4', name: 'Walter Sobchak', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 215, g2: 201, g3: 195, scratchScore: 611, handicap: 42, grandTotal: 653, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:06:00Z' },
  { id: 'w1-5', name: 'Arthur Pendelton', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 158, g2: 166, g3: 171, scratchScore: 495, handicap: 150, grandTotal: 645, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:08:00Z' },
  { id: 'w1-6', name: 'Linda Martinez', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 182, g2: 177, g3: 190, scratchScore: 549, handicap: 111, grandTotal: 660, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:10:00Z' },
  { id: 'w1-7', name: 'Roy Munson', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 224, g2: 205, g3: 212, scratchScore: 641, handicap: 24, grandTotal: 665, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:12:00Z' },
  { id: 'w1-8', name: 'Carl Esposito', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 170, g2: 184, g3: 176, scratchScore: 530, handicap: 120, grandTotal: 650, isAbsent: false, isSub: false, createdAt: '2026-10-15T20:14:00Z' },
];

const WEEK_2_BOWLERS: BowlerEntry[] = [
  { id: 'w2-1', name: 'Frank Miller', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 194, g2: 201, g3: 188, scratchScore: 583, handicap: 84, grandTotal: 667, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:00:00Z' },
  { id: 'w2-2', name: 'Gary Stewart', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 210, g2: 225, g3: 198, scratchScore: 633, handicap: 63, grandTotal: 696, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:02:00Z' },
  { id: 'w2-3', name: 'Diane Kowalski', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 180, g2: 188, g3: 172, scratchScore: 540, handicap: 129, grandTotal: 669, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:04:00Z' },
  { id: 'w2-4', name: 'Walter Sobchak', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 205, g2: 234, g3: 211, scratchScore: 650, handicap: 42, grandTotal: 692, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:06:00Z' },
  { id: 'w2-5', name: 'Arthur Pendelton', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 172, g2: 168, g3: 184, scratchScore: 524, handicap: 150, grandTotal: 674, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:08:00Z' },
  { id: 'w2-6', name: 'Linda Martinez', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 191, g2: 185, g3: 179, scratchScore: 555, handicap: 111, grandTotal: 666, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:10:00Z' },
  { id: 'w2-7', name: 'Roy Munson', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 245, g2: 218, g3: 227, scratchScore: 690, handicap: 24, grandTotal: 714, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:12:00Z' },
  { id: 'w2-8', name: 'Carl Esposito', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 165, g2: 179, g3: 182, scratchScore: 526, handicap: 120, grandTotal: 646, isAbsent: false, isSub: false, createdAt: '2026-10-22T20:14:00Z' },
];

const WEEK_3_BOWLERS: BowlerEntry[] = [
  { id: 'w3-1', name: 'Frank Miller', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 204, g2: 191, g3: 212, scratchScore: 607, handicap: 81, grandTotal: 688, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:00:00Z' },
  { id: 'w3-2', name: 'Gary Stewart', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 218, g2: 205, g3: 233, scratchScore: 656, handicap: 36, grandTotal: 692, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:02:00Z' },
  { id: 'w3-3', name: 'Diane Kowalski', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 192, g2: 184, g3: 199, scratchScore: 575, handicap: 114, grandTotal: 689, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:04:00Z' },
  { id: 'w3-4', name: 'Walter Sobchak', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 198, g2: 212, g3: 220, scratchScore: 630, handicap: 27, grandTotal: 657, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:06:00Z' },
  { id: 'w3-5', name: 'Arthur Pendelton', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 181, g2: 175, g3: 189, scratchScore: 545, handicap: 135, grandTotal: 680, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:08:00Z' },
  { id: 'w3-6', name: 'Linda Martinez', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 176, g2: 195, g3: 188, scratchScore: 559, handicap: 96, grandTotal: 655, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:10:00Z' },
  { id: 'w3-7', name: 'Roy Munson', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 215, g2: 236, g3: 209, scratchScore: 660, handicap: 9, grandTotal: 669, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:12:00Z' },
  { id: 'w3-8', name: 'Carl Esposito', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 188, g2: 174, g3: 181, scratchScore: 543, handicap: 114, grandTotal: 657, isAbsent: false, isSub: false, createdAt: '2026-10-29T20:14:00Z' },
];

const CURRENT_WEEK_4_BOWLERS: BowlerEntry[] = [
  { id: 'w4-1', name: 'Gary Stewart', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 226, g2: 214, g3: 235, scratchScore: 675, handicap: 39, grandTotal: 714, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:00:00Z' },
  { id: 'w4-2', name: 'Roy Munson', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 258, g2: 221, g3: 219, scratchScore: 698, handicap: 0, grandTotal: 698, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:03:00Z' },
  { id: 'w4-3', name: 'Diane Kowalski', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 195, g2: 204, g3: 186, scratchScore: 585, handicap: 102, grandTotal: 687, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:06:00Z' },
  { id: 'w4-4', name: 'Frank Miller', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 201, g2: 196, g3: 208, scratchScore: 605, handicap: 72, grandTotal: 677, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:09:00Z' },
  { id: 'w4-5', name: 'Walter Sobchak', team: 'Split Happens', entryMode: 'three', scoringType: 'handicap', g1: 212, g2: 208, g3: 216, scratchScore: 636, handicap: 27, grandTotal: 663, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:12:00Z' },
  { id: 'w4-6', name: 'Linda Martinez', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 184, g2: 192, g3: 185, scratchScore: 561, handicap: 93, grandTotal: 654, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:15:00Z' },
  { id: 'w4-7', name: 'Carl Esposito', team: 'Alley Cats', entryMode: 'three', scoringType: 'handicap', g1: 192, g2: 185, g3: 199, scratchScore: 576, handicap: 105, grandTotal: 681, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:16:00Z' },
  { id: 'w4-8', name: 'Norma Jean Baker', team: 'Pin Crushers', entryMode: 'three', scoringType: 'handicap', g1: 174, g2: 181, g3: 169, scratchScore: 524, handicap: 156, grandTotal: 680, isAbsent: false, isSub: false, createdAt: '2026-11-05T20:17:00Z' },
  { id: 'w4-9', name: 'Arthur Pendelton', team: 'Pocket Pounders', entryMode: 'three', scoringType: 'handicap', g1: 150, g2: 150, g3: 150, scratchScore: 450, handicap: 0, grandTotal: 450, isAbsent: true, isSub: false, rollStatus: 'absent', createdAt: '2026-11-05T20:18:00Z' },
];

export function createInitialSeedState(): AppState {
  const history: ArchivedWeek[] = [
    {
      id: 'hist-wk-1',
      league: 'Thursday Night Rollers',
      week: '1',
      date: '2026-10-15T21:30:00Z',
      settings: { ...DEFAULT_SETTINGS, weekNumber: '1' },
      bowlers: WEEK_1_BOWLERS,
    },
    {
      id: 'hist-wk-2',
      league: 'Thursday Night Rollers',
      week: '2',
      date: '2026-10-22T21:30:00Z',
      weekNotes: 'High Handicap Game side pot paid out after Game 3. Roy Munson bowled 245 in Game 1.',
      settings: { ...DEFAULT_SETTINGS, weekNumber: '2' },
      bowlers: WEEK_2_BOWLERS,
    },
    {
      id: 'hist-wk-3',
      league: 'Thursday Night Rollers',
      week: '3',
      date: '2026-10-29T21:30:00Z',
      weekNotes: 'Halftime 50/50 raffle raised $140 for end-of-season banquet prize fund.',
      settings: { ...DEFAULT_SETTINGS, weekNumber: '3' },
      bowlers: WEEK_3_BOWLERS,
    },
  ];

  const currentDues: Record<string, WeeklyDuesRecord> = {};
  SEED_ROSTER.forEach((p, idx) => {
    const isOwes = idx === 4; // Arthur owes this week
    currentDues[p.id] = {
      playerId: p.id,
      playerName: p.name,
      team: p.team,
      status: isOwes ? 'owes' : 'paid',
      amountPaid: isOwes ? 0 : DEFAULT_SETTINGS.weeklyDuesPerBowler,
      sidePotStrike: idx % 2 === 0,
      sidePotHighGame: idx < 5,
      notes: isOwes ? 'Absent Week 4 - Will pay double Week 5' : '',
    };
  });

  const teams = ['Pin Crushers', 'Split Happens', 'Pocket Pounders', 'Alley Cats'];
  const schedule = generateRoundRobinSchedule(teams, 1, 12);

  const thursdayLeague: Omit<AppState, 'allLeaguesRegistry'> = {
    version: CURRENT_APP_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      leagueId: 'thursday-night-rollers',
      leagueStatus: 'active',
      leagueName: 'Thursday Night Rollers',
    },
    bowlers: CURRENT_WEEK_4_BOWLERS,
    roster: SEED_ROSTER,
    history,
    currentDues,
    schedule,
    bracketEntrantIds: ['w4-1', 'w4-2', 'w4-3', 'w4-4', 'w4-5', 'w4-6', 'w4-7', 'w4-8'],
    weekNotes: 'Upcoming Week 5 is Position Round. Double-check any makeup scores before closing.',
    weekArchived: false,
    weekArchiveId: null,
    activeLeagueId: 'thursday-night-rollers',
  };

  // Second League: Tuesday Mixed 2026-2027 (inspired by user screenshot #2)
  const tuesdayRoster: RosterPlayer[] = [
    { id: 'tm-1', bowlerNumber: 156, name: 'Sam Kinley', gender: 'W', team: 'Shake N Bake', bookAverage: 155, birthday: '9/14' },
    { id: 'tm-2', bowlerNumber: 154, name: 'Matt Kinley', gender: 'M', team: 'Shake N Bake', bookAverage: 172, officerRole: 'President' },
    { id: 'tm-3', bowlerNumber: 155, name: 'Kristen Poulin', gender: 'W', team: 'Shake N Bake', bookAverage: 148 },
    { id: 'tm-4', bowlerNumber: 111, name: 'Steve Poulin', gender: 'M', team: 'Shake N Bake', bookAverage: 168 },
    { id: 'tm-5', bowlerNumber: 201, name: 'Becky Kuchtey', gender: 'W', team: 'Pin Pals', bookAverage: 162, birthday: '9/1', officerRole: 'Secretary' },
    { id: 'tm-6', bowlerNumber: 202, name: 'Walter Sobchak', gender: 'M', team: 'Pin Pals', bookAverage: 205 }, // Cross-league bowler #1
    { id: 'tm-7', bowlerNumber: 203, name: 'Roy Munson', gender: 'M', team: 'No Luck', bookAverage: 212 }, // Cross-league bowler #2
    { id: 'tm-8', bowlerNumber: 204, name: 'Robert Ellis', gender: 'M', team: 'No Luck', bookAverage: 184 },
  ];

  const tuesdayBowlers: BowlerEntry[] = [
    { id: 'tmb-1', name: 'Sam Kinley', team: 'Shake N Bake', entryMode: 'three', scoringType: 'handicap', g1: 154, g2: 189, g3: 222, scratchScore: 565, handicap: 120, grandTotal: 685, isAbsent: false, isSub: false, createdAt: '2026-11-10T19:00:00Z' },
    { id: 'tmb-2', name: 'Matt Kinley', team: 'Shake N Bake', entryMode: 'three', scoringType: 'handicap', g1: 159, g2: 183, g3: 183, scratchScore: 525, handicap: 84, grandTotal: 609, isAbsent: false, isSub: false, createdAt: '2026-11-10T19:01:00Z' },
    { id: 'tmb-3', name: 'Kristen Poulin', team: 'Shake N Bake', entryMode: 'three', scoringType: 'handicap', g1: 140, g2: 140, g3: 140, scratchScore: 420, handicap: 120, grandTotal: 540, isAbsent: true, isSub: false, createdAt: '2026-11-10T19:02:00Z' },
    { id: 'tmb-4', name: 'Steve Poulin', team: 'Shake N Bake', entryMode: 'three', scoringType: 'handicap', g1: 168, g2: 175, g3: 188, scratchScore: 531, handicap: 90, grandTotal: 621, isAbsent: false, isSub: false, createdAt: '2026-11-10T19:03:00Z' },
    { id: 'tmb-5', name: 'Becky Kuchtey', team: 'Pin Pals', entryMode: 'three', scoringType: 'handicap', g1: 172, g2: 168, g3: 180, scratchScore: 520, handicap: 102, grandTotal: 622, isAbsent: false, isSub: false, createdAt: '2026-11-10T19:04:00Z' },
    { id: 'tmb-6', name: 'Walter Sobchak', team: 'Pin Pals', entryMode: 'three', scoringType: 'handicap', g1: 215, g2: 204, g3: 226, scratchScore: 645, handicap: 39, grandTotal: 684, isAbsent: false, isSub: false, createdAt: '2026-11-10T19:05:00Z' },
    { id: 'tmb-7', name: 'Roy Munson', team: 'No Luck', entryMode: 'three', scoringType: 'handicap', g1: 224, g2: 210, g3: 235, scratchScore: 669, handicap: 21, grandTotal: 690, isAbsent: false, isSub: false, createdAt: '2026-11-10T19:06:00Z' },
    { id: 'tmb-8', name: 'Robert Ellis', team: 'No Luck', entryMode: 'three', scoringType: 'handicap', g1: 192, g2: 185, g3: 205, scratchScore: 582, handicap: 72, grandTotal: 654, isAbsent: false, isSub: false, createdAt: '2026-11-10T19:07:00Z' },
  ];

  const tuesdayLeague: Omit<AppState, 'allLeaguesRegistry'> = {
    version: CURRENT_APP_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      leagueId: 'tuesday-mixed-2026',
      leagueStatus: 'active',
      leagueName: 'Tuesday Mixed 2026-2027',
      seasonName: 'Fall / Winter 2026-2027',
      weekNumber: '2',
      totalWeeks: 31,
      pointSystem: '8pt',
      weeklyDuesPerBowler: 20,
      lineageCostPerBowler: 11,
    },
    bowlers: tuesdayBowlers,
    roster: tuesdayRoster,
    history: [],
    currentDues: {},
    schedule: generateRoundRobinSchedule(['Shake N Bake', 'Pin Pals', 'No Luck', 'Team 4'], 1, 12),
    bracketEntrantIds: tuesdayBowlers.filter((b) => !b.isAbsent).map((b) => b.id),
    weekArchived: false,
    weekArchiveId: null,
    activeLeagueId: 'tuesday-mixed-2026',
  };

  // Third League: Sunday Scratch Trios
  const sundayRoster: RosterPlayer[] = [
    { id: 'ss-1', bowlerNumber: 301, name: 'Benito Galio', gender: 'M', team: 'Strike Force', bookAverage: 215, officerRole: 'President' },
    { id: 'ss-2', bowlerNumber: 302, name: 'Josefa Dwyer', gender: 'W', team: 'Strike Force', bookAverage: 198, officerRole: 'Secretary' },
    { id: 'ss-3', bowlerNumber: 303, name: 'Lon Mead', gender: 'M', team: 'Kingpins', bookAverage: 208 },
    { id: 'ss-4', bowlerNumber: 304, name: 'Stephan Daley', gender: 'M', team: 'Kingpins', bookAverage: 204 },
  ];

  const sundayLeague: Omit<AppState, 'allLeaguesRegistry'> = {
    version: CURRENT_APP_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      leagueId: 'sunday-scratch-trios',
      leagueStatus: 'active',
      leagueName: 'Sunday Scratch Trios',
      seasonName: 'Winter 2026-2027',
      weekNumber: '1',
      totalWeeks: 28,
      scoringType: 'scratch',
      weeklyDuesPerBowler: 25,
      lineageCostPerBowler: 12,
    },
    bowlers: [
      { id: 'ssb-1', name: 'Benito Galio', team: 'Strike Force', entryMode: 'three', scoringType: 'scratch', g1: 214, g2: 225, g3: 207, scratchScore: 646, handicap: 0, grandTotal: 646, isAbsent: false, isSub: false, createdAt: '2026-11-08T18:00:00Z' },
      { id: 'ssb-2', name: 'Josefa Dwyer', team: 'Strike Force', entryMode: 'three', scoringType: 'scratch', g1: 191, g2: 195, g3: 204, scratchScore: 590, handicap: 0, grandTotal: 590, isAbsent: false, isSub: false, createdAt: '2026-11-08T18:01:00Z' },
      { id: 'ssb-3', name: 'Lon Mead', team: 'Kingpins', entryMode: 'three', scoringType: 'scratch', g1: 200, g2: 205, g3: 202, scratchScore: 607, handicap: 0, grandTotal: 607, isAbsent: false, isSub: false, createdAt: '2026-11-08T18:02:00Z' },
      { id: 'ssb-4', name: 'Stephan Daley', team: 'Kingpins', entryMode: 'three', scoringType: 'scratch', g1: 199, g2: 205, g3: 198, scratchScore: 602, handicap: 0, grandTotal: 602, isAbsent: false, isSub: false, createdAt: '2026-11-08T18:03:00Z' },
    ],
    roster: sundayRoster,
    history: [],
    currentDues: {},
    schedule: generateRoundRobinSchedule(['Strike Force', 'Kingpins'], 1, 12),
    bracketEntrantIds: ['ssb-1', 'ssb-2', 'ssb-3', 'ssb-4'],
    weekArchived: false,
    weekArchiveId: null,
    activeLeagueId: 'sunday-scratch-trios',
  };

  return {
    ...thursdayLeague,
    activeLeagueId: 'thursday-night-rollers',
    allLeaguesRegistry: {
      'thursday-night-rollers': thursdayLeague,
      'tuesday-mixed-2026': tuesdayLeague,
      'sunday-scratch-trios': sundayLeague,
    },
  };
}

