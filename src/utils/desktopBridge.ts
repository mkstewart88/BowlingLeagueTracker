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
  error?: string;
}

export interface BowlingDesktopBridge {
  isDesktopApp: boolean;
  getDesktopInfo: () => Promise<DesktopInfo>;
  saveDatedBackup: (
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
    saveDatedBackup: async (jsonText, defaultFilename) =>
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
      }, 450);

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

/**
 * Generates a standardized dated backup filename containing the current local date,
 * e.g. `BowlingLeagueHelper_Backup_2026-11-14.json`.
 */
export function getDatedBackupFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `BowlingLeagueHelper_Backup_${yyyy}-${mm}-${dd}.json`;
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
