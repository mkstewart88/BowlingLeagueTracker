import React, { useState, useEffect } from 'react';
import { AppState, LeagueSettings, VersionManifest } from '../types/bowling';
import { LATEST_AVAILABLE_VERSION } from '../utils/bowlingLogic';
import {
  compareSemverVersions,
  fetchRemoteHtmlTemplateFromGithub,
  fetchVersionManifest,
  mergePatchNotesHistory,
  parseGithubRepoSpec,
} from '../utils/githubUpdater';
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
  History,
  Globe,
} from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  remoteManifest: VersionManifest;
  manifestSourceUrl: string;
  onUpdateManifest: (manifest: VersionManifest, sourceUrl: string) => void;
  onUpdateSettings: (partial: Partial<LeagueSettings>) => void;
  onUpgradeVersion: (newVersion: string) => void;
  onShowToast: (msg: string, isError?: boolean) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  appState,
  remoteManifest,
  manifestSourceUrl,
  onUpdateManifest,
  onUpdateSettings,
  onUpgradeVersion,
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
  const [repoInput, setRepoInput] = useState<string>(appState.settings.githubRepo || '');
  const [branchInput, setBranchInput] = useState<string>(appState.settings.githubBranch || 'main');
  const [isChecking, setIsChecking] = useState(false);
  const [checkCompleted, setCheckCompleted] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  useEffect(() => {
    setRepoInput(appState.settings.githubRepo || '');
    setBranchInput(appState.settings.githubBranch || 'main');
  }, [appState.settings.githubRepo, appState.settings.githubBranch]);

  useEffect(() => {
    setSelectedPatchVersion(effectiveLatestVersion);
  }, [effectiveLatestVersion]);

  if (!isOpen) return null;

  const currentVersion = appState.version || '1.0.06';
  const hasNewUpdate = compareSemverVersions(effectiveLatestVersion, currentVersion) > 0;
  const selectedPatch =
    allPatches.find((p) => p.version === selectedPatchVersion) || allPatches[0];

  const parsedGithub = parseGithubRepoSpec(repoInput, branchInput);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    setCheckCompleted(false);
    setGithubError(null);

    const trimmedRepo = repoInput.trim();
    const trimmedBranch = branchInput.trim() || 'main';
    onUpdateSettings({
      githubRepo: trimmedRepo,
      githubBranch: trimmedBranch,
      lastGithubUpdateCheckAt: new Date().toISOString(),
    });

    try {
      const result = await fetchVersionManifest(trimmedRepo, trimmedBranch);
      onUpdateManifest(result.manifest, result.sourceUrl);
      setSelectedPatchVersion(result.manifest.latestVersion);
      if (result.error) {
        setGithubError(result.error);
        onShowToast(result.error, true);
      } else {
        const isNewer =
          compareSemverVersions(result.manifest.latestVersion, currentVersion) > 0;
        onShowToast(
          isNewer
            ? `Found v${result.manifest.latestVersion} from ${
                result.isFromGithub ? 'GitHub version.json' : 'version.json'
              }! Ready to install.`
            : `Checked ${
                result.isFromGithub ? 'GitHub version.json' : 'version.json'
              }: You are on the latest release (v${result.manifest.latestVersion}).`
        );
      }
    } catch {
      onShowToast('Could not reach GitHub version.json; using local release manifest.', true);
    } finally {
      setIsChecking(false);
      setCheckCompleted(true);
    }
  };

  const handleApplyAndOverwriteHtml = async () => {
    setIsUpdating(true);
    try {
      const trimmedRepo = repoInput.trim() || appState.settings.githubRepo || '';
      const trimmedBranch = branchInput.trim() || appState.settings.githubBranch || 'main';

      // Save GitHub repo settings into state BEFORE building the HTML file so the exported HTML file tracks GitHub too
      const updatedStateWithRepo: AppState = {
        ...appState,
        version: effectiveLatestVersion,
        settings: {
          ...appState.settings,
          githubRepo: trimmedRepo,
          githubBranch: trimmedBranch,
        },
      };

      onUpdateSettings({
        githubRepo: trimmedRepo,
        githubBranch: trimmedBranch,
      });
      onUpgradeVersion(effectiveLatestVersion);

      // Try fetching the latest pre-compiled HTML bundle from GitHub if a repo is configured
      let remoteHtml: string | null = null;
      if (trimmedRepo) {
        const fetched = await fetchRemoteHtmlTemplateFromGithub(
          trimmedRepo,
          trimmedBranch,
          remoteManifest
        );
        if (fetched?.html) {
          remoteHtml = fetched.html;
        }
      }

      const res = await overwriteOrDownloadSingleHtmlFile(
        updatedStateWithRepo,
        effectiveLatestVersion,
        remoteHtml
      );
      onShowToast(
        res.method === 'filesystem'
          ? `Updated to v${effectiveLatestVersion} and overwrote ${res.filename} with all league data intact!`
          : `Updated to v${effectiveLatestVersion} and downloaded ${res.filename} with all league data intact!`
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
    const trimmedRepo = repoInput.trim() || appState.settings.githubRepo || '';
    const trimmedBranch = branchInput.trim() || appState.settings.githubBranch || 'main';
    onUpdateSettings({
      githubRepo: trimmedRepo,
      githubBranch: trimmedBranch,
    });
    onUpgradeVersion(effectiveLatestVersion);
    onShowToast(
      `Program updated to v${effectiveLatestVersion}! All ${appState.bowlers.length} active bowlers and ${appState.roster.length} roster players were preserved.`
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
              Program Version Control, GitHub Live Updater & Patch Notes
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Tracks <code className="font-mono text-blue-300">version.json</code> on GitHub and updates your single-HTML desktop program while keeping 100% of your leagues.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Update & Patch Notes Window"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
              <div className="text-xs font-semibold text-slate-500">
                Latest in <code className="font-mono">version.json</code>
              </div>
              <div className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-0.5">
                v{effectiveLatestVersion}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {checkCompleted
                  ? hasNewUpdate
                    ? `Update available: ${remoteManifest.title.slice(0, 48)}...`
                    : 'Up to date with latest version.json release'
                  : 'Checking GitHub version.json...'}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2">
              <button
                type="button"
                onClick={handleCheckForUpdates}
                disabled={isChecking}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking GitHub...' : 'Check GitHub Now'}
              </button>
              <div className="text-[11px] text-slate-500 truncate" title={manifestSourceUrl}>
                Source: {manifestSourceUrl}
              </div>
            </div>
          </div>

          {/* GitHub Repository Tracker Configuration */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-700" />
                  GitHub Repository Auto-Update Tracker (<code className="font-mono text-blue-700">version.json</code>)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Enter your GitHub repository (e.g. <code className="font-mono text-slate-800">MKStewart88/bowling-league-helper</code> or full GitHub URL). It is saved inside any <code className="font-mono">.html</code> file you download so your uncle&apos;s single <code className="font-mono">.html</code> file automatically tracks your GitHub for updates!
                </p>
              </div>
              {parsedGithub && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                  Tracking: {parsedGithub.owner}/{parsedGithub.repo} ({parsedGithub.branch})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-7">
                <label htmlFor="github-repo-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                  GitHub Repository (owner/repo or https://github.com/owner/repo)
                </label>
                <input
                  id="github-repo-input"
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="e.g. MKStewart88/bowling-league-helper"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="github-branch-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                  Branch
                </label>
                <input
                  id="github-branch-input"
                  type="text"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>
              <div className="sm:col-span-3 flex items-end">
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  disabled={isChecking}
                  className="w-full px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                >
                  Save & Fetch version.json
                </button>
              </div>
            </div>

            {githubError && (
              <div className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {githubError}
              </div>
            )}
          </div>

          {/* Primary Overwrite & Update Action Box */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {hasNewUpdate
                  ? `Upgrade from v${currentVersion} to v${effectiveLatestVersion} (Keep All League Data)`
                  : `Re-Save Single HTML Desktop File (v${effectiveLatestVersion})`}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Downloads the newest <code className="font-mono text-slate-800">Bowling_League_Helper_Latest.html</code> code (from GitHub or this build), embeds 100% of your saved leagues inside it, and overwrites your existing <code className="font-mono text-slate-800">.html</code> file on your computer.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {hasNewUpdate && (
                <button
                  type="button"
                  onClick={handleApplyInAppUpdateOnly}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Update Live App to v{effectiveLatestVersion}
                </button>
              )}
              <button
                type="button"
                onClick={handleApplyAndOverwriteHtml}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileCode2 className="w-4 h-4" />
                {isUpdating
                  ? 'Updating HTML File...'
                  : `Update & Overwrite Single HTML File (v${effectiveLatestVersion})`}
              </button>
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
                    {selectedPatch.isLatest ? ' · Latest Official Build in version.json' : ''}
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
                  How GitHub Version Updates Work for Single-File HTML Users
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  1. <strong><code className="font-mono">version.json</code> in GitHub:</strong> Both the root <code className="font-mono">/version.json</code> and <code className="font-mono">/public/version.json</code> files store the current <code className="font-mono">latestVersion</code> and release notes.<br />
                  2. <strong>Automatic Single-HTML Updating:</strong> When you push an updated <code className="font-mono">version.json</code> and pre-compiled <code className="font-mono">Bowling_League_Helper_Latest.html</code> to GitHub, any desktop <code className="font-mono">.html</code> file linked to your repo detects the new version and overwrites itself with the new code while keeping 100% of your saved leagues intact.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveBackupNow}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
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
            100% Offline-Capable Single-File Architecture · Live GitHub <code className="font-mono">version.json</code> Sync
          </span>
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
