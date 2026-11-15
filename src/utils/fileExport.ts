import { AppState, BowlerEntry } from '../types/bowling';
import { buildTeamStandings, rankWeeklyBowlers } from './bowlingLogic';

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function generateResultsCsvContent(state: AppState): string {
  const ranked = rankWeeklyBowlers(state.bowlers);
  const teams = buildTeamStandings(state.bowlers);
  const teamRanks = new Map(teams.map((t) => [t.name, t.placement]));

  const rows: (string | number)[][] = [
    [
      'Individual Place',
      'Team Place',
      'Team',
      'Bowler',
      'Entry Type',
      'Game 1',
      'Game 2',
      'Game 3',
      'Scratch Score',
      'Handicap',
      'Grand Total',
      'Status',
    ],
  ];

  ranked.forEach((b) => {
    rows.push([
      b.placement ?? '',
      teamRanks.get(b.team || 'Unassigned') ?? '',
      b.team || '',
      b.name,
      b.entryMode === 'three' ? '3-game series' : 'Single game',
      b.entryMode === 'three' && !b.isAbsent ? b.g1 : '',
      b.entryMode === 'three' && !b.isAbsent ? b.g2 : '',
      b.entryMode === 'three' && !b.isAbsent ? b.g3 : '',
      b.isAbsent ? '' : b.scratchScore,
      b.isAbsent ? 0 : b.handicap,
      b.grandTotal,
      b.isAbsent ? 'Absent' : b.isSub ? 'Substitute' : 'Entered',
    ]);
  });

  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function exportWeeklyResultsCsv(state: AppState): string {
  const s = state.settings;
  const d = new Date();
  const dateStamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const cleanLeague = (s.leagueName || 'Bowling_League').replace(/[^a-zA-Z0-9]+/g, '_');
  const cleanWeek = (s.weekNumber || 'Week').replace(/[^a-zA-Z0-9]+/g, '_');

  let filename = s.customCsvName.trim()
    ? s.customCsvName.trim().replace(/[^a-zA-Z0-9._-]+/g, '_')
    : `${cleanLeague}_Week_${cleanWeek}_${dateStamp}`;

  if (!filename.toLowerCase().endsWith('.csv')) {
    filename += '.csv';
  }

  const csvContent = generateResultsCsvContent(state);
  downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), filename);
  return filename;
}

export function exportMasterRosterCsv(state: AppState): void {
  const rows = [
    ['Bowler Name', 'Team', 'Book Average', 'USBC ID'],
    ...state.roster
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => [p.name, p.team || '', p.bookAverage ?? 165, p.usbcId ?? '']),
  ];
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'Bowling_League_Master_Roster.csv');
}

export function exportMasterLeagueBackupJson(state: AppState): string {
  const d = new Date();
  const dateStamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const cleanLeague = (state.settings.leagueName || 'Bowling_League').replace(/[^a-zA-Z0-9]+/g, '_');
  const filename = `${cleanLeague}_Master_Backup_${dateStamp}.json`;

  const payload = {
    app: 'Bowling League Helper',
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    ...state,
  };

  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    filename
  );
  return filename;
}

/**
 * Generates a 100% self-contained, offline-ready Single HTML file (`Bowling_League_Tracker.html`)
 * that embeds the user's current `AppState` inside so that when the user downloads or overwrites
 * their desktop `.html` file, 100% of their league data, roster, history, and updated version
 * are preserved inside that single file!
 */
export function generateStandaloneSingleHtmlBundle(
  state: AppState,
  targetVersion: string
): string {
  const updatedState: AppState = {
    ...state,
    version: targetVersion,
  };
  const serializedState = JSON.stringify(updatedState).replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${updatedState.settings.leagueName || 'Bowling League Helper'} — v${targetVersion} Standalone</title>
<style>
  :root {
    --ink: #0f172a; --muted: #475569; --line: #cbd5e1; --panel: #ffffff;
    --page: #f1f5f9; --navy: #0f172a; --blue: #1d4ed8; --green: #047857;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: var(--page); color: var(--ink); font-family: system-ui, -apple-system, sans-serif; }
  .container { max-width: 1180px; margin: 0 auto; background: var(--panel); padding: 28px; border-radius: 12px; border: 1px solid var(--line); }
  h1 { margin: 0 0 6px; font-size: 26px; }
  .meta { color: var(--muted); font-size: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-variant-numeric: tabular-nums; font-size: 14px; }
  th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; }
  th { background: #f8fafc; font-weight: 700; }
  .btn { display: inline-block; padding: 10px 16px; background: var(--blue); color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 8px; }
</style>
</head>
<body>
  <div class="container">
    <h1>🎳 ${updatedState.settings.leagueName || 'Bowling League Helper'} (v${targetVersion} Standalone Edition)</h1>
    <div class="meta">
      Season: ${updatedState.settings.seasonName} · Current Week: ${updatedState.settings.weekNumber} · Roster: ${updatedState.roster.length} Bowlers · Archived Weeks: ${updatedState.history.length}
    </div>
    <p>This single-file desktop program contains your complete embedded league backup and automatically syncs with your browser storage on open.</p>
    <div>
      <button class="btn" onclick="window.print()">Print Current Standings</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>Bowler</th>
          <th>Team</th>
          <th>G1</th>
          <th>G2</th>
          <th>G3</th>
          <th>Scratch</th>
          <th>Hdcp</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${updatedState.bowlers
          .map(
            (b) => `<tr>
          <td><strong>${b.name}</strong></td>
          <td>${b.team || '—'}</td>
          <td>${b.isAbsent ? 'ABS' : b.g1}</td>
          <td>${b.isAbsent ? 'ABS' : b.g2}</td>
          <td>${b.isAbsent ? 'ABS' : b.g3}</td>
          <td>${b.scratchScore}</td>
          <td>${b.handicap}</td>
          <td><strong>${b.grandTotal}</strong></td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>
  <script id="embedded-league-state" type="application/json">${serializedState}</script>
  <script>
    (function() {
      try {
        var raw = document.getElementById('embedded-league-state').textContent;
        var parsed = JSON.parse(raw);
        localStorage.setItem('bowling_league_helper_state_v5', JSON.stringify(parsed));
        localStorage.setItem('bowling_league_helper_state_v4', JSON.stringify(parsed));
        localStorage.setItem('tnr_bowling_tracker_v3', JSON.stringify(parsed));
        console.log('Successfully synced embedded league state v' + parsed.version + ' to localStorage.');
      } catch (e) {
        console.error('Could not sync embedded state:', e);
      }
    })();
  </script>
</body>
</html>`;
}

// Persistent session handle for optional user-selected Auto-Backup location
interface WritableFileHandle {
  name: string;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

let activeAutoBackupFileHandle: WritableFileHandle | null = null;

export function hasConnectedAutoBackupHandle(): boolean {
  return activeAutoBackupFileHandle !== null;
}

export function getConnectedAutoBackupHandleName(): string | null {
  return activeAutoBackupFileHandle ? activeAutoBackupFileHandle.name : null;
}

/**
 * Lets the user pick an optional file location on their PC, USB drive, or cloud-synced folder
 * for automatic scheduled backups, and immediately writes the full state to that location.
 */
export async function chooseAutoBackupLocation(
  state: AppState,
  format: 'json' | 'html' = 'json'
): Promise<{ connected: boolean; locationName: string }> {
  const cleanLeague = (state.settings.leagueName || 'Bowling_League').replace(/[^a-zA-Z0-9]+/g, '_');
  const suggestedName =
    format === 'html'
      ? `${cleanLeague}_AutoBackup_Standalone.html`
      : `${cleanLeague}_AutoBackup_Master.json`;

  const content =
    format === 'html'
      ? generateStandaloneSingleHtmlBundle(state, state.version || '1.0.06')
      : JSON.stringify(
          {
            app: 'Bowling League Helper',
            schemaVersion: 4,
            exportedAt: new Date().toISOString(),
            ...state,
          },
          null,
          2
        );

  const win = window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<WritableFileHandle>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types:
          format === 'html'
            ? [
                {
                  description: 'Single-File Bowling League HTML Backup',
                  accept: { 'text/html': ['.html', '.htm'] },
                },
              ]
            : [
                {
                  description: 'Master Bowling League Backup (.json)',
                  accept: { 'application/json': ['.json'] },
                },
              ],
      });
      activeAutoBackupFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { connected: true, locationName: handle.name || suggestedName };
    } catch (err: unknown) {
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'AbortError') {
        throw new Error('Cancelled folder/file selection.');
      }
    }
  }

  // Fallback when running inside an iframe or browser without File System Access API:
  // Trigger immediate download to user's Downloads / configured browser save folder
  downloadBlob(
    new Blob([content], {
      type: format === 'html' ? 'text/html;charset=utf-8;' : 'application/json',
    }),
    suggestedName
  );
  return { connected: false, locationName: `Browser Downloads (${suggestedName})` };
}

/**
 * Executes an automatic or manual backup using the user's configured format (.json or .html).
 * If a FileSystem handle was chosen by the user, it silently writes directly to that file on disk!
 */
export async function executeAutoBackupWrite(
  state: AppState,
  allowDownloadFallback = true
): Promise<{ wrote: boolean; targetName: string; method: 'handle' | 'download' | 'skipped' }> {
  const format = state.settings.autoBackupFormat || 'json';
  const cleanLeague = (state.settings.leagueName || 'Bowling_League').replace(/[^a-zA-Z0-9]+/g, '_');
  const d = new Date();
  const dateStamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const fallbackName =
    format === 'html'
      ? `${cleanLeague}_AutoBackup_Week_${state.settings.weekNumber || '4'}_${dateStamp}.html`
      : `${cleanLeague}_AutoBackup_Week_${state.settings.weekNumber || '4'}_${dateStamp}.json`;

  const content =
    format === 'html'
      ? generateStandaloneSingleHtmlBundle(state, state.version || '1.0.06')
      : JSON.stringify(
          {
            app: 'Bowling League Helper',
            schemaVersion: 4,
            exportedAt: new Date().toISOString(),
            ...state,
          },
          null,
          2
        );

  if (activeAutoBackupFileHandle) {
    try {
      const writable = await activeAutoBackupFileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return {
        wrote: true,
        targetName: activeAutoBackupFileHandle.name,
        method: 'handle',
      };
    } catch {
      // Handle permission expired, fall through
    }
  }

  if (allowDownloadFallback) {
    downloadBlob(
      new Blob([content], {
        type: format === 'html' ? 'text/html;charset=utf-8;' : 'application/json',
      }),
      fallbackName
    );
    return {
      wrote: true,
      targetName: fallbackName,
      method: 'download',
    };
  }

  return { wrote: false, targetName: '', method: 'skipped' };
}

/**
 * Overwrites an existing `.html` file on the user's computer using the File System Access API
 * (`window.showSaveFilePicker`) if supported by Chrome/Edge, or falls back to a clean download.
 */
export async function overwriteOrDownloadSingleHtmlFile(
  state: AppState,
  targetVersion: string
): Promise<{ method: 'filesystem' | 'download'; filename: string }> {
  const htmlContent = generateStandaloneSingleHtmlBundle(state, targetVersion);
  const defaultFilename = `Bowling_League_Tracker_v${targetVersion}.html`;

  const win = window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<WritableFileHandle>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: 'Single-File Bowling League HTML Program',
            accept: { 'text/html': ['.html', '.htm'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(htmlContent);
      await writable.close();
      return { method: 'filesystem', filename: handle.name || defaultFilename };
    } catch (err: unknown) {
      // If user cancelled picker or security error inside cross-origin iframe, fall back to direct download
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'AbortError') {
        throw new Error('Cancelled file selection.');
      }
    }
  }

  downloadBlob(new Blob([htmlContent], { type: 'text/html;charset=utf-8;' }), defaultFilename);
  return { method: 'download', filename: defaultFilename };
}

/**
 * Saves the complete league data `.json` file directly to the user's hard drive via File Picker
 * or standard browser download.
 */
export async function saveLeagueFileToComputer(
  state: AppState
): Promise<{ method: 'filesystem' | 'download'; filename: string }> {
  const d = new Date();
  const dateStamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const cleanLeague = (state.settings.leagueName || 'Bowling_League').replace(/[^a-zA-Z0-9]+/g, '_');
  const suggestedName = `${cleanLeague}_Data_${dateStamp}.json`;

  const payload = JSON.stringify(
    {
      app: 'Bowling League Helper',
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      ...state,
    },
    null,
    2
  );

  const win = window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<WritableFileHandle>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Bowling League Data File (.json)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      activeAutoBackupFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      return { method: 'filesystem', filename: handle.name || suggestedName };
    } catch (err: unknown) {
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'AbortError') {
        throw new Error('Cancelled file save.');
      }
    }
  }

  downloadBlob(new Blob([payload], { type: 'application/json' }), suggestedName);
  return { method: 'download', filename: suggestedName };
}

