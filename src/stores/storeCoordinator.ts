import type { NoteContentStore } from "./noteContentStore";
import type { SyncStore } from "./syncStore";

/**
 * Coordinates cross-store subscriptions between syncStore and
 * noteContentStore. Returns a cleanup function.
 *
 * - Sync completion -> reload note from local (sync updated IndexedDB)
 * - Realtime change -> force-refresh if it matches current note
 */
export function createStoreCoordinator(
  syncStore: SyncStore,
  contentStore: NoteContentStore,
): () => void {
  const unsubSync = syncStore.subscribe(
    (s) => s.syncCompletionCount,
    () => {
      const ns = contentStore.getState();
      if (
        ns.date &&
        !ns.hasEdits &&
        (ns.status === "ready" || ns.status === "error")
      ) {
        void ns.reloadFromLocal();
      }
    },
  );

  const unsubRealtime = syncStore.subscribe(
    (s) => s.lastRealtimeChangedDate,
    (changedDate) => {
      if (!changedDate) return;
      const ns = contentStore.getState();
      if (
        changedDate === ns.date &&
        !ns.hasEdits &&
        (ns.status === "ready" || ns.status === "error")
      ) {
        ns.forceRefresh();
        syncStore.getState().clearRealtimeChanged();
      }
    },
  );

  return () => {
    unsubSync();
    unsubRealtime();
  };
}
