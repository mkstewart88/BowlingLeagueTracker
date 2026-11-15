export interface LeagueSettings {
  leagueId?: string;
  leagueStatus?: 'active' | 'inactive';
  leagueName: string;
  seasonName: string;
  weekNumber: string;
  totalWeeks: number; // e.g. 31
  customCsvName: string;
  formatMode: 'individual' | 'team';
  entryMode: 'single' | 'three';
  scoringType: 'scratch' | 'handicap';
  absentScore: number;
  maxGameScore: number;
  showAbsent: 'yes' | 'no';
  highlightFirst: 'yes' | 'no';
  showTeamSummary: 'yes' | 'no';
  topNote: string;
  bottomNote: string;
  // Handicap & League Rules
  handicapBasis: number; // e.g. 220
  handicapPercent: number; // e.g. 90
  autoCalculateHandicap: 'yes' | 'no';
  pointSystem: '7pt' | '8pt' | '5pt' | '4pt';
  weeklyDuesPerBowler: number; // e.g. 22
  lineageCostPerBowler: number; // e.g. 12
  startingLane: number; // e.g. 1
  // Bracket Settings
  bracketEntryFee: number; // e.g. 5
  bracketFirstPlacePayout: number; // e.g. 25
  bracketSecondPlacePayout: number; // e.g. 10
  // Auto-Backup Scheduler & Optional Location Settings
  autoBackupEnabled?: boolean;
  autoBackupInterval?: 'on_change' | '5min' | '15min' | '30min' | 'on_finish_week' | 'manual';
  autoBackupFormat?: 'json' | 'html';
  autoBackupDirectoryLabel?: string;
  lastLocalBackupAt?: string | null;
  lastAutoBackupAt?: string | null;
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
  bowlerNumber?: number; // e.g. 156 (from BLS grid)
  name: string;
  nickname?: string;
  gender?: 'M' | 'W' | 'Jr';
  team: string;
  bookAverage?: number; // Entering / fallback average
  usbcId?: string;
  birthday?: string; // e.g. "11/18"
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
  quarterfinals: BracketMatchNode[]; // 4 matchups (8 players)
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
  bracketEntrantIds: string[]; // IDs of bowlers entered into weekly brackets
  weekArchived: boolean;
  weekArchiveId: string | null;
  // Multi-League Registry embedded in state & backups so 1 file holds all leagues
  activeLeagueId?: string;
  allLeaguesRegistry?: Record<string, Omit<AppState, 'allLeaguesRegistry'>>;
}
