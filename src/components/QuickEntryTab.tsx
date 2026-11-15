import React, { useState, useRef, useEffect } from 'react';
import { AppState, BowlerEntry, LeagueSettings, RosterPlayer } from '../types/bowling';
import {
  calculateBowlerHandicap,
  computeBowlerAbsentScore,
  computeSeasonPlayerStats,
  rankWeeklyBowlers,
} from '../utils/bowlingLogic';
import {
  exportMasterRosterCsv,
  exportWeeklyResultsCsv,
} from '../utils/fileExport';
import {
  Printer,
  Download,
  Undo2,
  RotateCcw,
  UserPlus,
  Table2,
  ListChecks,
  Users,
  Sliders,
  AlertTriangle,
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
  onSwitchLeague: (leagueId: string) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

type ScoringSubTab = 'quick_entry' | 'recap_grid' | 'roster_manager' | 'league_rules';

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
  onSwitchLeague,
  onShowToast,
}) => {
  const { settings, bowlers, roster, history } = appState;
  const [subTab, setSubTab] = useState<ScoringSubTab>('quick_entry');

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
  const [confirmRemoveRosterPlayer, setConfirmRemoveRosterPlayer] = useState<RosterPlayer | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const g1InputRef = useRef<HTMLInputElement>(null);

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
          settings.entryMode,
          settings.maxHandicapPerGame || 0
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

  const sampleAbsentPreview = computeBowlerAbsentScore(175, settings);

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

      {/* Clean Unified Sub-Tab Bar + Active League / Week Switcher for Tab 1 */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Weekly Scoring Sub-Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'quick_entry'}
            onClick={() => setSubTab('quick_entry')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'quick_entry'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>1A. Quick Score Entry ({bowlers.length} Entered)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'recap_grid'}
            onClick={() => setSubTab('recap_grid')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'recap_grid'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Table2 className="w-4 h-4" />
            <span>1B. Team vs. Team Recap Grid</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'roster_manager'}
            onClick={() => setSubTab('roster_manager')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'roster_manager'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1C. Master Roster ({roster.length} Bowlers)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'league_rules'}
            onClick={() => setSubTab('league_rules')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'league_rules'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>1D. League Rules & Sheet Options</span>
          </button>
        </div>

        {/* Active League & Week Indicator (Non-Duplicated) */}
        <div className="flex flex-wrap items-center gap-2.5 pr-1">
          <div className="flex items-center gap-1.5">
            <label htmlFor="quick-league-switcher" className="text-xs font-bold text-slate-600">
              League:
            </label>
            <select
              id="quick-league-switcher"
              value={appState.activeLeagueId || settings.leagueId || 'thursday-night-rollers'}
              onChange={(e) => onSwitchLeague(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
            >
              {Object.entries(
                appState.allLeaguesRegistry || {
                  [settings.leagueId || 'thursday-night-rollers']: appState,
                }
              ).map(([id, lg]) => (
                <option key={id} value={id}>
                  {lg.settings?.leagueName || id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="quick-week-input" className="font-bold text-slate-600">
              Week:
            </label>
            <input
              id="quick-week-input"
              type="text"
              value={settings.weekNumber}
              onChange={(e) => onUpdateSettings({ weekNumber: e.target.value })}
              className="w-12 px-2 py-1 text-center font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1A: CLEAN QUICK SCORE ENTRY (UNCLUTTERED DEFAULT VIEW)        */}
      {/* ===================================================================== */}
      {subTab === 'quick_entry' && (
        <div className="space-y-6">
          {/* 4-Column Summary KPI Row */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Current week overview">
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
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                Rule: {sampleAbsentPreview.ruleDescription}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500">Still Missing from Roster</div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                {missingPlayers.length}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Click any missing name below to fill
              </div>
            </div>
          </section>

          {/* Main 2-Column Split: Left = Fast Entry + Side-by-Side Lists, Right = Print/CSV Action + Live Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Score Entry Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingId ? 'Update Bowler Score' : 'Enter Bowler Score'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Type a bowler name (or click a name from Missing on the right), enter their games, and press Enter.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canUndo}
                      onClick={onUndo}
                      title="Undo last score addition, edit, or deletion (Ctrl+Z)"
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                        canUndo
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 cursor-pointer'
                          : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo (Ctrl+Z)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTab('league_rules')}
                      className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      {settings.entryMode === 'three' ? '3-Game Series' : 'Single Game'} ·{' '}
                      {settings.scoringType === 'handicap' ? 'Handicap' : 'Scratch'} (Rules →)
                    </button>
                  </div>
                </div>

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

              {/* Side-by-Side Lists: Currently Entered vs Missing from Roster */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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
                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={onUndo}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border shrink-0 transition-colors ${
                      canUndo
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 cursor-pointer'
                        : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo Last Delete / Edit</span>
                  </button>
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
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(b)}
                                aria-label={`Edit ${b.name}`}
                                className="px-2 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteBowler(b.id)}
                                aria-label={`Delete ${b.name}`}
                                className="px-2 py-1 text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded cursor-pointer"
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
                      {missingPlayers.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-emerald-700 font-semibold text-center p-4">
                          All roster players are accounted for!
                        </div>
                      ) : (
                        missingPlayers.map((p) => (
                          <div
                            key={p.id}
                            className="py-2 px-2 flex items-center justify-between gap-2 hover:bg-slate-50 rounded"
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectMissing(p)}
                              className="text-left min-w-0 flex-1 cursor-pointer group"
                            >
                              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                                {p.team ? `[${p.team}] ` : ''}
                                {p.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                Book Avg: {p.bookAverage || 165}
                              </div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onMarkAbsent(p)}
                                aria-label={`Mark ${p.name} Absent`}
                                className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                              >
                                Absent
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

            {/* RIGHT COLUMN (5 Cols): Primary Output Action + Live Top 10 Leaderboard */}
            <div className="lg:col-span-5 space-y-6">
              {/* Primary Action Card: Finish Week & Generate CSV + Printout */}
              <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-300">
                    Weekly Standing Sheet & Spreadsheet Output
                  </div>
                  <h2 className="text-base font-bold mt-0.5">
                    Finish Week, Export CSV & Print Standings
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Archives Week {settings.weekNumber || 'Current'} to Season History, downloads the official Excel/CSV spreadsheet, and opens the Landscape Print Standing Sheet.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFinishAndGenerate}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>FINISH WEEK & GENERATE CSV + PRINTOUT</span>
                </button>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (bowlers.length === 0) {
                        onShowToast('Enter at least one bowler score first.', true);
                        return;
                      }
                      window.print();
                    }}
                    className="py-2 px-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (bowlers.length === 0) {
                        onShowToast('Enter at least one bowler score first.', true);
                        return;
                      }
                      const name = exportWeeklyResultsCsv(appState);
                      onShowToast(`Exported ${name}.`);
                    }}
                    className="py-2 px-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={onStartNewWeek}
                    className="py-2 px-2.5 rounded-lg text-xs font-semibold bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800/60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Start New Week</span>
                  </button>
                </div>
              </div>

              {/* Live Top 10 Leaderboard Bar Chart */}
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
                  <span className="text-xs font-semibold text-blue-700">
                    {settings.scoringType === 'handicap' ? 'With Hdcp' : 'Scratch'}
                  </span>
                </div>

                {top10Leaders.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    Enter bowler scores on the left to see the live leaderboard.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {top10Leaders.map((b, index) => {
                      const pct = Math.max(8, Math.round((b.grandTotal / maxLeaderScore) * 100));
                      const isFirst = index === 0;
                      return (
                        <div key={b.id} className="grid grid-cols-12 items-center gap-2 text-xs">
                          <div
                            className="col-span-4 truncate font-medium text-slate-800"
                            title={`${b.name} (${b.team || 'No Team'})`}
                          >
                            <span className="font-mono text-slate-400 mr-1">
                              {b.placement}.
                            </span>
                            {b.name}
                          </div>
                          <div className="col-span-6 bg-slate-100 h-5 rounded-md overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                isFirst ? 'bg-emerald-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="col-span-2 text-right font-mono tabular-nums font-bold text-slate-900">
                            {b.grandTotal}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 1B: TEAM VS. TEAM LANE PAIR RECAP SHEET GRID                  */}
      {/* ===================================================================== */}
      {subTab === 'recap_grid' && (
        <TeamRecapSheet
          appState={appState}
          onUpdateSettings={onUpdateSettings}
          onAddOrUpdateBowler={onAddOrUpdateBowler}
          onShowToast={onShowToast}
        />
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 1C: MASTER ROSTER & SUBSTITUTES MANAGER                       */}
      {/* ===================================================================== */}
      {subTab === 'roster_manager' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Master Roster & Entering Book Averages ({roster.length} Bowlers)
                </h2>
                <p className="text-xs text-slate-500">
                  Add regular league bowlers and their entering book averages so their team and handicap auto-fill during score entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportMasterRosterCsv(appState)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Master Roster (.csv)
              </button>
            </div>

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
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200"
            >
              <div className="sm:col-span-4">
                <label htmlFor="roster-add-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Bowler Name
                </label>
                <input
                  id="roster-add-name"
                  type="text"
                  value={newRosterName}
                  onChange={(e) => setNewRosterName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="roster-add-team" className="block text-xs font-bold text-slate-700 mb-1">
                  Team Name
                </label>
                <input
                  id="roster-add-team"
                  type="text"
                  list="team-suggestions-list"
                  value={newRosterTeam}
                  onChange={(e) => setNewRosterTeam(e.target.value)}
                  placeholder="e.g. Pin Crushers"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="roster-add-avg" className="block text-xs font-bold text-slate-700 mb-1">
                  Entering Avg
                </label>
                <input
                  id="roster-add-avg"
                  type="number"
                  min={50}
                  max={300}
                  value={newRosterBookAvg}
                  onChange={(e) => setNewRosterBookAvg(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono text-center"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add / Update</span>
                </button>
              </div>
            </form>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-4 font-bold">Bowler Name</th>
                    <th className="py-2.5 px-3 font-bold">Team</th>
                    <th className="py-2.5 px-3 font-bold">League Role</th>
                    <th className="py-2.5 px-3 font-bold">Birthday</th>
                    <th className="py-2.5 px-3 font-bold text-right">Entering / Book Avg</th>
                    <th className="py-2.5 px-3 font-bold text-right">Computed Hdcp/Gm</th>
                    <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {roster
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => {
                      const hdcpCalc = calculateBowlerHandicap(
                        r.bookAverage || 165,
                        settings.handicapBasis,
                        settings.handicapPercent,
                        settings.entryMode,
                        settings.maxHandicapPerGame || 0
                      );
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{r.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{r.team || 'Unassigned'}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-semibold">
                            {r.officerRole || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {r.birthday || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {r.bookAverage || 165}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-blue-700 font-semibold">
                            +{hdcpCalc.perGame} ({hdcpCalc.totalHandicap} series)
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveRosterPlayer(r)}
                              className="px-2.5 py-1 text-red-700 hover:bg-red-50 border border-red-200 rounded font-semibold cursor-pointer"
                            >
                              Remove...
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 1D: LEAGUE-AGNOSTIC RULES & STANDING SHEET SETUP              */}
      {/* ===================================================================== */}
      {subTab === 'league_rules' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                League Rules, Handicap Formula & Standing Sheet Setup
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize these rules for any bowling center or league format (Singles, Doubles, Trios, 4-Person, or 5-Person teams).
              </p>
            </div>

            {/* Group 1: League Identity & Format */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                1. League Identity & Team Format
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="rule-league-name" className="block text-xs font-bold text-slate-700 mb-1">
                    League Name
                  </label>
                  <input
                    id="rule-league-name"
                    type="text"
                    value={settings.leagueName}
                    onChange={(e) => onUpdateSettings({ leagueName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="rule-season-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Season Name
                  </label>
                  <input
                    id="rule-season-name"
                    type="text"
                    value={settings.seasonName}
                    onChange={(e) => onUpdateSettings({ seasonName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="rule-bowlers-per-team" className="block text-xs font-bold text-slate-700 mb-1">
                    Bowlers Per Team
                  </label>
                  <select
                    id="rule-bowlers-per-team"
                    value={settings.bowlersPerTeam ?? 4}
                    onChange={(e) =>
                      onUpdateSettings({ bowlersPerTeam: Number(e.target.value) || 4 })
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                  >
                    <option value={1}>1 Bowler (Singles League)</option>
                    <option value={2}>2 Bowlers (Doubles League)</option>
                    <option value={3}>3 Bowlers (Trios League)</option>
                    <option value={4}>4 Bowlers (4-Person Teams)</option>
                    <option value={5}>5 Bowlers (5-Person Classic)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rule-total-weeks" className="block text-xs font-bold text-slate-700 mb-1">
                    Total Season Weeks
                  </label>
                  <input
                    id="rule-total-weeks"
                    type="number"
                    min={1}
                    max={52}
                    value={settings.totalWeeks}
                    onChange={(e) =>
                      onUpdateSettings({ totalWeeks: Math.max(1, Number(e.target.value) || 31) })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Group 2: Scoring & Handicap Formula */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                2. Scoring Mode & Handicap Formula
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="rule-entry-mode" className="block text-xs font-bold text-slate-700 mb-1">
                    Games Per Session
                  </label>
                  <select
                    id="rule-entry-mode"
                    value={settings.entryMode}
                    onChange={(e) =>
                      onUpdateSettings({ entryMode: e.target.value as 'single' | 'three' })
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="three">3-Game Series (G1, G2, G3)</option>
                    <option value="single">Single Total Score</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rule-scoring-type" className="block text-xs font-bold text-slate-700 mb-1">
                    Scoring Type
                  </label>
                  <select
                    id="rule-scoring-type"
                    value={settings.scoringType}
                    onChange={(e) =>
                      onUpdateSettings({ scoringType: e.target.value as 'scratch' | 'handicap' })
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="handicap">Handicap League</option>
                    <option value="scratch">Scratch League</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rule-hdcp-basis" className="block text-xs font-bold text-slate-700 mb-1">
                    Handicap Basis & Percent
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="rule-hdcp-pct"
                      type="number"
                      min={50}
                      max={100}
                      value={settings.handicapPercent}
                      onChange={(e) =>
                        onUpdateSettings({
                          handicapPercent: Math.min(100, Math.max(50, Number(e.target.value) || 90)),
                        })
                      }
                      className="w-16 px-2 py-2 text-xs font-mono text-center bg-white border border-slate-300 rounded-lg"
                    />
                    <span className="text-xs text-slate-600">% of</span>
                    <input
                      id="rule-hdcp-basis"
                      type="number"
                      min={150}
                      max={300}
                      value={settings.handicapBasis}
                      onChange={(e) =>
                        onUpdateSettings({
                          handicapBasis: Math.min(300, Math.max(150, Number(e.target.value) || 220)),
                        })
                      }
                      className="w-20 px-2 py-2 text-xs font-mono text-center bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="rule-max-hdcp" className="block text-xs font-bold text-slate-700 mb-1">
                    Max Handicap Cap Per Game (0 = None)
                  </label>
                  <input
                    id="rule-max-hdcp"
                    type="number"
                    min={0}
                    max={200}
                    value={settings.maxHandicapPerGame ?? 0}
                    onChange={(e) =>
                      onUpdateSettings({
                        maxHandicapPerGame: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Group 3: League-Agnostic Absentee & Point System Rules */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                3. Absentee Score Rule & Match Point System
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="rule-absent-type" className="block text-xs font-bold text-slate-700 mb-1">
                    Absentee Score Rule
                  </label>
                  <select
                    id="rule-absent-type"
                    value={settings.absentRuleType || 'fixed'}
                    onChange={(e) =>
                      onUpdateSettings({
                        absentRuleType: e.target.value as LeagueSettings['absentRuleType'],
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="fixed">Fixed Absent Score (e.g. 150/gm)</option>
                    <option value="avg_minus_pins">Bowler Avg Minus Penalty Pins (USBC)</option>
                    <option value="avg_percent">Percentage of Bowler Average</option>
                  </select>
                </div>

                {(!settings.absentRuleType || settings.absentRuleType === 'fixed') && (
                  <div>
                    <label htmlFor="rule-absent-fixed" className="block text-xs font-bold text-slate-700 mb-1">
                      Fixed Absent Score (Per Game)
                    </label>
                    <input
                      id="rule-absent-fixed"
                      type="number"
                      min={0}
                      max={300}
                      value={settings.absentScore}
                      onChange={(e) =>
                        onUpdateSettings({ absentScore: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {settings.absentRuleType === 'avg_minus_pins' && (
                  <div>
                    <label htmlFor="rule-absent-penalty" className="block text-xs font-bold text-slate-700 mb-1">
                      Penalty Pins Subtracted from Avg
                    </label>
                    <input
                      id="rule-absent-penalty"
                      type="number"
                      min={0}
                      max={100}
                      value={settings.absentPenaltyPins ?? 10}
                      onChange={(e) =>
                        onUpdateSettings({
                          absentPenaltyPins: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {settings.absentRuleType === 'avg_percent' && (
                  <div>
                    <label htmlFor="rule-absent-pct" className="block text-xs font-bold text-slate-700 mb-1">
                      % of Bowler Average Used
                    </label>
                    <input
                      id="rule-absent-pct"
                      type="number"
                      min={50}
                      max={100}
                      value={settings.absentPercent ?? 90}
                      onChange={(e) =>
                        onUpdateSettings({
                          absentPercent: Math.min(100, Math.max(50, Number(e.target.value) || 90)),
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="rule-point-system" className="block text-xs font-bold text-slate-700 mb-1">
                    Team Match Point System
                  </label>
                  <select
                    id="rule-point-system"
                    value={settings.pointSystem}
                    onChange={(e) =>
                      onUpdateSettings({
                        pointSystem: e.target.value as LeagueSettings['pointSystem'],
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="7pt">7-Point (2 per Game + 1 Series)</option>
                    <option value="8pt">8-Point (2 per Game + 2 Series)</option>
                    <option value="9pt">9-Point (2 per Game + 3 Series)</option>
                    <option value="5pt">5-Point (1 per Game + 2 Series)</option>
                    <option value="4pt">4-Point (1 per Game + 1 Series)</option>
                    <option value="custom">Custom Points Per Game / Series</option>
                  </select>
                </div>

                {settings.pointSystem === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="custom-gm-pts" className="block text-xs font-bold text-slate-700 mb-1">
                        Pts / Game
                      </label>
                      <input
                        id="custom-gm-pts"
                        type="number"
                        min={0}
                        max={20}
                        value={settings.customPointsPerGame ?? 2}
                        onChange={(e) =>
                          onUpdateSettings({
                            customPointsPerGame: Math.max(0, Number(e.target.value) || 1),
                          })
                        }
                        className="w-full px-2 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-ser-pts" className="block text-xs font-bold text-slate-700 mb-1">
                        Pts / Series
                      </label>
                      <input
                        id="custom-ser-pts"
                        type="number"
                        min={0}
                        max={20}
                        value={settings.customPointsPerSeries ?? 1}
                        onChange={(e) =>
                          onUpdateSettings({
                            customPointsPerSeries: Math.max(0, Number(e.target.value) || 1),
                          })
                        }
                        className="w-full px-2 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Group 4: Printout & CSV Options */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                4. Printout Notes & CSV Filename Options
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="top-note-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Top Announcement (Prints at Top of Sheet)
                  </label>
                  <input
                    id="top-note-input"
                    type="text"
                    value={settings.topNote}
                    onChange={(e) => onUpdateSettings({ topNote: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="bottom-note-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Bottom Note (Prints at Bottom of Sheet)
                  </label>
                  <input
                    id="bottom-note-input"
                    type="text"
                    value={settings.bottomNote}
                    onChange={(e) => onUpdateSettings({ bottomNote: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="custom-csv-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Custom CSV Filename (Optional)
                  </label>
                  <input
                    id="custom-csv-input"
                    type="text"
                    value={settings.customCsvName}
                    onChange={(e) => onUpdateSettings({ customCsvName: e.target.value })}
                    placeholder="Leave blank for automatic naming"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Are You Sure Confirmation Modal for Removing a Bowler from Master Roster */}
      {confirmRemoveRosterPlayer && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Are you sure you want to remove {confirmRemoveRosterPlayer.name}?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  This removes <strong>{confirmRemoveRosterPlayer.name}</strong> ({confirmRemoveRosterPlayer.team || 'No Team'}) from the Master Roster.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmRemoveRosterPlayer(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRosterPlayer(confirmRemoveRosterPlayer.id);
                  setConfirmRemoveRosterPlayer(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                Yes, Remove from Master Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
