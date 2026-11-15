import React from 'react';
import { AppState, LeagueSettings, WeeklyDuesRecord } from '../types/bowling';
import { calculateTreasurySummary } from '../utils/bowlingLogic';
import { downloadBlob } from '../utils/fileExport';
import { DollarSign, Download, CheckCircle, AlertCircle, Printer } from 'lucide-react';

interface TreasuryTabProps {
  appState: AppState;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onUpdateDuesRecord: (playerId: string, record: WeeklyDuesRecord) => void;
  onMarkAllDuesPaid: () => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const TreasuryTab: React.FC<TreasuryTabProps> = ({
  appState,
  onUpdateSettings,
  onUpdateDuesRecord,
  onMarkAllDuesPaid,
  onShowToast,
}) => {
  const { settings, roster, currentDues } = appState;
  const summary = calculateTreasurySummary(roster, currentDues, settings);

  const handleExportTreasuryCsv = () => {
    const rows = [
      [
        'Bowler',
        'Team',
        'Payment Status',
        'Dues Paid ($)',
        'House Lineage Share ($)',
        'Prize Fund Share ($)',
        'Strike Pot ($5)',
        'High Game Pot ($5)',
        'Notes',
      ],
      ...roster.map((p) => {
        const rec = currentDues[p.id];
        const status = rec?.status || 'paid';
        const paid =
          rec !== undefined
            ? rec.amountPaid
            : settings.weeklyDuesPerBowler;
        const lineage =
          status === 'paid' || status === 'paid_ahead'
            ? settings.lineageCostPerBowler
            : 0;
        const prize = Math.max(0, paid - lineage);
        return [
          p.name,
          p.team || '',
          status.toUpperCase(),
          paid,
          lineage,
          prize,
          rec?.sidePotStrike ? 'YES ($5)' : 'NO',
          rec?.sidePotHighGame ? 'YES ($5)' : 'NO',
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
      {/* Header & Rate Settings */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Treasurer Billing, Weekly Envelopes & Prize Fund Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track weekly bowler dues, separate bowling alley lineage from the league prize fund, and log optional 50/50 or high-game side pots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <label htmlFor="weekly-dues-input" className="font-semibold text-slate-700">
              Weekly Dues ($):
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
              className="w-16 px-2 py-1 bg-white border border-slate-300 rounded font-mono tabular-nums text-center"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <label htmlFor="lineage-cost-input" className="font-semibold text-slate-700">
              Alley Lineage ($):
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
              className="w-16 px-2 py-1 bg-white border border-slate-300 rounded font-mono tabular-nums text-center"
            />
          </div>

          <button
            type="button"
            onClick={onMarkAllDuesPaid}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Mark All Paid
          </button>

          <button
            type="button"
            onClick={handleExportTreasuryCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Treasurer CSV
          </button>
        </div>
      </section>

      {/* Financial Reconciliation KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">Collected Gross Dues</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            ${summary.collectedGrossDues.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            of ${summary.expectedGrossDues.toFixed(2)} expected ({summary.paidCount}/{summary.totalActiveBowlers} paid)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">Alley Lineage Cut</div>
          <div className="text-2xl font-bold text-slate-800 font-mono tabular-nums mt-1">
            ${summary.houseLineageCut.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Paid to bowling center (${settings.lineageCostPerBowler}/bowler)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-700">Net Prize Fund Added</div>
          <div className="text-2xl font-bold text-emerald-800 font-mono tabular-nums mt-1">
            ${summary.netPrizeFundContribution.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Retained in league treasury pot
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-amber-800">Outstanding Arrears</div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            ${summary.outstandingArrears.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {summary.owesCount} bowler(s) owing for Week {settings.weekNumber || '4'}
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

      {/* Bowler-by-Bowler Dues & Side Pot Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Week {settings.weekNumber || '4'} Bowler Dues & Envelope Checklist
            </h3>
            <p className="text-xs text-slate-500">
              Click any status dropdown or side-pot checkbox to update the weekly envelope reconciliation.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-4 font-bold">Bowler</th>
                <th className="py-2.5 px-3 font-bold">Team</th>
                <th className="py-2.5 px-3 font-bold">Status</th>
                <th className="py-2.5 px-3 font-bold text-right">Amount Paid ($)</th>
                <th className="py-2.5 px-3 font-bold text-center">Strike Pot ($5)</th>
                <th className="py-2.5 px-3 font-bold text-center">High Game Pot ($5)</th>
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
  );
};
