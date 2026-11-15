import React, { useRef, useState } from 'react';
import { AppState, LaneMatchup, LeagueSettings } from '../types/bowling';
import {
  buildTeamStandings,
  computeMasterDatabaseMetrics,
  generatePositionRoundMatchups,
  generateRoundRobinSchedule,
} from '../utils/bowlingLogic';
import {
  chooseAutoBackupLocation,
  downloadBlob,
  executeAutoBackupWrite,
  getConnectedAutoBackupHandleName,
  saveLeagueFileToComputer,
} from '../utils/fileExport';
import {
  Calendar,
  Shuffle,
  Trophy,
  Download,
  Users,
  Cake,
  Bell,
  ChevronDown,
  Database,
  FolderOpen,
  Plus,
  Upload,
  HardDrive,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { LegacyCompareTab } from './LegacyCompareTab';

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
  const [weeksToGenerate, setWeeksToGenerate] = useState(12);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newSeasonName, setNewSeasonName] = useState('Fall / Winter 2026-2027');
  const [newScoringType, setNewScoringType] = useState<'handicap' | 'scratch'>('handicap');
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

  return (
    <div className="space-y-6">
      {/* Master Bowler Database Manager & Multi-League Switcher (Inspired by Uploaded Screenshot #1) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-700" />
              Master Bowler & Multi-League Database Manager
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage multiple leagues inside this single program, track cross-league bowler counts, and schedule automatic backups to your PC.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Save Master Backup Now
            </button>
          </div>
        </div>

        {/* 3 Summary Cards Matching Master Bowler Database Manager Screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Bowler Count */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-blue-100/80 border-b border-blue-200 px-4 py-2 text-xs font-bold text-slate-900 text-center">
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

          {/* Card 2: League Count */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-blue-100/80 border-b border-blue-200 px-4 py-2 text-xs font-bold text-slate-900 text-center">
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

          {/* Card 3: Database Backup Status */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-blue-100/80 border-b border-blue-200 px-4 py-2 text-xs font-bold text-slate-900 text-center">
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
          {/* Existing Leagues List (7 Cols) */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="text-xs font-bold text-slate-800">
              All Leagues Inside This Program (Click to Switch Active League)
            </div>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white">
              {Object.entries(leaguesMap).map(([id, lg]) => {
                const isCurrent =
                  id === (appState.activeLeagueId || settings.leagueId || 'thursday-night-rollers');
                const isInactive = lg.settings?.leagueStatus === 'inactive';
                return (
                  <div
                    key={id}
                    className={`px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
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
                          className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded cursor-pointer"
                        >
                          Switch to League
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleLeagueStatus(id)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded cursor-pointer"
                      >
                        {isInactive ? 'Mark Active' : 'Mark Inactive'}
                      </button>
                      {Object.keys(leaguesMap).length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteLeague(id)}
                          aria-label={`Delete ${lg.settings?.leagueName}`}
                          className="p-1 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New League Form (5 Cols) */}
          <form
            onSubmit={handleCreateLeagueSubmit}
            className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3"
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
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
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
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
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
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-semibold"
                >
                  <option value="handicap">Handicap</option>
                  <option value="scratch">Scratch</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-md cursor-pointer transition-colors"
            >
              + Create & Switch to New League
            </button>
          </form>
        </div>

        {/* Automatic Backup Scheduler & Optional Save Location */}
        <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-blue-700" />
                Automatic Backup Scheduler & Optional Save Location
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Protects all {dbMetrics.totalLeagues} leagues, rosters, brackets, and histories in case browser history is cleared or you move to a new computer.
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
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
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
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
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-md cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-700" />
                Choose Optional Save Location on PC...
              </button>
              <button
                type="button"
                onClick={handleRunManualAutoBackup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Run Scheduled Backup Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Header & Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Round-Robin Lane Schedule & Position Round Generator
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically rotates {allTeams.length} league teams across odd/even lane pairs so every team bowls each opponent fairly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <label htmlFor="start-lane-input" className="font-semibold text-slate-700">
              Starting Odd Lane:
            </label>
            <input
              id="start-lane-input"
              type="number"
              min={1}
              max={79}
              step={2}
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
              Season Weeks:
            </label>
            <input
              id="weeks-count-input"
              type="number"
              min={4}
              max={36}
              value={weeksToGenerate}
              onChange={(e) =>
                setWeeksToGenerate(Math.min(36, Math.max(4, Number(e.target.value) || 12)))
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

      {/* Automatic Position Round Preview (1st vs 2nd, 3rd vs 4th) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600" />
              Automatic Position Round Lane Assignments (Based on Current Standings)
            </h3>
            <p className="text-xs text-slate-500">
              Pairs 1st Place vs. 2nd Place, 3rd Place vs. 4th Place across consecutive lane pairs
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {positionRoundPairs.map((pair, idx) => (
            <div
              key={idx}
              className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-amber-900 font-mono">
                  Lanes {pair.oddLane} & {pair.evenLane} · Matchup #{idx + 1}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  #{idx * 2 + 1} {pair.teamA} <span className="text-slate-400 font-normal">vs.</span> #{idx * 2 + 2} {pair.teamB}
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-800">
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
              className={`bg-white border rounded-xl overflow-hidden shadow-xs ${
                isCurrentWeek ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
              }`}
            >
              <div
                className={`px-4 py-2.5 border-b flex items-center justify-between text-xs font-bold ${
                  isCurrentWeek
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Week {weekNum}
                </span>
                {isCurrentWeek && <span>Current Active Week</span>}
              </div>

              <div className="divide-y divide-slate-100 p-3 space-y-2">
                {matches.map((m, idx) => (
                  <div
                    key={idx}
                    className="pt-2 first:pt-0 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Lanes {m.oddLane}–{m.evenLane}
                    </span>
                    <div className="text-right font-medium text-slate-900">
                      <span>{m.teamA}</span>{' '}
                      <span className="text-slate-400">vs</span>{' '}
                      <span>{m.teamB}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* League Command Center: League Officers, Upcoming Birthdays & Special Season Events */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Users className="w-4 h-4 text-blue-700" />
            League Officers ({settings.seasonName})
          </h3>
          <div className="space-y-2 text-xs">
            {roster
              .filter((r) => r.officerRole)
              .map((officer) => (
                <div key={officer.id} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">{officer.officerRole}:</span>
                  <span className="font-bold text-slate-900">
                    {officer.name} ({officer.team})
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Cake className="w-4 h-4 text-amber-600" />
            Bowler Birthdays & Milestones
          </h3>
          <div className="space-y-2 text-xs">
            {roster
              .filter((r) => r.birthday)
              .slice(0, 5)
              .map((b) => (
                <div key={b.id} className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{b.name}</span>
                  <span className="font-mono text-slate-600">{b.birthday}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Bell className="w-4 h-4 text-emerald-700" />
            Special Season Events & Planner
          </h3>
          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-semibold">1st Half Position Round:</span>
              <span className="font-mono">Week 8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Mid-Season Mystery Doubles:</span>
              <span className="font-mono">Week 12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Championship Roll-Off & Banquet:</span>
              <span className="font-mono">Week {settings.totalWeeks || 31}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Preserved Original V1 & V2 Live Comparison Sandbox */}
      <details className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <summary className="px-5 py-3.5 text-sm font-bold text-slate-900 cursor-pointer flex items-center justify-between bg-slate-50">
          <span>View Original Saved Codebases (Version 1 vs. Version 2 Side-by-Side Archive)</span>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </summary>
        <div className="p-5 border-t border-slate-200">
          <LegacyCompareTab />
        </div>
      </details>
    </div>
  );
};
