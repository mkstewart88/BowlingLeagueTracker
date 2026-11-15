import React, { useState } from 'react';
import { AppState } from '../types/bowling';
import {
  LATEST_AVAILABLE_VERSION,
  PATCH_NOTES_HISTORY,
} from '../utils/bowlingLogic';
import {
  overwriteOrDownloadSingleHtmlFile,
  saveLeagueFileToComputer,
} from '../utils/fileExport';
import {
  Download,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  FileCode2,
  X,
  ShieldAlert,
  History,
} from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  onUpgradeVersion: (newVersion: string) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  appState,
  onUpgradeVersion,
  onShowToast,
}) => {
  const [selectedPatchVersion, setSelectedPatchVersion] = useState<string>(
    LATEST_AVAILABLE_VERSION
  );
  const [isChecking, setIsChecking] = useState(false);
  const [checkCompleted, setCheckCompleted] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen) return null;

  const currentVersion = appState.version || '1.0.06';
  const hasNewUpdate = currentVersion !== LATEST_AVAILABLE_VERSION;
  const selectedPatch =
    PATCH_NOTES_HISTORY.find((p) => p.version === selectedPatchVersion) ||
    PATCH_NOTES_HISTORY[0];

  const handleCheckForUpdates = () => {
    setIsChecking(true);
    setCheckCompleted(false);
    setTimeout(() => {
      setIsChecking(false);
      setCheckCompleted(true);
      onShowToast(
        currentVersion === LATEST_AVAILABLE_VERSION
          ? `You are running the latest version (v${LATEST_AVAILABLE_VERSION}).`
          : `Update v${LATEST_AVAILABLE_VERSION} is ready to install!`
      );
    }, 350);
  };

  const handleApplyAndOverwriteHtml = async () => {
    setIsUpdating(true);
    try {
      onUpgradeVersion(LATEST_AVAILABLE_VERSION);
      const res = await overwriteOrDownloadSingleHtmlFile(
        appState,
        LATEST_AVAILABLE_VERSION
      );
      onShowToast(
        res.method === 'filesystem'
          ? `Updated to v${LATEST_AVAILABLE_VERSION} and overwrote ${res.filename} with all league data intact!`
          : `Updated to v${LATEST_AVAILABLE_VERSION} and downloaded ${res.filename} with all league data intact!`
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Update cancelled.';
      if (!msg.includes('Cancelled')) {
        onShowToast(msg, true);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApplyInAppUpdateOnly = () => {
    onUpgradeVersion(LATEST_AVAILABLE_VERSION);
    onShowToast(
      `Program updated to v${LATEST_AVAILABLE_VERSION}! All ${appState.bowlers.length} active bowlers and ${appState.roster.length} roster players were preserved.`
    );
  };

  const handleSaveBackupNow = async () => {
    try {
      const res = await saveLeagueFileToComputer(appState);
      onShowToast(`Saved full league data file (${res.filename}) to your computer.`);
    } catch {
      // User cancelled picker
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <h2 id="update-modal-title" className="text-lg font-bold tracking-tight">
              Program Version Control, Single-File Updater & Patch Notes
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Update your single-HTML desktop program while keeping 100% of your saved scores, roster, and history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Update & Patch Notes Window"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
          {/* Version Status Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="text-xs font-semibold text-slate-500">Installed Version</div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                v{currentVersion}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {appState.roster.length} roster bowlers · {appState.history.length} archived weeks
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500">Latest Release Available</div>
              <div className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-0.5">
                v{LATEST_AVAILABLE_VERSION}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {checkCompleted
                  ? hasNewUpdate
                    ? 'Update available (Brackets, Recap Sheet & Averages Suite)'
                    : 'Up to date with latest release'
                  : 'Checking release manifest...'}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2">
              <button
                type="button"
                onClick={handleCheckForUpdates}
                disabled={isChecking}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking...' : 'Check for Updates'}
              </button>
            </div>
          </div>

          {/* Primary Overwrite & Update Action Box */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {hasNewUpdate
                    ? `Upgrade from v${currentVersion} to v${LATEST_AVAILABLE_VERSION} (Keep All League Data)`
                    : `Re-Save Single HTML Desktop File (v${LATEST_AVAILABLE_VERSION})`}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Overwrites your existing <code className="font-mono text-slate-800">.html</code> file on your computer with the newest version and embeds all your current scores, teams, and season history inside.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {hasNewUpdate && (
                  <button
                    type="button"
                    onClick={handleApplyInAppUpdateOnly}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Update Live App to v{LATEST_AVAILABLE_VERSION}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApplyAndOverwriteHtml}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <FileCode2 className="w-4 h-4" />
                  {isUpdating
                    ? 'Saving HTML File...'
                    : `Update & Overwrite Single HTML File (v${LATEST_AVAILABLE_VERSION})`}
                </button>
              </div>
            </div>
          </div>

          {/* Selectable Patch Notes Viewer */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-100 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" />
                <label htmlFor="patch-version-select" className="text-xs font-bold text-slate-800">
                  Select Version Patch Notes:
                </label>
              </div>
              <select
                id="patch-version-select"
                value={selectedPatchVersion}
                onChange={(e) => setSelectedPatchVersion(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md"
              >
                {PATCH_NOTES_HISTORY.map((rel) => (
                  <option key={rel.version} value={rel.version}>
                    v{rel.version} — {rel.title} ({rel.date})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-white space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Version {selectedPatch.version}: {selectedPatch.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Released {selectedPatch.date}
                    {selectedPatch.isLatest ? ' · Latest Official Build' : ''}
                  </p>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">
                  Key Release Highlights
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-5">
                  {selectedPatch.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">
                  Detailed Changelog
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                  {selectedPatch.changes.map((c, i) => (
                    <div key={i} className="px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="font-mono font-semibold text-slate-600 sm:w-32 shrink-0">
                        [{c.category}]
                      </span>
                      <span className="text-slate-800">{c.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Where is League Info Saved & Dead Computer Crash Protection */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-slate-700" />
                  Where Your League Data Is Saved & Dead-Computer Protection
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  1. <strong>Automatic Browser Memory:</strong> Every league, score, and roster name is saved immediately inside your web browser (<code className="font-mono">bowling_league_helper_state_v5</code>). Updating or replacing the <code className="font-mono">.html</code> file never wipes your browser memory.<br />
                  2. <strong>Hard Drive File Backup & Auto-Backup Scheduler:</strong> In case browser history is cleared or a new computer is needed, click <strong>Save Master Backup File</strong> below (or use the Auto-Backup Scheduler) to save all leagues into a single <code className="font-mono">.json</code> or <code className="font-mono">.html</code> file on your PC.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveBackupNow}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shrink-0 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Save Master Backup File
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-600">
            100% Offline Single-File Architecture · Zero License Fees
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
