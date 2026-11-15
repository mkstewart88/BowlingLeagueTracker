export interface LeagueSettings {
  leagueId?: string;
  leagueStatus?: 'active' | 'inactive';
  leagueName: string;
  seasonName: string;
  weekNumber: string;
  totalWeeks: number; // Configurable for any season length (e.g. 12, 16, 30, 36)
  bowlersPerTeam?: number; // Configurable 1 (Singles) to 5 (5-Person Teams), default 4
  customCsvName: string;
  formatMode: 'individual' | 'team';
  entryMode: 'single' | 'three';
  scoringType: 'scratch' | 'handicap';
  // League-Agnostic Absentee & Vacant Rules
  absentRuleType?: 'fixed' | 'avg_minus_pins' | 'avg_percent';
  absentScore: number; // Used when absentRuleType === 'fixed' or fallback
  absentPenaltyPins?: number; // Used when absentRuleType === 'avg_minus_pins' (e.g. Avg - 10)
  absentPercent?: number; // Used when absentRuleType === 'avg_percent' (e.g. 90% of Avg)
  vacantScore?: number; // Score for a vacant roster slot (e.g. 150)
  maxGameScore: number;
  showAbsent: 'yes' | 'no';
  highlightFirst: 'yes' | 'no';
  showTeamSummary: 'yes' | 'no';
  topNote: string;
  bottomNote: string;
  // League-Agnostic Handicap & Point Rules
  handicapBasis: number; // e.g. 200, 210, 220, 230
  handicapPercent: number; // e.g. 80, 85, 90, 100
  maxHandicapPerGame?: number; // 0 = No limit, or cap per game
  autoCalculateHandicap: 'yes' | 'no';
  pointSystem: '7pt' | '8pt' | '9pt' | '5pt' | '4pt' | 'custom';
  customPointsPerGame?: number; // Used when pointSystem === 'custom'
  customPointsPerSeries?: number; // Used when pointSystem === 'custom'
  // Financial / Treasury Settings (Customizable for any alley)
  weeklyDuesPerBowler: number;
  lineageCostPerBowler: number;
  secretaryFeePerBowler?: number;
  startingLane: number; // Any starting lane at the bowling center
  // Bracket & Side Pot Settings
  bracketEntryFee: number;
  bracketFirstPlacePayout: number;
  bracketSecondPlacePayout: number;
  sidePotEntryFee?: number;
  // Customizable Honor Score Thresholds
  honorGameThreshold?: number; // e.g. 200 or 225
  honorSeriesThreshold?: number; // e.g. 600 or 650
  // Auto-Backup Scheduler & Optional Location Settings
  autoBackupEnabled?: boolean;
  autoBackupInterval?: 'on_change' | '5min' | '15min' | '30min' | 'on_finish_week' | 'manual';
  autoBackupFormat?: 'json' | 'html';
  autoBackupDirectoryLabel?: string;
  lastLocalBackupAt?: string | null;
  lastAutoBackupAt?: string | null;
  // GitHub Version Tracking & Self-Updater Settings
  githubRepo?: string; // e.g. 'MKStewart88/bowling-league-helper' or full GitHub URL
  githubBranch?: string; // e.g. 'main'
  lastGithubUpdateCheckAt?: string | null;
}

export interface VersionManifest {
  appName: string;
  latestVersion: string;
  releaseDate: string;
  title: string;
  htmlBundlePath: string;
  fallbackHtmlPaths?: string[];
  releases: PatchRelease[];
}

export type GameRollStatus = 'normal' | 'absent' | 'vacant' | 'forfeit';

export interface BowlerEntry {
  id: string;
  name: string;
  team: string;
  entryMode: 'single' | 'three';
  scoringType: 'scratch' | 'handicap';
  g1: number;
  g2: number;
  g3: number;
  scratchScore: number;
  handicap: number;
  grandTotal: number;
  isAbsent: boolean;
  isSub: boolean;
  rollStatus?: GameRollStatus;
  createdAt: string;
  placement?: number | null;
}

export interface RosterPlayer {
  id: string;
  bowlerNumber?: number;
  name: string;
  nickname?: string;
  gender?: 'M' | 'W' | 'Jr';
  team: string;
  bookAverage?: number;
  usbcId?: string;
  birthday?: string;
  officerRole?: '' | 'President' | 'Vice President' | 'Secretary' | 'Treasurer' | 'Sergeant-at-Arms';
}

export interface WeeklyDuesRecord {
  playerId: string;
  playerName: string;
  team: string;
  status: 'paid' | 'owes' | 'paid_ahead' | 'exempt';
  amountPaid: number;
  sidePotStrike: boolean;
  sidePotHighGame: boolean;
  notes?: string;
}

export interface BracketMatchNode {
  slotIndex: number;
  playerA: {
    name: string;
    team: string;
    lane: number;
    hdcpPerGame: number;
    g1Score: number;
  };
  playerB: {
    name: string;
    team: string;
    lane: number;
    hdcpPerGame: number;
    g1Score: number;
  };
  round1Winner: {
    name: string;
    g1Total: number;
    g2Score: number;
    hdcpPerGame: number;
    g2Total: number;
  };
}

export interface EightPlayerBracket {
  id: string;
  title: string;
  mode: 'handicap' | 'scratch';
  entryFee: number;
  firstPrize: number;
  secondPrize: number;
  quarterfinals: BracketMatchNode[];
  semifinals: {
    match1Winner: { name: string; g2Total: number; g3Score: number; g3Total: number };
    match2Winner: { name: string; g2Total: number; g3Score: number; g3Total: number };
  };
  champion: { name: string; g3Total: number; payout: number };
  runnerUp: { name: string; g3Total: number; payout: number };
}

export interface ArchivedWeek {
  id: string;
  league: string;
  week: string;
  date: string;
  weekNotes?: string;
  settings: LeagueSettings;
  bowlers: BowlerEntry[];
  dues?: WeeklyDuesRecord[];
  laneMatchups?: LaneMatchup[];
}

export interface LaneMatchup {
  week: number;
  oddLane: number;
  evenLane: number;
  teamA: string;
  teamB: string;
  isPositionRound?: boolean;
  needsMakeup?: boolean;
}

export interface PatchRelease {
  version: string;
  date: string;
  title: string;
  isLatest?: boolean;
  highlights: string[];
  changes: {
    category: 'New Feature' | 'League Rules' | 'Improvement' | 'Data & Backup';
    description: string;
  }[];
}

export interface AppState {
  version: string;
  settings: LeagueSettings;
  bowlers: BowlerEntry[];
  roster: RosterPlayer[];
  history: ArchivedWeek[];
  currentDues: Record<string, WeeklyDuesRecord>;
  schedule: LaneMatchup[];
  bracketEntrantIds: string[];
  weekNotes?: string;
  weekArchived: boolean;
  weekArchiveId: string | null;
  activeLeagueId?: string;
  allLeaguesRegistry?: Record<string, Omit<AppState, 'allLeaguesRegistry'>>;
}
