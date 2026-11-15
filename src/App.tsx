import React, { useState, useEffect } from 'react';
import {
  AppState,
  BowlerEntry,
  LaneMatchup,
  LeagueSettings,
  RosterPlayer,
  VersionManifest,
  WeeklyDuesRecord,
} from './types/bowling';
import {
  CURRENT_APP_VERSION,
  DEFAULT_SETTINGS,
  LATEST_AVAILABLE_VERSION,
  computeBowlerAbsentScore,
  generateRoundRobinSchedule,
  parseUniversalBackupPayload,
} from './utils/bowlingLogic';
import {
  OFFICIAL_GITHUB_URL,
  compareSemverVersions,
  fetchVersionManifest,
  getBuiltInFallbackManifest,
} from './utils/githubUpdater';
import { createFreshInitialState } from './utils/seedData';
import { QuickEntryTab } from './components/QuickEntryTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { BracketsTab } from './components/BracketsTab';
import { TreasuryTab } from './components/TreasuryTab';
import { ScheduleTab } from './components/ScheduleTab';
import { UpdateModal } from './components/UpdateModal';
import { CloseSaveModal } from './components/CloseSaveModal';
import { PrintStandingSheet } from './components/PrintStandingSheet';
import {
  cancelPendingClose,
  executeAutoBackupWrite,
  forceCloseProgramWithoutSaving,
  hasConnectedAutoBackupHandle,
  pickNewSaveLocationAndFinishClose,
  quickSaveLeagueFile,
  saveLeagueFileToComputer,
  verifyAndSaveBeforeClose,
} from './utils/fileExport';
import { getDesktopBridge, serializeMasterSavePayload } from './utils/desktopBridge';
import {
  clearCookieVault,
  hasMeaningfulLeagueData,
  loadStateFromCookieVault,
  saveStateToCookieVault,
} from './utils/cookieVault';
import {
  RefreshCw,
  Calendar,
  LogOut,
  Save,
  FolderOpen,
} from 'lucide-react';

const STORAGE_KEY = 'bowling_league_helper_state_v5';

type ActiveTab = 'entry' | 'analytics' | 'brackets' | 'treasury' | 'schedule';

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function syncActiveLeagueInRegistry(state: AppState): AppState {
  const activeId = state.activeLeagueId || state.settings.leagueId || 'my-bowling-league';
  const { allLeaguesRegistry, ...leagueSnapshot } = state;
  const nextRegistry = {
    ...(allLeaguesRegistry || {}),
    [activeId]: {
      ...leagueSnapshot,
      activeLeagueId: activeId,
    },
  };
  return {
    ...state,
    activeLeagueId: activeId,
    allLeaguesRegistry: nextRegistry,
  };
}

/**
 * Automatically populates downstream BLS 2026 modules (Brackets, Weekly Dues,
 * and Round-Robin Lane Schedule) whenever bowlers or teams are entered in Tab 1.
 */
function autoPopulateDownstreamModules(
  prev: AppState,
  nextBowlers: BowlerEntry[],
  nextRoster: RosterPlayer[],
  addedOrUpdatedBowlerId?: string | null
): Pick<AppState, 'bracketEntrantIds' | 'currentDues' | 'schedule'> {
  // 1. Brackets: keep active non-absent bowler IDs and auto-include newly entered bowlers
  const activeBowlerIds = new Set(
    nextBowlers.filter((b) => !b.isAbsent).map((b) => b.id)
  );
  let nextBracketIds = (prev.bracketEntrantIds || []).filter((id) =>
    activeBowlerIds.has(id)
  );
  if (
    addedOrUpdatedBowlerId &&
    activeBowlerIds.has(addedOrUpdatedBowlerId) &&
    !nextBracketIds.includes(addedOrUpdatedBowlerId)
  ) {
    nextBracketIds = [...nextBracketIds, addedOrUpdatedBowlerId];
  }
  if (nextBracketIds.length === 0 && activeBowlerIds.size > 0) {
    nextBracketIds = Array.from(activeBowlerIds);
  }

  // 2. Weekly Dues & Treasurer: ensure every roster player and active bowler has an initialized dues record
  const nextDues: Record<string, WeeklyDuesRecord> = { ...(prev.currentDues || {}) };
  for (const r of nextRoster) {
    if (!nextDues[r.id]) {
      nextDues[r.id] = {
        playerId: r.id,
        playerName: r.name,
        team: r.team || '',
        status: 'paid',
        amountPaid: prev.settings.weeklyDuesPerBowler,
        sidePotStrike: false,
        sidePotHighGame: false,
        notes: '',
      };
    } else if (r.team && nextDues[r.id].team !== r.team) {
      nextDues[r.id] = {
        ...nextDues[r.id],
        playerName: r.name,
        team: r.team,
      };
    }
  }

  // 3. Round-Robin Lane Schedule & Team Matchups: auto-generate or expand schedule when >= 2 teams exist
  const teamSet = new Set<string>();
  nextRoster.forEach((r) => {
    const t = (r.team || '').trim();
    if (t && t.toLowerCase() !== 'unassigned') teamSet.add(t);
  });
  nextBowlers.forEach((b) => {
    const t = (b.team || '').trim();
    if (t && t.toLowerCase() !== 'unassigned') teamSet.add(t);
  });
  const uniqueTeams = Array.from(teamSet);

  let nextSchedule = prev.schedule || [];
  if (uniqueTeams.length >= 2) {
    const scheduledTeams = new Set<string>();
    nextSchedule.forEach((m) => {
      if (m.teamA && m.teamA !== 'BYE') scheduledTeams.add(m.teamA);
      if (m.teamB && m.teamB !== 'BYE') scheduledTeams.add(m.teamB);
    });
    const hasMissingTeam = uniqueTeams.some((t) => !scheduledTeams.has(t));
    const onlyDefaultPlaceholders =
      scheduledTeams.size > 0 &&
      Array.from(scheduledTeams).every((t) => /^Team \d+$/i.test(t)) &&
      uniqueTeams.some((t) => !/^Team \d+$/i.test(t));

    if (nextSchedule.length === 0 || hasMissingTeam || onlyDefaultPlaceholders) {
      nextSchedule = generateRoundRobinSchedule(
        uniqueTeams,
        prev.settings.startingLane || 1,
        prev.settings.totalWeeks || 12
      );
    }
  }

  return {
    bracketEntrantIds: nextBracketIds,
    currentDues: nextDues,
    schedule: nextSchedule,
  };
}

function extractStateTimestamp(raw: unknown, state: AppState): number {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (typeof obj.__vaultSavedAt === 'number' && obj.__vaultSavedAt > 0) {
    return obj.__vaultSavedAt;
  }
  if (typeof obj.exportedAt === 'string') {
    const t = Date.parse(obj.exportedAt);
    if (!Number.isNaN(t)) return t;
  }
  const localTs = state.settings?.lastLocalBackupAt
    ? Date.parse(state.settings.lastLocalBackupAt)
    : NaN;
  if (!Number.isNaN(localTs)) return localTs;
  const autoTs = state.settings?.lastAutoBackupAt
    ? Date.parse(state.settings.lastAutoBackupAt)
    : NaN;
  if (!Number.isNaN(autoTs)) return autoTs;
  return 0;
}

function resolveBestInitialState(): { state: AppState; dirty: boolean } {
  interface Candidate {
    state: AppState;
    meaningful: boolean;
    timestamp: number;
    dirty: boolean;
    priority: number;
  }

  const candidates: Candidate[] = [];

  const tryAddRawJson = (rawJson: string | null | undefined, priority: number, dirtyFlag = false) => {
    if (!rawJson) return;
    try {
      const parsed = JSON.parse(rawJson);
      const { restoredState } = parseUniversalBackupPayload(
        rawJson,
        createFreshInitialState()
      );
      const hasRegistry = Boolean(parsed && typeof parsed.allLeaguesRegistry === 'object');
      const synced = syncActiveLeagueInRegistry({
        ...restoredState,
        version: CURRENT_APP_VERSION,
        allLeaguesRegistry: hasRegistry ? restoredState.allLeaguesRegistry : undefined,
      });
      candidates.push({
        state: synced,
        meaningful: hasMeaningfulLeagueData(synced),
        timestamp: extractStateTimestamp(parsed, synced),
        dirty: dirtyFlag || Boolean(parsed && parsed.__vaultDirty === 1),
        priority,
      });
    } catch {
      // Ignore malformed candidate
    }
  };

  // 1. Check embedded-league-state script injected into HTML
  if (typeof document !== 'undefined') {
    const embeddedScript = document.getElementById('embedded-league-state')?.textContent;
    tryAddRawJson(embeddedScript, 3);
  }

  // 2. Check port-agnostic 127.0.0.1 Cookie Vault (survives random port changes across launches)
  const vaultSnap = loadStateFromCookieVault();
  if (vaultSnap) {
    candidates.push({
      state: syncActiveLeagueInRegistry(vaultSnap.state),
      meaningful: hasMeaningfulLeagueData(vaultSnap.state),
      timestamp: vaultSnap.savedAt,
      dirty: vaultSnap.dirty,
      priority: 4,
    });
  }

  // 3. Check localStorage keys
  if (typeof localStorage !== 'undefined') {
    tryAddRawJson(localStorage.getItem(STORAGE_KEY), 2);
    tryAddRawJson(localStorage.getItem('bowling_league_helper_state_v4'), 1);
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.meaningful !== b.meaningful) {
        return a.meaningful ? -1 : 1;
      }
      if (a.timestamp !== b.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.priority - a.priority;
    });
    const winner = candidates[0];
    return { state: winner.state, dirty: winner.dirty };
  }

  return { state: createFreshInitialState(), dirty: false };
}

export default function App() {
  const initialBootRef = React.useRef<{ state: AppState; dirty: boolean } | null>(null);
  if (!initialBootRef.current) {
    initialBootRef.current = resolveBestInitialState();
  }

  const [appState, setAppState] = useState<AppState>(() => initialBootRef.current!.state);
  const [undoStack, setUndoStack] = useState<AppState[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(
    () => initialBootRef.current!.dirty
  );
  const lastSavedSnapshotRef = React.useRef<AppState>(initialBootRef.current!.state);
  const openFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('entry');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [remoteManifest, setRemoteManifest] = useState<VersionManifest>(() =>
    getBuiltInFallbackManifest()
  );
  const [toast, setToast] = useState<{ message: string; isError: boolean; showUndo?: boolean } | null>(null);
  const [closeModalState, setCloseModalState] = useState<{
    isOpen: boolean;
    promptMode: 'unsaved_changes' | 'missing_file';
    hasExistingSaveFile: boolean;
    missingPath: string | null;
    reason: string;
    isBusy: boolean;
  }>({
    isOpen: false,
    promptMode: 'missing_file',
    hasExistingSaveFile: false,
    missingPath: null,
    reason: '',
    isBusy: false,
  });

  const appStateRef = React.useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const hasUnsavedChangesRef = React.useRef(hasUnsavedChanges);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Silently check GitHub (mkstewart88/BowlingLeagueTracker) / version.json on mount
  useEffect(() => {
    let active = true;
    fetchVersionManifest()
      .then((res) => {
        if (!active) return;
        setRemoteManifest(res.manifest);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const closeInFlightRef = React.useRef(false);
  const closeHandledCleanlyRef = React.useRef(false);
  const desktopLastSaveExistsRef = React.useRef(false);
  const desktopLastSavePathRef = React.useRef<string | null>(null);
  const initialLoadCompleteRef = React.useRef(!getDesktopBridge());
  const [desktopInstallDir, setDesktopInstallDir] = useState<string>('C:\\BowlingLeagueHelper');

  // Register native desktop close interception + keep save-file status synced
  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      initialLoadCompleteRef.current = true;
      return;
    }

    const refreshDesktopSaveStatus = () => {
      bridge
        .getDesktopInfo()
        .then((info) => {
          if (info.installDir) {
            setDesktopInstallDir(info.installDir);
          }
          desktopLastSaveExistsRef.current = Boolean(info.lastSaveExists);
          desktopLastSavePathRef.current = info.lastSaveFilePath || null;
          if (info.lastSaveFilePath && appStateRef.current.settings.autoBackupDirectoryLabel !== info.lastSaveFilePath) {
            setAppState((prev) =>
              syncActiveLeagueInRegistry({
                ...prev,
                settings: {
                  ...prev.settings,
                  autoBackupDirectoryLabel: info.lastSaveFilePath,
                },
              })
            );
          }
        })
        .catch(() => {});
    };

    refreshDesktopSaveStatus();
    if (typeof bridge.loadLastSaveFile === 'function') {
      bridge
        .loadLastSaveFile()
        .then((res) => {
          if (res?.ok && res.exists && res.jsonText) {
            try {
              const parsedRaw = JSON.parse(res.jsonText);
              const { restoredState } = parseUniversalBackupPayload(
                res.jsonText,
                createFreshInitialState()
              );
              const hasRegistry = Boolean(
                parsedRaw && typeof parsedRaw.allLeaguesRegistry === 'object'
              );
              const loaded = syncActiveLeagueInRegistry({
                ...restoredState,
                version: CURRENT_APP_VERSION,
                allLeaguesRegistry: hasRegistry ? restoredState.allLeaguesRegistry : undefined,
                settings: {
                  ...restoredState.settings,
                  autoBackupDirectoryLabel:
                    res.filePath || restoredState.settings.autoBackupDirectoryLabel,
                },
              });

              const diskTs = extractStateTimestamp(parsedRaw, loaded);
              const vaultSnap = loadStateFromCookieVault();
              const currentHasNewerVaultData =
                vaultSnap &&
                hasMeaningfulLeagueData(vaultSnap.state) &&
                vaultSnap.savedAt > diskTs + 2000;

              initialLoadCompleteRef.current = true;
              desktopLastSaveExistsRef.current = true;
              desktopLastSavePathRef.current = res.filePath || null;

              if (!currentHasNewerVaultData && (hasMeaningfulLeagueData(loaded) || !hasMeaningfulLeagueData(appStateRef.current))) {
                lastSavedSnapshotRef.current = loaded;
                setAppState(loaded);
                setUndoStack([]);
                setHasUnsavedChanges(false);
                hasUnsavedChangesRef.current = false;
                saveStateToCookieVault(loaded, false);
                const autoSaveOnClose =
                  loaded.settings.autoBackupEnabled !== false &&
                  loaded.settings.autoBackupInterval === 'on_close';
                bridge
                  .stageSavePayload?.(serializeMasterSavePayload(loaded), {
                    dirty: false,
                    autoSaveOnClose,
                  })
                  .catch(() => {});
                setToast({
                  message: `Opened save file "${res.filePath || 'BowlingLeagueTrackerSave.json'}".`,
                  isError: false,
                });
                return;
              }
            } catch (err) {
              console.warn('Could not parse linked save file on startup:', err);
            }
          }
          initialLoadCompleteRef.current = true;
          saveStateToCookieVault(appStateRef.current, hasUnsavedChangesRef.current);
          bridge
            .stageSavePayload?.(serializeMasterSavePayload(appStateRef.current), {
              dirty: hasUnsavedChangesRef.current,
              autoSaveOnClose:
                appStateRef.current.settings.autoBackupEnabled !== false &&
                appStateRef.current.settings.autoBackupInterval === 'on_close',
            })
            .catch(() => {});
        })
        .catch(() => {
          initialLoadCompleteRef.current = true;
          saveStateToCookieVault(appStateRef.current, hasUnsavedChangesRef.current);
          bridge
            .stageSavePayload?.(serializeMasterSavePayload(appStateRef.current), {
              dirty: hasUnsavedChangesRef.current,
              autoSaveOnClose:
                appStateRef.current.settings.autoBackupEnabled !== false &&
                appStateRef.current.settings.autoBackupInterval === 'on_close',
            })
            .catch(() => {});
        });
    } else {
      initialLoadCompleteRef.current = true;
      saveStateToCookieVault(appStateRef.current, hasUnsavedChangesRef.current);
      bridge
        .stageSavePayload?.(serializeMasterSavePayload(appStateRef.current), {
          dirty: hasUnsavedChangesRef.current,
          autoSaveOnClose:
            appStateRef.current.settings.autoBackupEnabled !== false &&
            appStateRef.current.settings.autoBackupInterval === 'on_close',
        })
        .catch(() => {});
    }
    const statusPoll = setInterval(refreshDesktopSaveStatus, 4000);
    window.addEventListener('focus', refreshDesktopSaveStatus);

    const openMissingSavePrompt = (missingPath: string | null, reason?: string) => {
      setCloseModalState({
        isOpen: true,
        promptMode: 'missing_file',
        hasExistingSaveFile: false,
        missingPath,
        reason:
          reason ||
          (missingPath
            ? `Cannot find your last save file at "${missingPath}".`
            : 'No save file location has been selected yet.'),
        isBusy: false,
      });
    };

    const unsubscribe = bridge.onRequestCloseSave(async () => {
      bridge.ackCloseRequest?.().catch(() => {});
      if (closeInFlightRef.current) return;
      closeInFlightRef.current = true;
      try {
        const autoSaveOnClose =
          appStateRef.current.settings.autoBackupEnabled !== false &&
          appStateRef.current.settings.autoBackupInterval === 'on_close';
        const isDirty = hasUnsavedChangesRef.current;

        // Whenever the user made changes since their last save, prompt them to confirm saving before closing!
        if (isDirty) {
          setCloseModalState({
            isOpen: true,
            promptMode: 'unsaved_changes',
            hasExistingSaveFile:
              desktopLastSaveExistsRef.current || hasConnectedAutoBackupHandle(),
            missingPath:
              desktopLastSavePathRef.current ||
              appStateRef.current.settings.autoBackupDirectoryLabel ||
              null,
            reason:
              'You made changes to your league since your last save. Would you like to save before closing?',
            isBusy: false,
          });
          return;
        }

        // If Auto-Backup is set to "On Closing Program", verify and save to the linked file before closing
        if (autoSaveOnClose) {
          const result = await verifyAndSaveBeforeClose(appStateRef.current);
          if (result.ok) {
            closeHandledCleanlyRef.current = true;
            desktopLastSaveExistsRef.current = true;
            setHasUnsavedChanges(false);
            hasUnsavedChangesRef.current = false;
          } else if (result.missing) {
            desktopLastSaveExistsRef.current = false;
            openMissingSavePrompt(result.missingPath || null, result.reason);
          } else {
            closeInFlightRef.current = false;
          }
          return;
        }

        // No unsaved changes: close cleanly
        closeHandledCleanlyRef.current = true;
        await forceCloseProgramWithoutSaving();
      } catch {
        closeInFlightRef.current = false;
      }
    });

    const notifyDesktopWindowUnloading = () => {
      if (
        closeHandledCleanlyRef.current ||
        (window as unknown as { __BOWLING_SUPPRESS_UNLOAD__?: boolean }).__BOWLING_SUPPRESS_UNLOAD__
      ) {
        return;
      }
      const current = syncActiveLeagueInRegistry(appStateRef.current);
      const payload = serializeMasterSavePayload(current);
      const autoSaveOnClose =
        current.settings.autoBackupEnabled !== false &&
        current.settings.autoBackupInterval === 'on_close';
      const isDirty = hasUnsavedChangesRef.current;

      // Always keep the port-agnostic Cookie Vault up to date on window unload so nothing is ever lost on reopen!
      saveStateToCookieVault(current, isDirty && !autoSaveOnClose);

      if (
        autoSaveOnClose &&
        desktopLastSaveExistsRef.current &&
        typeof bridge.sendAutoSaveBeacon === 'function'
      ) {
        bridge.sendAutoSaveBeacon(payload);
      }
      if (typeof bridge.sendWindowUnloadedBeacon === 'function') {
        bridge.sendWindowUnloadedBeacon(payload, {
          dirty: isDirty,
          autoSaveOnClose,
        });
      }
    };

    window.addEventListener('pagehide', notifyDesktopWindowUnloading);
    window.addEventListener('unload', notifyDesktopWindowUnloading);

    return () => {
      clearInterval(statusPoll);
      window.removeEventListener('focus', refreshDesktopSaveStatus);
      unsubscribe();
      window.removeEventListener('pagehide', notifyDesktopWindowUnloading);
      window.removeEventListener('unload', notifyDesktopWindowUnloading);
    };
  }, []);

  // Window beforeunload guard: ALWAYS prompt when unsaved changes exist (both in Edge --app desktop mode and browser mode!)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        closeHandledCleanlyRef.current ||
        (window as unknown as { __BOWLING_SUPPRESS_UNLOAD__?: boolean }).__BOWLING_SUPPRESS_UNLOAD__
      ) {
        return;
      }
      const current = syncActiveLeagueInRegistry(appStateRef.current);
      const autoSaveOnClose =
        current.settings.autoBackupEnabled !== false &&
        current.settings.autoBackupInterval === 'on_close';
      const hasSaveTarget =
        desktopLastSaveExistsRef.current || hasConnectedAutoBackupHandle();

      // Persist immediately to port-agnostic Cookie Vault so even if user clicks "Leave", their data is safe
      saveStateToCookieVault(current, hasUnsavedChangesRef.current);

      if (hasUnsavedChangesRef.current || (autoSaveOnClose && !hasSaveTarget && hasMeaningfulLeagueData(current))) {
        setCloseModalState({
          isOpen: true,
          promptMode: hasUnsavedChangesRef.current ? 'unsaved_changes' : 'missing_file',
          hasExistingSaveFile: hasSaveTarget,
          missingPath:
            desktopLastSavePathRef.current ||
            current.settings.autoBackupDirectoryLabel ||
            null,
          reason:
            'You made changes to your league since your last save. Would you like to save before closing?',
          isBusy: false,
        });
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Would you like to save before closing?';
        return 'You have unsaved changes. Would you like to save before closing?';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Sync to localStorage, port-agnostic Cookie Vault, and desktop host on every state change
  useEffect(() => {
    try {
      const synced = syncActiveLeagueInRegistry(appState);
      const serialized = JSON.stringify(synced);
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem('bowling_league_helper_state_v4', serialized);
      localStorage.setItem('tnr_bowling_tracker_v3', serialized);
      saveStateToCookieVault(synced, hasUnsavedChanges);

      if (!hasUnsavedChanges) {
        lastSavedSnapshotRef.current = synced;
      }

      if (!initialLoadCompleteRef.current) return;

      const bridge = getDesktopBridge();
      if (bridge) {
        const autoSaveOnClose =
          synced.settings.autoBackupEnabled !== false &&
          synced.settings.autoBackupInterval === 'on_close';
        const masterPayload = serializeMasterSavePayload(synced);

        const stageTimer = setTimeout(() => {
          bridge
            .stageSavePayload?.(masterPayload, {
              dirty: hasUnsavedChanges,
              autoSaveOnClose,
            })
            .catch(() => {});

          // If Auto-Backup is set to "On Closing Program" or "On Every Change" and a save file is linked on disk, keep the disk file synced automatically
          if (
            synced.settings.autoBackupEnabled !== false &&
            (synced.settings.autoBackupInterval === 'on_close' ||
              synced.settings.autoBackupInterval === 'on_change') &&
            desktopLastSaveExistsRef.current &&
            typeof bridge.quickSaveToCurrentFile === 'function'
          ) {
            bridge.quickSaveToCurrentFile(masterPayload).catch(() => {});
          }
        }, 80);
        return () => clearTimeout(stageTimer);
      }
    } catch (e) {
      console.error('Failed to persist state to storage mirrors:', e);
    }
  }, [appState, hasUnsavedChanges]);

  // Automatic Backup Scheduler Timer (5min, 15min, 30min) & On-Change Handle Writer
  useEffect(() => {
    if (appState.settings.autoBackupEnabled === false) return;
    const intervalMode = appState.settings.autoBackupInterval || 'on_finish_week';

    if (intervalMode === 'on_change' && hasConnectedAutoBackupHandle()) {
      executeAutoBackupWrite(syncActiveLeagueInRegistry(appState), false).catch(() => {});
      return;
    }

    const minutesMap: Record<string, number> = {
      '5min': 5,
      '15min': 15,
      '30min': 30,
    };
    const mins = minutesMap[intervalMode];
    if (!mins) return;

    const timer = setInterval(async () => {
      const res = await executeAutoBackupWrite(syncActiveLeagueInRegistry(appState), true);
      if (res.wrote) {
        setAppState((prev) =>
          syncActiveLeagueInRegistry({
            ...prev,
            settings: {
              ...prev.settings,
              lastAutoBackupAt: new Date().toISOString(),
            },
          })
        );
      }
    }, mins * 60 * 1000);

    return () => clearInterval(timer);
  }, [appState]);

  const showToast = (message: string, isError = false, showUndo = false) => {
    setToast({ message, isError, showUndo });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const pushUndoState = (current: AppState) => {
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
    setUndoStack((prev) => [...prev.slice(-29), JSON.parse(JSON.stringify(current))]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) {
      showToast('No recent changes to undo.');
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setAppState(previous);
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
    showToast('Last change undone.');
  };

  // Global Ctrl+Z / Cmd+Z handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoStack]);

  const handleUpdateSettings = (partial: Partial<LeagueSettings>) => {
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
    setAppState((prev) =>
      syncActiveLeagueInRegistry({
        ...prev,
        settings: { ...prev.settings, ...partial },
        weekArchived: false,
      })
    );
  };

  const handleUpdateWeekNotes = (notes: string) => {
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
    setAppState((prev) => {
      let nextHistory = prev.history;
      if (prev.weekArchived && prev.weekArchiveId) {
        nextHistory = prev.history.map((h) =>
          h.id === prev.weekArchiveId ? { ...h, weekNotes: notes } : h
        );
      }
      return syncActiveLeagueInRegistry({
        ...prev,
        weekNotes: notes,
        history: nextHistory,
      });
    });
  };

  const handleAddOrUpdateBowler = (
    entry: Omit<BowlerEntry, 'id' | 'createdAt'>,
    editingId: string | null
  ) => {
    pushUndoState(appState);

    setAppState((prev) => {
      let nextBowlers: BowlerEntry[];
      let targetBowlerId = editingId;
      if (editingId) {
        nextBowlers = prev.bowlers.map((b) =>
          b.id === editingId
            ? { ...b, ...entry, id: editingId }
            : b
        );
      } else {
        targetBowlerId = makeId();
        nextBowlers = [
          ...prev.bowlers,
          {
            ...entry,
            id: targetBowlerId,
            createdAt: new Date().toISOString(),
          },
        ];
      }

      // Update master roster if not a sub
      let nextRoster = [...prev.roster];
      if (!entry.isSub) {
        const existingIdx = nextRoster.findIndex(
          (r) => r.name.toLowerCase() === entry.name.toLowerCase()
        );
        if (existingIdx >= 0) {
          if (entry.team && nextRoster[existingIdx].team !== entry.team) {
            nextRoster[existingIdx] = {
              ...nextRoster[existingIdx],
              team: entry.team,
            };
          }
        } else {
          const gamesCount = entry.entryMode === 'three' ? 3 : 1;
          const initialBookAvg = Math.floor(entry.scratchScore / gamesCount) || 165;
          nextRoster.push({
            id: makeId(),
            name: entry.name,
            team: entry.team,
            bookAverage: initialBookAvg,
          });
        }
      }

      const downstream = autoPopulateDownstreamModules(
        prev,
        nextBowlers,
        nextRoster,
        targetBowlerId
      );

      return syncActiveLeagueInRegistry({
        ...prev,
        bowlers: nextBowlers,
        roster: nextRoster,
        ...downstream,
        weekArchived: false,
      });
    });

    showToast(
      editingId
        ? `Updated score for ${entry.name} (${entry.grandTotal}).`
        : `Added ${entry.name} — Total: ${entry.grandTotal}.`,
      false,
      true
    );
  };

  const handleDeleteBowler = (id: string) => {
    const target = appState.bowlers.find((b) => b.id === id);
    if (!target) return;
    pushUndoState(appState);
    setAppState((prev) => {
      const nextBowlers = prev.bowlers.filter((b) => b.id !== id);
      const nextBracketIds = (prev.bracketEntrantIds || []).filter((bid) => bid !== id);
      return syncActiveLeagueInRegistry({
        ...prev,
        bowlers: nextBowlers,
        bracketEntrantIds: nextBracketIds,
        weekArchived: false,
      });
    });
    showToast(`Removed ${target.name} from current week.`, false, true);
  };

  const handleMarkAbsent = (player: RosterPlayer) => {
    if (
      appState.bowlers.some(
        (b) => b.name.toLowerCase() === player.name.toLowerCase()
      )
    ) {
      showToast(`${player.name} is already entered for this week.`, true);
      return;
    }

    pushUndoState(appState);
    const absCalc = computeBowlerAbsentScore(player.bookAverage, appState.settings);
    const isThree = appState.settings.entryMode === 'three';
    const perGame = absCalc.perGame;
    const scratch = absCalc.totalSeries;

    const absentEntry: BowlerEntry = {
      id: makeId(),
      name: player.name,
      team: player.team || '',
      entryMode: appState.settings.entryMode,
      scoringType: appState.settings.scoringType,
      g1: isThree ? perGame : 0,
      g2: isThree ? perGame : 0,
      g3: isThree ? perGame : 0,
      scratchScore: scratch,
      handicap: 0,
      grandTotal: scratch,
      isAbsent: true,
      isSub: false,
      createdAt: new Date().toISOString(),
    };

    setAppState((prev) => {
      const nextBowlers = [...prev.bowlers, absentEntry];
      const downstream = autoPopulateDownstreamModules(prev, nextBowlers, prev.roster, null);
      return syncActiveLeagueInRegistry({
        ...prev,
        bowlers: nextBowlers,
        ...downstream,
        weekArchived: false,
      });
    });
    showToast(
      `Marked ${player.name} as Absent (${scratch} pts — ${absCalc.ruleDescription}).`,
      false,
      true
    );
  };

  const handleAddRosterPlayer = (name: string, team: string, bookAvg = 165) => {
    pushUndoState(appState);
    setAppState((prev) => {
      const idx = prev.roster.findIndex(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );
      let nextRoster = [...prev.roster];
      if (idx >= 0) {
        nextRoster[idx] = {
          ...nextRoster[idx],
          team: team || nextRoster[idx].team,
          bookAverage: bookAvg,
        };
      } else {
        nextRoster.push({
          id: makeId(),
          name,
          team,
          bookAverage: bookAvg,
        });
      }
      const downstream = autoPopulateDownstreamModules(prev, prev.bowlers, nextRoster, null);
      return syncActiveLeagueInRegistry({
        ...prev,
        roster: nextRoster,
        ...downstream,
      });
    });
    showToast(`Saved ${name} to Master Roster.`, false, true);
  };

  const handleDeleteRosterPlayer = (id: string) => {
    const target = appState.roster.find((r) => r.id === id);
    if (!target) return;
    pushUndoState(appState);
    setAppState((prev) => ({
      ...prev,
      roster: prev.roster.filter((r) => r.id !== id),
    }));
    showToast(`Removed ${target.name} from Master Roster.`, false, true);
  };

  const handleFinishWeekAndArchive = () => {
    if (appState.bowlers.length === 0) return;
    pushUndoState(appState);

    setAppState((prev) => {
      const archiveId = prev.weekArchiveId || makeId();
      const snapshot = {
        id: archiveId,
        league: prev.settings.leagueName,
        week: prev.settings.weekNumber,
        date: new Date().toISOString(),
        weekNotes: prev.weekNotes || '',
        settings: { ...prev.settings },
        bowlers: JSON.parse(JSON.stringify(prev.bowlers)),
      };

      const existingIdx = prev.history.findIndex((h) => h.id === archiveId);
      const nextHistory = [...prev.history];
      if (existingIdx >= 0) {
        nextHistory[existingIdx] = snapshot;
      } else {
        nextHistory.push(snapshot);
      }

      return syncActiveLeagueInRegistry({
        ...prev,
        history: nextHistory,
        weekArchived: true,
        weekArchiveId: archiveId,
        settings: {
          ...prev.settings,
          lastAutoBackupAt:
            prev.settings.autoBackupEnabled !== false &&
            (prev.settings.autoBackupInterval || 'on_finish_week') === 'on_finish_week'
              ? new Date().toISOString()
              : prev.settings.lastAutoBackupAt,
        },
      });
    });

    if (
      appState.settings.autoBackupEnabled !== false &&
      (appState.settings.autoBackupInterval || 'on_finish_week') === 'on_finish_week'
    ) {
      executeAutoBackupWrite(syncActiveLeagueInRegistry(appState), true).catch(() => {});
    }
  };

  const handleStartNewWeek = () => {
    pushUndoState(appState);
    setAppState((prev) => {
      // Auto-archive current week if it has scores and wasn't archived yet
      let nextHistory = [...prev.history];
      if (prev.bowlers.length > 0 && !prev.weekArchived) {
        nextHistory.push({
          id: prev.weekArchiveId || makeId(),
          league: prev.settings.leagueName,
          week: prev.settings.weekNumber,
          date: new Date().toISOString(),
          weekNotes: prev.weekNotes || '',
          settings: { ...prev.settings },
          bowlers: JSON.parse(JSON.stringify(prev.bowlers)),
        });
      }

      const nextWeekNum = String((Number(prev.settings.weekNumber) || 0) + 1);
      return syncActiveLeagueInRegistry({
        ...prev,
        bowlers: [],
        history: nextHistory,
        settings: {
          ...prev.settings,
          weekNumber: nextWeekNum,
          topNote: '',
          bottomNote: '',
        },
        weekNotes: '',
        weekArchived: false,
        weekArchiveId: null,
      });
    });
    showToast(
      'Started new week! Previous scores and Week Notes were archived to Season History, and Master Roster was kept.',
      false,
      true
    );
  };

  const handleImportBackupJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { restoredState, summary } = parseUniversalBackupPayload(
          String(reader.result),
          appState
        );
        const synced = syncActiveLeagueInRegistry({
          ...restoredState,
          version: CURRENT_APP_VERSION,
        });
        pushUndoState(appState);
        lastSavedSnapshotRef.current = synced;
        setHasUnsavedChanges(false);
        hasUnsavedChangesRef.current = false;
        saveStateToCookieVault(synced, false);
        setAppState(synced);
        showToast(summary, false, true);
      } catch (err: unknown) {
        showToast(
          `Could not import backup: ${(err as Error)?.message || 'Invalid backup file.'}`,
          true
        );
      }
    };
    reader.readAsText(file);
  };

  const handleLoadArchivedWeek = (weekId: string) => {
    const target = appState.history.find((h) => h.id === weekId);
    if (!target) return;
    pushUndoState(appState);
    setAppState((prev) => ({
      ...prev,
      bowlers: JSON.parse(JSON.stringify(target.bowlers)),
      settings: {
        ...prev.settings,
        ...(target.settings || {}),
        leagueName: target.league || prev.settings.leagueName,
        weekNumber: target.week || prev.settings.weekNumber,
      },
      weekNotes: typeof target.weekNotes === 'string' ? target.weekNotes : '',
      weekArchived: true,
      weekArchiveId: target.id,
    }));
    setActiveTab('entry');
    showToast(`Loaded archived Week ${target.week} into active view.`, false, true);
  };

  const handleDeleteArchivedWeek = (weekId: string) => {
    pushUndoState(appState);
    setAppState((prev) => ({
      ...prev,
      history: prev.history.filter((h) => h.id !== weekId),
    }));
    showToast('Deleted archived week from history.', false, true);
  };

  const handleUpdateDuesRecord = (playerId: string, record: WeeklyDuesRecord) => {
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
    setAppState((prev) => ({
      ...prev,
      currentDues: {
        ...prev.currentDues,
        [playerId]: record,
      },
    }));
  };

  const handleMarkAllDuesPaid = () => {
    pushUndoState(appState);
    const nextDues: Record<string, WeeklyDuesRecord> = {};
    appState.roster.forEach((p) => {
      const existing = appState.currentDues[p.id];
      nextDues[p.id] = {
        playerId: p.id,
        playerName: p.name,
        team: p.team,
        status: 'paid',
        amountPaid: appState.settings.weeklyDuesPerBowler,
        sidePotStrike: existing?.sidePotStrike ?? false,
        sidePotHighGame: existing?.sidePotHighGame ?? false,
        notes: existing?.notes ?? '',
      };
    });
    setAppState((prev) => ({ ...prev, currentDues: nextDues }));
    showToast(`Marked all ${appState.roster.length} bowlers as Paid ($${appState.settings.weeklyDuesPerBowler}).`, false, true);
  };

  const handleUpdateSchedule = (newSchedule: LaneMatchup[]) => {
    pushUndoState(appState);
    setAppState((prev) =>
      syncActiveLeagueInRegistry({
        ...prev,
        schedule: newSchedule,
      })
    );
  };

  const handleUpdateBracketEntrants = (ids: string[]) => {
    setHasUnsavedChanges(true);
    hasUnsavedChangesRef.current = true;
    setAppState((prev) =>
      syncActiveLeagueInRegistry({
        ...prev,
        bracketEntrantIds: ids,
      })
    );
  };

  const handleSwitchLeague = (leagueId: string) => {
    const synced = syncActiveLeagueInRegistry(appState);
    const target = synced.allLeaguesRegistry?.[leagueId];
    if (!target) return;
    pushUndoState(appState);
    setAppState({
      ...target,
      version: synced.version,
      activeLeagueId: leagueId,
      allLeaguesRegistry: synced.allLeaguesRegistry,
    });
    showToast(`Switched active league to "${target.settings.leagueName}".`, false, true);
  };

  const handleCreateLeague = (
    leagueName: string,
    seasonName: string,
    scoringType: 'handicap' | 'scratch'
  ) => {
    pushUndoState(appState);
    const synced = syncActiveLeagueInRegistry(appState);
    const slug =
      leagueName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36).slice(-4);

    const newLeagueState: Omit<AppState, 'allLeaguesRegistry'> = {
      version: synced.version,
      settings: {
        ...DEFAULT_SETTINGS,
        leagueId: slug,
        leagueStatus: 'active',
        leagueName,
        seasonName,
        weekNumber: '1',
        scoringType,
        autoBackupEnabled: synced.settings.autoBackupEnabled,
        autoBackupInterval: synced.settings.autoBackupInterval,
        autoBackupFormat: synced.settings.autoBackupFormat,
        autoBackupDirectoryLabel: synced.settings.autoBackupDirectoryLabel,
        lastLocalBackupAt: synced.settings.lastLocalBackupAt,
        lastAutoBackupAt: synced.settings.lastAutoBackupAt,
      },
      bowlers: [],
      roster: [],
      history: [],
      currentDues: {},
      schedule: generateRoundRobinSchedule(['Team 1', 'Team 2', 'Team 3', 'Team 4'], 1, 12),
      bracketEntrantIds: [],
      weekNotes: '',
      weekArchived: false,
      weekArchiveId: null,
      activeLeagueId: slug,
    };

    const nextRegistry = {
      ...(synced.allLeaguesRegistry || {}),
      [slug]: newLeagueState,
    };

    setAppState({
      ...newLeagueState,
      activeLeagueId: slug,
      allLeaguesRegistry: nextRegistry,
    });
    showToast(`Created new league "${leagueName}" and switched to it!`, false, true);
  };

  const handleToggleLeagueStatus = (leagueId: string) => {
    setAppState((prev) => {
      const synced = syncActiveLeagueInRegistry(prev);
      const target = synced.allLeaguesRegistry?.[leagueId];
      if (!target) return prev;
      const nextStatus: 'active' | 'inactive' =
        target.settings.leagueStatus === 'inactive' ? 'active' : 'inactive';
      const updatedTarget = {
        ...target,
        settings: {
          ...target.settings,
          leagueStatus: nextStatus,
        },
      };
      const nextRegistry = {
        ...(synced.allLeaguesRegistry || {}),
        [leagueId]: updatedTarget,
      };
      if (synced.activeLeagueId === leagueId) {
        return {
          ...synced,
          settings: updatedTarget.settings,
          allLeaguesRegistry: nextRegistry,
        };
      }
      return {
        ...synced,
        allLeaguesRegistry: nextRegistry,
      };
    });
  };

  const handleDeleteLeague = (leagueId: string) => {
    const synced = syncActiveLeagueInRegistry(appState);
    const registry = { ...(synced.allLeaguesRegistry || {}) };
    if (Object.keys(registry).length <= 1) {
      showToast('You must keep at least one league in the program.', true);
      return;
    }
    const targetName = registry[leagueId]?.settings?.leagueName || leagueId;
    delete registry[leagueId];
    const remainingIds = Object.keys(registry);
    const nextActiveId =
      synced.activeLeagueId === leagueId ? remainingIds[0] : synced.activeLeagueId!;
    const nextActiveState = registry[nextActiveId];
    pushUndoState(appState);
    setAppState({
      ...nextActiveState,
      activeLeagueId: nextActiveId,
      allLeaguesRegistry: registry,
    });
    showToast(`Deleted league "${targetName}".`, false, true);
  };

  const handleStartFreshResetAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('bowling_league_helper_state_v4');
      localStorage.removeItem('tnr_bowling_tracker_v3');
      clearCookieVault();
    } catch {
      // Ignore storage removal errors
    }
    desktopLastSaveExistsRef.current = false;
    desktopLastSavePathRef.current = null;
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    getDesktopBridge()?.clearLastSaveLink?.().catch(() => {});
    const fresh = createFreshInitialState();
    lastSavedSnapshotRef.current = fresh;
    setUndoStack([]);
    setAppState(fresh);
    setActiveTab('entry');
    showToast('Started fresh! Cleared all sample & prior data into a clean Week 1 league.');
  };

  const handleRecordBackupTimestamp = (kind: 'local' | 'auto', locationLabel?: string) => {
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    if (kind === 'local' && locationLabel) {
      desktopLastSaveExistsRef.current = true;
      desktopLastSavePathRef.current = locationLabel;
    }
    const nowIso = new Date().toISOString();
    setAppState((prev) => {
      const next = syncActiveLeagueInRegistry({
        ...prev,
        settings: {
          ...prev.settings,
          ...(kind === 'local' ? { lastLocalBackupAt: nowIso } : { lastAutoBackupAt: nowIso }),
          ...(locationLabel ? { autoBackupDirectoryLabel: locationLabel } : {}),
        },
      });
      lastSavedSnapshotRef.current = next;
      saveStateToCookieVault(next, false);
      return next;
    });
  };

  const handleQuickSave = async () => {
    if (isQuickSaving) return;
    setIsQuickSaving(true);
    try {
      const res = await quickSaveLeagueFile(appStateRef.current, () => {
        showToast('No save file found. Please choose where to save.');
      });
      handleRecordBackupTimestamp('local', res.filePath || res.filename);
      showToast(`Saved "${res.filePath || res.filename}".`);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (!/cancel/i.test(msg)) {
        showToast(msg || 'Could not save league file.', true);
      }
    } finally {
      setIsQuickSaving(false);
    }
  };

  const latestAvailableVersion =
    compareSemverVersions(remoteManifest.latestVersion, LATEST_AVAILABLE_VERSION) >= 0
      ? remoteManifest.latestVersion
      : LATEST_AVAILABLE_VERSION;

  const hasAvailableUpdate =
    compareSemverVersions(latestAvailableVersion, CURRENT_APP_VERSION) > 0;

  const handleSafeExitProgram = async () => {
    // Always prompt if the user made changes since their last save (whether in Manual Only or On Closing Program mode)
    if (hasUnsavedChangesRef.current) {
      setCloseModalState({
        isOpen: true,
        promptMode: 'unsaved_changes',
        hasExistingSaveFile:
          desktopLastSaveExistsRef.current || hasConnectedAutoBackupHandle(),
        missingPath:
          desktopLastSavePathRef.current ||
          appStateRef.current.settings.autoBackupDirectoryLabel ||
          null,
        reason:
          'You made changes to your league since your last save. Would you like to save before closing?',
        isBusy: false,
      });
      return;
    }

    const autoSaveOnClose =
      appStateRef.current.settings.autoBackupEnabled !== false &&
      appStateRef.current.settings.autoBackupInterval === 'on_close';

    if (!autoSaveOnClose && (desktopLastSaveExistsRef.current || !hasMeaningfulLeagueData(appStateRef.current))) {
      closeHandledCleanlyRef.current = true;
      await forceCloseProgramWithoutSaving();
      if (!getDesktopBridge()) {
        showToast('All changes are already saved. Ready to close safely.');
      } else {
        window.close();
      }
      return;
    }

    const result = await verifyAndSaveBeforeClose(appStateRef.current);
    if (result.ok) {
      closeHandledCleanlyRef.current = true;
      desktopLastSaveExistsRef.current = true;
      setHasUnsavedChanges(false);
      hasUnsavedChangesRef.current = false;
      if (result.savedPath) {
        handleRecordBackupTimestamp('local', result.savedPath);
      }
      if (!getDesktopBridge()) {
        showToast(
          `Auto-saved directly to "${result.savedPath || 'last save file'}". Ready to close safely.`
        );
      } else {
        window.close();
      }
      return;
    }

    desktopLastSaveExistsRef.current = false;
    setCloseModalState({
      isOpen: true,
      promptMode: 'missing_file',
      hasExistingSaveFile: false,
      missingPath: result.missingPath || null,
      reason:
        result.reason ||
        'Cannot find your last save file. Pick a new save location or choose Don\'t Save.',
      isBusy: false,
    });
  };

  const handleSaveToExistingAndClose = async () => {
    setCloseModalState((prev) => ({ ...prev, isBusy: true }));
    const result = await verifyAndSaveBeforeClose(appStateRef.current);
    if (result.ok) {
      closeHandledCleanlyRef.current = true;
      closeInFlightRef.current = false;
      desktopLastSaveExistsRef.current = true;
      setHasUnsavedChanges(false);
      hasUnsavedChangesRef.current = false;
      if (result.savedPath) {
        handleRecordBackupTimestamp('local', result.savedPath);
      }
      setCloseModalState({
        isOpen: false,
        promptMode: 'missing_file',
        hasExistingSaveFile: false,
        missingPath: null,
        reason: '',
        isBusy: false,
      });
      if (!getDesktopBridge()) {
        showToast(
          `Saved changes to "${result.savedPath || 'save file'}". Ready to close safely.`
        );
      } else {
        window.close();
      }
      return;
    }
    // If existing file was missing, fall back to picking a save location
    await handleClosePickNewLocation();
  };

  const handleClosePickNewLocation = async () => {
    setCloseModalState((prev) => ({ ...prev, isBusy: true }));
    const res = await pickNewSaveLocationAndFinishClose(appStateRef.current);
    if (res.closed) {
      closeHandledCleanlyRef.current = true;
      closeInFlightRef.current = false;
      desktopLastSaveExistsRef.current = true;
      setHasUnsavedChanges(false);
      hasUnsavedChangesRef.current = false;
      if (res.filePath) {
        handleRecordBackupTimestamp('local', res.filePath);
      }
      setCloseModalState({
        isOpen: false,
        promptMode: 'missing_file',
        hasExistingSaveFile: false,
        missingPath: null,
        reason: '',
        isBusy: false,
      });
      if (!getDesktopBridge()) {
        showToast(
          `Saved to "${res.filePath || 'new save file'}". Ready to close safely.`
        );
      } else {
        window.close();
      }
      return;
    }
    setCloseModalState((prev) => ({ ...prev, isBusy: false }));
    if (res.error) {
      showToast(res.error, true);
    }
  };

  const handleCloseDontSave = async () => {
    closeHandledCleanlyRef.current = true;
    setHasUnsavedChanges(false);
    hasUnsavedChangesRef.current = false;
    // Revert storage mirrors to the last explicitly saved snapshot so discarded edits do not persist
    try {
      const reverted = syncActiveLeagueInRegistry(lastSavedSnapshotRef.current);
      const raw = JSON.stringify(reverted);
      localStorage.setItem(STORAGE_KEY, raw);
      localStorage.setItem('bowling_league_helper_state_v4', raw);
      localStorage.setItem('tnr_bowling_tracker_v3', raw);
      saveStateToCookieVault(reverted, false);
      setAppState(reverted);
    } catch {
      // Ignore storage error
    }
    setCloseModalState((prev) => ({ ...prev, isBusy: true }));
    await forceCloseProgramWithoutSaving();
    closeInFlightRef.current = false;
    setCloseModalState({
      isOpen: false,
      promptMode: 'missing_file',
      hasExistingSaveFile: false,
      missingPath: null,
      reason: '',
      isBusy: false,
    });
    if (!getDesktopBridge()) {
      showToast('Discarded unsaved changes and reverted to last saved state.');
    } else {
      window.close();
    }
  };

  const handleCloseCancel = async () => {
    closeInFlightRef.current = false;
    await cancelPendingClose();
    setCloseModalState({
      isOpen: false,
      promptMode: 'missing_file',
      hasExistingSaveFile: false,
      missingPath: null,
      reason: '',
      isBusy: false,
    });
  };

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <div className="min-h-screen bg-slate-200/70 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract: 3 Zones separated by gap-8 (Single-Line Brand, 5 Nav Links, 1 Primary Action) */}
      <header className="bg-slate-900 text-white border-b-2 border-slate-800 px-6 py-3.5 sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Title */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              switchTab('entry');
            }}
            className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Bowling League Helper
          </a>

          {/* Zone 2: 5 Single-Line Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-6 text-xs font-semibold"
            aria-label="Primary Workspace Navigation"
          >
            <button
              type="button"
              onClick={() => switchTab('entry')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'entry'
                  ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              1. Quick Score Entry
            </button>
            <button
              type="button"
              onClick={() => switchTab('analytics')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              2. Averages & High Scores
            </button>
            <button
              type="button"
              onClick={() => switchTab('brackets')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'brackets'
                  ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              3. Brackets
            </button>
            <button
              type="button"
              onClick={() => switchTab('treasury')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'treasury'
                  ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              4. Dues & Treasurer
            </button>
            <button
              type="button"
              onClick={() => switchTab('schedule')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'schedule'
                  ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              5. Schedule & League Hub
            </button>
          </nav>

          {/* Zone 3: Open, Quick Save, Update & Exit Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={openFileInputRef}
              type="file"
              accept=".json,.html,.htm,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportBackupJson(file);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => openFileInputRef.current?.click()}
              title="Open an existing BowlingLeagueTrackerSave.json or backup file"
              className="px-3 py-2 text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open</span>
            </button>
            <button
              type="button"
              onClick={handleQuickSave}
              disabled={isQuickSaving}
              title={
                appState.settings.autoBackupDirectoryLabel
                  ? `Save directly to ${appState.settings.autoBackupDirectoryLabel}${hasUnsavedChanges ? ' (Unsaved changes)' : ''}`
                  : 'Save BowlingLeagueTrackerSave.json'
              }
              className={`px-3.5 py-2 text-xs font-bold text-white ${
                hasUnsavedChanges
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              } disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isQuickSaving ? 'Saving...' : hasUnsavedChanges ? 'Save *' : 'Save'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                v{appState.version} · {hasAvailableUpdate ? `Update to v${latestAvailableVersion}` : 'Updates & Patch Notes'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleSafeExitProgram}
              title="Save & Close Bowling League Helper"
              className="px-3 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-red-900/80 hover:text-white border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Bar (Shown on screens < md) */}
      <div className="md:hidden bg-white border-b-2 border-slate-300 px-3 py-2 flex items-center gap-1 overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => switchTab('entry')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 ${
            activeTab === 'entry' ? 'bg-slate-900 text-white' : 'text-slate-700'
          }`}
        >
          Score Entry
        </button>
        <button
          type="button"
          onClick={() => switchTab('analytics')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 ${
            activeTab === 'analytics' ? 'bg-slate-900 text-white' : 'text-slate-700'
          }`}
        >
          Averages & Highs
        </button>
        <button
          type="button"
          onClick={() => switchTab('brackets')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 ${
            activeTab === 'brackets' ? 'bg-slate-900 text-white' : 'text-slate-700'
          }`}
        >
          Brackets
        </button>
        <button
          type="button"
          onClick={() => switchTab('treasury')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 ${
            activeTab === 'treasury' ? 'bg-slate-900 text-white' : 'text-slate-700'
          }`}
        >
          Dues & Billing
        </button>
        <button
          type="button"
          onClick={() => switchTab('schedule')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 ${
            activeTab === 'schedule' ? 'bg-slate-900 text-white' : 'text-slate-700'
          }`}
        >
          Lanes & Hub
        </button>
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 print:hidden">
        {activeTab === 'entry' && (
          <QuickEntryTab
            appState={appState}
            canUndo={undoStack.length > 0}
            onUpdateSettings={handleUpdateSettings}
            onUpdateWeekNotes={handleUpdateWeekNotes}
            onAddOrUpdateBowler={handleAddOrUpdateBowler}
            onDeleteBowler={handleDeleteBowler}
            onMarkAbsent={handleMarkAbsent}
            onAddRosterPlayer={handleAddRosterPlayer}
            onDeleteRosterPlayer={handleDeleteRosterPlayer}
            onUndo={handleUndo}
            onStartNewWeek={handleStartNewWeek}
            onFinishWeekAndArchive={handleFinishWeekAndArchive}
            onSwitchLeague={handleSwitchLeague}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            appState={appState}
            onUpdateSettings={handleUpdateSettings}
            onLoadArchivedWeek={handleLoadArchivedWeek}
            onDeleteArchivedWeek={handleDeleteArchivedWeek}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'brackets' && (
          <BracketsTab
            appState={appState}
            onUpdateSettings={handleUpdateSettings}
            onUpdateBracketEntrants={handleUpdateBracketEntrants}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'treasury' && (
          <TreasuryTab
            appState={appState}
            onUpdateSettings={handleUpdateSettings}
            onUpdateDuesRecord={handleUpdateDuesRecord}
            onMarkAllDuesPaid={handleMarkAllDuesPaid}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            appState={appState}
            onUpdateSettings={handleUpdateSettings}
            onUpdateSchedule={handleUpdateSchedule}
            onSwitchLeague={handleSwitchLeague}
            onCreateLeague={handleCreateLeague}
            onToggleLeagueStatus={handleToggleLeagueStatus}
            onDeleteLeague={handleDeleteLeague}
            onImportBackupFile={handleImportBackupJson}
            onRecordBackupTimestamp={handleRecordBackupTimestamp}
            onStartFreshResetAll={handleStartFreshResetAll}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Bottom Quick-Week Jumper Strip + Clean Footer */}
      <footer className="max-w-7xl w-full mx-auto px-6 py-4 border-t-2 border-slate-300 text-xs text-slate-600 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white border-2 border-slate-300 rounded-xl px-4 py-2.5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Calendar className="w-3.5 h-3.5 text-blue-700" />
            <span>Quick Week Navigation ({appState.settings.seasonName}):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {appState.history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => handleLoadArchivedWeek(h.id)}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold cursor-pointer transition-colors"
              >
                Week {h.week}
              </button>
            ))}
            <span className="px-2.5 py-1 rounded-md bg-emerald-700 text-white font-bold">
              Week {appState.settings.weekNumber || '1'} (Active)
            </span>
            <button
              type="button"
              onClick={handleStartNewWeek}
              className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-semibold cursor-pointer transition-colors"
            >
              Advance to Week {(Number(appState.settings.weekNumber) || 1) + 1} →
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div>
              Bowling League Helper · {appState.settings.leagueName || 'My Bowling League'} · Version {appState.version}
              {getDesktopBridge() ? ` · Desktop Program (${desktopInstallDir})` : ' · Auto-saved locally'}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Auto-Save File: {appState.settings.autoBackupDirectoryLabel || 'Not set yet (will prompt on close)'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await saveLeagueFileToComputer(appState);
                  handleRecordBackupTimestamp('local', res.filePath || res.filename);
                  showToast(
                    `Saved "${res.filePath || res.filename}". Future closes will auto-save to this file.`
                  );
                } catch {
                  // Cancelled
                }
              }}
              className="font-semibold text-slate-800 hover:text-blue-700 cursor-pointer"
            >
              Save New File (.json)...
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleSafeExitProgram}
              className="inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-red-700 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Save &amp; Close
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              Check for Updates &amp; Patch Notes
            </button>
            <span>·</span>
            <a
              href={OFFICIAL_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-700 hover:text-slate-950 hover:underline"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>

      {/* Update & Patch Notes Popup Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        appState={appState}
        remoteManifest={remoteManifest}
        onUpdateManifest={(manifest) => {
          setRemoteManifest(manifest);
        }}
        onShowToast={showToast}
      />

      {/* Save-On-Close Recovery & Unsaved Changes Modal */}
      <CloseSaveModal
        isOpen={closeModalState.isOpen}
        promptMode={closeModalState.promptMode}
        hasExistingSaveFile={closeModalState.hasExistingSaveFile}
        missingPath={closeModalState.missingPath}
        reason={closeModalState.reason}
        isBusy={closeModalState.isBusy}
        onSaveToExistingAndClose={handleSaveToExistingAndClose}
        onPickNewSaveLocation={handleClosePickNewLocation}
        onDontSaveAndClose={handleCloseDontSave}
        onCancel={handleCloseCancel}
      />

      {/* Landscape Print Standing Sheet (Only visible when printing) */}
      <PrintStandingSheet appState={appState} />

      {/* Toast Notification with Direct Inline Undo Button */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-lg shadow-lg text-xs font-semibold text-white transition-all print:hidden flex items-center justify-between gap-3 ${
            toast.isError ? 'bg-red-800' : 'bg-slate-900'
          }`}
        >
          <span>{toast.message}</span>
          {toast.showUndo && undoStack.length > 0 && !toast.isError && (
            <button
              type="button"
              onClick={handleUndo}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded cursor-pointer shrink-0 transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
