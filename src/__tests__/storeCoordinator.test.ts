import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { createStoreCoordinator } from "../stores/storeCoordinator";
import type { NoteContentStore } from "../stores/noteContentStore";
import type { SyncStore } from "../stores/syncStore";

function createMockContentStore() {
  return createStore()(() => ({
    date: "2026-01-10",
    hasEdits: false,
    status: "ready" as const,
    reloadFromLocal: vi.fn().mockResolvedValue(undefined),
    forceRefresh: vi.fn(),
  })) as unknown as NoteContentStore;
}

function createMockSyncStore(): SyncStore {
  const state = {
    syncCompletionCount: 0,
    lastRealtimeChangedDate: null as string | null,
    clearRealtimeChanged: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createStore<any>()(subscribeWithSelector(() => state)) as SyncStore;
}

describe("storeCoordinator", () => {
  it("reloads content from local on sync completion", async () => {
    const contentStore = createMockContentStore();
    const ss = createMockSyncStore();

    const cleanup = createStoreCoordinator(ss, contentStore);

    ss.setState({ syncCompletionCount: 1 });
    await new Promise((r) => setTimeout(r, 10));

    expect(contentStore.getState().reloadFromLocal).toHaveBeenCalled();
    cleanup();
  });

  it("skips reload when content has local edits", async () => {
    const contentStore = createMockContentStore();
    contentStore.setState({ hasEdits: true });
    const ss = createMockSyncStore();

    const cleanup = createStoreCoordinator(ss, contentStore);

    ss.setState({ syncCompletionCount: 1 });
    await new Promise((r) => setTimeout(r, 10));

    expect(contentStore.getState().reloadFromLocal).not.toHaveBeenCalled();
    cleanup();
  });

  it("force-refreshes on realtime change matching current date", async () => {
    const contentStore = createMockContentStore();
    const ss = createMockSyncStore();

    const cleanup = createStoreCoordinator(ss, contentStore);

    ss.setState({ lastRealtimeChangedDate: "2026-01-10" });
    await new Promise((r) => setTimeout(r, 10));

    expect(contentStore.getState().forceRefresh).toHaveBeenCalled();
    expect(ss.getState().clearRealtimeChanged).toHaveBeenCalled();
    cleanup();
  });

  it("ignores realtime change for different date", async () => {
    const contentStore = createMockContentStore();
    const ss = createMockSyncStore();

    const cleanup = createStoreCoordinator(ss, contentStore);

    ss.setState({ lastRealtimeChangedDate: "2026-02-15" });
    await new Promise((r) => setTimeout(r, 10));

    expect(contentStore.getState().forceRefresh).not.toHaveBeenCalled();
    cleanup();
  });
});
