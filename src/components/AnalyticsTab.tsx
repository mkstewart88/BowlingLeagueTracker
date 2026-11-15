import React, { useState } from 'react';
import { AppState, LeagueSettings } from '../types/bowling';
import {
  buildTeamStandings,
  calculateMatchupPoints,
  computeSeasonPlayerStats,
  PlayerSeasonStats,
} from '../utils/bowlingLogic';
import { downloadBlob } from '../utils/fileExport';
import {
  Trophy,
  TrendingUp,
  Download,
  Award,
  Swords,
  Printer,
  Search,
} from 'lucide-react';

interface AnalyticsTabProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onLoadArchivedWeek: (weekId: string) => void;
  onDeleteArchivedWeek: (weekId: string) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  appState,
  onUpdateSettings,
  onLoadArchivedWeek,
  onDeleteArchivedWeek,
  onShowToast,
}) => {
  const { settings, roster, history, bowlers } = appState;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBowlerName, setSelectedBowlerName] = useState<string>(
    roster[0]?.name || ''
  );
  const [oneAwardPerBowlerRule, setOneAwardPerBowlerRule] = useState(true);
  const [chartViewMode, setChartViewMode] = useState<'series' | 'average' | 'all_players'>('series');
  const [csvColumns, setCsvColumns] = useState({
    gamesAndPins: true,
    bookAndEnteringAvg: true,
    handicapBreakdown: true,
    seasonHighs: true,
    weeklyHistory: true,
  });

  const playerStats = computeSeasonPlayerStats(
    roster,
    history,
    bowlers,
    settings,
    true
  );

  const filteredStats = playerStats.filter(
    (p) =>
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPlayer: PlayerSeasonStats | undefined =
    playerStats.find((p) => p.name === selectedBowlerName) || playerStats[0];

  // BLS Season High Awards Computation (with optional USBC "1 Award Per Bowler" protection)
  const computeAwards = () => {
    const active = playerStats.filter((p) => p.gamesBowled > 0);
    const winners = new Set<string>();

    const pickTop = (
      scorer: (p: PlayerSeasonStats) => number,
      enforceUnique: boolean
    ): { player: PlayerSeasonStats | null; value: number } => {
      const sorted = active
        .slice()
        .sort((a, b) => scorer(b) - scorer(a) || a.name.localeCompare(b.name));
      for (const candidate of sorted) {
        if (!enforceUnique || !winners.has(candidate.name)) {
          winners.add(candidate.name);
          return { player: candidate, value: scorer(candidate) };
        }
      }
      return sorted[0]
        ? { player: sorted[0], value: scorer(sorted[0]) }
        : { player: null, value: 0 };
    };

    const highScratchSeries = pickTop(
      (p) => p.highScratchSeries,
      oneAwardPerBowlerRule
    );
    const highScratchGame = pickTop(
      (p) => p.highScratchGame,
      oneAwardPerBowlerRule
    );
    const highHandicapSeries = pickTop(
      (p) => p.highHandicapSeries,
      oneAwardPerBowlerRule
    );
    const highHandicapGame = pickTop(
      (p) => p.highHandicapGame,
      oneAwardPerBowlerRule
    );
    const mostImproved = pickTop(
      (p) => p.averageImprovement,
      false // Most improved is typically separate
    );

    return {
      highScratchSeries,
      highScratchGame,
      highHandicapSeries,
      highHandicapGame,
      mostImproved,
    };
  };

  const awards = computeAwards();

  // Current Week Team Standings & Head-to-Head Matchups
  const teamStandings = buildTeamStandings(bowlers);
  const headToHeadPairs: {
    teamA: (typeof teamStandings)[0];
    teamB: (typeof teamStandings)[0];
    result: ReturnType<typeof calculateMatchupPoints>;
  }[] = [];

  for (let i = 0; i + 1 < teamStandings.length; i += 2) {
    headToHeadPairs.push({
      teamA: teamStandings[i],
      teamB: teamStandings[i + 1],
      result: calculateMatchupPoints(
        teamStandings[i],
        teamStandings[i + 1],
        settings.pointSystem
      ),
    });
  }

  const handleExportBookAverageCsv = () => {
    const headerRow: string[] = ['Bowler', 'Team'];
    if (csvColumns.gamesAndPins) {
      headerRow.push('Weeks', 'Games', 'Scratch Pins');
    }
    if (csvColumns.bookAndEnteringAvg) {
      headerRow.push('Entering Avg', 'Current Book Avg', 'Avg Diff');
    }
    if (csvColumns.handicapBreakdown) {
      headerRow.push(
        `Per-Game Hdcp (${settings.handicapPercent}% of ${settings.handicapBasis})`,
        '3-Game Series Hdcp'
      );
    }
    if (csvColumns.seasonHighs) {
      headerRow.push(
        'High Scratch Game',
        'High Scratch Series',
        'High Hdcp Game',
        'High Hdcp Series'
      );
    }
    if (csvColumns.weeklyHistory) {
      headerRow.push('Weekly Scratch Series Log', 'Weekly Total Series Log');
    }

    const dataRows = playerStats.map((p) => {
      const row: (string | number)[] = [p.name, p.team];
      if (csvColumns.gamesAndPins) {
        row.push(p.weeksBowled, p.gamesBowled, p.totalScratchPins);
      }
      if (csvColumns.bookAndEnteringAvg) {
        row.push(
          p.enteringAverage,
          p.currentAverage,
          p.averageImprovement >= 0 ? `+${p.averageImprovement}` : String(p.averageImprovement)
        );
      }
      if (csvColumns.handicapBreakdown) {
        row.push(p.computedHandicapPerGame, p.computedSeriesHandicap);
      }
      if (csvColumns.seasonHighs) {
        row.push(
          p.highScratchGame,
          p.highScratchSeries,
          p.highHandicapGame,
          p.highHandicapSeries
        );
      }
      if (csvColumns.weeklyHistory) {
        row.push(
          p.weeklySeriesHistory.map((w) => `${w.week}: ${w.scratch}`).join(' | '),
          p.weeklySeriesHistory.map((w) => `${w.week}: ${w.grand}`).join(' | ')
        );
      }
      return row;
    });

    const rows = [headerRow, ...dataRows];

    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `${(settings.leagueName || 'League').replace(/[^a-zA-Z0-9]/g, '_')}_Custom_Analytics_Report.csv`
    );
    onShowToast('Exported Custom Season Averages & High Scores CSV.');
  };

  return (
    <div className="space-y-6">
      {/* Handicap Formula, Custom CSV Builder & Point System Configuration Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Season Averages, High Scores & Customizable Analytics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically calculates rolling USBC book averages, handicap sheets, and tournament awards across {history.length} archived weeks + current Week {settings.weekNumber || '4'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <label htmlFor="hdcp-pct-input" className="font-semibold text-slate-700">
                Handicap Rule:
              </label>
              <input
                id="hdcp-pct-input"
                type="number"
                min={50}
                max={100}
                value={settings.handicapPercent}
                onChange={(e) =>
                  onUpdateSettings({
                    handicapPercent: Math.min(100, Math.max(50, Number(e.target.value) || 90)),
                  })
                }
                className="w-14 px-1.5 py-1 bg-white border border-slate-300 rounded font-mono tabular-nums text-center"
              />
              <span className="text-slate-600">% of</span>
              <input
                id="hdcp-basis-input"
                type="number"
                min={180}
                max={300}
                value={settings.handicapBasis}
                onChange={(e) =>
                  onUpdateSettings({
                    handicapBasis: Math.min(300, Math.max(180, Number(e.target.value) || 220)),
                  })
                }
                className="w-16 px-1.5 py-1 bg-white border border-slate-300 rounded font-mono tabular-nums text-center"
              />
            </div>

            <button
              type="button"
              onClick={handleExportBookAverageCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Custom Analytics CSV
            </button>
          </div>
        </div>

        {/* Customizable CSV Column Builder Strip */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-700">
            Customize CSV Report Columns:
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={csvColumns.gamesAndPins}
                onChange={(e) =>
                  setCsvColumns((p) => ({ ...p, gamesAndPins: e.target.checked }))
                }
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
              />
              <span>Weeks, Games & Total Pins</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={csvColumns.bookAndEnteringAvg}
                onChange={(e) =>
                  setCsvColumns((p) => ({ ...p, bookAndEnteringAvg: e.target.checked }))
                }
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
              />
              <span>Entering & Book Avg (+Diff)</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={csvColumns.handicapBreakdown}
                onChange={(e) =>
                  setCsvColumns((p) => ({ ...p, handicapBreakdown: e.target.checked }))
                }
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
              />
              <span>Per-Game & 3-Game Handicap</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={csvColumns.seasonHighs}
                onChange={(e) =>
                  setCsvColumns((p) => ({ ...p, seasonHighs: e.target.checked }))
                }
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
              />
              <span>High Games & High Series</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={csvColumns.weeklyHistory}
                onChange={(e) =>
                  setCsvColumns((p) => ({ ...p, weeklyHistory: e.target.checked }))
                }
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
              />
              <span>Week-by-Week Series Log</span>
            </label>
          </div>
        </div>
      </section>

      {/* Season Highs & Awards Board */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600" />
              Season High Scores & Prize Qualification Board
            </h3>
            <p className="text-xs text-slate-500">
              Automatically tracks individual high scratch & handicap achievements over time
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={oneAwardPerBowlerRule}
              onChange={(e) => setOneAwardPerBowlerRule(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <span>USBC Rule: Limit 1 High-Score Award Per Bowler</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs font-semibold text-slate-500">High Scratch Series</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {awards.highScratchSeries.value || '—'}
            </div>
            <div className="text-xs font-bold text-blue-700 mt-0.5 truncate">
              {awards.highScratchSeries.player?.name || '—'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {awards.highScratchSeries.player?.team || ''}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs font-semibold text-slate-500">High Scratch Game</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {awards.highScratchGame.value || '—'}
            </div>
            <div className="text-xs font-bold text-blue-700 mt-0.5 truncate">
              {awards.highScratchGame.player?.name || '—'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {awards.highScratchGame.player?.team || ''}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs font-semibold text-slate-500">High Handicap Series</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {awards.highHandicapSeries.value || '—'}
            </div>
            <div className="text-xs font-bold text-blue-700 mt-0.5 truncate">
              {awards.highHandicapSeries.player?.name || '—'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {awards.highHandicapSeries.player?.team || ''}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs font-semibold text-slate-500">High Handicap Game</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {awards.highHandicapGame.value || '—'}
            </div>
            <div className="text-xs font-bold text-blue-700 mt-0.5 truncate">
              {awards.highHandicapGame.player?.name || '—'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {awards.highHandicapGame.player?.team || ''}
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-lg">
            <div className="text-xs font-semibold text-emerald-800">Most Improved Bowler</div>
            <div className="text-2xl font-bold text-emerald-900 font-mono tabular-nums mt-1">
              {awards.mostImproved.value >= 0
                ? `+${awards.mostImproved.value}`
                : awards.mostImproved.value}{' '}
              <span className="text-xs font-normal">pins/gm</span>
            </div>
            <div className="text-xs font-bold text-emerald-800 mt-0.5 truncate">
              {awards.mostImproved.player?.name || '—'}
            </div>
            <div className="text-[11px] text-emerald-700 truncate">
              {awards.mostImproved.player
                ? `${awards.mostImproved.player.enteringAverage} → ${awards.mostImproved.player.currentAverage} avg`
                : ''}
            </div>
          </div>
        </div>
      </section>

      {/* Split Row: Player Performance Trend Chart over Time + Head-to-Head Team Point Matchups */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Player Progression Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Customizable Performance & Progression Charts
              </h3>
              <p className="text-xs text-slate-500">
                Switch between individual multi-week series, per-game average trends, or league-wide average comparison
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setChartViewMode('series')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    chartViewMode === 'series'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Series Bars
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('average')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    chartViewMode === 'average'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Avg / Game
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('all_players')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    chartViewMode === 'all_players'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  League Compare
                </button>
              </div>

              {chartViewMode !== 'all_players' && (
                <select
                  value={selectedPlayer?.name || ''}
                  onChange={(e) => setSelectedBowlerName(e.target.value)}
                  aria-label="Select Bowler for Progression Chart"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  {playerStats.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.team}) — {p.currentAverage} Avg
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {chartViewMode === 'all_players' ? (
            <div className="space-y-2.5 pt-1">
              <div className="text-xs font-semibold text-slate-600">
                League-Wide Entering Average vs. Current Book Average Comparison
              </div>
              {playerStats.slice(0, 8).map((p) => {
                const enterPct = Math.min(100, (p.enteringAverage / 240) * 100);
                const curPct = Math.min(100, (p.currentAverage / 240) * 100);
                return (
                  <div key={p.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {p.name} <span className="text-slate-400 font-normal">({p.team})</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-700">
                        Enter: {p.enteringAverage} → <strong className="text-blue-700">Now: {p.currentAverage}</strong>
                      </span>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded overflow-hidden relative">
                      <div
                        className="h-full bg-slate-300"
                        style={{ width: `${enterPct}%` }}
                      />
                      <div
                        className="h-2 bg-blue-700 absolute left-0 top-1 rounded-r"
                        style={{ width: `${curPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : selectedPlayer && selectedPlayer.weeklySeriesHistory.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <div className="text-[11px] text-slate-500">Current Avg</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {selectedPlayer.currentAverage}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Book Hdcp</div>
                  <div className="text-base font-bold font-mono tabular-nums text-blue-700">
                    +{selectedPlayer.computedHandicapPerGame}/gm
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">High Game</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {selectedPlayer.highScratchGame}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">High Series</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {selectedPlayer.highScratchSeries}
                  </div>
                </div>
              </div>

              {/* Clean Multi-Week Bar & Trend Line Visualization */}
              <div className="pt-2">
                <div className="grid grid-cols-1 gap-2.5">
                  {selectedPlayer.weeklySeriesHistory.map((wk, idx) => {
                    if (chartViewMode === 'average') {
                      const avgPct = Math.min(100, (wk.average / 250) * 100);
                      const enterPct = Math.min(100, (selectedPlayer.enteringAverage / 250) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 w-16">{wk.week}</span>
                            <span className="text-slate-500 font-mono tabular-nums">
                              Entering Avg: {selectedPlayer.enteringAverage}
                            </span>
                            <span className="font-mono tabular-nums font-bold text-emerald-700">
                              {wk.average} Pins / Game
                            </span>
                          </div>
                          <div className="w-full h-5 bg-slate-100 rounded-md overflow-hidden relative flex items-center">
                            <div
                              className="h-full bg-emerald-600 transition-all"
                              style={{ width: `${avgPct}%` }}
                            />
                            <div
                              className="h-full w-0.5 bg-slate-900 absolute top-0"
                              style={{ left: `${enterPct}%` }}
                              title={`Entering Average Baseline: ${selectedPlayer.enteringAverage}`}
                            />
                          </div>
                        </div>
                      );
                    }

                    const maxBar = 800;
                    const scratchPct = Math.min(100, (wk.scratch / maxBar) * 100);
                    const grandPct = Math.min(100, (wk.grand / maxBar) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 w-16">{wk.week}</span>
                          <span className="text-slate-500 font-mono tabular-nums">
                            Avg: {wk.average}/gm
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            {wk.scratch} Scratch · <span className="text-blue-700">{wk.grand} Total</span>
                          </span>
                        </div>
                        <div className="w-full h-5 bg-slate-100 rounded-md overflow-hidden relative flex items-center">
                          <div
                            className="h-full bg-blue-200 transition-all"
                            style={{ width: `${grandPct}%` }}
                            title={`Grand Total with Handicap: ${wk.grand}`}
                          />
                          <div
                            className="h-full bg-blue-700 absolute left-0 top-0 transition-all"
                            style={{ width: `${scratchPct}%` }}
                            title={`Scratch Series: ${wk.scratch}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-blue-700 inline-block" /> Scratch Series
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-blue-200 inline-block" /> Handicap Bonus Pins
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-400">
              No completed weeks recorded for this bowler yet.
            </div>
          )}
        </div>

        {/* Head-to-Head Team Point Matchups (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-slate-700" />
                Head-to-Head Team Point Matchups
              </h3>
              <p className="text-xs text-slate-500">
                Game 1, Game 2, Game 3 & Series Total Point Splits
              </p>
            </div>
            <select
              value={settings.pointSystem}
              onChange={(e) =>
                onUpdateSettings({ pointSystem: e.target.value as '7pt' | '8pt' | '5pt' | '4pt' })
              }
              aria-label="League Point System"
              className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md"
            >
              <option value="7pt">7-Point (2-2-2 + 1 Series)</option>
              <option value="8pt">8-Point (2-2-2 + 2 Series)</option>
              <option value="5pt">5-Point (1-1-1 + 2 Series)</option>
              <option value="4pt">4-Point (1-1-1 + 1 Series)</option>
            </select>
          </div>

          {headToHeadPairs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Enter scores for at least 2 teams to view Head-to-Head matchup points.
            </div>
          ) : (
            <div className="space-y-3">
              {headToHeadPairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>
                      {pair.teamA.name} ({pair.teamA.total})
                    </span>
                    <span className="font-mono tabular-nums px-2 py-0.5 bg-white border border-slate-200 rounded text-blue-700">
                      {pair.result.teamAPoints} pts — {pair.result.teamBPoints} pts
                    </span>
                    <span>
                      {pair.teamB.name} ({pair.teamB.total})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums text-center">
                    {pair.result.breakdown}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Archived Weeks History Manager */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-800">
              Archived Season History ({history.length} Weeks)
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {history.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No archived weeks yet.
                </div>
              ) : (
                history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <div
                      key={h.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs bg-white"
                    >
                      <div>
                        <div className="font-bold text-slate-800">
                          {h.league} · Week {h.week}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {h.bowlers.length} bowlers · {new Date(h.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onLoadArchivedWeek(h.id)}
                          className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                        >
                          Load Week
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteArchivedWeek(h.id)}
                          className="px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Season Book Average & High Score Spreadsheet Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Complete Season Book Average & Handicap Sheet ({filteredStats.length} Bowlers)
            </h3>
            <p className="text-xs text-slate-500">
              When Auto-Fill Handicap is enabled on Tab 1, these handicaps automatically populate as you type each bowler's name.
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter bowler or team..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                <th className="py-2.5 px-4 font-bold">Bowler</th>
                <th className="py-2.5 px-3 font-bold">Team</th>
                <th className="py-2.5 px-3 font-bold text-right">Wks</th>
                <th className="py-2.5 px-3 font-bold text-right">Gms</th>
                <th className="py-2.5 px-3 font-bold text-right">Pins</th>
                <th className="py-2.5 px-3 font-bold text-right">Enter Avg</th>
                <th className="py-2.5 px-3 font-bold text-right">Book Avg</th>
                <th className="py-2.5 px-3 font-bold text-right">Diff</th>
                <th className="py-2.5 px-3 font-bold text-right">Hdcp/Gm</th>
                <th className="py-2.5 px-3 font-bold text-right">3-Gm Hdcp</th>
                <th className="py-2.5 px-3 font-bold text-right">High Gm</th>
                <th className="py-2.5 px-4 font-bold text-right">High Ser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredStats.map((p) => (
                <tr
                  key={p.name}
                  onClick={() => setSelectedBowlerName(p.name)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-900">
                    {p.name}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">{p.team}</td>
                  <td className="py-2.5 px-3 text-right">{p.weeksBowled}</td>
                  <td className="py-2.5 px-3 text-right">{p.gamesBowled}</td>
                  <td className="py-2.5 px-3 text-right">{p.totalScratchPins}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {p.enteringAverage}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {p.currentAverage}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-semibold ${
                      p.averageImprovement > 0
                        ? 'text-emerald-700'
                        : p.averageImprovement < 0
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {p.averageImprovement > 0
                      ? `+${p.averageImprovement}`
                      : p.averageImprovement}
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-700 font-semibold">
                    +{p.computedHandicapPerGame}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-800">
                    +{p.computedSeriesHandicap}
                  </td>
                  <td className="py-2.5 px-3 text-right">{p.highScratchGame || '—'}</td>
                  <td className="py-2.5 px-4 text-right font-bold">
                    {p.highScratchSeries || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
