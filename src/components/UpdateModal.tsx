import React, { useState, useEffect } from 'react';
import { AppState, VersionManifest } from '../types/bowling';
import { LATEST_AVAILABLE_VERSION } from '../utils/bowlingLogic';
import {
  OFFICIAL_GITHUB_URL,
  compareSemverVersions,
  fetchRemoteHtmlTemplateFromGithub,
  fetchVersionManifest,
  mergePatchNotesHistory,
} from '../utils/githubUpdater';
import {
  buildInteractiveSingleHtmlFile,
  saveLeagueFileToComputer,
} from '../utils/fileExport';
import { saveUpdatedRuntimeBundle } from '../utils/runtimeUpdater';
import { getDesktopBridge, serializeMasterSavePayload } from '../utils/desktopBridge';
import { saveStateToCookieVault } from '../utils/cookieVault';
import {
  Download,
  HardDrive,
  RefreshCw,
  FileCode2,
  X,
  History,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  remoteManifest: VersionManifest;
  onUpdateManifest: (manifest: VersionManifest) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  appState,
  remoteManifest,
  onUpdateManifest,
  onShowToast,
}) => {
  const effectiveLatestVersion =
    compareSemverVersions(remoteManifest.latestVersion, LATEST_AVAILABLE_VERSION) >= 0
      ? remoteManifest.latestVersion
      : LATEST_AVAILABLE_VERSION;

  const allPatches = mergePatchNotesHistory(remoteManifest.releases);

  const [selectedPatchVersion, setSelectedPatchVersion] = useState<string>(
    effectiveLatestVersion
  );
  const [isChecking, setIsChecking] = useState(false);
  const [checkCompleted, setCheckCompleted] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateErrorHint, setUpdateErrorHint] = useState<string | null>(null);
  const [desktopInstallDir, setDesktopInstallDir] = useState<string>('C:\\BowlingLeagueHelper');

  useEffect(() => {
    setSelectedPatchVersion(effectiveLatestVersion);
  }, [effectiveLatestVersion]);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) return;
    bridge
      .getDesktopInfo()
      .then((info) => {
        if (info.installDir) {
          setDesktopInstallDir(info.installDir);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const currentVersion = appState.version || LATEST_AVAILABLE_VERSION;
  const hasNewUpdate = compareSemverVersions(effectiveLatestVersion, currentVersion) > 0;
  const selectedPatch =
    allPatches.find((p) => p.version === selectedPatchVersion) || allPatches[0];

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    setCheckCompleted(false);
    setUpdateErrorHint(null);
    try {
      const result = await fetchVersionManifest();
      onUpdateManifest(result.manifest);
      setSelectedPatchVersion(result.manifest.latestVersion);
      if (!result.githubConnected && result.errorHint) {
        setUpdateErrorHint(result.errorHint);
        onShowToast('Could not reach update server on GitHub.', true);
      } else {
        const isNewer =
          compareSemverVersions(result.manifest.latestVersion, currentVersion) > 0;
        onShowToast(
          isNewer
            ? `Update v${result.manifest.latestVersion} is ready to install!`
            : `You are running the latest version (v${result.manifest.latestVersion}).`
        );
      }
    } catch {
      setUpdateErrorHint('Could not reach GitHub to check for updates.');
      onShowToast('Could not reach GitHub to check for updates.', true);
    } finally {
      setIsChecking(false);
      setCheckCompleted(true);
    }
  };

  const fetchTargetRemoteHtml = async (): Promise<string | null> => {
    let remoteHtml = await fetchRemoteHtmlTemplateFromGithub(remoteManifest);

    if (!remoteHtml && typeof window !== 'undefined' && window.location.protocol !== 'file:') {
      for (const localPath of ['./BowlingLeagueHelper.html', './standalone_template.html']) {
        try {
          const resp = await fetch(`${localPath}?t=${Date.now()}`, {
            cache: 'no-store',
          });
          if (resp.ok) {
            const candidate = await resp.text();
            if (
              candidate.includes('id="root"') &&
              candidate.includes('<script') &&
              candidate.includes(effectiveLatestVersion)
            ) {
              remoteHtml = candidate;
              break;
            }
          }
        } catch {
          // Try next local bundle
        }
      }
    }
    return remoteHtml;
  };

  const handleUpdateAndRestart = async () => {
    setIsUpdating(true);
    setUpdateErrorHint(null);
    try {
      const remoteHtml = await fetchTargetRemoteHtml();

      if (!hasNewUpdate) {
        onShowToast(
          `You are already running the latest version (v${effectiveLatestVersion}).`
        );
        return;
      }

      if (!remoteHtml) {
        const msg = `Could not download v${effectiveLatestVersion} update bundle from GitHub. Verify the repository is Public and try again.`;
        setUpdateErrorHint(msg);
        onShowToast(msg, true);
        return;
      }

      // 1. Desktop App Mode (`C:\BowlingLeagueHelper\`): overwrite real files in install folder & relaunch
      saveStateToCookieVault(appState, false);
      const desktopBridge = getDesktopBridge();
      if (desktopBridge) {
        (window as unknown as { __BOWLING_SUPPRESS_UNLOAD__?: boolean }).__BOWLING_SUPPRESS_UNLOAD__ = true;
        await desktopBridge.quickSaveToCurrentFile?.(serializeMasterSavePayload(appState)).catch(() => {});
        const htmlWithEmbeddedState = await buildInteractiveSingleHtmlFile(
          appState,
          effectiveLatestVersion,
          remoteHtml
        );
        const versionJsonText = JSON.stringify(
          {
            ...remoteManifest,
            latestVersion: effectiveLatestVersion,
          },
          null,
          2
        );
        const installRes = await desktopBridge.installUpdateToProgramFolder({
          targetVersion: effectiveLatestVersion,
          htmlContent: htmlWithEmbeddedState || remoteHtml,
          versionJsonContent: versionJsonText,
        });
        if (installRes.ok) {
          const targetDir = installRes.installDir || desktopInstallDir;
          onShowToast(
            `Updated files in ${targetDir} to v${effectiveLatestVersion}! Restarting...`
          );
          document.title = 'Bowling League Helper [Updating]';
          if (installRes.needsPageReload) {
            setTimeout(() => {
              window.location.replace(
                `${window.location.origin}/?updated=${encodeURIComponent(effectiveLatestVersion)}&t=${Date.now()}`
              );
            }, 300);
          } else {
            // Legacy desktop host (v1.0.14–v1.0.19) spawns a new host process; close this window or reload it into the new server
            setTimeout(() => {
              try {
                window.open('', '_self')?.close();
              } catch {
                // Ignore
              }
              try {
                window.close();
              } catch {
                // Ignore
              }
              // If Chromium/Edge --app mode blocked window.close(), poll until the relaunched host responds and navigate this window to it, or close via force-close
              setTimeout(() => {
                window.location.replace(
                  `${window.location.origin}/?updated=${encodeURIComponent(effectiveLatestVersion)}&t=${Date.now()}`
                );
              }, 1400);
            }, 200);
          }
          return;
        }
        (window as unknown as { __BOWLING_SUPPRESS_UNLOAD__?: boolean }).__BOWLING_SUPPRESS_UNLOAD__ = false;
        const errMsg =
          installRes.error ||
          'Failed to write updated files to installation folder.';
        setUpdateErrorHint(errMsg);
        onShowToast(errMsg, true);
        return;
      }

      // 2. Browser / Single-HTML Mode: install into persistent IndexedDB runtime storage and reload
      const savedInApp = await saveUpdatedRuntimeBundle(effectiveLatestVersion, remoteHtml);

      if (savedInApp) {
        onShowToast(`Installed v${effectiveLatestVersion}! Restarting BowlingLeagueHelper...`);
        setTimeout(() => {
          window.location.reload();
        }, 650);
        return;
      }

      // Rare fallback only if browser blocks IndexedDB entirely
      const errMsg = 'Could not save updated runtime bundle locally. Please re-run the desktop updater or check permissions.';
      setUpdateErrorHint(errMsg);
      onShowToast(errMsg, true);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Update failed. Please try again.';
      setUpdateErrorHint(msg);
      onShowToast(msg, true);
    } finally {
      setIsUpdating(false);
    }
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
              Program Version Control, Auto-Updater &amp; Patch Notes
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {getDesktopBridge()
                ? `Updates program files directly inside ${desktopInstallDir} while keeping 100% of your saved scores, Week Notes, roster, and history.`
                : 'Checks for newer releases from GitHub while keeping 100% of your saved scores, Week Notes, roster, and history.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={OFFICIAL_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Official GitHub Repository"
              aria-label="Open Official GitHub Repository"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0.296997C5.37 0.296997 0 5.67 0 12.297C0 17.6 3.438 22.097 8.205 23.682C8.805 23.795 9.025 23.424 9.025 23.105C9.025 22.82 9.015 22.065 9.01 21.065C5.672 21.789 4.968 19.455 4.968 19.455C4.422 18.07 3.633 17.7 3.633 17.7C2.546 16.956 3.717 16.971 3.717 16.971C4.922 17.055 5.555 18.207 5.555 18.207C6.625 20.042 8.364 19.512 9.05 19.205C9.158 18.429 9.467 17.9 9.81 17.6C7.145 17.3 4.344 16.268 4.344 11.67C4.344 10.36 4.809 9.29 5.579 8.45C5.444 8.147 5.039 6.927 5.684 5.274C5.684 5.274 6.689 4.952 8.984 6.504C9.944 6.237 10.964 6.105 11.984 6.099C13.004 6.105 14.024 6.237 14.984 6.504C17.264 4.952 18.269 5.274 18.269 5.274C18.914 6.927 18.509 8.147 18.389 8.45C19.154 9.29 19.619 10.36 19.619 11.67C19.619 16.28 16.814 17.295 14.144 17.59C14.564 17.95 14.954 18.686 14.954 19.81C14.954 21.416 14.939 22.706 14.939 23.096C14.939 23.411 15.149 23.786 15.764 23.666C20.565 22.092 24 17.592 24 12.297C24 5.67 18.627 0.296997 12 0.296997Z" />
              </svg>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Update & Patch Notes Window"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800">
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
                v{effectiveLatestVersion}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {checkCompleted
                  ? hasNewUpdate
                    ? 'New update available to install'
                    : 'Up to date with latest release'
                  : 'Checking for latest release...'}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2">
              <button
                type="button"
                onClick={handleCheckForUpdates}
                disabled={isChecking}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking...' : 'Check for Updates'}
              </button>
            </div>
          </div>

          {updateErrorHint && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-lg flex items-start gap-2.5 text-xs text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Could not check GitHub for newer updates</div>
                <p className="mt-0.5 leading-relaxed text-amber-900">{updateErrorHint}</p>
              </div>
            </div>
          )}

          {/* Primary 1-Click Automatic Update & Restart Card */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {hasNewUpdate
                  ? `Update Available: v${currentVersion} → v${effectiveLatestVersion}`
                  : `You Are Running the Latest Version (v${effectiveLatestVersion})`}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {hasNewUpdate
                  ? getDesktopBridge()
                    ? `Click Update and Restart to download v${effectiveLatestVersion} and automatically overwrite the program files inside ${desktopInstallDir} — clearing browser cache will never remove this update.`
                    : `Click Update and Restart to install v${effectiveLatestVersion} and reload with all saved leagues intact.`
                  : getDesktopBridge()
                  ? `Your installed desktop program inside ${desktopInstallDir} is up to date (v${effectiveLatestVersion}).`
                  : `You are running the latest version (v${effectiveLatestVersion}). Visit the GitHub repository to download the Windows 11 or Linux desktop installer if needed.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {hasNewUpdate ? (
                <button
                  type="button"
                  onClick={handleUpdateAndRestart}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileCode2 className="w-4 h-4" />
                  {isUpdating ? 'Updating & Restarting...' : 'Update and Restart'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  Up to Date (v{effectiveLatestVersion})
                </span>
              )}

              <a
                href={OFFICIAL_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-700" />
                Open GitHub Repository
              </a>
            </div>
          </div>

          {/* Selectable Patch Notes Viewer */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-100 border-b border-slate-200">
              <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                <History className="w-4 h-4 text-slate-700 shrink-0" />
                <label htmlFor="patch-version-select" className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  Select Version Patch Notes:
                </label>
              </div>
              <select
                id="patch-version-select"
                value={selectedPatchVersion}
                onChange={(e) => setSelectedPatchVersion(e.target.value)}
                className="min-w-0 w-full sm:w-auto sm:max-w-md px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md truncate"
              >
                {allPatches.map((rel) => (
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
                    <div key={i} className="px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-start gap-2">
                      <span className="font-mono font-semibold text-slate-600 sm:w-32 shrink-0">
                        [{c.category}]
                      </span>
                      <span className="text-slate-800 leading-relaxed">{c.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Where League Data Is Saved & Auto-Save on Closing */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-slate-700" />
                  Where Your Program &amp; League Save File Are Stored
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  1. <strong>Installed Program Folder:</strong> Updates install directly into <code className="font-mono">{desktopInstallDir}</code> (on Windows 11) or your local desktop installation folder (on Linux)—clearing browser cache or history never affects the program.<br />
                  2. <strong>Auto-Save on Closing (<code className="font-mono">BowlingLeagueTrackerSave.json</code>):</strong> Click <strong>Save New File (.json)...</strong> to pick where <code className="font-mono">BowlingLeagueTrackerSave.json</code> is saved. Closing automatically overwrites that exact file; if it cannot be found, closing pauses and asks for a new location or <strong>Don&apos;t Save</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveBackupNow}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Save New File (.json)...
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">
              100% Offline Desktop Program (Windows 11 &amp; Linux) · Zero License Fees
            </span>
            <a
              href={OFFICIAL_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
              title="Open Official GitHub Page"
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0.296997C5.37 0.296997 0 5.67 0 12.297C0 17.6 3.438 22.097 8.205 23.682C8.805 23.795 9.025 23.424 9.025 23.105C9.025 22.82 9.015 22.065 9.01 21.065C5.672 21.789 4.968 19.455 4.968 19.455C4.422 18.07 3.633 17.7 3.633 17.7C2.546 16.956 3.717 16.971 3.717 16.971C4.922 17.055 5.555 18.207 5.555 18.207C6.625 20.042 8.364 19.512 9.05 19.205C9.158 18.429 9.467 17.9 9.81 17.6C7.145 17.3 4.344 16.268 4.344 11.67C4.344 10.36 4.809 9.29 5.579 8.45C5.444 8.147 5.039 6.927 5.684 5.274C5.684 5.274 6.689 4.952 8.984 6.504C9.944 6.237 10.964 6.105 11.984 6.099C13.004 6.105 14.024 6.237 14.984 6.504C17.264 4.952 18.269 5.274 18.269 5.274C18.914 6.927 18.509 8.147 18.389 8.45C19.154 9.29 19.619 10.36 19.619 11.67C19.619 16.28 16.814 17.295 14.144 17.59C14.564 17.95 14.954 18.686 14.954 19.81C14.954 21.416 14.939 22.706 14.939 23.096C14.939 23.411 15.149 23.786 15.764 23.666C20.565 22.092 24 17.592 24 12.297C24 5.67 18.627 0.296997 12 0.296997Z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
