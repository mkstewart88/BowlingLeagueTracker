import { AppState, ArchivedWeek } from '../types/bowling';

const DB_NAME = 'bowling_league_helper_db_v1';
const DB_VERSION = 1;
const STORE_MASTER = 'master_state';
const STORE_WEEKS = 'league_weeks';
const MASTER_KEY = 'current';

export interface StoredMasterDbRecord {
  id: string;
  state: AppState;
  savedAt: number;
  dirty: boolean;
  schemaVersion: number;
  leagueCount: number;
  totalArchivedWeeks: number;
}

export interface StoredWeekRecord {
  leagueWeekKey: string;
  leagueId: string;
  week: string;
  savedAt: number;
  snapshot: ArchivedWeek;
}

export interface StartupStateCandidate {
  state: AppState;
  meaningful: boolean;
  timestamp: number;
  dirty: boolean;
  trimmed: boolean;
  archivedWeeksCount: number;
  priority: number;
}

/**
 * Counts all archived week snapshots across every league in allLeaguesRegistry
 * (without double-counting the active league's history).
 */
export function countTotalArchivedWeeks(state: AppState | null | undefined): number {
  if (!state) return 0;
  const activeId = state.activeLeagueId || state.settings?.leagueId || 'my-bowling-league';
  let total = Array.isArray(state.history) ? state.history.length : 0;

  if (state.allLeaguesRegistry && typeof state.allLeaguesRegistry === 'object') {
    for (const [id, lg] of Object.entries(state.allLeaguesRegistry)) {
      if (id === activeId) continue;
      if (lg && Array.isArray(lg.history)) {
        total += lg.history.length;
      }
    }
  }
  return total;
}

/**
 * Pure selector for choosing the authoritative startup state across
 * Disk JSON, IndexedDB, localStorage, Embedded HTML, and Cookie Vault.
 *
 * Critical guarantee: A trimmed (40KB-capped) Cookie Vault snapshot will NEVER
 * overwrite a full untrimmed dataset when meaningful league data exists in both.
 */
export function selectBestStartupCandidate(
  candidates: StartupStateCandidate[]
): StartupStateCandidate | null {
  if (!candidates || candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    if (a.meaningful !== b.meaningful) {
      return a.meaningful ? -1 : 1;
    }
    if (a.trimmed !== b.trimmed) {
      return a.trimmed ? 1 : -1;
    }
    if (a.timestamp !== b.timestamp) {
      return b.timestamp - a.timestamp;
    }
    if (a.archivedWeeksCount !== b.archivedWeeksCount) {
      return b.archivedWeeksCount - a.archivedWeeksCount;
    }
    return b.priority - a.priority;
  });

  return sorted[0];
}

/**
 * Pure check for whether an asynchronously loaded IndexedDB snapshot should
 * upgrade/hydrate the currently booted state (e.g., if initial boot hit a trimmed
 * cookie or exceeded localStorage 5MB quota on an earlier session).
 */
export function shouldHydrateIndexedDbOverCurrent(params: {
  idbRecord: StoredMasterDbRecord | null;
  currentMeaningful: boolean;
  currentTimestamp: number;
  currentWasTrimmed: boolean;
  currentArchivedWeeks: number;
}): boolean {
  const { idbRecord, currentMeaningful, currentTimestamp, currentWasTrimmed, currentArchivedWeeks } =
    params;
  if (!idbRecord || !idbRecord.state) return false;

  if (currentWasTrimmed && idbRecord.totalArchivedWeeks >= currentArchivedWeeks) {
    return true;
  }
  if (!currentMeaningful && (idbRecord.totalArchivedWeeks > 0 || (idbRecord.state.bowlers?.length || 0) > 0 || (idbRecord.state.roster?.length || 0) > 0)) {
    return true;
  }
  if (idbRecord.savedAt > currentTimestamp + 500) {
    return true;
  }
  if (
    idbRecord.totalArchivedWeeks > currentArchivedWeeks &&
    idbRecord.savedAt >= currentTimestamp - 2000
  ) {
    return true;
  }
  return false;
}

function openLeagueDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MASTER)) {
        db.createObjectStore(STORE_MASTER, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_WEEKS)) {
        const weekStore = db.createObjectStore(STORE_WEEKS, { keyPath: 'leagueWeekKey' });
        weekStore.createIndex('by_league', 'leagueId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB database.'));
  });
}

function collectAllWeekRecords(state: AppState, savedAt: number): StoredWeekRecord[] {
  const records = new Map<string, StoredWeekRecord>();
  const activeId = state.activeLeagueId || state.settings?.leagueId || 'my-bowling-league';

  const addHistory = (leagueId: string, history: ArchivedWeek[] | undefined) => {
    for (const snap of history || []) {
      if (!snap || typeof snap !== 'object') continue;
      const weekStr = String(snap.week ?? '').trim() || snap.id;
      const leagueWeekKey = `${leagueId}::${weekStr}`;
      records.set(leagueWeekKey, {
        leagueWeekKey,
        leagueId,
        week: weekStr,
        savedAt,
        snapshot: snap,
      });
    }
  };

  if (state.allLeaguesRegistry && typeof state.allLeaguesRegistry === 'object') {
    for (const [leagueId, lg] of Object.entries(state.allLeaguesRegistry)) {
      if (lg && Array.isArray(lg.history)) {
        addHistory(leagueId, lg.history);
      }
    }
  }
  addHistory(activeId, state.history);

  return Array.from(records.values());
}

/**
 * Saves the complete, untrimmed multi-league database (plus per-league/per-week
 * indexed records) to IndexedDB. Supports hundreds of megabytes with zero 40KB
 * cookie limits or 5MB localStorage limits.
 */
export async function saveFullStateToIndexedDb(
  state: AppState,
  savedAt: number = Date.now(),
  dirty = false
): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openLeagueDatabase();
    const weekRecords = collectAllWeekRecords(state, savedAt);
    const masterRecord: StoredMasterDbRecord = {
      id: MASTER_KEY,
      state,
      savedAt,
      dirty,
      schemaVersion: 4,
      leagueCount: state.allLeaguesRegistry ? Object.keys(state.allLeaguesRegistry).length : 1,
      totalArchivedWeeks: countTotalArchivedWeeks(state),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction([STORE_MASTER, STORE_WEEKS], 'readwrite');
      const masterStore = tx.objectStore(STORE_MASTER);
      const weekStore = tx.objectStore(STORE_WEEKS);

      masterStore.put(masterRecord);
      weekStore.clear();
      for (const rec of weekRecords) {
        weekStore.put(rec);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed.'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted.'));
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function loadFullStateFromIndexedDb(): Promise<StoredMasterDbRecord | null> {
  if (typeof indexedDB === 'undefined') return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openLeagueDatabase();
    const record = await new Promise<StoredMasterDbRecord | null>((resolve, reject) => {
      const tx = db!.transaction([STORE_MASTER], 'readonly');
      const req = tx.objectStore(STORE_MASTER).get(MASTER_KEY);
      req.onsuccess = () => resolve((req.result as StoredMasterDbRecord) || null);
      req.onerror = () => reject(req.error || new Error('IndexedDB read failed.'));
    });
    return record;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function clearIndexedDbState(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  let db: IDBDatabase | null = null;
  try {
    db = await openLeagueDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction([STORE_MASTER, STORE_WEEKS], 'readwrite');
      tx.objectStore(STORE_MASTER).clear();
      tx.objectStore(STORE_WEEKS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cleanup errors
  } finally {
    db?.close();
  }
}
