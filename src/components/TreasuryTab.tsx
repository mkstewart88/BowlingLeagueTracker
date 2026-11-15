import React, { useState } from 'react';
import { AppState, LeagueSettings, WeeklyDuesRecord } from '../types/bowling';
import { buildTeamStandings, calculateTreasurySummary } from '../utils/bowlingLogic';
import { downloadBlob } from '../utils/fileExport';
import { DollarSign, Download, CheckCircle, Calculator, ClipboardList } from 'lucide-react';

interface TreasuryTabProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onUpdateDuesRecord: (playerId: string, record: WeeklyDuesRecord) => void;
  onMarkAllDuesPaid: () => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

type TreasurySubTab = 'weekly_dues' | 'prize_list';

export const TreasuryTab: React.FC<TreasuryTabProps> = ({
  appState,
  onUpdateSettings,
  onUpdateDuesRecord,
  onMarkAllDuesPaid,
  onShowToast,
}) => {
  const { settings, roster, currentDues, bowlers } = appState;
  const [subTab, setSubTab] = useState<TreasurySubTab>('weekly_dues');
  const [prizeDistMode, setPrizeDistMode] = useState<'place_pct' | 'equal_point'>('place_pct');

  const summary = calculateTreasurySummary(roster, currentDues, settings);
  const teamStandings = buildTeamStandings(bowlers);

  // Projected Full-Season Prize Fund Pool (Net Weekly Prize Fund * Total Season Weeks)
  const projectedSeasonPrizeFund =
    summary.netPrizeFundContribution * (settings.totalWeeks || 31);

  // Default configurable placement percentages for any number of teams
  const getTeamSharePercent = (index: number, totalTeams: number): number => {
    if (totalTeams <= 1) return 100;
    if (prizeDistMode === 'equal_point') {
      // Weighted by current total pins / rank
      const weights = Array.from({ length: totalTeams }, (_, i) => totalTeams - i);
      const sumW = weights.reduce((a, b) => a + b, 0);
      return Math.round(((totalTeams - index) / sumW) * 1000) / 10;
    }
    const preset4 = [40, 28, 19, 13];
    if (totalTeams === 4) return preset4[index] ?? 10;
    const rawWeight = Math.pow(0.72, index);
    const allWeights = Array.from({ length: totalTeams }, (_, i) => Math.pow(0.72, i));
    const totalW = allWeights.reduce((a, b) => a + b, 0);
    return Math.round((rawWeight / totalW) * 1000) / 10;
  };

  const handleExportTreasuryCsv = () => {
    const rows = [
      [
        'Bowler',
        'Team',
        'Payment Status',
        'Dues Paid ($)',
        'House Lineage Share ($)',
        'Secretary Fee ($)',
        'Prize Fund Share ($)',
        'Strike Pot',
        'High Game Pot',
        'Notes',
      ],
      ...roster.map((p) => {
        const rec = currentDues[p.id];
        const status = rec?.status || 'paid';
        const paid =
          rec !== undefined ? rec.amountPaid : settings.weeklyDuesPerBowler;
        const lineage =
          status === 'paid' || status === 'paid_ahead'
            ? settings.lineageCostPerBowler
            : 0;
        const secFee =
          status === 'paid' || status === 'paid_ahead'
            ? settings.secretaryFeePerBowler ?? 0
            : 0;
        const prize = Math.max(0, paid - lineage - secFee);
        return [
          p.name,
          p.team || '',
          status.toUpperCase(),
          paid,
          lineage,
          secFee,
          prize,
          rec?.sidePotStrike ? 'YES' : 'NO',
          rec?.sidePotHighGame ? 'YES' : 'NO',
          rec?.notes || '',
        ];
      }),
    ];

    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `${(settings.leagueName || 'League').replace(/[^a-zA-Z0-9]/g, '_')}_Week_${
        settings.weekNumber || '4'
      }_Treasurer_Ledger.csv`
    );
    onShowToast('Exported Weekly Treasurer & Dues Ledger CSV.');
  };

  return (
    <div className="space-y-6">
      {/* Clear Sub-Tab Bar for Tab 4 */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Treasurer and Dues Sections">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'weekly_dues'}
            onClick={() => setSubTab('weekly_dues')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'weekly_dues'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>4A. Weekly Dues & Envelope Checklist</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'prize_list'}
            onClick={() => setSubTab('prize_list')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === 'prize_list'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>4B. Season Prize Fund & Payout Calculator</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 4A: WEEKLY DUES & ENVELOPE CHECKLIST                          */}
      {/* ===================================================================== */}
      {subTab === 'weekly_dues' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Weekly Bowler Dues, Alley Lineage & Envelope Reconciliation
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure your league's weekly dues, bowling center lineage fee, and optional secretary stipend.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <label htmlFor="weekly-dues-input" className="font-semibold text-slate-700">
                  Dues ($):
                </label>
                <input
                  id="weekly-dues-input"
                  type="number"
                  min={0}
                  max={200}
                  value={settings.weeklyDuesPerBowler}
                  onChange={(e) =>
                    onUpdateSettings({
                      weeklyDuesPerBowler: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-14 px-1.5 py-1 bg-white border border-slate-300 rounded font-mono text-center"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <label htmlFor="lineage-cost-input" className="font-semibold text-slate-700">
                  Lineage ($):
                </label>
                <input
                  id="lineage-cost-input"
                  type="number"
                  min={0}
                  max={200}
                  value={settings.lineageCostPerBowler}
                  onChange={(e) =>
                    onUpdateSettings({
                      lineageCostPerBowler: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-14 px-1.5 py-1 bg-white border border-slate-300 rounded font-mono text-center"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <label htmlFor="sec-fee-input" className="font-semibold text-slate-700">
                  Sec Fee ($):
                </label>
                <input
                  id="sec-fee-input"
                  type="number"
                  min={0}
                  max={50}
                  value={settings.secretaryFeePerBowler ?? 1}
                  onChange={(e) =>
                    onUpdateSettings({
                      secretaryFeePerBowler: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-14 px-1.5 py-1 bg-white border border-slate-300 rounded font-mono text-center"
                />
              </div>

              <button
                type="button"
                onClick={onMarkAllDuesPaid}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Mark All Paid
              </button>

              <button
                type="button"
                onClick={handleExportTreasuryCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Treasurer CSV
              </button>
            </div>
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500">Collected Gross Dues</div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                ${summary.collectedGrossDues.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                of ${summary.expectedGrossDues.toFixed(2)} ({summary.paidCount}/{summary.totalActiveBowlers} paid)
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500">Alley Lineage Cut</div>
              <div className="text-2xl font-bold text-slate-800 font-mono tabular-nums mt-1">
                ${summary.houseLineageCut.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                ${settings.lineageCostPerBowler}/bowler to center
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-emerald-700">Net Prize Fund Added</div>
              <div className="text-2xl font-bold text-emerald-800 font-mono tabular-nums mt-1">
                ${summary.netPrizeFundContribution.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                After lineage & ${summary.secretarySalaryCut} sec fee
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-amber-800">Outstanding Arrears</div>
              <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
                ${summary.outstandingArrears.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {summary.owesCount} bowler(s) owing
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-blue-700">Side Pots Collected</div>
              <div className="text-2xl font-bold text-blue-800 font-mono tabular-nums mt-1">
                ${(summary.strikePotCollected + summary.highGamePotCollected).toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Strike: ${summary.strikePotCollected} · High Gm: ${summary.highGamePotCollected}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Week {settings.weekNumber || '4'} Bowler Dues & Envelope Checklist
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-4 font-bold">Bowler</th>
                    <th className="py-2.5 px-3 font-bold">Team</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Amount Paid ($)</th>
                    <th className="py-2.5 px-3 font-bold text-center">Strike Pot</th>
                    <th className="py-2.5 px-3 font-bold text-center">High Game Pot</th>
                    <th className="py-2.5 px-4 font-bold">Secretary Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {roster.map((p) => {
                    const rec: WeeklyDuesRecord = currentDues[p.id] || {
                      playerId: p.id,
                      playerName: p.name,
                      team: p.team,
                      status: 'paid',
                      amountPaid: settings.weeklyDuesPerBowler,
                      sidePotStrike: false,
                      sidePotHighGame: false,
                      notes: '',
                    };

                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{p.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.team || '—'}</td>
                        <td className="py-2.5 px-3">
                          <select
                            value={rec.status}
                            aria-label={`Payment status for ${p.name}`}
                            onChange={(e) => {
                              const newStatus = e.target.value as WeeklyDuesRecord['status'];
                              const newAmt =
                                newStatus === 'owes' || newStatus === 'exempt'
                                  ? 0
                                  : settings.weeklyDuesPerBowler;
                              onUpdateDuesRecord(p.id, {
                                ...rec,
                                status: newStatus,
                                amountPaid: newAmt,
                              });
                            }}
                            className={`px-2.5 py-1 rounded-md font-semibold border text-xs ${
                              rec.status === 'paid' || rec.status === 'paid_ahead'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                : rec.status === 'owes'
                                ? 'bg-red-50 border-red-300 text-red-900'
                                : 'bg-slate-100 border-slate-300 text-slate-700'
                            }`}
                          >
                            <option value="paid">Paid (${settings.weeklyDuesPerBowler})</option>
                            <option value="owes">Owes (Arrears)</option>
                            <option value="paid_ahead">Paid Ahead</option>
                            <option value="exempt">Exempt / Sub</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            max={500}
                            aria-label={`Amount paid by ${p.name}`}
                            value={rec.amountPaid}
                            onChange={(e) =>
                              onUpdateDuesRecord(p.id, {
                                ...rec,
                                amountPaid: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-20 px-2 py-1 text-right bg-white border border-slate-300 rounded font-mono tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Strike pot entry for ${p.name}`}
                            checked={rec.sidePotStrike}
                            onChange={(e) =>
                              onUpdateDuesRecord(p.id, {
                                ...rec,
                                sidePotStrike: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`High game pot entry for ${p.name}`}
                            checked={rec.sidePotHighGame}
                            onChange={(e) =>
                              onUpdateDuesRecord(p.id, {
                                ...rec,
                                sidePotHighGame: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            aria-label={`Notes for ${p.name}`}
                            value={rec.notes || ''}
                            onChange={(e) =>
                              onUpdateDuesRecord(p.id, {
                                ...rec,
                                notes: e.target.value,
                              })
                            }
                            placeholder="Add envelope note..."
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded text-xs"
                          />
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
      {/* SUB-TAB 4B: END-OF-SEASON PRIZE FUND & PAYOUT CALCULATOR              */}
      {/* ===================================================================== */}
      {subTab === 'prize_list' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-700" />
                End-of-Season Prize Fund & Team Payout Calculator
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Projects your league's full-season net prize fund over {settings.totalWeeks} weeks and calculates team & per-bowler payouts.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Payout Formula:</span>
              <select
                value={prizeDistMode}
                onChange={(e) => setPrizeDistMode(e.target.value as 'place_pct' | 'equal_point')}
                className="px-3 py-1.5 font-bold bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="place_pct">Championship Placement Curve (1st Heavy)</option>
                <option value="equal_point">Balanced Graduated Split (Closer Tiers)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="text-xs font-bold text-emerald-800">Projected Season Prize Pool</div>
              <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                ${projectedSeasonPrizeFund.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-800 mt-0.5">
                ${summary.netPrizeFundContribution}/wk × {settings.totalWeeks} weeks
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold text-slate-500">Season Alley Lineage Total</div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                ${(summary.houseLineageCut * (settings.totalWeeks || 31)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                ${summary.houseLineageCut}/wk × {settings.totalWeeks} weeks
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold text-slate-500">Bowlers Per Team Setting</div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {settings.bowlersPerTeam ?? 4} Bowlers / Team
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Used to split team prize into individual shares
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-sans">
                  <th className="py-2.5 px-4 font-bold">Standing Place</th>
                  <th className="py-2.5 px-3 font-bold">Current Team in Slot</th>
                  <th className="py-2.5 px-3 font-bold text-right">Prize Pool Share (%)</th>
                  <th className="py-2.5 px-3 font-bold text-right">Team Payout ($)</th>
                  <th className="py-2.5 px-4 font-bold text-right">
                    Per Bowler (${settings.bowlersPerTeam ?? 4}/team)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {teamStandings.map((t, idx) => {
                  const pct = getTeamSharePercent(idx, teamStandings.length);
                  const teamPayout = Math.round((projectedSeasonPrizeFund * pct) / 100);
                  const perBowler = Math.round(
                    teamPayout / Math.max(1, settings.bowlersPerTeam ?? 4)
                  );
                  return (
                    <tr key={t.name} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-900">
                        #{idx + 1} Place
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-blue-700">{t.name}</td>
                      <td className="py-2.5 px-3 text-right">{pct}%</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                        ${teamPayout.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ${perBowler.toLocaleString()} / bowler
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
