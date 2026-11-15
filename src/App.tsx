import React, { useState, useEffect } from 'react';
import {
  AppState,
  BowlerEntry,
  LaneMatchup,
  LeagueSettings,
  RosterPlayer,
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
import { createInitialSeedState } from './utils/seedData';
import { QuickEntryTab } from './components/QuickEntryTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { BracketsTab } from './components/BracketsTab';
import { TreasuryTab } from './components/TreasuryTab';
import { ScheduleTab } from './components/ScheduleTab';
import { UpdateModal } from './components/UpdateModal';
import { PrintStandingSheet } from './components/PrintStandingSheet';
import {
  executeAutoBackupWrite,
  hasConnectedAutoBackupHandle,
  saveLeagueFileToComputer,
} from './utils/fileExport';
import {
  RefreshCw,
  Calendar,
} from 'lucide-react';

const STORAGE_KEY = 'bowling_league_helper_state_v5';

type ActiveTab = 'entry' | 'analytics' | 'brackets' | 'treasury' | 'schedule';

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function syncActiveLeagueInRegistry(state: AppState): AppState {
  const activeId = state.activeLeagueId || state.settings.leagueId || 'thursday-night-rollers';
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
            version: parsed.version || CURRENT_APP_VERSION,
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
            weekArchiveId: parsed.weekArchiveId || null,
            activeLeagueId: parsed.activeLeagueId || parsed.settings?.leagueId || 'thursday-night-rollers',
            allLeaguesRegistry: parsed.allLeaguesRegistry || undefined,
          });
        }
      }
    } catch (e) {
      console.warn('Could not load saved bowling state, using initial seed data.', e);
    }
    return createInitialSeedState();
  });

  const [undoStack, setUndoStack] = useState<AppState[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('entry');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  // Sync to localStorage and legacy keys on every state change
  useEffect(() => {
    try {
      const synced = syncActiveLeagueInRegistry(appState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
      localStorage.setItem('bowling_league_helper_state_v4', JSON.stringify(synced));
      localStorage.setItem('tnr_bowling_tracker_v3', JSON.stringify(synced));
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

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
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
        : `Added ${entry.name} — Total: ${entry.grandTotal}.`
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
    showToast(`Removed ${target.name} from current week. Click Undo to restore.`);
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
    showToast(`Marked ${player.name} as Absent (${scratch} pts — ${absCalc.ruleDescription}).`);
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
    showToast(`Saved ${name} to Master Roster.`);
  };

  const handleDeleteRosterPlayer = (id: string) => {
    const target = appState.roster.find((r) => r.id === id);
    if (!target) return;
    pushUndoState(appState);
    setAppState((prev) => ({
      ...prev,
      roster: prev.roster.filter((r) => r.id !== id),
    }));
    showToast(`Removed ${target.name} from Master Roster.`);
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
        weekArchived: false,
        weekArchiveId: null,
      });
    });
    showToast('Started new week! Previous scores were archived to Season History, and Master Roster was kept.');
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
        showToast(summary);
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
      weekArchived: true,
      weekArchiveId: target.id,
    }));
    setActiveTab('entry');
    showToast(`Loaded archived Week ${target.week} into active view.`);
  };

  const handleDeleteArchivedWeek = (weekId: string) => {
    pushUndoState(appState);
    setAppState((prev) => ({
      ...prev,
      history: prev.history.filter((h) => h.id !== weekId),
    }));
    showToast('Deleted archived week from history.');
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
    showToast(`Marked all ${appState.roster.length} bowlers as Paid ($${appState.settings.weeklyDuesPerBowler}).`);
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
    showToast(`Switched active league to "${target.settings.leagueName}".`);
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
    showToast(`Created new league "${leagueName}" and switched to it!`);
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
    showToast(`Deleted league "${targetName}".`);
  };

  const handleRecordBackupTimestamp = (kind: 'local' | 'auto', locationLabel?: string) => {
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

  const handleUpgradeVersion = (newVersion: string) => {
    setAppState((prev) => {
      const synced = syncActiveLeagueInRegistry(prev);
      const updatedRegistry: NonNullable<AppState['allLeaguesRegistry']> = {};
      for (const [id, lg] of Object.entries(synced.allLeaguesRegistry || {})) {
        updatedRegistry[id] = {
          ...lg,
          version: newVersion,
          settings: { ...DEFAULT_SETTINGS, ...lg.settings },
        };
      }
      return {
        ...synced,
        version: newVersion,
        settings: { ...DEFAULT_SETTINGS, ...synced.settings },
        allLeaguesRegistry: updatedRegistry,
      };
    });
  };

  const hasAvailableUpdate = appState.version !== LATEST_AVAILABLE_VERSION;

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Bar Contract: 3 Zones separated by gap-8 (Single-Line Brand, 5 Nav Links, 1 Primary Action) */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-3.5 sticky top-0 z-40 print:hidden">
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
                v{appState.version} · {hasAvailableUpdate ? `Update to v${LATEST_AVAILABLE_VERSION}` : 'Updates & Patch Notes'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Bar (Shown on screens < md) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-1 overflow-x-auto print:hidden">
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
            onAddOrUpdateBowler={handleAddOrUpdateBowler}
            onDeleteBowler={handleDeleteBowler}
            onMarkAbsent={handleMarkAbsent}
            onAddRosterPlayer={handleAddRosterPlayer}
            onDeleteRosterPlayer={handleDeleteRosterPlayer}
            onUndo={handleUndo}
            onStartNewWeek={handleStartNewWeek}
            onFinishWeekAndArchive={handleFinishWeekAndArchive}
            onImportBackupJson={handleImportBackupJson}
            onSwitchLeague={handleSwitchLeague}
            onOpenLeagueAndBackupHub={() => switchTab('schedule')}
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
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Bottom Quick-Week Jumper Strip + Clean Footer */}
      <footer className="max-w-7xl w-full mx-auto px-6 py-4 border-t border-slate-200 text-xs text-slate-500 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3.5 py-2">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-blue-700" />
            <span>Quick Week Navigation ({appState.settings.seasonName}):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {appState.history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => handleLoadArchivedWeek(h.id)}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer transition-colors"
              >
                Week {h.week}
              </button>
            ))}
            <span className="px-2.5 py-1 rounded bg-emerald-700 text-white font-bold">
              Week {appState.settings.weekNumber || '4'} (Active)
            </span>
            <button
              type="button"
              onClick={handleStartNewWeek}
              className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-semibold cursor-pointer transition-colors"
            >
              Advance to Week {(Number(appState.settings.weekNumber) || 4) + 1} →
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            Bowling League Helper · {appState.settings.leagueName || 'Thursday Night Rollers'} · Version {appState.version} · Auto-saved locally in browser memory
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await saveLeagueFileToComputer(appState);
                  showToast(`Saved ${res.filename} to your computer.`);
                } catch {
                  // Cancelled
                }
              }}
              className="font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              Save Backup File to PC (.json)
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(true)}
              className="font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              Check for Updates & Patch Notes
            </button>
          </div>
        </div>
      </footer>

      {/* Update & Patch Notes Popup Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        appState={appState}
        onUpgradeVersion={handleUpgradeVersion}
        onShowToast={showToast}
      />

      {/* Landscape Print Standing Sheet (Only visible when printing) */}
      <PrintStandingSheet appState={appState} />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-lg shadow-lg text-xs font-semibold text-white transition-all print:hidden ${
            toast.isError ? 'bg-red-800' : 'bg-slate-900'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
