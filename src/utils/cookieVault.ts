import { AppState } from '../types/bowling';
import {
  CURRENT_APP_VERSION,
  DEFAULT_SETTINGS,
  parseUniversalBackupPayload,
} from './bowlingLogic';
import { createFreshInitialState } from './seedData';

const COOKIE_PREFIX = 'blh_v_';
const COOKIE_META = 'blh_v_meta';
const CHUNK_SIZE = 2600;
const MAX_CHUNKS = 15; // Keeps total Cookie header < 40KB (safe for 64KB native C++ HTTP header buffer)
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

export interface VaultSnapshot {
  state: AppState;
  savedAt: number;
  dirty: boolean;
  trimmed: boolean;
}

export function utf8ToUrlSafeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function urlSafeBase64ToUtf8(b64: string): string {
  let std = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (std.length % 4 !== 0) {
    std += '=';
  }
  const bin = atob(std);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function hasMeaningfulLeagueData(state: AppState | null | undefined): boolean {
  if (!state) return false;
  if ((state.bowlers?.length || 0) > 0) return true;
  if ((state.roster?.length || 0) > 0) return true;
  if ((state.history?.length || 0) > 0) return true;
  if ((state.weekNotes || '').trim().length > 0) return true;
  if (state.settings) {
    if (
      state.settings.leagueName &&
      state.settings.leagueName !== DEFAULT_SETTINGS.leagueName
    ) {
      return true;
    }
    if (state.settings.lastLocalBackupAt || state.settings.autoBackupDirectoryLabel) {
      return true;
    }
    if (
      state.settings.autoBackupInterval &&
      state.settings.autoBackupInterval !== DEFAULT_SETTINGS.autoBackupInterval
    ) {
      return true;
    }
    if (state.settings.autoBackupEnabled === false) {
      return true;
    }
  }
  if (state.allLeaguesRegistry && Object.keys(state.allLeaguesRegistry).length > 1) {
    return true;
  }
  return false;
}

function buildCompactVaultJson(
  state: AppState,
  savedAt: number,
  dirty: boolean,
  maxHistoryEntries?: number,
  trimmed = false,
  trimOtherLeaguesHistory = false
): string {
  const activeId =
    state.activeLeagueId || state.settings.leagueId || 'my-bowling-league';
  const otherLeagues: Record<string, unknown> = {};
  if (state.allLeaguesRegistry) {
    for (const [id, lg] of Object.entries(state.allLeaguesRegistry)) {
      if (id !== activeId && lg) {
        otherLeagues[id] = trimOtherLeaguesHistory
          ? {
              ...lg,
              history: Array.isArray(lg.history) ? lg.history.slice(-1) : [],
            }
          : lg;
      }
    }
  }

  const historySlice =
    typeof maxHistoryEntries === 'number'
      ? (state.history || []).slice(-maxHistoryEntries)
      : state.history || [];

  const compactPayload = {
    app: 'Bowling League Helper',
    schemaVersion: 4,
    __vaultSavedAt: savedAt,
    __vaultDirty: dirty ? 1 : 0,
    __vaultTrimmed: trimmed ? 1 : 0,
    ...state,
    history: historySlice,
    allLeaguesRegistry:
      Object.keys(otherLeagues).length > 0 ? otherLeagues : undefined,
  };

  return JSON.stringify(compactPayload);
}

/**
 * Persists the league state into port-agnostic cookies on `127.0.0.1` (`path=/`).
 * Unlike `localStorage` (which is partitioned by port number), cookies on `127.0.0.1`
 * are shared across all ports per RFC 6265, guaranteeing state restoration even when
 * an older desktop host executable binds to a different localhost port on startup.
 */
export function saveStateToCookieVault(
  state: AppState,
  dirty = false,
  cookieSetter?: (cookieStr: string) => void
): boolean {
  const writeCookie =
    cookieSetter ||
    ((c: string) => {
      if (typeof document !== 'undefined') {
        document.cookie = c;
      }
    });

  try {
    const savedAt = Date.now();
    let json = buildCompactVaultJson(state, savedAt, dirty, undefined, false, false);
    let encoded = utf8ToUrlSafeBase64(json);

    // If multi-year history exceeds the 15-chunk budget, trim older history snapshots in the cookie mirror
    // and mark __vaultTrimmed=1 so full untrimmed stores (IndexedDB, localStorage, Disk JSON) never get overwritten.
    if (encoded.length > CHUNK_SIZE * MAX_CHUNKS) {
      for (const keepHistory of [12, 6, 3, 1, 0]) {
        json = buildCompactVaultJson(state, savedAt, dirty, keepHistory, true, false);
        encoded = utf8ToUrlSafeBase64(json);
        if (encoded.length <= CHUNK_SIZE * MAX_CHUNKS) break;
      }
    }

    if (encoded.length > CHUNK_SIZE * MAX_CHUNKS) {
      for (const keepHistory of [3, 1, 0]) {
        json = buildCompactVaultJson(state, savedAt, dirty, keepHistory, true, true);
        encoded = utf8ToUrlSafeBase64(json);
        if (encoded.length <= CHUNK_SIZE * MAX_CHUNKS) break;
      }
    }

    if (encoded.length > CHUNK_SIZE * MAX_CHUNKS) {
      return false;
    }

    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
      chunks.push(encoded.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      writeCookie(
        `${COOKIE_PREFIX}${i}=${chunks[i]}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`
      );
    }

    // Clear any stale higher-numbered chunks from a previously larger state
    for (let i = chunks.length; i < MAX_CHUNKS; i++) {
      writeCookie(`${COOKIE_PREFIX}${i}=; path=/; max-age=0; SameSite=Lax`);
    }

    writeCookie(
      `${COOKIE_META}=${chunks.length}.${savedAt}.${dirty ? 1 : 0}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`
    );
    return true;
  } catch {
    return false;
  }
}

export function loadStateFromCookieVault(rawCookieHeader?: string): VaultSnapshot | null {
  try {
    const cookieStr =
      typeof rawCookieHeader === 'string'
        ? rawCookieHeader
        : typeof document !== 'undefined'
        ? document.cookie
        : '';
    if (!cookieStr) return null;

    const map = new Map<string, string>();
    const parts = cookieStr.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      map.set(k, v);
    }

    const meta = map.get(COOKIE_META);
    if (!meta) return null;

    const [countStr, savedAtStr, dirtyStr] = meta.split('.');
    const chunkCount = Number(countStr);
    const savedAt = Number(savedAtStr) || 0;
    const dirty = dirtyStr === '1';

    if (!Number.isFinite(chunkCount) || chunkCount <= 0 || chunkCount > MAX_CHUNKS) {
      return null;
    }

    let combined = '';
    for (let i = 0; i < chunkCount; i++) {
      const chunk = map.get(`${COOKIE_PREFIX}${i}`);
      if (!chunk) return null;
      combined += chunk;
    }

    const jsonText = urlSafeBase64ToUtf8(combined);
    const parsedRaw = JSON.parse(jsonText);
    const { restoredState } = parseUniversalBackupPayload(
      jsonText,
      createFreshInitialState()
    );
    const hasRegistry = Boolean(
      parsedRaw && typeof parsedRaw.allLeaguesRegistry === 'object'
    );

    const activeId =
      restoredState.activeLeagueId ||
      restoredState.settings.leagueId ||
      'my-bowling-league';
    const { allLeaguesRegistry, ...snapshot } = restoredState;
    const syncedState: AppState = {
      ...restoredState,
      version: CURRENT_APP_VERSION,
      activeLeagueId: activeId,
      allLeaguesRegistry: {
        ...(hasRegistry ? allLeaguesRegistry : {}),
        [activeId]: {
          ...snapshot,
          version: CURRENT_APP_VERSION,
          activeLeagueId: activeId,
        },
      },
    };

    return {
      state: syncedState,
      savedAt,
      dirty,
      trimmed: Boolean(parsedRaw?.__vaultTrimmed),
    };
  } catch {
    return null;
  }
}

export function clearCookieVault(cookieSetter?: (cookieStr: string) => void): void {
  const writeCookie =
    cookieSetter ||
    ((c: string) => {
      if (typeof document !== 'undefined') {
        document.cookie = c;
      }
    });
  writeCookie(`${COOKIE_META}=; path=/; max-age=0; SameSite=Lax`);
  for (let i = 0; i < MAX_CHUNKS; i++) {
    writeCookie(`${COOKIE_PREFIX}${i}=; path=/; max-age=0; SameSite=Lax`);
  }
}
