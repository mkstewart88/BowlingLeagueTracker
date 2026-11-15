import React, { useState } from 'react';
import { AppState, LeagueSettings } from '../types/bowling';
import { buildEightPlayerBracket } from '../utils/bowlingLogic';
import { downloadBlob } from '../utils/fileExport';
import { Shuffle, Trophy, Download, Users, Sparkles, GitBranch } from 'lucide-react';

interface BracketsTabProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onUpdateBracketEntrants: (entrantIds: string[]) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

type BracketSubTab = 'tree' | 'side_pots' | 'payouts';

export const BracketsTab: React.FC<BracketsTabProps> = ({
  appState,
  onUpdateSettings,
  onUpdateBracketEntrants,
  onShowToast,
}) => {
  const { settings, bowlers, bracketEntrantIds } = appState;
  const [subTab, setSubTab] = useState<BracketSubTab>('tree');
  const [bracketMode, setBracketMode] = useState<'handicap' | 'scratch'>('handicap');
  const [seedOrder, setSeedOrder] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7]);
  const [mysteryTargetScore, setMysteryTargetScore] = useState<number>(188);
  const [mysteryGameNum, setMysteryGameNum] = useState<1 | 2 | 3>(2);

  const activeBowlers = bowlers.filter((b) => !b.isAbsent);
  const selectedBowlers = activeBowlers.filter((b) =>
    bracketEntrantIds.includes(b.id)
  );

  const orderedEntrants = seedOrder
    .map((idx) => selectedBowlers[idx])
    .filter(Boolean);

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

  const handleDrawMysteryNumber = () => {
    const drawn = 135 + Math.floor(Math.random() * 115);
    setMysteryTargetScore(drawn);
    onShowToast(`Drew Mystery Score Target: ${drawn} for Game ${mysteryGameNum}!`);
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

  // Side Pot Calculations (Game 1, Game 2, Game 3 High Scratch & High Handicap)
  const getGameWinner = (gameIdx: 1 | 2 | 3, withHdcp: boolean) => {
    if (activeBowlers.length === 0) return null;
    const scored = activeBowlers.map((b) => {
      const perGmHdcp = b.entryMode === 'three' ? Math.round(b.handicap / 3) : b.handicap;
      const raw =
        b.entryMode === 'three'
          ? gameIdx === 1
            ? b.g1
            : gameIdx === 2
            ? b.g2
            : b.g3
          : b.scratchScore;
      return {
        bowler: b,
        score: withHdcp ? raw + perGmHdcp : raw,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0] || null;
  };

  // Mystery Score closest match
  const mysteryMatches = activeBowlers
    .map((b) => {
      const raw =
        b.entryMode === 'three'
          ? mysteryGameNum === 1
            ? b.g1
            : mysteryGameNum === 2
            ? b.g2
            : b.g3
          : b.scratchScore;
      return {
        bowler: b,
        gameScore: raw,
        diff: Math.abs(raw - mysteryTargetScore),
      };
    })
    .sort((a, b) => a.diff - b.diff);

  const sidePotFee = settings.sidePotEntryFee ?? 5;
  const totalSidePotPool = activeBowlers.length * sidePotFee;

  return (
    <div className="space-y-6">
      {/* Clear Sub-Tab Bar for Tab 3 */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Brackets and Side Pots Sections">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'tree'}
            onClick={() => setSubTab('tree')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'tree'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>3A. 8-Bowler Tournament Brackets</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'side_pots'}
            onClick={() => setSubTab('side_pots')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'side_pots'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3B. High-Game & Mystery Side Pots</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'payouts'}
            onClick={() => setSubTab('payouts')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'payouts'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3C. Bracket Entrants & Payouts ({selectedBowlers.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 3A: 8-BOWLER TOURNAMENT BRACKETS                              */}
      {/* ===================================================================== */}
      {subTab === 'tree' && (
        <div className="space-y-6">
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
                  <span className="text-xs font-bold text-emerald-800 font-mono">
                    Champion: {brk.champion.name} (${brk.champion.payout})
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-w-[780px] text-xs font-mono tabular-nums">
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

      {/* ===================================================================== */}
      {/* SUB-TAB 3B: HIGH-GAME JACKPOTS & MYSTERY SCORE SIDE POTS              */}
      {/* ===================================================================== */}
      {subTab === 'side_pots' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-600" />
                  Weekly High-Game Side Pots (Game 1, Game 2 & Game 3 Winners)
                </h2>
                <p className="text-xs text-slate-500">
                  Automatically finds the highest Scratch and Handicap game winner for each game of the night.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <label htmlFor="side-pot-fee-input" className="font-bold text-slate-700">
                  Side Pot Entry ($):
                </label>
                <input
                  id="side-pot-fee-input"
                  type="number"
                  min={1}
                  max={100}
                  value={sidePotFee}
                  onChange={(e) =>
                    onUpdateSettings({ sidePotEntryFee: Math.max(1, Number(e.target.value) || 5) })
                  }
                  className="w-14 px-2 py-1 bg-white border border-slate-300 rounded font-mono text-center"
                />
                <span className="text-slate-500">
                  (Total Pool: <strong>${totalSidePotPool}</strong>)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([1, 2, 3] as const).map((gmNum) => {
                const scrWin = getGameWinner(gmNum, false);
                const hdcpWin = getGameWinner(gmNum, true);
                const perGamePrize = Math.round(totalSidePotPool / 3);
                return (
                  <div
                    key={gmNum}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-sm font-bold text-slate-900">Game {gmNum} High Pot</span>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        ~${perGamePrize} Pot
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-500">Scratch Winner</div>
                          <div className="font-bold text-slate-900">
                            {scrWin?.bowler.name || '—'}
                          </div>
                        </div>
                        <span className="text-base font-mono font-bold text-slate-900">
                          {scrWin?.score || '—'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-blue-700 font-semibold">Handicap Winner</div>
                          <div className="font-bold text-slate-900">
                            {hdcpWin?.bowler.name || '—'}
                          </div>
                        </div>
                        <span className="text-base font-mono font-bold text-blue-700">
                          {hdcpWin?.score || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Mystery Score / Lucky Number Pot */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-700" />
                  Mystery Score / Lucky Number Jackpot Drawer
                </h3>
                <p className="text-xs text-slate-500">
                  Draw a random Mystery Score (or type the number pulled from your league's pill bottle) to see who hit or came closest!
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={mysteryGameNum}
                  onChange={(e) => setMysteryGameNum(Number(e.target.value) as 1 | 2 | 3)}
                  aria-label="Select Mystery Game Number"
                  className="px-2.5 py-1.5 font-bold bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value={1}>Game 1</option>
                  <option value={2}>Game 2</option>
                  <option value={3}>Game 3</option>
                </select>
                <input
                  type="number"
                  min={100}
                  max={300}
                  value={mysteryTargetScore}
                  onChange={(e) => setMysteryTargetScore(Number(e.target.value) || 180)}
                  aria-label="Mystery Score Target"
                  className="w-20 px-2.5 py-1.5 font-mono font-bold text-center bg-white border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleDrawMysteryNumber}
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Draw Random Mystery Score
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mysteryMatches.slice(0, 3).map((m, idx) => (
                <div
                  key={m.bowler.id}
                  className={`p-3.5 border rounded-xl flex items-center justify-between text-xs ${
                    m.diff === 0
                      ? 'bg-emerald-50 border-emerald-300'
                      : idx === 0
                      ? 'bg-blue-50/60 border-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      #{idx + 1} {m.bowler.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {m.diff === 0
                        ? 'EXACT MYSTERY SCORE HIT!'
                        : `Off by ${m.diff} pin(s) in Game ${mysteryGameNum}`}
                    </div>
                  </div>
                  <span className="text-base font-mono font-bold text-slate-900">
                    {m.gameScore}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3C: BRACKET ENTRANTS & PAYOUT SUMMARY                         */}
      {/* ===================================================================== */}
      {subTab === 'payouts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Select Bowlers Entered in Weekly Brackets ({selectedBowlers.length} Active)
                </h3>
                <p className="text-xs text-slate-500">
                  Check or uncheck bowlers to include them in this week's 8-player bracket draw.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="brk-1st" className="font-semibold text-slate-600">
                  1st ($):
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
                  className="w-16 px-2 py-1 border border-slate-300 rounded font-mono text-center"
                />
                <label htmlFor="brk-2nd" className="font-semibold text-slate-600">
                  2nd ($):
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
                  className="w-16 px-2 py-1 border border-slate-300 rounded font-mono text-center"
                />
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
