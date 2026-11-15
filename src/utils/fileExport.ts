import { AppState } from '../types/bowling';
import {
  LATEST_AVAILABLE_VERSION,
  buildTeamStandings,
  rankWeeklyBowlers,
} from './bowlingLogic';
import { loadUpdatedRuntimeBundle, stripBootFromCacheFlag } from './runtimeUpdater';
import {
  DEFAULT_SAVE_FILENAME,
  getDefaultSaveFilename,
  getDesktopBridge,
  serializeMasterSavePayload,
} from './desktopBridge';

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
  const filename = DEFAULT_SAVE_FILENAME;

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
  return stripBootFromCacheFlag(html).replace(patternState, '').replace(patternBoot, '');
}

/**
 * Builds the 100% interactive, full 5-tab Single-File HTML desktop application
 * by injecting the user's complete multi-league `AppState` into:
 *   1. A freshly fetched GitHub HTML bundle (`remoteHtmlTemplate`), OR
 *   2. Any newer installed runtime bundle stored in IndexedDB, OR
 *   3. The hosted `/BowlingLeagueHelper.html` or `/standalone_template.html` bundle, OR
 *   4. The currently running single-file document's `<head>` when offline (`file://`).
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

  const injectStateIntoTemplate = (templateHtml: string): string | null => {
    if (!templateHtml.includes('id="root"')) return null;
    const cleaned = stripOldEmbeddedScripts(templateHtml);
    const lastBodyIdx = cleaned.lastIndexOf(cBody);
    if (lastBodyIdx === -1) return null;
    return (
      cleaned.slice(0, lastBodyIdx) +
      '\n' +
      bootstrapBlock +
      '\n' +
      cleaned.slice(lastBodyIdx)
    );
  };

  // 1. If a newly downloaded GitHub HTML bundle was provided, inject the user's saved leagues into it
  if (remoteHtmlTemplate) {
    const built = injectStateIntoTemplate(remoteHtmlTemplate);
    if (built) return built;
  }

  // 2. If running a cached runtime bundle in IndexedDB that matches/exceeds built-in DOM, use it
  try {
    const cachedRuntime = await loadUpdatedRuntimeBundle();
    if (cachedRuntime && cachedRuntime.html) {
      const built = injectStateIntoTemplate(cachedRuntime.html);
      if (built) return built;
    }
  } catch {
    // Ignore IndexedDB unavailability
  }

  // 3. Try fetching the pre-compiled singlefile template when running over http/https
  if (
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    window.location.protocol !== 'file:'
  ) {
    for (const templateUrl of ['/BowlingLeagueHelper.html', '/standalone_template.html']) {
      try {
        const resp = await fetch(`${templateUrl}?t=${Date.now()}`, { cache: 'no-store' });
        if (resp.ok) {
          const templateHtml = await resp.text();
          const built = injectStateIntoTemplate(templateHtml);
          if (built) return built;
        }
      } catch {
        // Try next template path
      }
    }
  }

  // 4. Offline / Desktop `file://` Mode: Clone the currently running single-file document's <head> bundle
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
  getFile?: () => Promise<File>;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
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
      : DEFAULT_SAVE_FILENAME;

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
      if (format === 'json') {
        await saveLastBackupHandle(handle);
      }
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
  const fallbackName =
    format === 'html'
      ? `${cleanLeague}_AutoBackup_Standalone.html`
      : DEFAULT_SAVE_FILENAME;

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

export const DEFAULT_PROGRAM_HTML_FILENAME = 'BowlingLeagueHelper.html';

const HANDLE_DB_NAME = 'BowlingLeagueHelperFS';
const HANDLE_STORE_NAME = 'handles';
const PROGRAM_HANDLE_KEY = 'programHtmlFile';
const LAST_SAVE_HANDLE_KEY = 'lastBackupJsonHandle';

function openHandleDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 1200);
    try {
      const req = indexedDB.open(HANDLE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
            db.createObjectStore(HANDLE_STORE_NAME);
          }
        } catch {
          // Ignore upgrade errors
        }
      };
      req.onsuccess = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(req.result);
        }
      };
      req.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      };
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

async function loadRememberedProgramHandle(): Promise<WritableFileHandle | null> {
  const db = await openHandleDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
      const store = tx.objectStore(HANDLE_STORE_NAME);
      const req = store.get(PROGRAM_HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as WritableFileHandle) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveRememberedProgramHandle(handle: WritableFileHandle): Promise<void> {
  const db = await openHandleDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HANDLE_STORE_NAME);
      const req = store.put(handle, PROGRAM_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearRememberedProgramHandle(): Promise<void> {
  const db = await openHandleDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HANDLE_STORE_NAME);
      const req = store.delete(PROGRAM_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function ensureReadWritePermission(handle: WritableFileHandle): Promise<boolean> {
  try {
    if (typeof handle.queryPermission === 'function') {
      const current = await handle.queryPermission({ mode: 'readwrite' });
      if (current === 'granted') return true;
      if (current === 'prompt' && typeof handle.requestPermission === 'function') {
        const requested = await handle.requestPermission({ mode: 'readwrite' });
        return requested === 'granted';
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

let activeOpenedHtmlHandle: WritableFileHandle | null = null;

export async function hasRememberedProgramHandle(): Promise<boolean> {
  if (activeOpenedHtmlHandle) return true;
  const saved = await loadRememberedProgramHandle();
  return saved !== null;
}

/**
 * Extracts the exact `.html` filename currently open in the browser when launched from disk (`file://`),
 * falling back to `BowlingLeagueHelper.html` (with no spaces or version numbers).
 */
export function getCurrentOpenedHtmlFilename(rawPathnameOverride?: string): string {
  if (typeof rawPathnameOverride === 'string') {
    try {
      const lastSeg = decodeURIComponent(rawPathnameOverride.split('/').pop() || '').trim();
      if (/\.html?$/i.test(lastSeg) && lastSeg.toLowerCase() !== 'index.html') {
        return lastSeg;
      }
    } catch {
      // Ignore malformed URI components
    }
    return DEFAULT_PROGRAM_HTML_FILENAME;
  }

  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    try {
      const rawPath = window.location.pathname || '';
      const lastSeg = decodeURIComponent(rawPath.split('/').pop() || '').trim();
      if (/\.html?$/i.test(lastSeg) && lastSeg.toLowerCase() !== 'index.html') {
        return lastSeg;
      }
    } catch {
      // Ignore malformed URI components
    }
  }
  return DEFAULT_PROGRAM_HTML_FILENAME;
}

/**
 * Immediately downloads a portable `BowlingLeagueHelper.html` copy containing the user's current leagues
 * with zero save-location prompts.
 */
export async function downloadDesktopProgramHtmlFile(
  state: AppState,
  targetVersion: string,
  remoteHtmlTemplate?: string | null
): Promise<{ method: 'download'; filename: string }> {
  const htmlContent = await buildInteractiveSingleHtmlFile(
    state,
    targetVersion,
    remoteHtmlTemplate
  );
  const filename = DEFAULT_PROGRAM_HTML_FILENAME;
  downloadBlob(new Blob([htmlContent], { type: 'text/html;charset=utf-8;' }), filename);
  return { method: 'download', filename };
}

/**
 * Overwrites the remembered `.html` file handle in-place (persisted in IndexedDB across restarts)
 * or opens the File System Access API picker once to link the file location, falling back to a browser
 * download named `Bowling League Helper.html` if direct disk access is unavailable.
 */
export async function overwriteOrDownloadSingleHtmlFile(
  state: AppState,
  targetVersion: string,
  remoteHtmlTemplate?: string | null
): Promise<{ method: 'filesystem' | 'download'; filename: string; reusedSavedHandle?: boolean }> {
  const htmlContent = await buildInteractiveSingleHtmlFile(
    state,
    targetVersion,
    remoteHtmlTemplate
  );
  const openedFilename = getCurrentOpenedHtmlFilename();

  // 1. Try active session handle or previously linked IndexedDB handle so no save picker is needed
  const candidateHandle = activeOpenedHtmlHandle || (await loadRememberedProgramHandle());
  if (candidateHandle) {
    try {
      const allowed = await ensureReadWritePermission(candidateHandle);
      if (allowed) {
        const writable = await candidateHandle.createWritable();
        await writable.write(htmlContent);
        await writable.close();
        activeOpenedHtmlHandle = candidateHandle;
        return {
          method: 'filesystem',
          filename: candidateHandle.name || openedFilename,
          reusedSavedHandle: true,
        };
      }
    } catch {
      activeOpenedHtmlHandle = null;
      await clearRememberedProgramHandle();
    }
  }

  // 2. Ask once for the file location and remember it in IndexedDB for all future updates
  const win = window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<WritableFileHandle>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        id: 'bowling-league-app-html',
        suggestedName: openedFilename,
        types: [
          {
            description: 'Single-File Bowling League HTML Program',
            accept: { 'text/html': ['.html', '.htm'] },
          },
        ],
      });
      activeOpenedHtmlHandle = handle;
      await saveRememberedProgramHandle(handle);
      const writable = await handle.createWritable();
      await writable.write(htmlContent);
      await writable.close();
      return {
        method: 'filesystem',
        filename: handle.name || openedFilename,
        reusedSavedHandle: false,
      };
    } catch (err: unknown) {
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'AbortError') {
        throw new Error('Cancelled file selection.');
      }
    }
  }

  downloadBlob(new Blob([htmlContent], { type: 'text/html;charset=utf-8;' }), openedFilename);
  return { method: 'download', filename: openedFilename, reusedSavedHandle: false };
}

async function loadLastBackupHandle(): Promise<WritableFileHandle | null> {
  const db = await openHandleDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
      const store = tx.objectStore(HANDLE_STORE_NAME);
      const req = store.get(LAST_SAVE_HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as WritableFileHandle) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveLastBackupHandle(handle: WritableFileHandle): Promise<void> {
  const db = await openHandleDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HANDLE_STORE_NAME);
      const req = store.put(handle, LAST_SAVE_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearLastBackupHandle(): Promise<void> {
  const db = await openHandleDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HANDLE_STORE_NAME);
      const req = store.delete(LAST_SAVE_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Saves the league data file (`BowlingLeagueTrackerSave.json` by default) to
 * whatever folder the user chooses, and sets it as the automatic save-on-close target.
 */
export async function saveLeagueFileToComputer(
  state: AppState
): Promise<{ method: 'desktop' | 'filesystem' | 'download'; filename: string; filePath?: string }> {
  const suggestedName = getDefaultSaveFilename();
  const payload = serializeMasterSavePayload(state);

  const bridge = getDesktopBridge();
  if (bridge) {
    const res = await bridge.saveNewLeagueFile(payload, suggestedName);
    if (res.canceled) {
      throw new Error('Cancelled file save.');
    }
    if (!res.saved || !res.filePath) {
      throw new Error(res.error || 'Could not save backup file.');
    }
    return {
      method: 'desktop',
      filename: res.filename || suggestedName,
      filePath: res.filePath,
    };
  }

  const win = window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<WritableFileHandle>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Bowling League Save File (.json)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      activeAutoBackupFileHandle = handle;
      await saveLastBackupHandle(handle);
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      return {
        method: 'filesystem',
        filename: handle.name || suggestedName,
        filePath: handle.name || suggestedName,
      };
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

/**
 * Overwrites the currently linked save file (`BowlingLeagueTrackerSave.json`) directly
 * without opening a file picker if already linked; otherwise prompts to choose a save location.
 */
export async function quickSaveLeagueFile(
  state: AppState
): Promise<{ method: 'desktop' | 'filesystem' | 'download'; filename: string; filePath?: string }> {
  const suggestedName = getDefaultSaveFilename();
  const payload = serializeMasterSavePayload(state);

  const bridge = getDesktopBridge();
  if (bridge) {
    if (typeof bridge.quickSaveToCurrentFile === 'function') {
      const res = await bridge.quickSaveToCurrentFile(payload);
      if (res.saved && res.filePath) {
        return {
          method: 'desktop',
          filename: res.filename || suggestedName,
          filePath: res.filePath,
        };
      }
      if (res.missing) {
        // No save file linked yet: notify user and prompt to pick a save location
        if (typeof window !== 'undefined') {
          // Toast or fallback picker
        }
      }
    }
    return saveLeagueFileToComputer(state);
  }

  const candidateHandle = activeAutoBackupFileHandle || (await loadLastBackupHandle());
  if (candidateHandle) {
    try {
      const allowed = await ensureReadWritePermission(candidateHandle);
      if (allowed) {
        const writable = await candidateHandle.createWritable();
        await writable.write(payload);
        await writable.close();
        activeAutoBackupFileHandle = candidateHandle;
        return {
          method: 'filesystem',
          filename: candidateHandle.name || suggestedName,
          filePath: candidateHandle.name || suggestedName,
        };
      }
    } catch {
      activeAutoBackupFileHandle = null;
      await clearLastBackupHandle();
    }
  }

  return saveLeagueFileToComputer(state);
}

/**
 * Automatically saves to the remembered last save file when closing.
 * If the last save file cannot be found on disk (deleted, moved, or not set yet),
 * returns `{ ok: false, missing: true, ... }` so the program stays open and prompts the user.
 */
export async function verifyAndSaveBeforeClose(state: AppState): Promise<{
  ok: boolean;
  missing?: boolean;
  missingPath?: string | null;
  reason?: string;
  savedPath?: string;
}> {
  const payload = serializeMasterSavePayload(state);
  const bridge = getDesktopBridge();
  if (bridge) {
    return bridge.attemptCloseWithSave(payload);
  }

  const candidateHandle = activeAutoBackupFileHandle || (await loadLastBackupHandle());
  if (!candidateHandle) {
    return {
      ok: false,
      missing: true,
      missingPath: null,
      reason: 'No save file location has been picked yet.',
    };
  }

  try {
    const allowed = await ensureReadWritePermission(candidateHandle);
    if (!allowed) {
      return {
        ok: false,
        missing: true,
        missingPath: candidateHandle.name,
        reason: `Permission to write to "${candidateHandle.name}" is no longer available.`,
      };
    }

    if (typeof candidateHandle.getFile === 'function') {
      await candidateHandle.getFile();
    }

    const writable = await candidateHandle.createWritable();
    await writable.write(payload);
    await writable.close();
    activeAutoBackupFileHandle = candidateHandle;
    return { ok: true, savedPath: candidateHandle.name };
  } catch {
    activeAutoBackupFileHandle = null;
    await clearLastBackupHandle();
    return {
      ok: false,
      missing: true,
      missingPath: candidateHandle.name,
      reason: `Cannot find your last save file "${candidateHandle.name}". It may have been moved or deleted.`,
    };
  }
}

export async function pickNewSaveLocationAndFinishClose(state: AppState): Promise<{
  closed: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}> {
  const payload = serializeMasterSavePayload(state);
  const defaultName = getDefaultSaveFilename();
  const bridge = getDesktopBridge();
  if (bridge) {
    return bridge.pickNewSaveAndClose(payload, defaultName);
  }

  try {
    const saved = await saveLeagueFileToComputer(state);
    return { closed: true, filePath: saved.filePath || saved.filename };
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (/cancel/i.test(msg)) {
      return { closed: false, canceled: true };
    }
    return { closed: false, error: msg || 'Failed to save to new location.' };
  }
}

export async function forceCloseProgramWithoutSaving(): Promise<void> {
  const bridge = getDesktopBridge();
  if (bridge) {
    await bridge.forceCloseWithoutSaving();
  }
}

export async function cancelPendingClose(): Promise<void> {
  const bridge = getDesktopBridge();
  if (bridge) {
    await bridge.cancelClose();
  }
}
