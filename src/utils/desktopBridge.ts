import { AppState } from '../types/bowling';

export interface DesktopInfo {
  isDesktopApp: boolean;
  installDir: string;
  defaultSaveDir: string;
  desktopVersion: string;
  lastSaveFilePath: string;
  lastSavedAt: string | null;
  lastSaveExists: boolean;
}

export interface DesktopBackupSaveResult {
  saved: boolean;
  canceled?: boolean;
  filePath?: string;
  filename?: string;
  savedAt?: string;
  error?: string;
}

export interface DesktopCloseAttemptResult {
  ok: boolean;
  missing?: boolean;
  missingPath?: string | null;
  reason?: string;
  savedPath?: string;
}

export interface DesktopPickSaveAndCloseResult {
  closed: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface DesktopInstallUpdateResult {
  ok: boolean;
  targetVersion?: string;
  installDir?: string;
  updatedTargets?: string[];
  needsPageReload?: boolean;
  error?: string;
}

export interface DesktopLoadSaveResult {
  ok: boolean;
  exists: boolean;
  filePath?: string;
  jsonText?: string;
  error?: string;
}

export interface DesktopQuickSaveResult {
  saved: boolean;
  missing?: boolean;
  filePath?: string;
  filename?: string;
  savedAt?: string;
  error?: string;
}

export interface BowlingDesktopBridge {
  isDesktopApp: boolean;
  getDesktopInfo: () => Promise<DesktopInfo>;
  loadLastSaveFile?: () => Promise<DesktopLoadSaveResult>;
  quickSaveToCurrentFile?: (jsonText: string) => Promise<DesktopQuickSaveResult>;
  clearLastSaveLink?: () => Promise<{ ok: boolean }>;
  saveNewLeagueFile: (
    jsonText: string,
    defaultFilename: string
  ) => Promise<DesktopBackupSaveResult>;
  attemptCloseWithSave: (jsonText: string) => Promise<DesktopCloseAttemptResult>;
  pickNewSaveAndClose: (
    jsonText: string,
    defaultFilename: string
  ) => Promise<DesktopPickSaveAndCloseResult>;
  forceCloseWithoutSaving: () => Promise<{ closed: boolean }>;
  cancelClose: () => Promise<{ cancelled: boolean }>;
  installUpdateToProgramFolder: (payload: {
    targetVersion: string;
    htmlContent: string;
    versionJsonContent: string;
  }) => Promise<DesktopInstallUpdateResult>;
  onRequestCloseSave: (callback: () => void) => () => void;
  ackCloseRequest?: () => Promise<void>;
  stageSavePayload?: (jsonText: string) => Promise<void>;
  sendAutoSaveBeacon?: (jsonText: string) => void;
  sendWindowUnloadedBeacon?: (jsonText: string) => void;
}

export function createHttpDesktopBridge(baseUrl = ''): BowlingDesktopBridge {
  const api = (path: string) => `${baseUrl}${path}`;

  const postJson = async <T,>(path: string, body: unknown): Promise<T> => {
    const resp = await fetch(api(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!resp.ok) {
      throw new Error(`Desktop host request failed (${resp.status})`);
    }
    return resp.json() as Promise<T>;
  };

  return {
    isDesktopApp: true,
    getDesktopInfo: async () => {
      const resp = await fetch(api('/api/desktop/info'), { cache: 'no-store' });
      if (!resp.ok) {
        throw new Error(`Failed to fetch desktop info (${resp.status})`);
      }
      return resp.json() as Promise<DesktopInfo>;
    },
    loadLastSaveFile: async () => {
      try {
        const resp = await fetch(api('/api/desktop/load-save'), { cache: 'no-store' });
        if (resp.ok) {
          return (await resp.json()) as DesktopLoadSaveResult;
        }
      } catch {
        // Fallback if older host binary does not expose /api/desktop/load-save
      }
      return { ok: false, exists: false };
    },
    quickSaveToCurrentFile: async (jsonText) => {
      try {
        const resp = await fetch(api('/api/desktop/quick-save'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonText }),
          cache: 'no-store',
        });
        if (resp.ok) {
          return (await resp.json()) as DesktopQuickSaveResult;
        }
      } catch {
        // Fall through to /api/desktop/info + /api/desktop/autosave-beacon fallback
      }

      // Backwards-compatible fallback for older desktop host executables (e.g. v1.0.14)
      try {
        const infoResp = await fetch(api('/api/desktop/info'), { cache: 'no-store' });
        if (infoResp.ok) {
          const info = (await infoResp.json()) as DesktopInfo;
          if (info.lastSaveExists && info.lastSaveFilePath) {
            const beaconResp = await fetch(api('/api/desktop/autosave-beacon'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: jsonText,
              cache: 'no-store',
            });
            if (beaconResp.ok) {
              const beaconData = (await beaconResp.json()) as { ok?: boolean };
              if (beaconData.ok) {
                const filename =
                  info.lastSaveFilePath.split(/[\\/]/).pop() || DEFAULT_SAVE_FILENAME;
                return {
                  saved: true,
                  missing: false,
                  filePath: info.lastSaveFilePath,
                  filename,
                  savedAt: new Date().toISOString(),
                };
              }
            }
          }
        }
      } catch {
        // Ignore fallback error and report missing so file picker opens
      }

      return { saved: false, missing: true };
    },
    clearLastSaveLink: async () => {
      try {
        const resp = await fetch(api('/api/desktop/clear-save-link'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          cache: 'no-store',
        });
        if (resp.ok) {
          return (await resp.json()) as { ok: boolean };
        }
      } catch {
        // Ignore if older host binary does not expose /api/desktop/clear-save-link
      }
      return { ok: true };
    },
    saveNewLeagueFile: async (jsonText, defaultFilename) =>
      postJson<DesktopBackupSaveResult>('/api/desktop/save-backup', {
        jsonText,
        defaultFilename,
      }),
    attemptCloseWithSave: async (jsonText) =>
      postJson<DesktopCloseAttemptResult>('/api/desktop/close-attempt', {
        jsonText,
      }),
    pickNewSaveAndClose: async (jsonText, defaultFilename) =>
      postJson<DesktopPickSaveAndCloseResult>('/api/desktop/pick-save-and-close', {
        jsonText,
        defaultFilename,
      }),
    forceCloseWithoutSaving: async () =>
      postJson<{ closed: boolean }>('/api/desktop/force-close', {}),
    cancelClose: async () =>
      postJson<{ cancelled: boolean }>('/api/desktop/cancel-close', {}),
    installUpdateToProgramFolder: async (payload) =>
      postJson<DesktopInstallUpdateResult>('/api/desktop/install-update', payload),
    onRequestCloseSave: (callback) => {
      let active = true;
      let es: EventSource | null = null;

      const customHandler = () => {
        if (active) callback();
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('bowling:request-close-save', customHandler);
      }

      if (typeof EventSource !== 'undefined') {
        try {
          es = new EventSource(api('/api/desktop/events'));
          es.addEventListener('request-close-save', () => {
            if (active) callback();
          });
        } catch {
          // Polling fallback below handles environments without SSE
        }
      }

      const pollTimer = setInterval(async () => {
        if (!active || typeof fetch !== 'function') return;
        try {
          const resp = await fetch(api('/api/desktop/pending-close'), { cache: 'no-store' });
          if (resp.ok) {
            const data = (await resp.json()) as { pending?: boolean };
            if (data.pending && active) {
              callback();
            }
          }
        } catch {
          // Ignore transient poll errors while closing
        }
      }, 200);

      return () => {
        active = false;
        clearInterval(pollTimer);
        if (typeof window !== 'undefined') {
          window.removeEventListener('bowling:request-close-save', customHandler);
        }
        if (es) {
          es.close();
        }
      };
    },
    ackCloseRequest: async () => {
      try {
        await fetch(api('/api/desktop/close-ack'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          cache: 'no-store',
        });
      } catch {
        // Ignore network errors during close
      }
    },
    stageSavePayload: async (jsonText) => {
      try {
        await fetch(api('/api/desktop/stage-state'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonText,
          cache: 'no-store',
        });
      } catch {
        // Ignore transient staging errors
      }
    },
    sendAutoSaveBeacon: (jsonText) => {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([jsonText], { type: 'application/json' });
        const queued = navigator.sendBeacon(api('/api/desktop/autosave-beacon'), blob);
        if (!queued) {
          const smallRef = new Blob(['{"useStaged":true}'], { type: 'application/json' });
          navigator.sendBeacon(api('/api/desktop/autosave-beacon'), smallRef);
        }
      }
    },
    sendWindowUnloadedBeacon: (jsonText) => {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([jsonText], { type: 'application/json' });
        const queued = navigator.sendBeacon(api('/api/desktop/window-unloaded'), blob);
        if (!queued) {
          const smallRef = new Blob(['{"useStaged":true}'], { type: 'application/json' });
          navigator.sendBeacon(api('/api/desktop/window-unloaded'), smallRef);
        }
      } else if (typeof fetch === 'function') {
        fetch(api('/api/desktop/window-unloaded'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonText,
          keepalive: true,
          cache: 'no-store',
        }).catch(() => {});
      }
    },
  };
}

let cachedHttpBridge: BowlingDesktopBridge | null = null;

export function resetCachedDesktopBridgeForTesting(): void {
  cachedHttpBridge = null;
}

export function getDesktopBridge(): BowlingDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    bowlingDesktop?: BowlingDesktopBridge;
    __BOWLING_NATIVE_HOST__?: boolean;
  };
  if (win.bowlingDesktop && win.bowlingDesktop.isDesktopApp) {
    return win.bowlingDesktop;
  }
  if (win.__BOWLING_NATIVE_HOST__) {
    if (!cachedHttpBridge) {
      cachedHttpBridge = createHttpDesktopBridge('');
    }
    return cachedHttpBridge;
  }
  return null;
}

export const DEFAULT_SAVE_FILENAME = 'BowlingLeagueTrackerSave.json';

/**
 * Returns the persistent save filename (`BowlingLeagueTrackerSave.json`) so
 * auto-save on closing repeatedly writes to the same file without appending dates.
 */
export function getDefaultSaveFilename(): string {
  return DEFAULT_SAVE_FILENAME;
}

export function serializeMasterSavePayload(state: AppState): string {
  return JSON.stringify(
    {
      app: 'Bowling League Helper',
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      ...state,
    },
    null,
    2
  );
}
