import React, { useState } from 'react';
import { AppState, LeagueSettings } from '../types/bowling';
import {
  buildTeamStandings,
  calculateMatchupPoints,
  computeSeasonPlayerStats,
  computeSeasonTeamPerformance,
  PlayerSeasonStats,
} from '../utils/bowlingLogic';
import { downloadBlob } from '../utils/fileExport';
import {
  Trophy,
  TrendingUp,
  Download,
  Award,
  Swords,
  Search,
  BarChart3,
  Users,
  History,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface AnalyticsTabProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onLoadArchivedWeek: (weekId: string) => void;
  onDeleteArchivedWeek: (weekId: string) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

type AnalyticsSubTab = 'team_performance' | 'bowler_averages' | 'season_highs' | 'archived_weeks';

const TEAM_BAR_COLORS = [
  'bg-blue-700',
  'bg-emerald-700',
  'bg-amber-600',
  'bg-indigo-700',
  'bg-teal-700',
  'bg-rose-700',
];

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  appState,
  onUpdateSettings,
  onLoadArchivedWeek,
  onDeleteArchivedWeek,
  onShowToast,
}) => {
  const { settings, roster, history, bowlers } = appState;
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('team_performance');

  // Team Performance Sub-Tab State
  const [teamScoreType, setTeamScoreType] = useState<'grand' | 'scratch'>('grand');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  // Bowler Averages Sub-Tab State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBowlerName, setSelectedBowlerName] = useState<string>(
    roster[0]?.name || ''
  );
  const [chartViewMode, setChartViewMode] = useState<'series' | 'average' | 'all_players'>('series');
  const [csvColumns, setCsvColumns] = useState({
    gamesAndPins: true,
    bookAndEnteringAvg: true,
    handicapBreakdown: true,
    seasonHighs: true,
    weeklyHistory: true,
  });

  // Season Highs Sub-Tab State
  const [oneAwardPerBowlerRule, setOneAwardPerBowlerRule] = useState(true);

  // Confirm Delete Archived Week Modal State
  const [confirmDeleteWeekId, setConfirmDeleteWeekId] = useState<string | null>(null);

  const playerStats = computeSeasonPlayerStats(
    roster,
    history,
    bowlers,
    settings,
    true
  );

  const teamPerf = computeSeasonTeamPerformance(
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

  // Season High Awards Computation
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

    return {
      highScratchSeries: pickTop((p) => p.highScratchSeries, oneAwardPerBowlerRule),
      highScratchGame: pickTop((p) => p.highScratchGame, oneAwardPerBowlerRule),
      highHandicapSeries: pickTop((p) => p.highHandicapSeries, oneAwardPerBowlerRule),
      highHandicapGame: pickTop((p) => p.highHandicapGame, oneAwardPerBowlerRule),
      mostImproved: pickTop((p) => p.averageImprovement, false),
      mostPinsOverGame: pickTop((p) => p.maxPinsOverAverageGame, false),
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
        settings.pointSystem,
        settings.customPointsPerGame ?? 2,
        settings.customPointsPerSeries ?? 1
      ),
    });
  }

  const handleExportTeamPerformanceCsv = () => {
    const headers = [
      'Consistency Rank',
      'Team Name',
      'Weeks Played',
      ...teamPerf.weekLabels.map((w) => `${w} Total`),
      'Season Scratch Pins',
      'Season Handicap Pins',
      'Season Total Pins',
      'Weekly Avg Score',
      'High Week',
      'Low Week',
      'High-Low Spread',
      'Std Deviation (± Pins)',
      'Consistency Score (%)',
    ];

    const rows = teamPerf.teams.map((t) => {
      const weekScoresMap = new Map(
        t.weeklyScores.map((w) => [
          w.weekLabel,
          teamScoreType === 'grand' ? w.grandTotal : w.scratchTotal,
        ])
      );
      return [
        `#${t.consistencyRank}`,
        t.teamName,
        t.weeksPlayed,
        ...teamPerf.weekLabels.map((w) => weekScoresMap.get(w) ?? '—'),
        t.seasonScratchPins,
        t.seasonHandicapPins,
        t.seasonGrandPins,
        teamScoreType === 'grand' ? t.weeklyAverageGrand : t.weeklyAverageScratch,
        t.highWeekGrand,
        t.lowWeekGrand,
        t.highLowSpread,
        `±${t.stdDeviation}`,
        `${t.consistencyScore}%`,
      ];
    });

    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `${(settings.leagueName || 'League').replace(/[^a-zA-Z0-9]/g, '_')}_Team_Performance_Consistency.csv`
    );
    onShowToast('Exported Team Performance & Weekly Consistency CSV.');
  };

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
        'Series Hdcp'
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

  // Max score across all team weekly scores for bar chart scaling
  const maxTeamWeeklyScore = Math.max(
    1,
    ...teamPerf.teams.flatMap((t) =>
      t.weeklyScores.map((w) =>
        teamScoreType === 'grand' ? w.grandTotal : w.scratchTotal
      )
    )
  );

  const visibleTeamsForChart =
    teamFilter === 'ALL'
      ? teamPerf.teams
      : teamPerf.teams.filter((t) => t.teamName === teamFilter);

  const targetWeekToDelete = history.find((h) => h.id === confirmDeleteWeekId);

  return (
    <div className="space-y-6">
      {/* High-Contrast Framed Sub-Tab Navigation Bar */}
      <div className="bg-slate-800 border-2 border-slate-700 rounded-xl p-2 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Standings and Analytics Sections">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'team_performance'}
            onClick={() => setSubTab('team_performance')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'team_performance'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>2A. Team Performance (Weekly Bar Chart)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'bowler_averages'}
            onClick={() => setSubTab('bowler_averages')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'bowler_averages'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2B. Bowler Averages & Trends</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'season_highs'}
            onClick={() => setSubTab('season_highs')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'season_highs'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>2C. Season Highs & Honor Roll</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'archived_weeks'}
            onClick={() => setSubTab('archived_weeks')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'archived_weeks'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/70'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>2D. Archived Weeks ({history.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 2A: TEAM PERFORMANCE & WEEKLY CONSISTENCY BAR CHART           */}
      {/* ===================================================================== */}
      {subTab === 'team_performance' && (
        <div className="space-y-6">
          {/* Section Header & Controls */}
          <section className="bg-white border-2 border-blue-300 rounded-xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-700" />
                Team Performance & Season Consistency Analyzer
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Compare total team scores per week across {teamPerf.weekLabels.length} weeks to identify the most consistent teams in {settings.leagueName}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Toggle Grand Total vs Scratch */}
              <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-300 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTeamScoreType('grand')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    teamScoreType === 'grand'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Total w/ Handicap
                </button>
                <button
                  type="button"
                  onClick={() => setTeamScoreType('scratch')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    teamScoreType === 'scratch'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Scratch Team Total
                </button>
              </div>

              {/* Filter by Team */}
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                aria-label="Filter Team Performance Chart"
                className="px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
              >
                <option value="ALL">Show All Teams ({teamPerf.teams.length})</option>
                {teamPerf.teams.map((t) => (
                  <option key={t.teamName} value={t.teamName}>
                    {t.teamName} (Avg: {t.weeklyAverageGrand}/wk)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportTeamPerformanceCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Team Performance CSV
              </button>
            </div>
          </section>

          {/* 4 Summary Callout Cards: Most Consistent Team, Highest Weekly Average, High Single Week, Active Weeks */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-xl p-4 shadow-xs">
              <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                #1 Most Consistent Team
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1 truncate">
                {teamPerf.mostConsistentTeam?.teamName || '—'}
              </div>
              <div className="text-xs text-emerald-800 font-mono tabular-nums mt-0.5">
                {teamPerf.mostConsistentTeam
                  ? `${teamPerf.mostConsistentTeam.consistencyScore}% Consistency (±${teamPerf.mostConsistentTeam.stdDeviation} pins/wk)`
                  : 'Need 2+ weeks'}
              </div>
            </div>

            <div className="bg-blue-50/70 border-2 border-blue-300 rounded-xl p-4 shadow-xs">
              <div className="text-xs font-bold text-blue-900">Highest Team Weekly Average</div>
              <div className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-1">
                {teamPerf.highestAverageTeam
                  ? `${
                      teamScoreType === 'grand'
                        ? teamPerf.highestAverageTeam.weeklyAverageGrand
                        : teamPerf.highestAverageTeam.weeklyAverageScratch
                    } pins/wk`
                  : '—'}
              </div>
              <div className="text-xs font-bold text-slate-700 mt-0.5 truncate">
                {teamPerf.highestAverageTeam?.teamName || '—'}
              </div>
            </div>

            <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-4 shadow-xs">
              <div className="text-xs font-bold text-amber-900">Highest Single-Week Team Total</div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                {teamPerf.highestSingleWeekTeam?.score || '—'}
              </div>
              <div className="text-xs text-slate-700 mt-0.5 truncate">
                {teamPerf.highestSingleWeekTeam
                  ? `${teamPerf.highestSingleWeekTeam.teamName} (${teamPerf.highestSingleWeekTeam.weekLabel})`
                  : '—'}
              </div>
            </div>

            <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-xs">
              <div className="text-xs font-bold text-slate-700">Weeks Tracked in Chart</div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                {teamPerf.weekLabels.length} Weeks
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {teamPerf.teams.length} competing teams
              </div>
            </div>
          </section>

          {/* Visual Bar Chart of Total Team Scores Per Week */}
          <section className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-blue-50/90 border-b-2 border-blue-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Bar Chart: Total Team Scores Per Week ({teamScoreType === 'grand' ? 'With Handicap' : 'Scratch'})
                </h3>
                <p className="text-xs text-slate-600">
                  Each bar shows the team's weekly pin total compared against their season weekly average (vertical marker line). Narrower bars around the marker indicate higher week-to-week consistency.
                </p>
              </div>
              <div className="text-xs font-bold text-blue-900 bg-white border border-blue-200 px-3 py-1 rounded-md">
                Vertical Line = Team Season Weekly Average
              </div>
            </div>
            <div className="p-6">

            {visibleTeamsForChart.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No team scores recorded yet. Enter bowler scores on Tab 1 to view the Team Performance Bar Chart.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {visibleTeamsForChart.map((team, tIdx) => {
                  const barColor = TEAM_BAR_COLORS[tIdx % TEAM_BAR_COLORS.length];
                  const avgVal =
                    teamScoreType === 'grand'
                      ? team.weeklyAverageGrand
                      : team.weeklyAverageScratch;
                  const avgPct = Math.min(98, Math.max(5, (avgVal / maxTeamWeeklyScore) * 100));

                  return (
                    <div
                      key={team.teamName}
                      className="p-4 bg-slate-50 border-2 border-slate-300 rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                        <div>
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span>{team.teamName}</span>
                            {team.consistencyRank === 1 && (
                              <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-900 rounded">
                                #1 Most Consistent
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                            Weekly Avg: <strong>{avgVal}</strong> · Spread: {team.highLowSpread} pins · Variance: ±{team.stdDeviation}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Consistency</div>
                          <div className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                            {team.consistencyScore}%
                          </div>
                        </div>
                      </div>

                      {/* Vertical Column / Horizontal Bar Chart per Week */}
                      <div className="space-y-2.5 pt-1">
                        {team.weeklyScores.map((wk) => {
                          const val =
                            teamScoreType === 'grand' ? wk.grandTotal : wk.scratchTotal;
                          const pct = Math.min(100, Math.max(8, (val / maxTeamWeeklyScore) * 100));
                          const diffFromAvg = val - avgVal;

                          return (
                            <div key={wk.weekLabel} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                                <span className="font-sans font-bold text-slate-800 w-20">
                                  {wk.weekLabel}
                                </span>
                                <span className="text-slate-500">
                                  {diffFromAvg >= 0 ? `+${diffFromAvg}` : diffFromAvg} vs avg
                                </span>
                                <span className="font-bold text-slate-900">
                                  {val} pins
                                </span>
                              </div>
                              <div className="w-full h-6 bg-white border border-slate-300 rounded-md overflow-hidden relative flex items-center">
                                <div
                                  className={`h-full ${barColor} transition-all rounded-r`}
                                  style={{ width: `${pct}%` }}
                                  title={`${team.teamName} — ${wk.weekLabel}: ${val} pins`}
                                />
                                {/* Team Season Average Reference Line */}
                                <div
                                  className="h-full w-0.5 bg-slate-950 absolute top-0 z-10"
                                  style={{ left: `${avgPct}%` }}
                                  title={`Season Weekly Average: ${avgVal}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </section>

          {/* Team Consistency & Week-by-Week Comparison Table */}
          <section className="bg-white border-2 border-emerald-300 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-emerald-50/90 px-5 py-4 border-b-2 border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Season Team Consistency & Weekly Totals Table
                </h3>
                <p className="text-xs text-slate-600">
                  Smaller High–Low Spread and lower Standard Deviation (± Pins) indicate a more dependable, consistent team week after week.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                    <th className="py-2.5 px-4 font-bold">Consistency Rank</th>
                    <th className="py-2.5 px-3 font-bold">Team Name</th>
                    {teamPerf.weekLabels.map((wk) => (
                      <th key={wk} className="py-2.5 px-3 font-bold text-right">
                        {wk}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-bold text-right">Weekly Avg</th>
                    <th className="py-2.5 px-3 font-bold text-right">High–Low Spread</th>
                    <th className="py-2.5 px-3 font-bold text-right">Std Dev (±)</th>
                    <th className="py-2.5 px-4 font-bold text-right">Season Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {teamPerf.teams.map((t) => {
                    const wkMap = new Map(
                      t.weeklyScores.map((w) => [
                        w.weekLabel,
                        teamScoreType === 'grand' ? w.grandTotal : w.scratchTotal,
                      ])
                    );
                    return (
                      <tr key={t.teamName} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-sans font-bold text-emerald-800">
                          #{t.consistencyRank} ({t.consistencyScore}%)
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                          {t.teamName}
                        </td>
                        {teamPerf.weekLabels.map((wk) => (
                          <td key={wk} className="py-2.5 px-3 text-right text-slate-700">
                            {wkMap.get(wk) ?? '—'}
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                          {teamScoreType === 'grand'
                            ? t.weeklyAverageGrand
                            : t.weeklyAverageScratch}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {t.highLowSpread} pins
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          ±{t.stdDeviation}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                          {teamScoreType === 'grand'
                            ? t.seasonGrandPins
                            : t.seasonScratchPins}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Current Week Head-to-Head Matchup Points */}
          <section className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 border-b-2 border-slate-300 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-slate-700" />
                  Current Week Head-to-Head Team Point Splits
                </h3>
                <p className="text-xs text-slate-600">
                  Supports any league point system (7-Pt, 8-Pt, 9-Pt, 5-Pt, 4-Pt, or Custom Points)
                </p>
              </div>
              <select
                value={settings.pointSystem}
                onChange={(e) =>
                  onUpdateSettings({
                    pointSystem: e.target.value as LeagueSettings['pointSystem'],
                  })
                }
                aria-label="League Point System"
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
              >
                <option value="7pt">7-Point (2 per Game + 1 Series)</option>
                <option value="8pt">8-Point (2 per Game + 2 Series)</option>
                <option value="9pt">9-Point (2 per Game + 3 Series)</option>
                <option value="5pt">5-Point (1 per Game + 2 Series)</option>
                <option value="4pt">4-Point (1 per Game + 1 Series)</option>
                <option value="custom">
                  Custom ({settings.customPointsPerGame ?? 2}/gm + {settings.customPointsPerSeries ?? 1} ser)
                </option>
              </select>
            </div>

            <div className="p-5">
            {headToHeadPairs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Enter scores for at least 2 teams to view Head-to-Head matchup points.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {headToHeadPairs.map((pair, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>
                        {pair.teamA.name} ({pair.teamA.total})
                      </span>
                      <span className="font-mono tabular-nums px-2.5 py-1 bg-white border border-slate-300 rounded text-blue-700">
                        {pair.result.teamAPoints} pts — {pair.result.teamBPoints} pts
                      </span>
                      <span>
                        {pair.teamB.name} ({pair.teamB.total})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono tabular-nums text-center">
                      {pair.result.breakdown}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2B: BOWLER AVERAGES, PROGRESSION CHARTS & CUSTOM CSV          */}
      {/* ===================================================================== */}
      {subTab === 'bowler_averages' && (
        <div className="space-y-6">
          {/* Handicap Formula & Custom CSV Builder Header */}
          <section className="bg-white border-2 border-blue-300 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Bowler Book Averages, Handicaps & Individual Trend Charts
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any bowler row in the table below to inspect their week-by-week series and average progression chart.
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
                    min={150}
                    max={300}
                    value={settings.handicapBasis}
                    onChange={(e) =>
                      onUpdateSettings({
                        handicapBasis: Math.min(300, Math.max(150, Number(e.target.value) || 220)),
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
                  <span>Per-Game & Series Handicap</span>
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

          {/* Individual Bowler Progression Chart */}
          <section className="bg-white border-2 border-emerald-300 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-emerald-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Individual Bowler Progression Chart
                </h3>
                <p className="text-xs text-slate-500">
                  Switch between weekly series totals, per-game averages, or league-wide average comparison
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChartViewMode('series')}
                    className={`px-3 py-1 rounded-md cursor-pointer ${
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
                    className={`px-3 py-1 rounded-md cursor-pointer ${
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
                    className={`px-3 py-1 rounded-md cursor-pointer ${
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
                {playerStats.slice(0, 10).map((p) => {
                  const enterPct = Math.min(100, (p.enteringAverage / 240) * 100);
                  const curPct = Math.min(100, (p.currentAverage / 240) * 100);
                  return (
                    <div key={p.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          {p.name} <span className="text-slate-400 font-normal">({p.team})</span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-700">
                          Entering: {p.enteringAverage} → <strong className="text-blue-700">Current: {p.currentAverage}</strong>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <div className="text-xs text-slate-500">Current Avg</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                      {selectedPlayer.currentAverage}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Book Hdcp</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-blue-700">
                      +{selectedPlayer.computedHandicapPerGame}/gm
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">High Game</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                      {selectedPlayer.highScratchGame}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">High Series</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                      {selectedPlayer.highScratchSeries}
                    </div>
                  </div>
                </div>

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
                          />
                          <div
                            className="h-full bg-blue-700 absolute left-0 top-0 transition-all"
                            style={{ width: `${scratchPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No completed weeks recorded for this bowler yet.
              </div>
            )}
          </section>

          {/* Complete Season Book Average Table */}
          <section className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-5 py-4 border-b-2 border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Complete Season Book Average & Handicap Sheet ({filteredStats.length} Bowlers)
                </h3>
                <p className="text-xs text-slate-600">
                  Click any row to view that bowler's chart above.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter bowler or team..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
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
                    <th className="py-2.5 px-3 font-bold text-right">Series Hdcp</th>
                    <th className="py-2.5 px-3 font-bold text-right">High Gm</th>
                    <th className="py-2.5 px-4 font-bold text-right">High Ser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {filteredStats.map((p) => (
                    <tr
                      key={p.name}
                      onClick={() => setSelectedBowlerName(p.name)}
                      className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${
                        selectedPlayer?.name === p.name ? 'bg-blue-50/60' : ''
                      }`}
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
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2C: SEASON HIGHS, AWARDS & USBC / LEAGUE HONOR ROLL           */}
      {/* ===================================================================== */}
      {subTab === 'season_highs' && (
        <div className="space-y-6">
          <section className="bg-white border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-amber-50/90 px-5 py-4 border-b-2 border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-600" />
                  Season High Scores & Prize Qualification Board
                </h2>
                <p className="text-xs text-slate-600">
                  Tracks individual high scratch & handicap achievements, Most Improved Bowler, and Pins Over Average.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-800 font-bold cursor-pointer bg-white px-3 py-2 rounded-lg border border-amber-300">
                <input
                  type="checkbox"
                  checked={oneAwardPerBowlerRule}
                  onChange={(e) => setOneAwardPerBowlerRule(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <span>Limit 1 High-Score Award Per Bowler</span>
              </label>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border-2 border-slate-300 rounded-xl">
                <div className="text-xs font-bold text-slate-600">High Scratch Series</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {awards.highScratchSeries.value || '—'}
                </div>
                <div className="text-sm font-bold text-blue-700 mt-1">
                  {awards.highScratchSeries.player?.name || '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {awards.highScratchSeries.player?.team || ''}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-2 border-slate-300 rounded-xl">
                <div className="text-xs font-bold text-slate-600">High Scratch Game</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {awards.highScratchGame.value || '—'}
                </div>
                <div className="text-sm font-bold text-blue-700 mt-1">
                  {awards.highScratchGame.player?.name || '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {awards.highScratchGame.player?.team || ''}
                </div>
              </div>

              <div className="p-4 bg-blue-50/60 border-2 border-blue-300 rounded-xl">
                <div className="text-xs font-bold text-blue-900">High Handicap Series</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {awards.highHandicapSeries.value || '—'}
                </div>
                <div className="text-sm font-bold text-blue-700 mt-1">
                  {awards.highHandicapSeries.player?.name || '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {awards.highHandicapSeries.player?.team || ''}
                </div>
              </div>

              <div className="p-4 bg-blue-50/60 border-2 border-blue-300 rounded-xl">
                <div className="text-xs font-bold text-blue-900">High Handicap Game</div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {awards.highHandicapGame.value || '—'}
                </div>
                <div className="text-sm font-bold text-blue-700 mt-1">
                  {awards.highHandicapGame.player?.name || '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {awards.highHandicapGame.player?.team || ''}
                </div>
              </div>

              <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-xl">
                <div className="text-xs font-bold text-emerald-900">Most Improved Average</div>
                <div className="text-2xl font-bold text-emerald-900 font-mono tabular-nums mt-1">
                  {awards.mostImproved.value >= 0
                    ? `+${awards.mostImproved.value}`
                    : awards.mostImproved.value}{' '}
                  <span className="text-xs font-normal">pins/gm</span>
                </div>
                <div className="text-sm font-bold text-emerald-800 mt-1">
                  {awards.mostImproved.player?.name || '—'}
                </div>
                <div className="text-xs text-emerald-700">
                  {awards.mostImproved.player
                    ? `Entering ${awards.mostImproved.player.enteringAverage} → Current ${awards.mostImproved.player.currentAverage}`
                    : ''}
                </div>
              </div>

              <div className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-xl">
                <div className="text-xs font-bold text-amber-900">Most Pins Over Average (Game)</div>
                <div className="text-2xl font-bold text-amber-950 font-mono tabular-nums mt-1">
                  +{awards.mostPinsOverGame.value || 0} <span className="text-xs font-normal">pins</span>
                </div>
                <div className="text-sm font-bold text-amber-900 mt-1">
                  {awards.mostPinsOverGame.player?.name || '—'}
                </div>
                <div className="text-xs text-amber-800">
                  {awards.mostPinsOverGame.player
                    ? `High Game ${awards.mostPinsOverGame.player.highScratchGame} vs ${awards.mostPinsOverGame.player.enteringAverage} Book Avg`
                    : ''}
                </div>
              </div>
            </div>
          </section>

          {/* Customizable Honor Score Milestone Qualification Table */}
          <section className="bg-white border-2 border-blue-300 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-blue-50/90 px-5 py-4 border-b-2 border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-blue-700" />
                  Customizable Honor Scores & Milestone Tracker
                </h3>
                <p className="text-xs text-slate-600">
                  Set your league's custom Honor Game and Honor Series thresholds (e.g. 200+ Game / 600+ Series, or 225+ / 650+)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="honor-gm-min" className="font-bold text-slate-700">
                    Honor Game Min:
                  </label>
                  <input
                    id="honor-gm-min"
                    type="number"
                    min={150}
                    max={300}
                    value={settings.honorGameThreshold ?? 215}
                    onChange={(e) =>
                      onUpdateSettings({
                        honorGameThreshold: Math.max(100, Number(e.target.value) || 215),
                      })
                    }
                    className="w-16 px-2 py-1 border border-slate-300 rounded font-mono text-center"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="honor-ser-min" className="font-bold text-slate-700">
                    Honor Series Min:
                  </label>
                  <input
                    id="honor-ser-min"
                    type="number"
                    min={400}
                    max={900}
                    value={settings.honorSeriesThreshold ?? 625}
                    onChange={(e) =>
                      onUpdateSettings({
                        honorSeriesThreshold: Math.max(300, Number(e.target.value) || 625),
                      })
                    }
                    className="w-16 px-2 py-1 border border-slate-300 rounded font-mono text-center"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                    <th className="py-2.5 px-4 font-bold">Bowler</th>
                    <th className="py-2.5 px-3 font-bold">Team</th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      {settings.honorGameThreshold ?? 215}+ Games
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      {settings.honorSeriesThreshold ?? 625}+ Series
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right">Max Pins Over Avg (Gm)</th>
                    <th className="py-2.5 px-4 font-bold text-right">Max Pins Over Avg (Ser)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {playerStats.map((p) => (
                    <tr key={p.name} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">{p.team}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                        {p.honorGamesCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {p.honorSeriesCount}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {p.maxPinsOverAverageGame > 0 ? `+${p.maxPinsOverAverageGame}` : '0'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold">
                        {p.maxPinsOverAverageSeries > 0 ? `+${p.maxPinsOverAverageSeries}` : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2D: ARCHIVED WEEKS HISTORY                                    */}
      {/* ===================================================================== */}
      {subTab === 'archived_weeks' && (
        <section className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-100 px-5 py-4 border-b-2 border-slate-300">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-700" />
              Archived Season Weeks ({history.length} Weeks Saved)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Click "Load Week into View" to inspect or reprint any past week's standing sheet.
            </p>
          </div>

          <div className="p-5">
          {history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No archived weeks yet. Click "FINISH WEEK & GENERATE CSV + PRINTOUT" on Tab 1 to archive the active week.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history
                .slice()
                .reverse()
                .map((h) => (
                  <div
                    key={h.id}
                    className="p-4 border-2 border-slate-300 rounded-xl flex flex-col justify-between gap-3 bg-slate-50 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">
                          {h.league} · Week {h.week}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {h.bowlers.length} bowlers entered · Saved {new Date(h.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onLoadArchivedWeek(h.id)}
                          className="px-3 py-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg cursor-pointer"
                        >
                          Load Week into View
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteWeekId(h.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-lg cursor-pointer"
                        >
                          Delete...
                        </button>
                      </div>
                    </div>
                    {h.weekNotes && h.weekNotes.trim() && (
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                        <span className="font-bold text-slate-900">Week Notes: </span>
                        <span className="whitespace-pre-line">{h.weekNotes.trim()}</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          </div>
        </section>
      )}

      {/* Are You Sure Confirmation Modal for Deleting an Archived Week */}
      {targetWeekToDelete && (
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
                  Are you sure you want to delete Week {targetWeekToDelete.week}?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  This will remove the archived scores for <strong>{targetWeekToDelete.league} — Week {targetWeekToDelete.week}</strong> ({targetWeekToDelete.bowlers.length} bowlers) from Season History.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteWeekId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel (Keep Week)
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteArchivedWeek(targetWeekToDelete.id);
                  setConfirmDeleteWeekId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                Yes, Delete Archived Week
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
