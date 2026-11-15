import { AppState } from '../types/bowling';

export interface DesktopInfo {
  isDesktopApp: boolean;
  installDir: string;
  oneDriveDir: string;
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

export function getDesktopBridge(): BowlingDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { bowlingDesktop?: BowlingDesktopBridge };
  if (win.bowlingDesktop && win.bowlingDesktop.isDesktopApp) {
    return win.bowlingDesktop;
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
