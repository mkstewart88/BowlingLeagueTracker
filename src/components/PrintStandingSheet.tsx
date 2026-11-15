import React from 'react';
import { AppState } from '../types/bowling';
import { buildTeamStandings, rankWeeklyBowlers } from '../utils/bowlingLogic';

interface PrintStandingSheetProps {
  appState: AppState;
}

export const PrintStandingSheet: React.FC<PrintStandingSheetProps> = ({ appState }) => {
  const { settings, bowlers, weekNotes } = appState;
  const rankedIndividual = rankWeeklyBowlers(bowlers);
  const teamStandings = buildTeamStandings(bowlers);
  const today = new Date().toLocaleDateString();
  const teamColSpan =
    2 + (settings.entryMode === 'three' ? 4 : 1) + (settings.scoringType === 'handicap' ? 1 : 0);

  return (
    <div id="print-standing-sheet" className="hidden print:block bg-white text-slate-950 p-4 font-sans">
      <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          {settings.leagueName || 'Bowling League Official Results'}
        </h1>
        <p className="text-xs font-semibold text-slate-600 mt-1">
          {settings.weekNumber ? `Week ${settings.weekNumber} · ` : ''}
          {settings.seasonName} · {settings.scoringType === 'handicap' ? `${settings.handicapPercent}% of ${settings.handicapBasis} Handicap` : 'Scratch'} · {bowlers.length} Bowlers · Generated {today}
        </p>
      </div>

      {settings.topNote && (
        <div className="text-center font-bold italic text-sm text-red-700 mb-4">
          {settings.topNote}
        </div>
      )}

      {settings.formatMode === 'individual' ? (
        <div>
          <h2 className="text-sm font-bold mb-2">Individual Leaderboard Standings</h2>
          <table className="w-full border-collapse border border-slate-500 text-xs font-mono tabular-nums">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-sans">
                <th className="border border-slate-500 p-1.5 text-left">#</th>
                <th className="border border-slate-500 p-1.5 text-left">Bowler</th>
                <th className="border border-slate-500 p-1.5 text-left">Team</th>
                {settings.entryMode === 'three' ? (
                  <>
                    <th className="border border-slate-500 p-1.5 text-right">G1</th>
                    <th className="border border-slate-500 p-1.5 text-right">G2</th>
                    <th className="border border-slate-500 p-1.5 text-right">G3</th>
                    <th className="border border-slate-500 p-1.5 text-right">Scratch</th>
                  </>
                ) : (
                  <th className="border border-slate-500 p-1.5 text-right">Score</th>
                )}
                {settings.scoringType === 'handicap' && (
                  <th className="border border-slate-500 p-1.5 text-right">Hdcp</th>
                )}
                <th className="border border-slate-500 p-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rankedIndividual.map((b) => {
                const isFirst =
                  settings.highlightFirst === 'yes' && !b.isAbsent && b.placement === 1;
                return (
                  <tr
                    key={b.id}
                    className={isFirst ? 'bg-amber-100 font-bold' : ''}
                  >
                    <td className="border border-slate-500 p-1.5">{b.placement ?? '—'}</td>
                    <td className="border border-slate-500 p-1.5 font-sans font-semibold">
                      {b.name}
                    </td>
                    <td className="border border-slate-500 p-1.5 font-sans">
                      {b.team || '—'}
                    </td>
                    {b.isAbsent ? (
                      <td
                        colSpan={settings.entryMode === 'three' ? 4 : 1}
                        className="border border-slate-500 p-1.5 text-center font-bold italic text-red-700"
                      >
                        ABSENT ({b.scratchScore})
                      </td>
                    ) : settings.entryMode === 'three' ? (
                      <>
                        <td className="border border-slate-500 p-1.5 text-right">{b.g1}</td>
                        <td className="border border-slate-500 p-1.5 text-right">{b.g2}</td>
                        <td className="border border-slate-500 p-1.5 text-right">{b.g3}</td>
                        <td className="border border-slate-500 p-1.5 text-right">
                          {b.scratchScore}
                        </td>
                      </>
                    ) : (
                      <td className="border border-slate-500 p-1.5 text-right">
                        {b.scratchScore}
                      </td>
                    )}
                    {settings.scoringType === 'handicap' && (
                      <td className="border border-slate-500 p-1.5 text-right">
                        {b.isAbsent ? 0 : b.handicap}
                      </td>
                    )}
                    <td className="border border-slate-500 p-1.5 text-right font-bold">
                      {b.grandTotal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {settings.showTeamSummary === 'yes' && (
            <div>
              <h2 className="text-sm font-bold mb-2">Team Standings Summary</h2>
              <table className="w-full border-collapse border border-slate-500 text-xs font-mono tabular-nums mb-4">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-sans">
                    <th className="border border-slate-500 p-1.5">Place</th>
                    <th className="border border-slate-500 p-1.5 text-left">Team Name</th>
                    <th className="border border-slate-500 p-1.5 text-right">G1</th>
                    <th className="border border-slate-500 p-1.5 text-right">G2</th>
                    <th className="border border-slate-500 p-1.5 text-right">G3</th>
                    <th className="border border-slate-500 p-1.5 text-right">Team Total</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStandings.map((t) => (
                    <tr
                      key={t.name}
                      className={
                        settings.highlightFirst === 'yes' && t.placement === 1
                          ? 'bg-amber-100 font-bold'
                          : ''
                      }
                    >
                      <td className="border border-slate-500 p-1.5 text-center">
                        {t.placement}
                      </td>
                      <td className="border border-slate-500 p-1.5 font-sans font-bold">
                        {t.name}
                      </td>
                      <td className="border border-slate-500 p-1.5 text-right">{t.g1Total}</td>
                      <td className="border border-slate-500 p-1.5 text-right">{t.g2Total}</td>
                      <td className="border border-slate-500 p-1.5 text-right">{t.g3Total}</td>
                      <td className="border border-slate-500 p-1.5 text-right font-bold">
                        {t.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {teamStandings.map((t) => (
              <div key={t.name} className="break-inside-avoid">
                <table className="w-full border-collapse border border-slate-500 text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="bg-slate-800 text-white font-sans">
                      <th colSpan={teamColSpan} className="p-1.5 text-center font-bold">
                        {t.placement}. {t.name} (Total: {t.total})
                      </th>
                    </tr>
                    <tr className="bg-slate-200 text-slate-900 font-sans">
                      <th className="border border-slate-500 p-1 text-left">Bowler</th>
                      {settings.entryMode === 'three' ? (
                        <>
                          <th className="border border-slate-500 p-1 text-right">G1</th>
                          <th className="border border-slate-500 p-1 text-right">G2</th>
                          <th className="border border-slate-500 p-1 text-right">G3</th>
                          <th className="border border-slate-500 p-1 text-right">Scr</th>
                        </>
                      ) : (
                        <th className="border border-slate-500 p-1 text-right">Scr</th>
                      )}
                      {settings.scoringType === 'handicap' && (
                        <th className="border border-slate-500 p-1 text-right">Hdcp</th>
                      )}
                      <th className="border border-slate-500 p-1 text-right">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.players.map((b) => (
                      <tr key={b.id}>
                        <td className="border border-slate-500 p-1 font-sans">{b.name}</td>
                        {b.isAbsent ? (
                          <td
                            colSpan={settings.entryMode === 'three' ? 4 : 1}
                            className="border border-slate-500 p-1 text-center italic text-red-700"
                          >
                            ABSENT
                          </td>
                        ) : settings.entryMode === 'three' ? (
                          <>
                            <td className="border border-slate-500 p-1 text-right">{b.g1}</td>
                            <td className="border border-slate-500 p-1 text-right">{b.g2}</td>
                            <td className="border border-slate-500 p-1 text-right">{b.g3}</td>
                            <td className="border border-slate-500 p-1 text-right">
                              {b.scratchScore}
                            </td>
                          </>
                        ) : (
                          <td className="border border-slate-500 p-1 text-right">
                            {b.scratchScore}
                          </td>
                        )}
                        {settings.scoringType === 'handicap' && (
                          <td className="border border-slate-500 p-1 text-right">
                            {b.isAbsent ? 0 : b.handicap}
                          </td>
                        )}
                        <td className="border border-slate-500 p-1 text-right font-bold">
                          {b.grandTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {weekNotes && weekNotes.trim() && (
        <div className="mt-5 p-3 border-2 border-slate-400 rounded-lg bg-slate-50 break-inside-avoid">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
            Week {settings.weekNumber || ''} Notes — Tournament &amp; League Events
          </div>
          <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
            {weekNotes.trim()}
          </p>
        </div>
      )}

      {settings.bottomNote && (
        <div className="text-center italic text-xs text-slate-700 mt-6 pt-3 border-t border-slate-400">
          {settings.bottomNote}
        </div>
      )}
    </div>
  );
};
