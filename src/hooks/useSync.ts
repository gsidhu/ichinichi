import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SyncStatus } from "../types";
import type { PendingOpsSummary, Syncable } from "../domain/sync";
import type { SyncStore, SyncStoreState } from "../stores/syncStore";
import { formatSyncError } from "../utils/syncError";
import { useServiceContext } from "../contexts/serviceContext";

interface UseSyncReturn {
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSynced: Date | null;
  triggerSync: (options?: { immediate?: boolean }) => void;
  queueIdleSync: (options?: { delayMs?: number }) => void;
  pendingOps: PendingOpsSummary;
  realtimeConnected: boolean;
  /** Date of the last note changed via realtime subscription */
  lastRealtimeChangedDate: string | null;
  /** Clear the lastRealtimeChangedDate after consuming it */
  clearRealtimeChanged: () => void;
  /** Monotonically increasing counter of completed syncs */
  syncCompletionCount: number;
}

function useStoreSel<T>(
  store: SyncStore,
  selector: (state: SyncStoreState) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function useSync(
  repository: Syncable | null,
  options?: {
    enabled?: boolean;
    userId?: string | null;
    supabase?: SupabaseClient | null;
  },
): UseSyncReturn {
  const { syncStore: store } = useServiceContext();
  const syncEnabled = options?.enabled ?? !!repository;
  const userId = options?.userId ?? null;
  const supabase = options?.supabase ?? null;

  const prevRepoRef = useRef<Syncable | null>(null);
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    const repoChanged = repository !== prevRepoRef.current;
    const enabledChanged = syncEnabled !== prevEnabledRef.current;
    prevRepoRef.current = repository;
    prevEnabledRef.current = syncEnabled;

    if (syncEnabled && repository && userId && supabase) {
      if (repoChanged || enabledChanged) {
        store.getState().init({ repository, userId, supabase });
      }
    } else {
      if (!store.getState()._disposed) {
        store.getState().dispose();
      }
    }

    return () => {
      if (!store.getState()._disposed) {
        store.getState().dispose();
      }
    };
  }, [repository, syncEnabled, userId, supabase, store]);

  const syncStatus = useStoreSel(store, (s) => s.status);
  const syncError = useStoreSel(store, (s) =>
    s.syncError ? formatSyncError(s.syncError) : null,
  );
  const lastSynced = useStoreSel(store, (s) => s.lastSynced);
  const pendingOps = useStoreSel(store, (s) => s.pendingOps);
  const realtimeConnected = useStoreSel(store, (s) => s.realtimeConnected);
  const lastRealtimeChangedDate = useStoreSel(
    store,
    (s) => s.lastRealtimeChangedDate,
  );
  const syncCompletionCount = useStoreSel(
    store,
    (s) => s.syncCompletionCount,
  );

  const triggerSync = useCallback(
    (opts?: { immediate?: boolean }) => {
      store.getState().requestSync(opts);
    },
    [store],
  );

  const queueIdleSync = useCallback(
    (opts?: { delayMs?: number }) => {
      store.getState().queueIdleSync(opts);
    },
    [store],
  );

  const clearRealtimeChanged = useCallback(() => {
    store.getState().clearRealtimeChanged();
  }, [store]);

  return {
    syncStatus,
    syncError,
    lastSynced,
    triggerSync,
    queueIdleSync,
    pendingOps,
    realtimeConnected,
    lastRealtimeChangedDate,
    clearRealtimeChanged,
    syncCompletionCount,
  };
}
