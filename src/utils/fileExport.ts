import { AppState } from '../types/bowling';
import {
  LATEST_AVAILABLE_VERSION,
  buildTeamStandings,
  rankWeeklyBowlers,
} from './bowlingLogic';

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Runtime tag builders so the single-file HTML bundler never sees literal closing script/head tags inside JS strings
function openTag(name: string): string {
  return String.fromCharCode(60) + name;
}

function closeTag(name: string): string {
  return String.fromCharCode(60, 47) + name + String.fromCharCode(62);
}

function safeSerializeJsonForHtml(data: unknown): string {
  const raw = JSON.stringify(data);
  // Escape any "</" sequences inside JSON strings so HTML parser never mistakes them for closing tags
  return raw.replace(new RegExp(String.fromCharCode(60, 47), 'g'), '\\u003c/');
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

function buildBootstrapScriptBlock(state: AppState, targetVersion: string): string {
  const updatedRegistry: NonNullable<AppState['allLeaguesRegistry']> = {};
  if (state.allLeaguesRegistry) {
    for (const [id, lg] of Object.entries(state.allLeaguesRegistry)) {
      updatedRegistry[id] = {
        ...lg,
        version: targetVersion,
      };
    }
  }
  const updatedState: AppState = {
    ...state,
    version: targetVersion,
    allLeaguesRegistry: state.allLeaguesRegistry ? updatedRegistry : undefined,
  };
  const serializedState = safeSerializeJsonForHtml(updatedState);
  const sOpen = openTag('script');
  const sClose = closeTag('script');

  return (
    `${sOpen} id="embedded-league-state" type="application/json">${serializedState}${sClose}\n` +
    `${sOpen} id="embedded-league-bootstrap">\n` +
    `(function() {\n` +
    `  try {\n` +
    `    var el = document.getElementById('embedded-league-state');\n` +
    `    if (!el) return;\n` +
    `    var parsed = JSON.parse(el.textContent);\n` +
    `    var existingRaw = localStorage.getItem('bowling_league_helper_state_v5');\n` +
    `    if (!existingRaw) {\n` +
    `      localStorage.setItem('bowling_league_helper_state_v5', JSON.stringify(parsed));\n` +
    `      localStorage.setItem('bowling_league_helper_state_v4', JSON.stringify(parsed));\n` +
    `      localStorage.setItem('tnr_bowling_tracker_v3', JSON.stringify(parsed));\n` +
    `    } else {\n` +
    `      var existing = JSON.parse(existingRaw);\n` +
    `      var changed = false;\n` +
    `      if (parsed.version && parsed.version !== existing.version) {\n` +
    `        existing.version = parsed.version;\n` +
    `        if (existing.allLeaguesRegistry) {\n` +
    `          Object.keys(existing.allLeaguesRegistry).forEach(function(k) {\n` +
    `            existing.allLeaguesRegistry[k].version = parsed.version;\n` +
    `          });\n` +
    `        }\n` +
    `        changed = true;\n` +
    `      }\n` +
    `      if (changed) {\n` +
    `        localStorage.setItem('bowling_league_helper_state_v5', JSON.stringify(existing));\n` +
    `      }\n` +
    `    }\n` +
    `  } catch (e) {\n` +
    `    console.warn('Embedded state bootstrap warning:', e);\n` +
    `  }\n` +
    `})();\n` +
    `${sClose}`
  );
}

export function generateStandaloneSingleHtmlBundle(
  state: AppState,
  targetVersion: string
): string {
  const bootstrapBlock = buildBootstrapScriptBlock(state, targetVersion);
  const cHead = closeTag('head');
  const cBody = closeTag('body');
  const cHtml = closeTag('html');

  return (
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
    `<meta charset="utf-8">\n` +
    `<title>${state.settings.leagueName || 'Bowling League Helper'} — v${targetVersion}</title>\n` +
    `${cHead}\n<body>\n` +
    `<div id="root"></div>\n` +
    `${bootstrapBlock}\n` +
    `${cBody}\n${cHtml}`
  );
}

function stripOldEmbeddedScripts(html: string): string {
  const sOpen = openTag('script');
  const sClose = closeTag('script');
  const patternState = new RegExp(
    `${sOpen}[^>]*id=["']embedded-league-state["'][^>]*>[\\s\\S]*?${sClose}`,
    'gi'
  );
  const patternBoot = new RegExp(
    `${sOpen}[^>]*id=["']embedded-league-bootstrap["'][^>]*>[\\s\\S]*?${sClose}`,
    'gi'
  );
  return html.replace(patternState, '').replace(patternBoot, '');
}

/**
 * Builds the 100% interactive, full 5-tab Single-File HTML desktop application
 * by injecting the user's complete multi-league `AppState` into:
 *   1. A freshly fetched GitHub HTML bundle (`remoteHtmlTemplate`), OR
 *   2. The hosted `/standalone_template.html` bundle, OR
 *   3. The currently running single-file document's `<head>` when offline (`file://`).
 */
export async function buildInteractiveSingleHtmlFile(
  state: AppState,
  targetVersion: string,
  remoteHtmlTemplate?: string | null
): Promise<string> {
  const bootstrapBlock = buildBootstrapScriptBlock(state, targetVersion);
  const cBody = closeTag('body');
  const cHead = closeTag('head');
  const cHtml = closeTag('html');

  // 1. If a newly downloaded GitHub HTML bundle was provided, inject the user's saved leagues into it!
  if (remoteHtmlTemplate && remoteHtmlTemplate.includes('id="root"')) {
    const cleaned = stripOldEmbeddedScripts(remoteHtmlTemplate);
    const lastBodyIdx = cleaned.lastIndexOf(cBody);
    if (lastBodyIdx !== -1) {
      return (
        cleaned.slice(0, lastBodyIdx) +
        '\n' +
        bootstrapBlock +
        '\n' +
        cleaned.slice(lastBodyIdx)
      );
    }
  }

  // 2. Try fetching the pre-compiled singlefile template when running over http/https
  try {
    if (
      typeof window !== 'undefined' &&
      typeof fetch === 'function' &&
      window.location.protocol !== 'file:'
    ) {
      const resp = await fetch(`/standalone_template.html?t=${Date.now()}`, { cache: 'no-store' });
      if (resp.ok) {
        const templateHtml = await resp.text();
        if (templateHtml.includes('id="root"')) {
          const cleaned = stripOldEmbeddedScripts(templateHtml);
          const lastBodyIdx = cleaned.lastIndexOf(cBody);
          if (lastBodyIdx !== -1) {
            return (
              cleaned.slice(0, lastBodyIdx) +
              '\n' +
              bootstrapBlock +
              '\n' +
              cleaned.slice(lastBodyIdx)
            );
          }
        }
      }
    }
  } catch {
    // Fall through to live DOM self-cloning when offline (file://)
  }

  // 3. Offline / Desktop `file://` Mode: Clone the currently running single-file document's <head> bundle
  if (typeof document !== 'undefined' && document.head) {
    const cleanHeadInner = stripOldEmbeddedScripts(document.head.innerHTML);
    return (
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
      cleanHeadInner +
      `\n${cHead}\n<body>\n  <div id="root"></div>\n  ` +
      bootstrapBlock +
      `\n${cBody}\n${cHtml}`
    );
  }

  return bootstrapBlock;
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
      ? await buildInteractiveSingleHtmlFile(state, LATEST_AVAILABLE_VERSION)
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
      ? await buildInteractiveSingleHtmlFile(state, LATEST_AVAILABLE_VERSION)
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
  targetVersion: string,
  remoteHtmlTemplate?: string | null
): Promise<{ method: 'filesystem' | 'download'; filename: string }> {
  const htmlContent = await buildInteractiveSingleHtmlFile(
    state,
    targetVersion,
    remoteHtmlTemplate
  );
  const defaultFilename = `Bowling_League_Helper_v${targetVersion}.html`;

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
