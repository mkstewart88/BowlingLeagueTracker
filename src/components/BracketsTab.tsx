import React, { useState } from 'react';
import { AppState, LeagueSettings } from '../types/bowling';
import { buildEightPlayerBracket } from '../utils/bowlingLogic';
import { downloadBlob } from '../utils/fileExport';
import { Shuffle, Trophy, Download, Users, CheckSquare } from 'lucide-react';

interface BracketsTabProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onUpdateBracketEntrants: (entrantIds: string[]) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const BracketsTab: React.FC<BracketsTabProps> = ({
  appState,
  onUpdateSettings,
  onUpdateBracketEntrants,
  onShowToast,
}) => {
  const { settings, bowlers, bracketEntrantIds } = appState;
  const [bracketMode, setBracketMode] = useState<'handicap' | 'scratch'>('handicap');
  const [subView, setSubView] = useState<'tree' | 'opponents' | 'payouts'>('tree');
  const [seedOrder, setSeedOrder] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7]);

  const activeBowlers = bowlers.filter((b) => !b.isAbsent);
  const selectedBowlers = activeBowlers.filter((b) =>
    bracketEntrantIds.includes(b.id)
  );

  // Re-order according to current shuffle seed
  const orderedEntrants = seedOrder
    .map((idx) => selectedBowlers[idx])
    .filter(Boolean);

  // Also build a second rotated bracket so multiple brackets can be viewed
  const rotatedEntrants = [...orderedEntrants.slice(2), ...orderedEntrants.slice(0, 2)];

  const bracket1 = buildEightPlayerBracket(
    orderedEntrants.length >= 2 ? orderedEntrants : activeBowlers,
    bracketMode,
    `Bracket #1 — ${bracketMode === 'handicap' ? 'Handicap' : 'Scratch'}`,
    settings.bracketEntryFee || 5,
    settings.bracketFirstPlacePayout || 25,
    settings.bracketSecondPlacePayout || 10,
    settings.startingLane || 1
  );

  const bracket2 = buildEightPlayerBracket(
    rotatedEntrants.length >= 2 ? rotatedEntrants : activeBowlers.slice().reverse(),
    bracketMode,
    `Bracket #2 — ${bracketMode === 'handicap' ? 'Handicap' : 'Scratch'}`,
    settings.bracketEntryFee || 5,
    settings.bracketFirstPlacePayout || 25,
    settings.bracketSecondPlacePayout || 10,
    (settings.startingLane || 1) + 2
  );

  const handleToggleEntrant = (bowlerId: string) => {
    if (bracketEntrantIds.includes(bowlerId)) {
      onUpdateBracketEntrants(bracketEntrantIds.filter((id) => id !== bowlerId));
    } else {
      onUpdateBracketEntrants([...bracketEntrantIds, bowlerId]);
    }
  };

  const handleShuffleSeeds = () => {
    const indices = Array.from({ length: Math.max(8, selectedBowlers.length) }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setSeedOrder(indices);
    onShowToast('Shuffled 8-player bracket pairings.');
  };

  const handleExportBracketCsv = () => {
    if (!bracket1) return;
    const rows = [
      [
        'Bracket',
        'Slot',
        'Round 1 (Game 1) Matchup',
        'Round 2 (Game 2) Winner',
        'Final Champion (Game 3)',
        '1st Prize ($)',
        'Runner-Up',
        '2nd Prize ($)',
      ],
    ];

    [bracket1, bracket2].forEach((brk) => {
      if (!brk) return;
      brk.quarterfinals.forEach((qf, idx) => {
        rows.push([
          brk.title,
          `Match ${qf.slotIndex}`,
          `${qf.playerA.name} (${qf.playerA.g1Score}) vs ${qf.playerB.name} (${qf.playerB.g1Score})`,
          `${qf.round1Winner.name} (G2: ${qf.round1Winner.g2Total})`,
          idx === 0 ? `${brk.champion.name} (G3: ${brk.champion.g3Total})` : '',
          idx === 0 ? String(brk.champion.payout) : '',
          idx === 0 ? `${brk.runnerUp.name} (G3: ${brk.runnerUp.g3Total})` : '',
          idx === 0 ? String(brk.runnerUp.payout) : '',
        ]);
      });
    });

    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `${(settings.leagueName || 'League').replace(/[^a-zA-Z0-9]/g, '_')}_Week_${
        settings.weekNumber || '4'
      }_Brackets_Payouts.csv`
    );
    onShowToast('Exported Weekly Tournament Brackets & Payouts CSV.');
  };

  const bracketsList = [bracket1, bracket2].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top Bracket Control Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            8-Player Tournament Brackets (Handicap & Scratch)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically resolves Game 1 Quarterfinals → Game 2 Semifinals → Game 3 Championship Finals from your entered scores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setBracketMode('handicap')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                bracketMode === 'handicap'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Handicap Bracket
            </button>
            <button
              type="button"
              onClick={() => setBracketMode('scratch')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                bracketMode === 'scratch'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Scratch Bracket
            </button>
          </div>

          <button
            type="button"
            onClick={handleShuffleSeeds}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Shuffle Bracket Draw
          </button>

          <button
            type="button"
            onClick={handleExportBracketCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Brackets CSV
          </button>
        </div>
      </section>

      {/* Sub-Navigation & Prize Rules Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setSubView('tree')}
            className={`px-3.5 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
              subView === 'tree'
                ? 'bg-blue-700 text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            View Brackets Tree
          </button>
          <button
            type="button"
            onClick={() => setSubView('opponents')}
            className={`px-3.5 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
              subView === 'opponents'
                ? 'bg-blue-700 text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Opponent View
          </button>
          <button
            type="button"
            onClick={() => setSubView('payouts')}
            className={`px-3.5 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
              subView === 'payouts'
                ? 'bg-blue-700 text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Payouts & Entrants ({selectedBowlers.length} Entered)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <label htmlFor="brk-fee" className="font-semibold text-slate-600">
              Entry ($):
            </label>
            <input
              id="brk-fee"
              type="number"
              min={1}
              max={100}
              value={settings.bracketEntryFee}
              onChange={(e) =>
                onUpdateSettings({ bracketEntryFee: Math.max(1, Number(e.target.value) || 5) })
              }
              className="w-14 px-2 py-1 border border-slate-300 rounded font-mono tabular-nums text-center"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="brk-1st" className="font-semibold text-slate-600">
              1st Place ($):
            </label>
            <input
              id="brk-1st"
              type="number"
              min={1}
              max={500}
              value={settings.bracketFirstPlacePayout}
              onChange={(e) =>
                onUpdateSettings({
                  bracketFirstPlacePayout: Math.max(1, Number(e.target.value) || 25),
                })
              }
              className="w-16 px-2 py-1 border border-slate-300 rounded font-mono tabular-nums text-center"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="brk-2nd" className="font-semibold text-slate-600">
              2nd Place ($):
            </label>
            <input
              id="brk-2nd"
              type="number"
              min={0}
              max={500}
              value={settings.bracketSecondPlacePayout}
              onChange={(e) =>
                onUpdateSettings({
                  bracketSecondPlacePayout: Math.max(0, Number(e.target.value) || 10),
                })
              }
              className="w-16 px-2 py-1 border border-slate-300 rounded font-mono tabular-nums text-center"
            />
          </div>
        </div>
      </section>

      {/* SUBVIEW 1: Visual 3-Round Bracket Trees (Game 1 -> Game 2 -> Game 3 -> Winner Payouts) */}
      {subView === 'tree' && (
        <div className="space-y-6">
          {bracketsList.map((brk) => {
            if (!brk) return null;
            return (
              <section
                key={brk.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 overflow-x-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-blue-800">
                      {brk.title} — Week {settings.weekNumber || '4'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      8 Bowlers · Entry ${brk.entryFee} · 1st Place ${brk.firstPrize} · 2nd Place ${brk.secondPrize}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-red-700 font-mono">
                    ** FINISHED **
                  </span>
                </div>

                {/* 4-Column Visual Bracket Tree */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-w-[780px] text-xs font-mono tabular-nums">
                  {/* Column 1: Game 1 (Quarterfinals - 8 Slots) */}
                  <div className="space-y-3">
                    <div className="font-sans font-bold text-slate-700 text-center pb-1 border-b border-slate-200">
                      Game 1 (Quarterfinals)
                    </div>
                    {brk.quarterfinals.map((qf) => {
                      const aWon = qf.playerA.g1Score >= qf.playerB.g1Score;
                      return (
                        <div
                          key={qf.slotIndex}
                          className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50"
                        >
                          <div
                            className={`px-3 py-1.5 flex items-center justify-between border-b border-slate-200 ${
                              aWon ? 'bg-emerald-50/80 text-emerald-950 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <span className="truncate">
                              Ln={qf.playerA.lane} h={qf.playerA.hdcpPerGame} {qf.playerA.name}
                            </span>
                            <span className="ml-2">{qf.playerA.g1Score}</span>
                          </div>
                          <div
                            className={`px-3 py-1.5 flex items-center justify-between ${
                              !aWon ? 'bg-emerald-50/80 text-emerald-950 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <span className="truncate">
                              Ln={qf.playerB.lane} h={qf.playerB.hdcpPerGame} {qf.playerB.name}
                            </span>
                            <span className="ml-2">{qf.playerB.g1Score}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Column 2: Game 2 (Semifinals - 4 Winners) */}
                  <div className="flex flex-col justify-around space-y-4">
                    <div className="font-sans font-bold text-slate-700 text-center pb-1 border-b border-slate-200">
                      Game 2 (Semifinals)
                    </div>
                    {[0, 1].map((semiIdx) => {
                      const topNode = brk.quarterfinals[semiIdx * 2].round1Winner;
                      const botNode = brk.quarterfinals[semiIdx * 2 + 1].round1Winner;
                      const topWon = topNode.g2Total >= botNode.g2Total;
                      return (
                        <div
                          key={semiIdx}
                          className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50 my-auto"
                        >
                          <div
                            className={`px-3 py-2 flex items-center justify-between border-b border-slate-200 ${
                              topWon ? 'bg-blue-50 text-blue-950 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <span className="truncate">{topNode.name}</span>
                            <span className="ml-2">{topNode.g2Total}</span>
                          </div>
                          <div
                            className={`px-3 py-2 flex items-center justify-between ${
                              !topWon ? 'bg-blue-50 text-blue-950 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <span className="truncate">{botNode.name}</span>
                            <span className="ml-2">{botNode.g2Total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Column 3: Game 3 (Championship Final - 2 Finalists) */}
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="font-sans font-bold text-slate-700 text-center pb-1 border-b border-slate-200">
                      Game 3 (Finals)
                    </div>
                    <div className="border-2 border-blue-600 rounded-lg overflow-hidden bg-white my-auto shadow-xs">
                      <div
                        className={`px-3 py-2.5 flex items-center justify-between border-b border-slate-200 ${
                          brk.semifinals.match1Winner.g3Total >=
                          brk.semifinals.match2Winner.g3Total
                            ? 'bg-emerald-50 text-emerald-950 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate">{brk.semifinals.match1Winner.name}</span>
                        <span className="ml-2">{brk.semifinals.match1Winner.g3Total}</span>
                      </div>
                      <div
                        className={`px-3 py-2.5 flex items-center justify-between ${
                          brk.semifinals.match2Winner.g3Total >
                          brk.semifinals.match1Winner.g3Total
                            ? 'bg-emerald-50 text-emerald-950 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate">{brk.semifinals.match2Winner.name}</span>
                        <span className="ml-2">{brk.semifinals.match2Winner.g3Total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Final Bracket Payout Results */}
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="font-sans font-bold text-slate-700 text-center pb-1 border-b border-slate-200">
                      Bracket Winners & Payout
                    </div>
                    <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-lg space-y-2 my-auto">
                      <div className="flex items-center justify-between text-emerald-950 font-bold text-sm">
                        <span>1. {brk.champion.name}</span>
                        <span>${brk.champion.payout}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700 font-semibold text-xs pt-2 border-t border-emerald-200">
                        <span>2. {brk.runnerUp.name}</span>
                        <span>${brk.runnerUp.payout}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* SUBVIEW 2: Opponent Matchup Table View */}
      {subView === 'opponents' && bracket1 && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Head-to-Head Opponent Matrix ({bracket1.title})
            </h3>
            <p className="text-xs text-slate-500">
              Shows each bowler's Round 1 opponent, score needed to advance, and final elimination round.
            </p>
          </div>
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                <th className="py-2.5 px-4 font-bold">Match #</th>
                <th className="py-2.5 px-3 font-bold">Bowler A</th>
                <th className="py-2.5 px-3 font-bold text-right">G1 Total</th>
                <th className="py-2.5 px-3 font-bold">Bowler B</th>
                <th className="py-2.5 px-3 font-bold text-right">G1 Total</th>
                <th className="py-2.5 px-4 font-bold">Advancing Winner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {bracket1.quarterfinals.map((qf) => (
                <tr key={qf.slotIndex} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-bold">Pair #{qf.slotIndex}</td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                    {qf.playerA.name} (+{qf.playerA.hdcpPerGame})
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">{qf.playerA.g1Score}</td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                    {qf.playerB.name} (+{qf.playerB.hdcpPerGame})
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">{qf.playerB.g1Score}</td>
                  <td className="py-2.5 px-4 font-sans font-bold text-emerald-700">
                    {qf.round1Winner.name} ({qf.round1Winner.g1Total})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* SUBVIEW 3: Entrants Selector & Payout Summary */}
      {subView === 'payouts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Select Bowlers Entered in Weekly Brackets ({selectedBowlers.length} Active)
                </h3>
                <p className="text-xs text-slate-500">
                  Check or uncheck bowlers to include them in this week's 8-player bracket draw.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeBowlers.map((b) => {
                const isChecked = bracketEntrantIds.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer text-xs ${
                      isChecked
                        ? 'bg-blue-50/60 border-blue-300 text-slate-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleEntrant(b.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                      />
                      <span>
                        {b.name} ({b.team || 'No Team'})
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-500">
                      {b.grandTotal}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Weekly Bracket Payout Summary
            </h3>
            <div className="space-y-3 text-xs">
              {bracketsList.map((brk) => {
                if (!brk) return null;
                return (
                  <div
                    key={brk.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                  >
                    <div className="font-bold text-slate-900">{brk.title}</div>
                    <div className="flex items-center justify-between">
                      <span>1st Place: <strong>{brk.champion.name}</strong></span>
                      <span className="font-mono font-bold text-emerald-700">
                        ${brk.champion.payout}.00
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>2nd Place: <strong>{brk.runnerUp.name}</strong></span>
                      <span className="font-mono font-bold text-blue-700">
                        ${brk.runnerUp.payout}.00
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
