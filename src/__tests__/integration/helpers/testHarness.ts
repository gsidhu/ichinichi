import {
  createNoteContentStore,
  type NoteContentStore,
  type ConnectivitySource,
} from "../../../stores/noteContentStore";
import {
  createSyncStore,
  type SyncStore,
} from "../../../stores/syncStore";
import { createStoreCoordinator } from "../../../stores/storeCoordinator";
import type { PendingOpsSource } from "../../../domain/sync/pendingOpsSource";

interface MockConnectivity extends ConnectivitySource {
  setOnline(online: boolean): void;
  subscribe(listener: (online: boolean) => void): () => void;
}

export function createMockConnectivity(
  initialOnline = true,
): MockConnectivity {
  let online = initialOnline;
  const listeners = new Set<(online: boolean) => void>();
  return {
    getOnline: () => online,
    setOnline(value: boolean) {
      online = value;
      listeners.forEach((l) => l(value));
    },
    subscribe(listener: (online: boolean) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createMockPendingOpsSource(): PendingOpsSource {
  return {
    getSummary: vi.fn().mockResolvedValue({
      notes: 0,
      images: 0,
      total: 0,
    }),
    hasPending: vi.fn().mockResolvedValue(false),
  };
}

export interface TestHarness {
  contentStore: NoteContentStore;
  syncStore: SyncStore;
  connectivity: MockConnectivity;
  pendingOpsSource: PendingOpsSource;
  disposeCoordinator: () => void;
  dispose: () => Promise<void>;
}

export function createTestHarness(options?: {
  online?: boolean;
}): TestHarness {
  const connectivity = createMockConnectivity(options?.online ?? true);
  const pendingOpsSource = createMockPendingOpsSource();
  const contentStore = createNoteContentStore({ connectivity });
  const syncStore = createSyncStore({ connectivity, pendingOpsSource });
  const disposeCoordinator = createStoreCoordinator(
    syncStore,
    contentStore,
  );

  return {
    contentStore,
    syncStore,
    connectivity,
    pendingOpsSource,
    disposeCoordinator,
    async dispose() {
      disposeCoordinator();
      await contentStore.getState().dispose();
      syncStore.getState().dispose();
    },
  };
}
