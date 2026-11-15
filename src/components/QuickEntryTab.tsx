import React, { useState, useRef, useEffect } from 'react';
import { AppState, BowlerEntry, LeagueSettings, RosterPlayer } from '../types/bowling';
import {
  calculateBowlerHandicap,
  computeSeasonPlayerStats,
  rankWeeklyBowlers,
} from '../utils/bowlingLogic';
import {
  chooseAutoBackupLocation,
  exportMasterLeagueBackupJson,
  exportMasterRosterCsv,
  exportWeeklyResultsCsv,
  getConnectedAutoBackupHandleName,
  saveLeagueFileToComputer,
} from '../utils/fileExport';
import {
  Printer,
  Download,
  Undo2,
  RotateCcw,
  Upload,
  Check,
  UserPlus,
  Edit3,
  Trash2,
  UserX,
  HardDriveDownload,
  ChevronDown,
  Table2,
  ListChecks,
} from 'lucide-react';
import { TeamRecapSheet } from './TeamRecapSheet';

interface QuickEntryTabProps {
  appState: AppState;
  canUndo: boolean;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onAddOrUpdateBowler: (entry: Omit<BowlerEntry, 'id' | 'createdAt'>, editingId: string | null) => void;
  onDeleteBowler: (id: string) => void;
  onMarkAbsent: (rosterPlayer: RosterPlayer) => void;
  onAddRosterPlayer: (name: string, team: string, bookAvg?: number) => void;
  onDeleteRosterPlayer: (id: string) => void;
  onUndo: () => void;
  onStartNewWeek: () => void;
  onFinishWeekAndArchive: () => void;
  onImportBackupJson: (file: File) => void;
  onSwitchLeague: (leagueId: string) => void;
  onOpenLeagueAndBackupHub: () => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const QuickEntryTab: React.FC<QuickEntryTabProps> = ({
  appState,
  canUndo,
  onUpdateSettings,
  onAddOrUpdateBowler,
  onDeleteBowler,
  onMarkAbsent,
  onAddRosterPlayer,
  onDeleteRosterPlayer,
  onUndo,
  onStartNewWeek,
  onFinishWeekAndArchive,
  onImportBackupJson,
  onSwitchLeague,
  onOpenLeagueAndBackupHub,
  onShowToast,
}) => {
  const { settings, bowlers, roster, history } = appState;
  const [entryViewMode, setEntryViewMode] = useState<'simple' | 'recap'>('simple');

  // Score Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bowlerName, setBowlerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [singleScore, setSingleScore] = useState('');
  const [g1, setG1] = useState('');
  const [g2, setG2] = useState('');
  const [g3, setG3] = useState('');
  const [hdcp, setHdcp] = useState('');
  const [isSub, setIsSub] = useState(false);
  const [autoFilledHdcpHint, setAutoFilledHdcpHint] = useState<string | null>(null);

  // Filter / Sort State
  const [enteredSearch, setEnteredSearch] = useState('');
  const [enteredSort, setEnteredSort] = useState<'entry' | 'score' | 'name' | 'team'>('entry');

  // Quick Roster Add State
  const [newRosterName, setNewRosterName] = useState('');
  const [newRosterTeam, setNewRosterTeam] = useState('');
  const [newRosterBookAvg, setNewRosterBookAvg] = useState('175');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const g1InputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Season stats map for automatic book average & handicap lookup
  const seasonStats = computeSeasonPlayerStats(roster, history, bowlers, settings, false);

  const handleBowlerNameChange = (val: string) => {
    setBowlerName(val);
    const clean = val.trim().toLowerCase();
    if (!clean) {
      setAutoFilledHdcpHint(null);
      return;
    }

    const matchedRoster = roster.find((r) => r.name.toLowerCase() === clean);
    if (matchedRoster && matchedRoster.team && !teamName) {
      setTeamName(matchedRoster.team);
    }

    if (settings.scoringType === 'handicap' && settings.autoCalculateHandicap === 'yes') {
      const playerStat = seasonStats.find((s) => s.name.toLowerCase() === clean);
      const avg = playerStat?.currentAverage ?? matchedRoster?.bookAverage;
      if (avg && avg > 0) {
        const calc = calculateBowlerHandicap(
          avg,
          settings.handicapBasis,
          settings.handicapPercent,
          settings.entryMode
        );
        setHdcp(String(calc.totalHandicap));
        setAutoFilledHdcpHint(
          `Auto-filled from ${avg} avg (${settings.handicapPercent}% of ${settings.handicapBasis} = +${calc.perGame}/gm)`
        );
      } else {
        setAutoFilledHdcpHint(null);
      }
    }
  };

  // Recalculate auto handicap if entryMode changes while typing
  useEffect(() => {
    if (bowlerName && !editingId) {
      handleBowlerNameChange(bowlerName);
    }
  }, [settings.entryMode, settings.scoringType, settings.autoCalculateHandicap]);

  const clearForm = () => {
    setEditingId(null);
    setBowlerName('');
    setTeamName('');
    setSingleScore('');
    setG1('');
    setG2('');
    setG3('');
    setHdcp('');
    setIsSub(false);
    setAutoFilledHdcpHint(null);
  };

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = bowlerName.trim();
    if (!cleanName) {
      onShowToast('Please enter a bowler name.', true);
      nameInputRef.current?.focus();
      return;
    }

    // Check if roster has team fallback
    let resolvedTeam = teamName.trim();
    if (!resolvedTeam) {
      const rp = roster.find((r) => r.name.toLowerCase() === cleanName.toLowerCase());
      if (rp?.team) resolvedTeam = rp.team;
    }

    if (settings.formatMode === 'team' && !resolvedTeam) {
      onShowToast('Please enter a Team Name when Team Standings is selected.', true);
      return;
    }

    const duplicate = bowlers.find(
      (b) => b.name.toLowerCase() === cleanName.toLowerCase() && b.id !== editingId
    );
    if (duplicate) {
      onShowToast(
        `${cleanName} is already entered for this week. Click 'Edit' next to their name to change their score.`,
        true
      );
      return;
    }

    const maxScore = settings.maxGameScore || 300;
    let game1 = 0;
    let game2 = 0;
    let game3 = 0;
    let scratchScore = 0;

    if (settings.entryMode === 'single') {
      if (singleScore.trim() === '') {
        onShowToast('Please enter a total score.', true);
        scoreInputRef.current?.focus();
        return;
      }
      const parsed = Number(singleScore);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > maxScore) {
        onShowToast(`Score must be a whole number between 0 and ${maxScore}.`, true);
        scoreInputRef.current?.focus();
        return;
      }
      scratchScore = parsed;
      game1 = parsed;
    } else {
      if (g1.trim() === '' || g2.trim() === '' || g3.trim() === '') {
        onShowToast('Please enter all three game scores (Game 1, Game 2, Game 3).', true);
        g1InputRef.current?.focus();
        return;
      }
      const scores = [Number(g1), Number(g2), Number(g3)];
      for (let i = 0; i < 3; i++) {
        if (!Number.isInteger(scores[i]) || scores[i] < 0 || scores[i] > maxScore) {
          onShowToast(`Game ${i + 1} must be between 0 and ${maxScore}.`, true);
          return;
        }
      }
      [game1, game2, game3] = scores;
      scratchScore = game1 + game2 + game3;
    }

    let handicapVal = 0;
    if (settings.scoringType === 'handicap') {
      const parsedHdcp = hdcp.trim() === '' ? 0 : Number(hdcp);
      if (!Number.isInteger(parsedHdcp) || parsedHdcp < 0 || parsedHdcp > 9999) {
        onShowToast('Handicap must be 0 or greater.', true);
        return;
      }
      handicapVal = parsedHdcp;
    }

    onAddOrUpdateBowler(
      {
        name: cleanName,
        team: resolvedTeam,
        entryMode: settings.entryMode,
        scoringType: settings.scoringType,
        g1: game1,
        g2: game2,
        g3: game3,
        scratchScore,
        handicap: handicapVal,
        grandTotal: scratchScore + handicapVal,
        isAbsent: false,
        isSub,
      },
      editingId
    );

    clearForm();
    nameInputRef.current?.focus();
  };

  const handleStartEdit = (b: BowlerEntry) => {
    setEditingId(b.id);
    setBowlerName(b.name);
    setTeamName(b.team || '');
    setIsSub(b.isSub);
    if (b.entryMode !== settings.entryMode) {
      onUpdateSettings({ entryMode: b.entryMode });
    }
    if (b.scoringType !== settings.scoringType) {
      onUpdateSettings({ scoringType: b.scoringType });
    }
    if (b.entryMode === 'single') {
      setSingleScore(String(b.scratchScore));
    } else {
      setG1(String(b.g1));
      setG2(String(b.g2));
      setG3(String(b.g3));
    }
    setHdcp(String(b.handicap));
    setAutoFilledHdcpHint(null);
    nameInputRef.current?.focus();
  };

  const handleSelectMissing = (player: RosterPlayer) => {
    setEditingId(null);
    setBowlerName(player.name);
    setTeamName(player.team || '');
    setIsSub(false);
    handleBowlerNameChange(player.name);
    setTimeout(() => {
      if (settings.entryMode === 'single') {
        scoreInputRef.current?.focus();
      } else {
        g1InputRef.current?.focus();
      }
    }, 30);
  };

  const handleFinishAndGenerate = () => {
    if (bowlers.length === 0) {
      onShowToast('Please enter at least one bowler score before generating results.', true);
      return;
    }
    onFinishWeekAndArchive();
    const csvName = exportWeeklyResultsCsv(appState);
    onShowToast(`Archived Week ${settings.weekNumber || ''}, exported ${csvName}, and prepared print view.`);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleSaveToComputer = async () => {
    try {
      const res = await saveLeagueFileToComputer(appState);
      onShowToast(`Saved league data file (${res.filename}) to your computer.`);
    } catch {
      // Cancelled
    }
  };

  // Filtered & sorted entered list
  const query = enteredSearch.trim().toLowerCase();
  const visibleEntered = bowlers
    .filter((b) => {
      if (b.isAbsent && settings.showAbsent === 'no') return false;
      if (!query) return true;
      return (
        b.name.toLowerCase().includes(query) ||
        (b.team || '').toLowerCase().includes(query)
      );
    })
    .slice();

  if (enteredSort === 'name') {
    visibleEntered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (enteredSort === 'score') {
    visibleEntered.sort((a, b) => b.grandTotal - a.grandTotal || a.name.localeCompare(b.name));
  } else if (enteredSort === 'team') {
    visibleEntered.sort(
      (a, b) => (a.team || '').localeCompare(b.team || '') || a.name.localeCompare(b.name)
    );
  } else {
    visibleEntered.reverse();
  }

  // Missing from roster list
  const enteredNamesSet = new Set(bowlers.map((b) => b.name.toLowerCase()));
  const missingPlayers = roster
    .filter((r) => !enteredNamesSet.has(r.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Top 10 Live Leaderboard
  const rankedActive = rankWeeklyBowlers(bowlers).filter((b) => !b.isAbsent);
  const top10Leaders = rankedActive.slice(0, 10);
  const maxLeaderScore = Math.max(1, ...top10Leaders.map((b) => b.grandTotal));
  const highBowler = top10Leaders[0];

  const uniqueTeams = [...new Set(roster.map((r) => r.team).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      {/* Datalists for fast keyboard autocomplete */}
      <datalist id="team-suggestions-list">
        {uniqueTeams.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="name-suggestions-list">
        {roster.map((r) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>

      {/* Top League Configuration & Multi-League Quick Switcher */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        {/* Multi-League Selector Bar + Quick Import/Backup Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="quick-league-switcher"
              className="text-xs font-bold text-slate-700"
            >
              Active League:
            </label>
            <select
              id="quick-league-switcher"
              value={appState.activeLeagueId || settings.leagueId || 'thursday-night-rollers'}
              onChange={(e) => onSwitchLeague(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-blue-50/70 border border-blue-300 rounded-lg cursor-pointer"
            >
              {Object.entries(
                appState.allLeaguesRegistry || {
                  [settings.leagueId || 'thursday-night-rollers']: appState,
                }
              ).map(([id, lg]) => (
                <option key={id} value={id}>
                  {lg.settings?.leagueName || id} (Wk {lg.settings?.weekNumber || '1'} · {(lg.roster || []).length} Bowlers)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenLeagueAndBackupHub}
              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 cursor-pointer"
            >
              + Manage Multiple Leagues / Auto-Backup
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="Cleared browser history or moved to a new PC? Click Import to load all leagues, scores, rosters & history from your single backup file."
            >
              <Upload className="w-3.5 h-3.5" />
              Import Full Backup (.json or .html)
            </button>
            <button
              type="button"
              onClick={handleSaveToComputer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              Save Backup to PC
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="league-name-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              League Name
            </label>
            <input
              id="league-name-input"
              type="text"
              value={settings.leagueName}
              onChange={(e) => onUpdateSettings({ leagueName: e.target.value })}
              placeholder="e.g. Thursday Night Rollers"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="week-number-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Week #
            </label>
            <input
              id="week-number-input"
              type="text"
              value={settings.weekNumber}
              onChange={(e) => onUpdateSettings({ weekNumber: e.target.value })}
              placeholder="e.g. 4"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none font-mono tabular-nums"
            />
          </div>
          <div>
            <label
              htmlFor="custom-csv-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Custom CSV Filename (Optional)
            </label>
            <input
              id="custom-csv-input"
              type="text"
              value={settings.customCsvName}
              onChange={(e) => onUpdateSettings({ customCsvName: e.target.value })}
              placeholder={`Auto: ${(settings.leagueName || 'League').replace(/[^a-zA-Z0-9]/g, '_')}_Week_${settings.weekNumber || '1'}.csv`}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Print Announcement Notes (From V1/V2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label
              htmlFor="top-note-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Top Announcement (Prints at Top of Standing Sheet)
            </label>
            <input
              id="top-note-input"
              type="text"
              value={settings.topNote}
              onChange={(e) => onUpdateSettings({ topNote: e.target.value })}
              placeholder="e.g. Position Round Next Week!"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="bottom-note-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Bottom Note (Prints at Bottom of Standing Sheet)
            </label>
            <input
              id="bottom-note-input"
              type="text"
              value={settings.bottomNote}
              onChange={(e) => onUpdateSettings({ bottomNote: e.target.value })}
              placeholder="e.g. Pay league dues by Friday."
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* 4-Column Summary KPI Row */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        aria-label="Current week overview"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">Bowlers Entered</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {bowlers.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Week {settings.weekNumber || 'Current'} active entries
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">Highest Week Total</div>
          <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums mt-1">
            {highBowler ? highBowler.grandTotal : '—'}
          </div>
          <div className="text-xs text-slate-600 mt-0.5 truncate">
            {highBowler ? `${highBowler.name} (${highBowler.scratchScore} scr)` : 'Waiting for scores'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">Absent Bowlers</div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {bowlers.filter((b) => b.isAbsent).length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {settings.absentScore} pts/game absent rule
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">Still Missing from Roster</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {missingPlayers.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Click any name below to auto-fill
          </div>
        </div>
      </section>

      {/* Mode Switcher: Simple Entry Mode vs Team vs. Team Lane Pair Recap Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="text-xs text-slate-600 px-1">
          <strong>Choose Score Entry View:</strong> Keep it simple with <strong>Quick Bowler Entry</strong>, or switch to the full <strong>Team vs. Team Lane Recap Grid</strong>.
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setEntryViewMode('simple')}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              entryViewMode === 'simple'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Simple Quick Entry
          </button>
          <button
            type="button"
            onClick={() => setEntryViewMode('recap')}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              entryViewMode === 'recap'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Team vs. Team Recap Sheet Grid
          </button>
        </div>
      </div>

      {entryViewMode === 'recap' && (
        <TeamRecapSheet
          appState={appState}
          onUpdateSettings={onUpdateSettings}
          onAddOrUpdateBowler={onAddOrUpdateBowler}
          onShowToast={onShowToast}
        />
      )}

      {/* Main 2-Column Split: Left = Fast Entry + Side-by-Side Lists, Right = Live Leaderboard + Roster + Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Score Entry Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingId ? 'Update Bowler Score' : 'Quick Score Entry'}
                </h2>
                <p className="text-xs text-slate-500">
                  Type a bowler name, enter their games, and press Enter.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {editingId ? 'Editing Existing Entry' : 'Ready for Entry'}
              </span>
            </div>

            {/* Format / Entry / Scoring Type Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <label
                  htmlFor="format-mode-select"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Standings Format
                </label>
                <select
                  id="format-mode-select"
                  value={settings.formatMode}
                  onChange={(e) =>
                    onUpdateSettings({ formatMode: e.target.value as 'individual' | 'team' })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md"
                >
                  <option value="individual">Individual Leaderboard</option>
                  <option value="team">Team Standings</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="entry-mode-select"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Game Entry Mode
                </label>
                <select
                  id="entry-mode-select"
                  value={settings.entryMode}
                  onChange={(e) =>
                    onUpdateSettings({ entryMode: e.target.value as 'single' | 'three' })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md"
                >
                  <option value="single">Single Total Score</option>
                  <option value="three">3-Game Series (G1, G2, G3)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="type-mode-select"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Scoring Type
                </label>
                <select
                  id="type-mode-select"
                  value={settings.scoringType}
                  onChange={(e) =>
                    onUpdateSettings({ scoringType: e.target.value as 'scratch' | 'handicap' })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md"
                >
                  <option value="scratch">Scratch (Raw Score)</option>
                  <option value="handicap">Handicap</option>
                </select>
              </div>
            </div>

            {/* Collapsible Advanced League & BLS Rules Settings */}
            <details className="border border-slate-200 rounded-lg bg-slate-50/50 text-xs">
              <summary className="px-3.5 py-2.5 font-bold text-slate-800 cursor-pointer flex items-center justify-between">
                <span>Advanced League, Handicap & Print Validation Settings</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </summary>
              <div className="p-3.5 pt-2 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="absent-score-input" className="block font-semibold text-slate-700 mb-1">
                      Absent Score (Per Game)
                    </label>
                    <input
                      id="absent-score-input"
                      type="number"
                      min={0}
                      max={300}
                      value={settings.absentScore}
                      onChange={(e) =>
                        onUpdateSettings({ absentScore: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="max-game-input" className="block font-semibold text-slate-700 mb-1">
                      Max Game Score
                    </label>
                    <input
                      id="max-game-input"
                      type="number"
                      min={1}
                      max={999}
                      value={settings.maxGameScore}
                      onChange={(e) =>
                        onUpdateSettings({ maxGameScore: Math.max(1, Number(e.target.value) || 300) })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="auto-hdcp-select" className="block font-semibold text-slate-700 mb-1">
                      Auto-Fill Book Handicap
                    </label>
                    <select
                      id="auto-hdcp-select"
                      value={settings.autoCalculateHandicap}
                      onChange={(e) =>
                        onUpdateSettings({ autoCalculateHandicap: e.target.value as 'yes' | 'no' })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                    >
                      <option value="yes">Yes ({settings.handicapPercent}% of {settings.handicapBasis})</option>
                      <option value="no">No (Manual Entry Only)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="show-absent-select" className="block font-semibold text-slate-700 mb-1">
                      Show Absent Players
                    </label>
                    <select
                      id="show-absent-select"
                      value={settings.showAbsent}
                      onChange={(e) =>
                        onUpdateSettings({ showAbsent: e.target.value as 'yes' | 'no' })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="highlight-first-select" className="block font-semibold text-slate-700 mb-1">
                      Highlight 1st Place on Print
                    </label>
                    <select
                      id="highlight-first-select"
                      value={settings.highlightFirst}
                      onChange={(e) =>
                        onUpdateSettings({ highlightFirst: e.target.value as 'yes' | 'no' })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="show-team-summary-select" className="block font-semibold text-slate-700 mb-1">
                      Show Team Summary on Print
                    </label>
                    <select
                      id="show-team-summary-select"
                      value={settings.showTeamSummary}
                      onChange={(e) =>
                        onUpdateSettings({ showTeamSummary: e.target.value as 'yes' | 'no' })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>
            </details>

            {editingId && (
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-semibold">
                <span>
                  Editing existing score for <strong>{bowlerName}</strong> — original score remains safe until you save.
                </span>
                <button
                  type="button"
                  onClick={clearForm}
                  className="px-2.5 py-1 bg-white border border-blue-300 rounded text-blue-800 hover:bg-blue-100"
                >
                  Cancel Edit
                </button>
              </div>
            )}

            {/* Main Score Form */}
            <form onSubmit={handleSubmitScore} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="bowler-name-field"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Bowler Name
                  </label>
                  <input
                    ref={nameInputRef}
                    id="bowler-name-field"
                    type="text"
                    list="name-suggestions-list"
                    value={bowlerName}
                    onChange={(e) => handleBowlerNameChange(e.target.value)}
                    placeholder="Type or select bowler name..."
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="team-name-field"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Team Name {settings.formatMode === 'team' ? '(Required)' : '(Auto-fills from roster)'}
                  </label>
                  <input
                    id="team-name-field"
                    type="text"
                    list="team-suggestions-list"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Type or select team..."
                    autoComplete="off"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {settings.entryMode === 'single' ? (
                <div>
                  <label
                    htmlFor="single-score-field"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Total Scratch Score
                  </label>
                  <input
                    ref={scoreInputRef}
                    id="single-score-field"
                    type="number"
                    min={0}
                    max={settings.maxGameScore}
                    value={singleScore}
                    onChange={(e) => setSingleScore(e.target.value)}
                    placeholder="e.g. 210"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="g1-field"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Game 1
                    </label>
                    <input
                      ref={g1InputRef}
                      id="g1-field"
                      type="number"
                      min={0}
                      max={settings.maxGameScore}
                      value={g1}
                      onChange={(e) => setG1(e.target.value)}
                      placeholder="185"
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="g2-field"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Game 2
                    </label>
                    <input
                      id="g2-field"
                      type="number"
                      min={0}
                      max={settings.maxGameScore}
                      value={g2}
                      onChange={(e) => setG2(e.target.value)}
                      placeholder="205"
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="g3-field"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      Game 3
                    </label>
                    <input
                      id="g3-field"
                      type="number"
                      min={0}
                      max={settings.maxGameScore}
                      value={g3}
                      onChange={(e) => setG3(e.target.value)}
                      placeholder="215"
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                    />
                  </div>
                </div>
              )}

              {settings.scoringType === 'handicap' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="hdcp-field"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Handicap (Total Added to Score)
                    </label>
                    {autoFilledHdcpHint && (
                      <span className="text-[11px] text-emerald-700 font-medium">
                        {autoFilledHdcpHint}
                      </span>
                    )}
                  </div>
                  <input
                    id="hdcp-field"
                    type="number"
                    min={0}
                    value={hdcp}
                    onChange={(e) => setHdcp(e.target.value)}
                    placeholder="Enter total handicap amount (e.g. 45)"
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSub}
                    onChange={(e) => setIsSub(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>Substitute Player (Do not save to master roster)</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  {editingId ? 'Save Updated Score' : 'Add Bowler (or press Enter)'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={clearForm}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* V1 + V2 Signature Side-by-Side Lists: Currently Entered vs Missing from Roster */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="search"
                value={enteredSearch}
                onChange={(e) => setEnteredSearch(e.target.value)}
                placeholder="Search entered players or teams..."
                aria-label="Search entered players or teams"
                className="flex-1 px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg"
              />
              <select
                value={enteredSort}
                onChange={(e) =>
                  setEnteredSort(e.target.value as 'entry' | 'score' | 'name' | 'team')
                }
                aria-label="Sort entered players"
                className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg"
              >
                <option value="entry">Sort: Entry Order (Newest First)</option>
                <option value="score">Sort: Score High → Low</option>
                <option value="name">Sort: Name A–Z</option>
                <option value="team">Sort: Team A–Z</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Currently Entered Box */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-slate-50/40">
                <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Currently Entered ({visibleEntered.length})
                  </span>
                  <span className="text-[11px] text-slate-500">Week {settings.weekNumber || 'Current'}</span>
                </div>
                <div className="h-80 overflow-y-auto divide-y divide-slate-200/70 p-2 bg-white">
                  {visibleEntered.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center p-4">
                      No matching entries yet.
                    </div>
                  ) : (
                    visibleEntered.map((b) => (
                      <div
                        key={b.id}
                        className="py-2 px-2 flex items-center justify-between gap-2 hover:bg-slate-50 rounded"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {b.team ? `[${b.team}] ` : ''}
                            {b.name}{' '}
                            <span className="font-mono tabular-nums text-blue-700 ml-1">
                              {b.isAbsent ? '[Absent]' : b.grandTotal}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                            {b.isAbsent
                              ? `Absent score applied (${b.grandTotal})`
                              : b.entryMode === 'three'
                              ? `${b.g1} / ${b.g2} / ${b.g3} (${b.scratchScore} scr + ${b.handicap} hdcp)`
                              : `Single game: ${b.scratchScore} scr + ${b.handicap} hdcp`}
                            {b.isSub ? ' · Sub' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(b)}
                            aria-label={`Edit ${b.name}`}
                            className="px-2 py-1 text-[11px] font-semibold bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteBowler(b.id)}
                            aria-label={`Delete ${b.name}`}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-red-600 hover:text-white rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Missing from Roster Box */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-slate-50/40">
                <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Missing from Roster ({missingPlayers.length})
                  </span>
                  <span className="text-[11px] text-slate-500">Click name to fill</span>
                </div>
                <div className="h-80 overflow-y-auto divide-y divide-slate-200/70 p-2 bg-white">
                  {roster.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center p-4">
                      Roster empty. Names save here automatically.
                    </div>
                  ) : missingPlayers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-emerald-700 font-bold text-center p-4 gap-1">
                      <Check className="w-5 h-5" />
                      <span>All master roster players entered!</span>
                    </div>
                  ) : (
                    missingPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="py-2 px-2 flex items-center justify-between gap-2 hover:bg-blue-50/50 rounded"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectMissing(p)}
                          className="text-left flex-1 min-w-0 group cursor-pointer"
                        >
                          <div className="text-xs font-bold text-blue-700 group-hover:underline truncate">
                            {p.team ? `[${p.team}] ` : ''}
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                            Book Avg: {p.bookAverage ?? 165}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onMarkAbsent(p)}
                            aria-label={`Mark ${p.name} Absent`}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 rounded transition-colors"
                          >
                            Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRosterPlayer(p.id)}
                            aria-label={`Remove ${p.name} from Master Roster`}
                            title="Permanently delete from Master Roster"
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): Finish & Print Primary CTA, Live Top 10 Bar Chart, Master Roster & Local Computer Backup */}
        <div className="lg:col-span-5 space-y-6">
          {/* Primary Action Card: Finish Week, Print & Export CSV */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <div className="text-xs font-semibold text-blue-300">
                Weekly Standing Sheet & Spreadsheet Output
              </div>
              <h2 className="text-lg font-bold tracking-tight mt-0.5">
                Finish Week, Export CSV & Print Standings
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Archives Week {settings.weekNumber || 'Current'} to Season History, downloads the official Excel/CSV spreadsheet, and opens the Landscape Print Standing Sheet.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFinishAndGenerate}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              FINISH WEEK & GENERATE CSV + PRINTOUT
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo Last
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = exportWeeklyResultsCsv(appState);
                  onShowToast(`Downloaded ${name}`);
                }}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV Only
              </button>
              <button
                type="button"
                onClick={onStartNewWeek}
                className="col-span-2 sm:col-span-1 py-2 px-3 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/60 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Start New Week
              </button>
            </div>
          </div>

          {/* Live Top 10 Leaderboard Chart (From Version 2) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Live Week Leaderboard (Top 10)
                </h3>
                <p className="text-xs text-slate-500">
                  Updates automatically as scores are entered
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {settings.scoringType === 'handicap' ? 'With Hdcp' : 'Scratch'}
              </span>
            </div>

            {top10Leaders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Add bowler scores to see the live leaderboard chart.
              </div>
            ) : (
              <div className="space-y-2.5">
                {top10Leaders.map((b, idx) => {
                  const pct = Math.max(8, Math.min(100, (b.grandTotal / maxLeaderScore) * 100));
                  return (
                    <div
                      key={b.id}
                      className="grid grid-cols-12 items-center gap-2 text-xs"
                    >
                      <div
                        className="col-span-4 font-semibold text-slate-800 truncate"
                        title={`${b.name} (${b.team || 'No Team'})`}
                      >
                        <span className="font-mono text-slate-400 mr-1">{idx + 1}.</span>
                        {b.name}
                      </div>
                      <div className="col-span-6 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold tabular-nums text-slate-900">
                        {b.grandTotal}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Computer Hard-Drive Backup, Auto-Backup Scheduler & Restore Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Full Backup, New-PC Import & Auto-Backup Scheduler
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Backs up 100% of all leagues, active scores, master rosters, brackets, dues, and season history. If browser history is cleared or a new PC is needed, click <strong>Import</strong> to restore everything from a single file.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSaveToComputer}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                Save Master Backup to PC
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Backup (.json or .html)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.html,.htm,application/json,text/html"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportBackupJson(file);
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {/* Quick Auto-Backup Scheduler Box */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoBackupEnabled !== false}
                    onChange={(e) =>
                      onUpdateSettings({ autoBackupEnabled: e.target.checked })
                    }
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                  />
                  <span>Auto-Backup Scheduler</span>
                </label>
                <select
                  aria-label="Auto-Backup Schedule Frequency"
                  value={settings.autoBackupInterval || 'on_finish_week'}
                  onChange={(e) =>
                    onUpdateSettings({
                      autoBackupInterval: e.target.value as LeagueSettings['autoBackupInterval'],
                    })
                  }
                  className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                >
                  <option value="on_change">On Every Score Change</option>
                  <option value="5min">Every 5 Minutes</option>
                  <option value="15min">Every 15 Minutes</option>
                  <option value="30min">Every 30 Minutes</option>
                  <option value="on_finish_week">On Finish Week</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-600 truncate">
                  Location: {getConnectedAutoBackupHandleName() || settings.autoBackupDirectoryLabel || 'PC Downloads Folder'}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await chooseAutoBackupLocation(
                        appState,
                        settings.autoBackupFormat || 'json'
                      );
                      onUpdateSettings({
                        autoBackupDirectoryLabel: res.locationName,
                        lastAutoBackupAt: new Date().toISOString(),
                      });
                      onShowToast(`Auto-Backup location set to ${res.locationName}.`);
                    } catch {
                      // Cancelled
                    }
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-blue-700 shrink-0 cursor-pointer"
                >
                  Set Save Location...
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  exportMasterRosterCsv(appState);
                  onShowToast('Exported Master Roster CSV.');
                }}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Export Master Roster (.csv)
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => {
                  const fname = exportMasterLeagueBackupJson(appState);
                  onShowToast(`Exported ${fname}`);
                }}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Quick Download JSON Backup
              </button>
            </div>
          </div>

          {/* Master Roster Pre-Builder Accordion */}
          <details className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <summary className="px-5 py-3.5 text-sm font-bold text-slate-900 cursor-pointer flex items-center justify-between bg-slate-50/60">
              <span>Master Roster Manager ({roster.length} Bowlers)</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </summary>
            <div className="p-5 pt-3 border-t border-slate-200 space-y-3">
              <p className="text-xs text-slate-500">
                Bowlers entered with a score are added to the roster automatically unless marked as a Substitute. You can also add bowlers or set their Entering Book Average here:
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newRosterName.trim()) return;
                  onAddRosterPlayer(
                    newRosterName.trim(),
                    newRosterTeam.trim(),
                    Number(newRosterBookAvg) || 165
                  );
                  setNewRosterName('');
                }}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2"
              >
                <input
                  type="text"
                  value={newRosterName}
                  onChange={(e) => setNewRosterName(e.target.value)}
                  placeholder="Bowler Name"
                  aria-label="New Roster Bowler Name"
                  className="sm:col-span-5 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                />
                <input
                  type="text"
                  value={newRosterTeam}
                  onChange={(e) => setNewRosterTeam(e.target.value)}
                  placeholder="Team Name"
                  aria-label="New Roster Team Name"
                  className="sm:col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                />
                <input
                  type="number"
                  value={newRosterBookAvg}
                  onChange={(e) => setNewRosterBookAvg(e.target.value)}
                  placeholder="Avg"
                  aria-label="Entering Book Average"
                  title="Entering Book Average"
                  className="sm:col-span-3 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono tabular-nums"
                />
                <button
                  type="submit"
                  className="sm:col-span-12 py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add or Update Roster Bowler
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
