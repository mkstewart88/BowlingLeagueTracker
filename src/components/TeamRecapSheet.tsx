import React, { useState } from 'react';
import { AppState, BowlerEntry, LeagueSettings } from '../types/bowling';
import {
  buildTeamStandings,
  calculateMatchupPoints,
  computeSeasonPlayerStats,
} from '../utils/bowlingLogic';
import { downloadBlob } from '../utils/fileExport';
import { Download, Printer } from 'lucide-react';

interface TeamRecapSheetProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onAddOrUpdateBowler: (
    entry: Omit<BowlerEntry, 'id' | 'createdAt'>,
    editingId: string | null
  ) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const TeamRecapSheet: React.FC<TeamRecapSheetProps> = ({
  appState,
  onUpdateSettings,
  onAddOrUpdateBowler,
  onShowToast,
}) => {
  const { settings, bowlers, roster, history } = appState;
  const teams = buildTeamStandings(bowlers);

  // Pair teams into Lane Pair Matchups (e.g., Lanes 1-2: Team 1 vs Team 2, Lanes 3-4: Team 3 vs Team 4)
  const pairs: {
    pairIndex: number;
    oddLane: number;
    evenLane: number;
    teamA: (typeof teams)[0];
    teamB: (typeof teams)[0];
  }[] = [];

  for (let i = 0; i < teams.length; i += 2) {
    const teamA = teams[i];
    const teamB = teams[i + 1] || {
      placement: i + 2,
      name: 'BYE (Vacant)',
      g1Scratch: 0,
      g2Scratch: 0,
      g3Scratch: 0,
      g1Hdcp: 0,
      g2Hdcp: 0,
      g3Hdcp: 0,
      g1Total: 0,
      g2Total: 0,
      g3Total: 0,
      scratchTotal: 0,
      handicapTotal: 0,
      total: 0,
      players: [],
    };
    const oddLane = (settings.startingLane || 1) + i;
    pairs.push({
      pairIndex: Math.floor(i / 2),
      oddLane,
      evenLane: oddLane + 1,
      teamA,
      teamB,
    });
  }

  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const [activeSide, setActiveSide] = useState<'A' | 'B'>('A');
  const [needsMakeup, setNeedsMakeup] = useState(false);

  const currentPair = pairs[selectedPairIdx] || pairs[0];
  const seasonStats = computeSeasonPlayerStats(roster, history, bowlers, settings, false);

  if (!currentPair) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-xl">
        Enter bowler scores with Team Names assigned to view the Lane Pair Team Recap Sheet.
      </div>
    );
  }

  const activeTeam = activeSide === 'A' ? currentPair.teamA : currentPair.teamB;
  const opponentTeam = activeSide === 'A' ? currentPair.teamB : currentPair.teamA;

  const matchup = calculateMatchupPoints(
    activeTeam,
    opponentTeam,
    settings.pointSystem
  );

  const handleInlineScoreChange = (
    bowler: BowlerEntry,
    field: 'g1' | 'g2' | 'g3',
    newVal: string
  ) => {
    const num = Math.max(0, Math.min(settings.maxGameScore || 300, Number(newVal) || 0));
    const nextG1 = field === 'g1' ? num : bowler.g1;
    const nextG2 = field === 'g2' ? num : bowler.g2;
    const nextG3 = field === 'g3' ? num : bowler.g3;
    const nextScratch = nextG1 + nextG2 + nextG3;
    const nextGrand = nextScratch + (bowler.isAbsent ? 0 : bowler.handicap);

    onAddOrUpdateBowler(
      {
        name: bowler.name,
        team: bowler.team,
        entryMode: 'three',
        scoringType: bowler.scoringType,
        g1: nextG1,
        g2: nextG2,
        g3: nextG3,
        scratchScore: nextScratch,
        handicap: bowler.handicap,
        grandTotal: nextGrand,
        isAbsent: bowler.isAbsent,
        isSub: bowler.isSub,
      },
      bowler.id
    );
  };

  const handleExportRecapCsv = () => {
    const rows: (string | number)[][] = [
      [
        `Week ${settings.weekNumber || '4'} Team Recap Sheet — Lanes ${currentPair.oddLane}-${currentPair.evenLane}: ${currentPair.teamA.name} vs. ${currentPair.teamB.name}`,
      ],
      [
        'ID',
        'Bowler Name',
        'Team',
        'Sex',
        'Book Avg',
        'HCP/Gm',
        'Status',
        'Game 1',
        'Game 2',
        'Game 3',
        'Scratch Series',
        'Series HCP',
        'Grand Total',
      ],
    ];

    activeTeam.players.forEach((b, idx) => {
      const rInfo = roster.find((r) => r.name.toLowerCase() === b.name.toLowerCase());
      const sInfo = seasonStats.find((s) => s.name.toLowerCase() === b.name.toLowerCase());
      const perGmHcp = Math.round(b.handicap / 3);
      rows.push([
        rInfo?.bowlerNumber ?? 101 + idx,
        b.name,
        b.team,
        rInfo?.gender ?? 'M',
        sInfo?.currentAverage ?? rInfo?.bookAverage ?? 165,
        perGmHcp,
        b.isAbsent ? 'ABSENT' : b.isSub ? 'SUB' : 'NORMAL',
        b.g1,
        b.g2,
        b.g3,
        b.scratchScore,
        b.handicap,
        b.grandTotal,
      ]);
    });

    rows.push([]);
    rows.push([
      'SUMMARY ROW',
      '',
      '',
      '',
      '',
      '',
      '',
      'Game 1',
      'Game 2',
      'Game 3',
      'Scratch Series',
      'Handicap',
      'Total w/ HDCP',
      'Points',
    ]);
    rows.push([
      'Scratch Total',
      '',
      '',
      '',
      '',
      '',
      '',
      activeTeam.g1Scratch,
      activeTeam.g2Scratch,
      activeTeam.g3Scratch,
      activeTeam.scratchTotal,
      '',
      '',
      '',
    ]);
    rows.push([
      'Handicap',
      '',
      '',
      '',
      '',
      '',
      '',
      activeTeam.g1Hdcp,
      activeTeam.g2Hdcp,
      activeTeam.g3Hdcp,
      '',
      activeTeam.handicapTotal,
      '',
      '',
    ]);
    rows.push([
      'Total with HDCP',
      '',
      '',
      '',
      '',
      '',
      '',
      activeTeam.g1Total,
      activeTeam.g2Total,
      activeTeam.g3Total,
      '',
      '',
      activeTeam.total,
      '',
    ]);
    rows.push([
      'HDCP Won/Lost',
      '',
      '',
      '',
      '',
      '',
      '',
      matchup.wonFlagsA[0],
      matchup.wonFlagsA[1],
      matchup.wonFlagsA[2],
      '',
      '',
      matchup.wonFlagsA[3],
      '',
    ]);
    rows.push([
      'Team Points Won',
      '',
      '',
      '',
      '',
      '',
      '',
      matchup.gamePtsEarnedA[0],
      matchup.gamePtsEarnedA[1],
      matchup.gamePtsEarnedA[2],
      '',
      '',
      matchup.seriesPtsEarnedA,
      matchup.teamAPoints,
    ]);
    rows.push([
      "Opponent's Points",
      '',
      '',
      '',
      '',
      '',
      '',
      matchup.gamePtsEarnedB[0],
      matchup.gamePtsEarnedB[1],
      matchup.gamePtsEarnedB[2],
      '',
      '',
      matchup.seriesPtsEarnedB,
      matchup.teamBPoints,
    ]);

    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `${(activeTeam.name || 'Team').replace(/[^a-zA-Z0-9]/g, '_')}_Recap_Sheet_Week_${
        settings.weekNumber || '4'
      }.csv`
    );
    onShowToast(`Exported Official Team Recap Sheet CSV for ${activeTeam.name}.`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      {/* Top Lane Pair & Opponent Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="lane-pair-select" className="text-xs font-bold text-slate-700">
            Lane Pair Matchup:
          </label>
          <select
            id="lane-pair-select"
            value={selectedPairIdx}
            onChange={(e) => setSelectedPairIdx(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg"
          >
            {pairs.map((p, idx) => (
              <option key={idx} value={idx}>
                Lanes {p.oddLane}–{p.evenLane}: {idx * 2 + 1}-{p.teamA.name} vs. {idx * 2 + 2}-{p.teamB.name}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={needsMakeup}
              onChange={(e) => setNeedsMakeup(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <span>Needs Makeup</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={settings.pointSystem}
            onChange={(e) =>
              onUpdateSettings({
                pointSystem: e.target.value as '7pt' | '8pt' | '5pt' | '4pt',
              })
            }
            aria-label="Point System Rule"
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
          >
            <option value="7pt">7-Point System (2-2-2 + 1)</option>
            <option value="8pt">8-Point System (2-2-2 + 2)</option>
            <option value="5pt">5-Point System (1-1-1 + 2)</option>
            <option value="4pt">4-Point System (1-1-1 + 1)</option>
          </select>

          <button
            type="button"
            onClick={handleExportRecapCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Recap CSV
          </button>
        </div>
      </div>

      {/* Team A / Team B Tab Switcher */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveSide('A')}
          className={`px-5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            activeSide === 'A'
              ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          Lane {currentPair.oddLane}: {currentPair.teamA.name} ({matchup.teamAPoints} pts)
        </button>
        <button
          type="button"
          onClick={() => setActiveSide('B')}
          className={`px-5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            activeSide === 'B'
              ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          Lane {currentPair.evenLane}: {currentPair.teamB.name} ({activeSide === 'A' ? matchup.teamBPoints : matchup.teamAPoints} pts)
        </button>
      </div>

      {/* Team Recap Spreadsheet Grid */}
      <div className="overflow-x-auto border border-slate-300 rounded-lg">
        <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
          <thead>
            <tr className="bg-blue-800 text-white font-sans">
              <th className="py-2 px-2.5 border-r border-blue-700 text-center w-10">#</th>
              <th className="py-2 px-2.5 border-r border-blue-700 w-14">ID</th>
              <th className="py-2 px-3 border-r border-blue-700">Bowler Name</th>
              <th className="py-2 px-2 border-r border-blue-700 text-center">S</th>
              <th className="py-2 px-2.5 border-r border-blue-700 text-right">Avg</th>
              <th className="py-2 px-2.5 border-r border-blue-700 text-right">HCP</th>
              <th className="py-2 px-2 border-r border-blue-700 text-center">?</th>
              <th className="py-2 px-3 border-r border-emerald-700 bg-emerald-800 text-right">
                Game 1
              </th>
              <th className="py-2 px-3 border-r border-emerald-700 bg-emerald-800 text-right">
                Game 2
              </th>
              <th className="py-2 px-3 border-r border-emerald-700 bg-emerald-800 text-right">
                Game 3
              </th>
              <th className="py-2 px-3 border-r border-blue-700 text-right">SS</th>
              <th className="py-2 px-3 border-r border-blue-700 text-right">HCP</th>
              <th className="py-2 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {activeTeam.players.map((b, idx) => {
              const rInfo = roster.find(
                (r) => r.name.toLowerCase() === b.name.toLowerCase()
              );
              const sInfo = seasonStats.find(
                (s) => s.name.toLowerCase() === b.name.toLowerCase()
              );
              const avg = sInfo?.currentAverage ?? rInfo?.bookAverage ?? 165;
              const perGameHcp = b.isAbsent ? 0 : Math.round(b.handicap / 3);

              return (
                <tr
                  key={b.id}
                  className={b.isAbsent ? 'bg-amber-50/70' : 'hover:bg-slate-50'}
                >
                  <td className="py-1.5 px-2.5 border-r border-slate-200 bg-blue-700 text-white font-bold text-center">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-2.5 border-r border-slate-200 text-slate-600">
                    {rInfo?.bowlerNumber ?? 101 + idx}
                  </td>
                  <td className="py-1.5 px-3 border-r border-slate-200 font-sans font-bold text-slate-900">
                    {b.name}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center text-slate-600">
                    {rInfo?.gender ?? 'M'}
                  </td>
                  <td className="py-1.5 px-2.5 border-r border-slate-200 text-right text-amber-900 font-semibold">
                    {avg}b
                  </td>
                  <td className="py-1.5 px-2.5 border-r border-slate-200 text-right text-amber-900">
                    {perGameHcp}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center font-bold text-amber-800">
                    {b.isAbsent ? 'A' : b.isSub ? 'S' : ''}
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 text-right">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      aria-label={`Game 1 score for ${b.name}`}
                      value={b.g1}
                      onChange={(e) => handleInlineScoreChange(b, 'g1', e.target.value)}
                      className={`w-16 px-1.5 py-0.5 text-right border rounded font-mono tabular-nums ${
                        b.isAbsent
                          ? 'bg-amber-200/80 border-amber-400 font-bold text-amber-950'
                          : 'bg-white border-slate-200'
                      }`}
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 text-right">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      aria-label={`Game 2 score for ${b.name}`}
                      value={b.g2}
                      onChange={(e) => handleInlineScoreChange(b, 'g2', e.target.value)}
                      className={`w-16 px-1.5 py-0.5 text-right border rounded font-mono tabular-nums ${
                        b.isAbsent
                          ? 'bg-amber-200/80 border-amber-400 font-bold text-amber-950'
                          : 'bg-white border-slate-200'
                      }`}
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 text-right">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      aria-label={`Game 3 score for ${b.name}`}
                      value={b.g3}
                      onChange={(e) => handleInlineScoreChange(b, 'g3', e.target.value)}
                      className={`w-16 px-1.5 py-0.5 text-right border rounded font-mono tabular-nums ${
                        b.isAbsent
                          ? 'bg-amber-200/80 border-amber-400 font-bold text-amber-950'
                          : 'bg-white border-slate-200'
                      }`}
                    />
                  </td>
                  <td className="py-1.5 px-3 border-r border-slate-200 text-right font-semibold">
                    {b.scratchScore}
                  </td>
                  <td className="py-1.5 px-3 border-r border-slate-200 text-right text-slate-600">
                    {b.isAbsent ? 0 : b.handicap}
                  </td>
                  <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                    {b.grandTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Bottom Recap Summary Rows */}
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-mono tabular-nums text-xs">
            <tr className="border-b border-slate-200">
              <td
                colSpan={7}
                className="py-1.5 px-3 bg-blue-700 text-white font-sans font-bold text-right"
              >
                Scratch Total
              </td>
              <td className="py-1.5 px-3 text-right font-semibold">{activeTeam.g1Scratch}</td>
              <td className="py-1.5 px-3 text-right font-semibold">{activeTeam.g2Scratch}</td>
              <td className="py-1.5 px-3 text-right font-semibold">{activeTeam.g3Scratch}</td>
              <td className="py-1.5 px-3 text-right font-bold">{activeTeam.scratchTotal}</td>
              <td colSpan={2} />
            </tr>

            <tr className="border-b border-slate-200">
              <td
                colSpan={7}
                className="py-1.5 px-3 bg-blue-700 text-white font-sans font-bold text-right"
              >
                Handicap
              </td>
              <td className="py-1.5 px-3 text-right text-slate-600">{activeTeam.g1Hdcp}</td>
              <td className="py-1.5 px-3 text-right text-slate-600">{activeTeam.g2Hdcp}</td>
              <td className="py-1.5 px-3 text-right text-slate-600">{activeTeam.g3Hdcp}</td>
              <td />
              <td className="py-1.5 px-3 text-right font-semibold">
                {activeTeam.handicapTotal}
              </td>
              <td />
            </tr>

            <tr className="border-b border-slate-200 bg-white">
              <td
                colSpan={7}
                className="py-1.5 px-3 bg-blue-700 text-white font-sans font-bold text-right"
              >
                Total with HDCP
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                {activeTeam.g1Total}
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                {activeTeam.g2Total}
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                {activeTeam.g3Total}
              </td>
              <td colSpan={2} />
              <td className="py-1.5 px-3 text-right font-bold text-blue-800 text-sm">
                {activeTeam.total}
              </td>
            </tr>

            <tr className="border-b border-slate-200">
              <td
                colSpan={7}
                className="py-1.5 px-3 bg-blue-700 text-white font-sans font-bold text-right"
              >
                HDCP Won / Lost (vs. {opponentTeam.name})
              </td>
              {[0, 1, 2].map((gIdx) => (
                <td key={gIdx} className="py-1.5 px-3 text-right font-bold">
                  <span
                    className={
                      matchup.wonFlagsA[gIdx] === 'W'
                        ? 'text-emerald-700'
                        : matchup.wonFlagsA[gIdx] === 'L'
                        ? 'text-red-700'
                        : 'text-amber-700'
                    }
                  >
                    [{matchup.wonFlagsA[gIdx]}]
                  </span>
                </td>
              ))}
              <td colSpan={2} />
              <td className="py-1.5 px-3 text-right font-bold">
                <span
                  className={
                    matchup.wonFlagsA[3] === 'W'
                      ? 'text-emerald-700'
                      : matchup.wonFlagsA[3] === 'L'
                      ? 'text-red-700'
                      : 'text-amber-700'
                  }
                >
                  [{matchup.wonFlagsA[3]}]
                </span>
              </td>
            </tr>

            <tr className="border-b border-slate-200 bg-emerald-50/40">
              <td
                colSpan={7}
                className="py-1.5 px-3 bg-blue-700 text-white font-sans font-bold text-right"
              >
                Team Points Won
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-emerald-800">
                {matchup.gamePtsEarnedA[0]}
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-emerald-800">
                {matchup.gamePtsEarnedA[1]}
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-emerald-800">
                {matchup.gamePtsEarnedA[2]}
              </td>
              <td colSpan={2} className="py-1.5 px-3 text-right font-bold text-emerald-800">
                Series: {matchup.seriesPtsEarnedA}
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-emerald-900 text-sm">
                {matchup.teamAPoints} pts
              </td>
            </tr>

            <tr>
              <td
                colSpan={7}
                className="py-1.5 px-3 bg-blue-700 text-white font-sans font-bold text-right"
              >
                Opponent's Points ({opponentTeam.name})
              </td>
              <td className="py-1.5 px-3 text-right text-slate-600">
                {matchup.gamePtsEarnedB[0]}
              </td>
              <td className="py-1.5 px-3 text-right text-slate-600">
                {matchup.gamePtsEarnedB[1]}
              </td>
              <td className="py-1.5 px-3 text-right text-slate-600">
                {matchup.gamePtsEarnedB[2]}
              </td>
              <td colSpan={2} className="py-1.5 px-3 text-right text-slate-600">
                Series: {matchup.seriesPtsEarnedB}
              </td>
              <td className="py-1.5 px-3 text-right font-bold text-slate-700">
                {matchup.teamBPoints} pts
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
