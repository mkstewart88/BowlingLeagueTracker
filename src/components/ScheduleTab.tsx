import React, { useRef, useState } from 'react';
import { AppState, LaneMatchup, LeagueSettings } from '../types/bowling';
import {
  LATEST_AVAILABLE_VERSION,
  buildTeamStandings,
  computeMasterDatabaseMetrics,
  generatePositionRoundMatchups,
  generateRoundRobinSchedule,
} from '../utils/bowlingLogic';
import {
  chooseAutoBackupLocation,
  DEFAULT_PROGRAM_HTML_FILENAME,
  downloadBlob,
  downloadDesktopProgramHtmlFile,
  executeAutoBackupWrite,
  getConnectedAutoBackupHandleName,
  saveLeagueFileToComputer,
} from '../utils/fileExport';
import {
  Calendar,
  Shuffle,
  Trophy,
  Download,
  Database,
  FolderOpen,
  Plus,
  Upload,
  HardDrive,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface ScheduleTabProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onUpdateSchedule: (newSchedule: LaneMatchup[]) => void;
  onSwitchLeague: (leagueId: string) => void;
  onCreateLeague: (leagueName: string, seasonName: string, scoringType: 'handicap' | 'scratch') => void;
  onToggleLeagueStatus: (leagueId: string) => void;
  onDeleteLeague: (leagueId: string) => void;
  onImportBackupFile: (file: File) => void;
  onRecordBackupTimestamp: (kind: 'local' | 'auto', locationLabel?: string) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

type HubSubTab = 'leagues' | 'schedule' | 'backups';

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  appState,
  onUpdateSettings,
  onUpdateSchedule,
  onSwitchLeague,
  onCreateLeague,
  onToggleLeagueStatus,
  onDeleteLeague,
  onImportBackupFile,
  onRecordBackupTimestamp,
  onShowToast,
}) => {
  const { settings, roster, bowlers, schedule } = appState;
  const [subTab, setSubTab] = useState<HubSubTab>('leagues');
  const [weeksToGenerate, setWeeksToGenerate] = useState(12);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newSeasonName, setNewSeasonName] = useState('Fall / Winter 2026-2027');
  const [newScoringType, setNewScoringType] = useState<'handicap' | 'scratch'>('handicap');

  // Confirmation Popup State for Deleting a League
  const [leagueIdPendingDelete, setLeagueIdPendingDelete] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const leaguesMap: Record<string, Omit<AppState, 'allLeaguesRegistry'>> =
    appState.allLeaguesRegistry && Object.keys(appState.allLeaguesRegistry).length > 0
      ? appState.allLeaguesRegistry
      : {
          [settings.leagueId || 'thursday-night-rollers']: appState,
        };

  const dbMetrics = computeMasterDatabaseMetrics(
    leaguesMap,
    settings.lastLocalBackupAt,
    settings.lastAutoBackupAt
  );

  const connectedFileName = getConnectedAutoBackupHandleName();

  // Extract unique teams from roster + current bowlers
  const allTeams = [
    ...new Set([
      ...roster.map((r) => r.team.trim()),
      ...bowlers.map((b) => b.team.trim()),
    ]),
  ]
    .filter(Boolean)
    .sort();

  const teamStandings = buildTeamStandings(bowlers);
  const positionRoundPairs = generatePositionRoundMatchups(
    teamStandings,
    Number(settings.weekNumber || 4) + 1,
    settings.startingLane || 1
  );

  const handleRegenerateSchedule = () => {
    if (allTeams.length < 2) {
      onShowToast('Add at least 2 teams to your roster to generate a lane schedule.', true);
      return;
    }
    const generated = generateRoundRobinSchedule(
      allTeams,
      settings.startingLane || 1,
      weeksToGenerate
    );
    onUpdateSchedule(generated);
    onShowToast(
      `Generated ${weeksToGenerate}-week Round-Robin Lane Schedule for ${allTeams.length} teams starting on Lane ${settings.startingLane || 1}.`
    );
  };

  const handleExportScheduleCsv = () => {
    const rows = [
      ['Week', 'Odd Lane', 'Even Lane', 'Left Lane Team', 'Right Lane Team', 'Round Type'],
      ...schedule.map((m) => [
        `Week ${m.week}`,
        `Lane ${m.oddLane}`,
        `Lane ${m.evenLane}`,
        m.teamA,
        m.teamB,
        m.isPositionRound ? 'Position Round' : 'Regular Season',
      ]),
    ];
    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `${(settings.leagueName || 'League').replace(/[^a-zA-Z0-9]/g, '_')}_Lane_Schedule.csv`
    );
    onShowToast('Exported Season Lane Assignment Schedule CSV.');
  };

  const handleCreateLeagueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) {
      onShowToast('Please enter a name for the new league.', true);
      return;
    }
    onCreateLeague(newLeagueName.trim(), newSeasonName.trim() || '2026-2027 Season', newScoringType);
    setNewLeagueName('');
  };

  const handlePickAutoBackupLocation = async () => {
    try {
      const res = await chooseAutoBackupLocation(
        appState,
        settings.autoBackupFormat || 'json'
      );
      onRecordBackupTimestamp('auto', res.locationName);
      onShowToast(
        res.connected
          ? `Connected Auto-Backup destination (${res.locationName}) and wrote initial full backup!`
          : `Saved initial Auto-Backup file to ${res.locationName}.`
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (!msg.includes('Cancelled')) {
        onShowToast(msg || 'Could not select backup location.', true);
      }
    }
  };

  const handleRunManualAutoBackup = async () => {
    const res = await executeAutoBackupWrite(appState, true);
    if (res.wrote) {
      onRecordBackupTimestamp('auto', res.targetName);
      onShowToast(`Auto-Backup saved all ${dbMetrics.totalLeagues} leagues to ${res.targetName}.`);
    }
  };

  // Group schedule by week
  const weeksMap = new Map<number, LaneMatchup[]>();
  for (const m of schedule) {
    if (!weeksMap.has(m.week)) weeksMap.set(m.week, []);
    weeksMap.get(m.week)!.push(m);
  }

  const leaguePendingDeleteObj = leagueIdPendingDelete
    ? leaguesMap[leagueIdPendingDelete]
    : null;

  return (
    <div className="space-y-6">
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.html,.htm,application/json,text/html"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onImportBackupFile(file);
            e.target.value = '';
          }
        }}
      />

      {/* High-Contrast Framed 3-Part Sub-Tab Navigation Bar for Tab 5 */}
      <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-2 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Schedule and League Hub Sections">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'leagues'}
            onClick={() => setSubTab('leagues')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'leagues'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>5A. Manage Multiple Leagues ({dbMetrics.totalLeagues})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'schedule'}
            onClick={() => setSubTab('schedule')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'schedule'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>5B. Lane Schedule & Position Rounds</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'backups'}
            onClick={() => setSubTab('backups')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'backups'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>5C. Backups, Restore & Auto-Save</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 5A: MANAGE MULTIPLE LEAGUES & MASTER DATABASE                 */}
      {/* ===================================================================== */}
      {subTab === 'leagues' && (
        <section className="bg-white border-2 border-blue-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-blue-50/90 px-6 py-4 border-b-2 border-blue-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-700" />
                Master Bowler & Multi-League Database Manager
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Manage multiple bowling leagues inside this single program and switch between them with 1 click.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border-2 border-blue-300 rounded-lg overflow-hidden shadow-xs">
              <div className="bg-blue-100 border-b-2 border-blue-200 px-4 py-2 text-xs font-bold text-slate-900 text-center">
                Bowler Count (All Leagues)
              </div>
              <div className="p-4 space-y-2 text-xs font-mono tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-slate-700">Active</span>
                  <span className="font-bold text-slate-900">{dbMetrics.activeBowlers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-slate-700">Inactive / Absent</span>
                  <span className="font-bold text-slate-900">{dbMetrics.inactiveBowlers}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-sans font-bold text-slate-900">Total</span>
                  <span className="font-bold text-blue-700">{dbMetrics.totalBowlers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-slate-700" title={dbMetrics.duplicateNames.join(', ')}>
                    Cross-League Bowlers (Duplicates)
                  </span>
                  <span className="font-bold text-amber-800">{dbMetrics.duplicateBowlersCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-2 border-emerald-300 rounded-lg overflow-hidden shadow-xs">
              <div className="bg-emerald-100 border-b-2 border-emerald-200 px-4 py-2 text-xs font-bold text-slate-900 text-center">
                League Count
              </div>
              <div className="p-4 space-y-2 text-xs font-mono tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-slate-700">Active</span>
                  <span className="font-bold text-emerald-700">{dbMetrics.activeLeagues}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-slate-700">Inactive</span>
                  <span className="font-bold text-slate-600">{dbMetrics.inactiveLeagues}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-sans font-bold text-slate-900">Total Managed Leagues</span>
                  <span className="font-bold text-blue-700">{dbMetrics.totalLeagues}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-slate-700">Current Active League</span>
                  <span className="font-sans font-bold text-slate-900 truncate max-w-36">
                    {settings.leagueName}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-2 border-amber-300 rounded-lg overflow-hidden shadow-xs">
              <div className="bg-amber-100 border-b-2 border-amber-200 px-4 py-2 text-xs font-bold text-slate-900 text-center">
                Database & Backup Status
              </div>
              <div className="p-4 space-y-2.5 text-xs text-center">
                <div>
                  <div className="font-bold text-slate-900">Days Since Local Backup</div>
                  <div className="font-mono font-semibold text-blue-700 mt-0.5">
                    {dbMetrics.daysSinceLocalBackup}
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <div className="font-bold text-slate-900">Days Since Auto Backup</div>
                  <div className="font-mono font-semibold text-emerald-700 mt-0.5">
                    {dbMetrics.daysSinceAutoBackup}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-League Selector & New League Creator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
            <div className="lg:col-span-7 space-y-2.5">
              <div className="text-xs font-bold text-slate-800">
                All Leagues Inside This Program (Click to Switch Active League)
              </div>
              <div className="divide-y divide-slate-200 border-2 border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
                {Object.entries(leaguesMap).map(([id, lg]) => {
                  const isCurrent =
                    id === (appState.activeLeagueId || settings.leagueId || 'thursday-night-rollers');
                  const isInactive = lg.settings?.leagueStatus === 'inactive';
                  return (
                    <div
                      key={id}
                      className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs ${
                        isCurrent ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{lg.settings?.leagueName || id}</span>
                          {isCurrent && (
                            <span className="text-[11px] font-bold text-blue-700">
                              (Active Workspace)
                            </span>
                          )}
                          {isInactive && (
                            <span className="text-[11px] font-semibold text-slate-500">
                              [Inactive]
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          {lg.settings?.seasonName} · Week {lg.settings?.weekNumber || '1'} of {lg.settings?.totalWeeks || 31} · {(lg.roster || []).length} Roster Bowlers · {(lg.history || []).length} Archived Wks
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => onSwitchLeague(id)}
                            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-md cursor-pointer"
                          >
                            Switch to League
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onToggleLeagueStatus(id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md cursor-pointer"
                        >
                          {isInactive ? 'Mark Active' : 'Mark Inactive'}
                        </button>
                        {Object.keys(leaguesMap).length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLeagueIdPendingDelete(id)}
                            aria-label={`Delete ${lg.settings?.leagueName}`}
                            className="px-2.5 py-1.5 text-red-700 hover:bg-red-50 border border-red-200 rounded-md font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete...</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={handleCreateLeagueSubmit}
              className="lg:col-span-5 bg-slate-50 border-2 border-slate-300 rounded-lg p-5 space-y-3 shadow-xs"
            >
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-700" />
                Create New League Inside This Program
              </div>
              <div>
                <label htmlFor="new-league-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  New League Name
                </label>
                <input
                  id="new-league-name"
                  type="text"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  placeholder="e.g., Friday Night Men's Classic"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="new-season-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Season
                  </label>
                  <input
                    id="new-season-name"
                    type="text"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="new-league-scoring" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Scoring Format
                  </label>
                  <select
                    id="new-league-scoring"
                    value={newScoringType}
                    onChange={(e) => setNewScoringType(e.target.value as 'handicap' | 'scratch')}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-semibold"
                  >
                    <option value="handicap">Handicap</option>
                    <option value="scratch">Scratch</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
              >
                + Create & Switch to New League
              </button>
            </form>
          </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5B: LANE SCHEDULE & POSITION ROUNDS                           */}
      {/* ===================================================================== */}
      {subTab === 'schedule' && (
        <div className="space-y-6">
          <section className="bg-white border-2 border-blue-300 rounded-xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Round-Robin Lane Schedule & Position Round Generator
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically rotates {allTeams.length} league teams across odd/even lane pairs starting at any lane number in your bowling center.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                <label htmlFor="start-lane-input" className="font-semibold text-slate-700">
                  Starting Lane:
                </label>
                <input
                  id="start-lane-input"
                  type="number"
                  min={1}
                  max={79}
                  value={settings.startingLane}
                  onChange={(e) =>
                    onUpdateSettings({
                      startingLane: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="w-14 px-2 py-1 bg-white border border-slate-300 rounded font-mono tabular-nums text-center"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                <label htmlFor="weeks-count-input" className="font-semibold text-slate-700">
                  Weeks to Generate:
                </label>
                <input
                  id="weeks-count-input"
                  type="number"
                  min={2}
                  max={52}
                  value={weeksToGenerate}
                  onChange={(e) =>
                    setWeeksToGenerate(Math.min(52, Math.max(2, Number(e.target.value) || 12)))
                  }
                  className="w-14 px-2 py-1 bg-white border border-slate-300 rounded font-mono tabular-nums text-center"
                />
              </div>

              <button
                type="button"
                onClick={handleRegenerateSchedule}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Rebuild Rotation
              </button>

              <button
                type="button"
                onClick={handleExportScheduleCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Schedule CSV
              </button>
            </div>
          </section>

          {/* Position Round Preview */}
          <section className="bg-white border-2 border-amber-300 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b-2 border-amber-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  Automatic Position Round Pairings (1st vs 2nd, 3rd vs 4th)
                </h3>
                <p className="text-xs text-slate-600">
                  Generated live from your current team standings starting on Lane {settings.startingLane}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {positionRoundPairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-amber-50/70 border-2 border-amber-300 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-amber-900 font-mono">
                      Lanes {pair.oddLane} & {pair.evenLane} · Matchup #{idx + 1}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      #{idx * 2 + 1} {pair.teamA} <span className="text-slate-400 font-normal">vs.</span> #{idx * 2 + 2} {pair.teamB}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-900 bg-white border border-amber-300 px-2.5 py-1 rounded">
                    Position Round
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Multi-Week Round Robin Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...weeksMap.entries()].map(([weekNum, matches]) => {
              const isCurrentWeek = String(weekNum) === String(settings.weekNumber);
              return (
                <div
                  key={weekNum}
                  className={`bg-white border-2 rounded-xl overflow-hidden shadow-sm ${
                    isCurrentWeek ? 'border-blue-600 ring-2 ring-blue-300' : 'border-slate-300'
                  }`}
                >
                  <div
                    className={`px-4 py-2.5 border-b-2 flex items-center justify-between text-xs font-bold ${
                      isCurrentWeek
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-100 text-slate-900 border-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Week {weekNum}
                    </span>
                    {isCurrentWeek && <span>Current Active Week</span>}
                  </div>

                  <div className="divide-y divide-slate-200 p-3 space-y-2">
                    {matches.map((m, idx) => (
                      <div
                        key={idx}
                        className="pt-2 first:pt-0 flex items-center justify-between text-xs"
                      >
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                          Lanes {m.oddLane}–{m.evenLane}
                        </span>
                        <div className="text-right font-bold text-slate-900">
                          <span>{m.teamA}</span>{' '}
                          <span className="text-slate-400 font-normal">vs</span>{' '}
                          <span>{m.teamB}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5C: BACKUPS, RESTORE & AUTO-BACKUP SCHEDULER                  */}
      {/* ===================================================================== */}
      {subTab === 'backups' && (
        <section className="bg-white border-2 border-emerald-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-emerald-50/90 px-6 py-4 border-b-2 border-emerald-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-blue-700" />
                Full Backup, New-PC Import & Automatic Backup Scheduler
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Protects 100% of all {dbMetrics.totalLeagues} leagues, rosters, scores, brackets, and histories if browser history is cleared or a new computer is needed.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Import & Restore Full Backup (.json or .html)
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await saveLeagueFileToComputer(appState);
                    onRecordBackupTimestamp('local', res.filename);
                    onShowToast(`Saved full multi-league backup (${res.filename}) to your computer.`);
                  } catch {
                    // Cancelled
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <HardDrive className="w-4 h-4" />
                Save Master Backup (.json)
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await downloadDesktopProgramHtmlFile(
                      appState,
                      LATEST_AVAILABLE_VERSION
                    );
                    onRecordBackupTimestamp('local', res.filename);
                    onShowToast(`Downloaded ${res.filename}! Double-click this file on any PC to run.`);
                  } catch {
                    // Ignore
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download {DEFAULT_PROGRAM_HTML_FILENAME}
              </button>
            </div>
          </div>

          <div className="p-6">
          <div className="p-5 bg-blue-50/70 border-2 border-blue-300 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-blue-700" />
                  Automatic Backup Scheduler & Optional Save Location
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Automatically writes a complete backup file on your chosen schedule.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoBackupEnabled !== false}
                  onChange={(e) => onUpdateSettings({ autoBackupEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <span>Enable Auto-Backup Scheduler</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label htmlFor="autobackup-interval" className="block font-semibold text-slate-700 mb-1">
                  Auto-Backup Schedule Frequency
                </label>
                <select
                  id="autobackup-interval"
                  value={settings.autoBackupInterval || 'on_finish_week'}
                  onChange={(e) =>
                    onUpdateSettings({
                      autoBackupInterval: e.target.value as LeagueSettings['autoBackupInterval'],
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                >
                  <option value="on_change">Every Score Change (Instant Sync to Connected File)</option>
                  <option value="5min">Every 5 Minutes</option>
                  <option value="15min">Every 15 Minutes</option>
                  <option value="30min">Every 30 Minutes</option>
                  <option value="on_finish_week">When Clicking Finish Week & Archive</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>

              <div>
                <label htmlFor="autobackup-format" className="block font-semibold text-slate-700 mb-1">
                  Auto-Backup File Type
                </label>
                <select
                  id="autobackup-format"
                  value={settings.autoBackupFormat || 'json'}
                  onChange={(e) =>
                    onUpdateSettings({
                      autoBackupFormat: e.target.value as 'json' | 'html',
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                >
                  <option value="json">Master Multi-League Database (.json)</option>
                  <option value="html">Standalone Single-File HTML Program (.html)</option>
                </select>
              </div>

              <div>
                <label htmlFor="autobackup-folder-label" className="block font-semibold text-slate-700 mb-1">
                  Optional Save Location / Path Label
                </label>
                <input
                  id="autobackup-folder-label"
                  type="text"
                  value={connectedFileName || settings.autoBackupDirectoryLabel || ''}
                  onChange={(e) =>
                    onUpdateSettings({ autoBackupDirectoryLabel: e.target.value })
                  }
                  placeholder="e.g., D:\Bowling_Backups\Master_League.json"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="text-xs text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>
                  {connectedFileName
                    ? `Connected live file target: ${connectedFileName}`
                    : `Target location: ${settings.autoBackupDirectoryLabel || 'Browser Downloads / PC Folder'}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePickAutoBackupLocation}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-700" />
                  Choose Optional Save Location on PC...
                </button>
                <button
                  type="button"
                  onClick={handleRunManualAutoBackup}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Run Scheduled Backup Now
                </button>
              </div>
            </div>
          </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* "ARE YOU SURE?" CONFIRMATION POPUP MODAL BEFORE DELETING A LEAGUE     */}
      {/* ===================================================================== */}
      {leagueIdPendingDelete && leaguePendingDeleteObj && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-league-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 id="delete-league-modal-title" className="text-base font-bold text-slate-900">
                  Are you sure you want to delete this league?
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  You are about to permanently remove{' '}
                  <strong className="text-slate-900">
                    "{leaguePendingDeleteObj.settings?.leagueName || leagueIdPendingDelete}"
                  </strong>{' '}
                  ({(leaguePendingDeleteObj.roster || []).length} roster bowlers and{' '}
                  {(leaguePendingDeleteObj.history || []).length} archived weeks).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLeagueIdPendingDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                No, Cancel (Keep League)
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteLeague(leagueIdPendingDelete);
                  setLeagueIdPendingDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                Yes, I'm Sure — Delete League
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
