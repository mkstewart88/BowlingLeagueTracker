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
  saveLeagueFileToComputer,
  verifyAndSaveBeforeClose,
} from './utils/fileExport';
import { getDesktopBridge, serializeMasterSavePayload } from './utils/desktopBridge';
import {
  RefreshCw,
  Calendar,
  LogOut,
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

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const embeddedScript =
        typeof document !== 'undefined'
          ? document.getElementById('embedded-league-state')?.textContent
          : null;
      const rawSource = saved || embeddedScript;
      if (rawSource) {
        const parsed = JSON.parse(rawSource);
        if (parsed && Array.isArray(parsed.bowlers) && Array.isArray(parsed.roster)) {
          return syncActiveLeagueInRegistry({
            version: CURRENT_APP_VERSION,
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
            bowlers: parsed.bowlers,
            roster: parsed.roster,
            history: Array.isArray(parsed.history) ? parsed.history : [],
            currentDues: parsed.currentDues || {},
            schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [],
            bracketEntrantIds: Array.isArray(parsed.bracketEntrantIds)
              ? parsed.bracketEntrantIds
              : parsed.bowlers.filter((b: BowlerEntry) => !b.isAbsent).map((b: BowlerEntry) => b.id),
            weekArchived: Boolean(parsed.weekArchived),
            weekNotes: typeof parsed.weekNotes === 'string' ? parsed.weekNotes : '',
            weekArchiveId: parsed.weekArchiveId || null,
            activeLeagueId: parsed.activeLeagueId || parsed.settings?.leagueId || 'my-bowling-league',
            allLeaguesRegistry: parsed.allLeaguesRegistry || undefined,
          });
        }
      }
    } catch (e) {
      console.warn('Could not load saved bowling state, starting with a clean league.', e);
    }
    return createFreshInitialState();
  });

  const [undoStack, setUndoStack] = useState<AppState[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('entry');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [remoteManifest, setRemoteManifest] = useState<VersionManifest>(() =>
    getBuiltInFallbackManifest()
  );
  const [toast, setToast] = useState<{ message: string; isError: boolean; showUndo?: boolean } | null>(null);
  const [closeModalState, setCloseModalState] = useState<{
    isOpen: boolean;
    missingPath: string | null;
    reason: string;
    isBusy: boolean;
  }>({
    isOpen: false,
    missingPath: null,
    reason: '',
    isBusy: false,
  });

  const appStateRef = React.useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

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
  const [desktopInstallDir, setDesktopInstallDir] = useState<string>('C:\\BowlingLeagueHelper');

  // Register native desktop close interception + keep save-file status synced
  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) return;

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
    bridge.stageSavePayload?.(serializeMasterSavePayload(appStateRef.current)).catch(() => {});
    const statusPoll = setInterval(refreshDesktopSaveStatus, 4000);
    window.addEventListener('focus', refreshDesktopSaveStatus);

    const openMissingSavePrompt = (missingPath: string | null, reason?: string) => {
      setCloseModalState({
        isOpen: true,
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
        const result = await verifyAndSaveBeforeClose(appStateRef.current);
        if (result.ok) {
          closeHandledCleanlyRef.current = true;
          desktopLastSaveExistsRef.current = true;
        } else if (result.missing) {
          desktopLastSaveExistsRef.current = false;
          openMissingSavePrompt(result.missingPath || null, result.reason);
        } else {
          closeInFlightRef.current = false;
        }
      } catch {
        closeInFlightRef.current = false;
      }
    });

    const notifyDesktopWindowUnloading = () => {
      if (closeHandledCleanlyRef.current) return;
      const payload = serializeMasterSavePayload(appStateRef.current);
      if (desktopLastSaveExistsRef.current && typeof bridge.sendAutoSaveBeacon === 'function') {
        bridge.sendAutoSaveBeacon(payload);
      }
      if (typeof bridge.sendWindowUnloadedBeacon === 'function') {
        bridge.sendWindowUnloadedBeacon(payload);
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

  // Sync to localStorage and stage latest desktop save payload on every state change
  useEffect(() => {
    try {
      const synced = syncActiveLeagueInRegistry(appState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
      localStorage.setItem('bowling_league_helper_state_v4', JSON.stringify(synced));
      localStorage.setItem('tnr_bowling_tracker_v3', JSON.stringify(synced));

      const bridge = getDesktopBridge();
      if (bridge?.stageSavePayload) {
        const stageTimer = setTimeout(() => {
          bridge.stageSavePayload?.(serializeMasterSavePayload(synced)).catch(() => {});
        }, 150);
        return () => clearTimeout(stageTimer);
      }
    } catch (e) {
      console.error('Failed to persist state to localStorage:', e);
    }
  }, [appState]);

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
    setAppState((prev) =>
      syncActiveLeagueInRegistry({
        ...prev,
        settings: { ...prev.settings, ...partial },
        weekArchived: false,
      })
    );
  };

  const handleUpdateWeekNotes = (notes: string) => {
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
      if (editingId) {
        nextBowlers = prev.bowlers.map((b) =>
          b.id === editingId
            ? { ...b, ...entry, id: editingId }
            : b
        );
      } else {
        nextBowlers = [
          ...prev.bowlers,
          {
            ...entry,
            id: makeId(),
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

      return syncActiveLeagueInRegistry({
        ...prev,
        bowlers: nextBowlers,
        roster: nextRoster,
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
    setAppState((prev) => ({
      ...prev,
      bowlers: prev.bowlers.filter((b) => b.id !== id),
      weekArchived: false,
    }));
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

    setAppState((prev) => ({
      ...prev,
      bowlers: [...prev.bowlers, absentEntry],
      weekArchived: false,
    }));
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
      return { ...prev, roster: nextRoster };
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
        pushUndoState(appState);
        setAppState(syncActiveLeagueInRegistry(restoredState));
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
    } catch {
      // Ignore storage removal errors
    }
    const fresh = createFreshInitialState();
    setUndoStack([]);
    setAppState(fresh);
    setActiveTab('entry');
    showToast('Started fresh! Cleared all sample & prior data into a clean Week 1 league.');
  };

  const handleRecordBackupTimestamp = (kind: 'local' | 'auto', locationLabel?: string) => {
    if (kind === 'local' && locationLabel) {
      desktopLastSaveExistsRef.current = true;
      desktopLastSavePathRef.current = locationLabel;
    }
    const nowIso = new Date().toISOString();
    setAppState((prev) =>
      syncActiveLeagueInRegistry({
        ...prev,
        settings: {
          ...prev.settings,
          ...(kind === 'local' ? { lastLocalBackupAt: nowIso } : { lastAutoBackupAt: nowIso }),
          ...(locationLabel ? { autoBackupDirectoryLabel: locationLabel } : {}),
        },
      })
    );
  };

  const latestAvailableVersion =
    compareSemverVersions(remoteManifest.latestVersion, LATEST_AVAILABLE_VERSION) >= 0
      ? remoteManifest.latestVersion
      : LATEST_AVAILABLE_VERSION;

  const hasAvailableUpdate =
    compareSemverVersions(latestAvailableVersion, CURRENT_APP_VERSION) > 0;

  const handleSafeExitProgram = async () => {
    const result = await verifyAndSaveBeforeClose(appStateRef.current);
    if (result.ok) {
      closeHandledCleanlyRef.current = true;
      desktopLastSaveExistsRef.current = true;
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
      missingPath: result.missingPath || null,
      reason:
        result.reason ||
        'Cannot find your last save file. Pick a new save location or choose Don\'t Save.',
      isBusy: false,
    });
  };

  const handleClosePickNewLocation = async () => {
    setCloseModalState((prev) => ({ ...prev, isBusy: true }));
    const res = await pickNewSaveLocationAndFinishClose(appStateRef.current);
    if (res.closed) {
      closeHandledCleanlyRef.current = true;
      closeInFlightRef.current = false;
      desktopLastSaveExistsRef.current = true;
      if (res.filePath) {
        handleRecordBackupTimestamp('local', res.filePath);
      }
      setCloseModalState({ isOpen: false, missingPath: null, reason: '', isBusy: false });
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
    setCloseModalState((prev) => ({ ...prev, isBusy: true }));
    await forceCloseProgramWithoutSaving();
    closeInFlightRef.current = false;
    setCloseModalState({ isOpen: false, missingPath: null, reason: '', isBusy: false });
    if (!getDesktopBridge()) {
      showToast('Closed without saving to a backup file.');
    } else {
      window.close();
    }
  };

  const handleCloseCancel = async () => {
    closeInFlightRef.current = false;
    await cancelPendingClose();
    setCloseModalState({ isOpen: false, missingPath: null, reason: '', isBusy: false });
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

          {/* Zone 3: 1 Primary Action (Update & Version Control Button) */}
          <div className="flex items-center shrink-0">
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

      {/* Save-On-Close Recovery Modal when Last Save File Cannot Be Found */}
      <CloseSaveModal
        isOpen={closeModalState.isOpen}
        missingPath={closeModalState.missingPath}
        reason={closeModalState.reason}
        isBusy={closeModalState.isBusy}
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
