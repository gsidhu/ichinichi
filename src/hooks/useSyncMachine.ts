import {
  assign,
  enqueueActions,
  fromCallback,
  setup,
  type ActorRefFrom,
} from "xstate";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { SyncStatus } from "../types";
import type { UnifiedSyncedNoteRepository } from "../domain/notes/hydratingSyncedNoteRepository";
import type { PendingOpsSummary, SyncService } from "../domain/sync";
import {
  createSyncIntentScheduler,
  createSyncService,
  getPendingOpsSummary,
} from "../domain/sync";
import { pendingOpsSource } from "../storage/pendingOpsSource";
import { createCancellableOperation } from "../utils/asyncHelpers";
import { formatSyncError } from "../utils/syncError";

const initialPendingOps: PendingOpsSummary = {
  notes: 0,
  images: 0,
  total: 0,
};

type SyncResourceEvent =
  | { type: "REQUEST_SYNC"; immediate: boolean }
  | { type: "REQUEST_IDLE_SYNC"; delayMs?: number }
  | { type: "SYNC_NOW" };

type PendingOpsPollerEvent = { type: "REFRESH" };

export type SyncMachineEvent =
  | {
      type: "INPUTS_CHANGED";
      repository: UnifiedSyncedNoteRepository | null;
      enabled: boolean;
      online: boolean;
      userId: string | null;
      supabase: SupabaseClient | null;
    }
  | { type: "REQUEST_SYNC"; immediate?: boolean }
  | { type: "REQUEST_IDLE_SYNC"; delayMs?: number }
  | { type: "SYNC_REQUESTED"; intent: { immediate: boolean } }
  | { type: "SYNC_STARTED" }
  | { type: "SYNC_FINISHED"; status: SyncStatus }
  | { type: "SYNC_FAILED"; error: string }
  | { type: "PENDING_OPS_REFRESHED"; summary: PendingOpsSummary }
  | { type: "PENDING_OPS_FAILED" }
  | { type: "REALTIME_NOTE_CHANGED"; date: string }
  | { type: "REALTIME_CONNECTED" }
  | { type: "REALTIME_DISCONNECTED" }
  | { type: "CLEAR_REALTIME_CHANGED" }
  | { type: "WINDOW_FOCUSED" };

interface SyncMachineContext {
  repository: UnifiedSyncedNoteRepository | null;
  enabled: boolean;
  online: boolean;
  userId: string | null;
  supabase: SupabaseClient | null;
  syncError: string | null;
  lastSynced: Date | null;
  pendingOps: PendingOpsSummary;
  status: SyncStatus;
  realtimeConnected: boolean;
  /** Date of the last note changed via realtime (for triggering note refresh) */
  lastRealtimeChangedDate: string | null;
  /** Monotonically increasing counter of completed syncs (immune to React batching) */
  syncCompletionCount: number;
}

const syncResourcesActor = fromCallback<
  SyncResourceEvent,
  { repository: UnifiedSyncedNoteRepository }
>(({ sendBack, receive, input }) => {
  const syncService: SyncService = createSyncService(
    input.repository,
    pendingOpsSource,
    {
      onSyncStart: () => {
        sendBack({ type: "SYNC_STARTED" });
      },
      onSyncComplete: (status) => {
        sendBack({ type: "SYNC_FINISHED", status });
      },
      onSyncError: (error) =>
        sendBack({
          type: "SYNC_FAILED",
          error: formatSyncError(error),
        }),
    },
  );

  const intentScheduler = createSyncIntentScheduler((event) => {
    if (event.type === "SYNC_REQUESTED") {
      sendBack({ type: "SYNC_REQUESTED", intent: event.intent });
    }
  }, pendingOpsSource);

  let currentSync: { cancel: () => void } | null = null;

  const runSyncNow = () => {
    if (currentSync) {
      currentSync.cancel();
    }
    const operation = createCancellableOperation(
      (signal) => {
        if (signal.aborted) {
          return Promise.resolve();
        }
        return syncService.syncNow();
      },
      {
        timeoutMs: 30000,
      },
    );
    currentSync = { cancel: operation.cancel };
    void operation.promise.finally(() => {
      if (currentSync?.cancel === operation.cancel) {
        currentSync = null;
      }
    });
  };

  receive((event) => {
    switch (event.type) {
      case "REQUEST_SYNC":
        intentScheduler.requestSync({ immediate: event.immediate });
        break;
      case "REQUEST_IDLE_SYNC":
        intentScheduler.requestIdleSync({ delayMs: event.delayMs });
        break;
      case "SYNC_NOW":
        runSyncNow();
        break;
    }
  });

  return () => {
    currentSync?.cancel();
    syncService.dispose();
    intentScheduler.dispose();
  };
});

const pendingOpsPollerActor = fromCallback<PendingOpsPollerEvent>(
  ({ sendBack, receive }) => {
    let disposed = false;
    const refresh = async () => {
      try {
        const summary = await getPendingOpsSummary(pendingOpsSource);
        if (!disposed) {
          sendBack({ type: "PENDING_OPS_REFRESHED", summary });
        }
      } catch {
        if (!disposed) {
          sendBack({ type: "PENDING_OPS_FAILED" });
        }
      }
    };

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 5000);

    receive((event) => {
      if (event.type === "REFRESH") {
        void refresh();
      }
    });

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  },
);

const PERIODIC_SYNC_INTERVAL_MS = 30_000;

const periodicSyncActor = fromCallback(({ sendBack }) => {
  const intervalId = window.setInterval(() => {
    sendBack({ type: "REQUEST_SYNC", immediate: true });
  }, PERIODIC_SYNC_INTERVAL_MS);
  return () => window.clearInterval(intervalId);
});

type RealtimeActorEvent = { type: "START"; userId: string } | { type: "STOP" };

const REALTIME_RETRY_MS = 5_000;

const realtimeActor = fromCallback<
  RealtimeActorEvent,
  { supabase: SupabaseClient | null }
>(({ sendBack, receive, input }) => {
  let channel: RealtimeChannel | null = null;
  let debounceTimer: number | null = null;
  let retryTimer: number | null = null;
  let currentUserId: string | null = null;
  let stopped = false;
  const DEBOUNCE_MS = 500;

  const cleanup = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    if (retryTimer) window.clearTimeout(retryTimer);
    debounceTimer = null;
    retryTimer = null;
    void channel?.unsubscribe();
    channel = null;
  };

  const subscribe = (userId: string) => {
    if (stopped || !input.supabase) return;

    // Clean up previous channel if any
    void channel?.unsubscribe();
    channel = null;

    channel = input.supabase
      .channel(`notes:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const record = payload.new as { date?: string } | undefined;
          if (!record?.date) return;

          if (debounceTimer) window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            sendBack({ type: "REALTIME_NOTE_CHANGED", date: record.date! });
          }, DEBOUNCE_MS);
        },
      )
      .subscribe((status) => {
        if (stopped) return;
        if (status === "SUBSCRIBED") {
          sendBack({ type: "REALTIME_CONNECTED" });
        } else if (
          status === "CLOSED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          sendBack({ type: "REALTIME_DISCONNECTED" });
          // Schedule retry
          if (retryTimer) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            if (!stopped && currentUserId) {
              subscribe(currentUserId);
            }
          }, REALTIME_RETRY_MS);
        }
      });
  };

  receive((event) => {
    if (event.type === "START") {
      currentUserId = event.userId;
      subscribe(event.userId);
    } else if (event.type === "STOP") {
      stopped = true;
      currentUserId = null;
      cleanup();
    }
  });

  return () => {
    stopped = true;
    currentUserId = null;
    cleanup();
  };
});

type SyncResourcesActorRef = ActorRefFrom<typeof syncResourcesActor>;
type PendingOpsPollerActorRef = ActorRefFrom<typeof pendingOpsPollerActor>;
type RealtimeActorRef = ActorRefFrom<typeof realtimeActor>;

void (null as unknown as SyncResourcesActorRef);
void (null as unknown as PendingOpsPollerActorRef);
void (null as unknown as RealtimeActorRef);

export const syncMachine = setup({
  types: {
    context: {} as SyncMachineContext,
    events: {} as SyncMachineEvent,
  },
  actors: {
    syncResources: syncResourcesActor,
    pendingOpsPoller: pendingOpsPollerActor,
    realtimeActor: realtimeActor,
    periodicSync: periodicSyncActor,
  },
}).createMachine({
  id: "sync",
  initial: "disabled",
  context: {
    repository: null,
    enabled: false,
    online: false,
    userId: null,
    supabase: null,
    syncError: null,
    lastSynced: null,
    pendingOps: initialPendingOps,
    status: SyncStatus.Idle,
    realtimeConnected: false,
    lastRealtimeChangedDate: null,
    syncCompletionCount: 0,
  },
  states: {
    disabled: {
      id: "disabled",
      on: {
        INPUTS_CHANGED: [
          {
            guard: ({ event }) => !event.enabled || !event.repository,
            actions: assign(({ event }) => ({
              repository: event.repository,
              enabled: event.enabled,
              online: event.online,
              userId: event.userId,
              supabase: event.supabase,
            })),
          },
          {
            guard: ({ event }) =>
              event.enabled && !!event.repository && !event.online,
            target: "#offline",
            actions: assign(({ event }) => ({
              repository: event.repository,
              enabled: event.enabled,
              online: event.online,
              userId: event.userId,
              supabase: event.supabase,
              status: SyncStatus.Offline,
            })),
          },
          {
            target: "#initializing",
            actions: assign(({ event }) => ({
              repository: event.repository,
              enabled: event.enabled,
              online: event.online,
              userId: event.userId,
              supabase: event.supabase,
              status: SyncStatus.Idle,
            })),
          },
        ],
      },
    },
    active: {
      id: "active",
      entry: [
        assign({ syncError: null }),
        enqueueActions(({ context, system }) => {
          if (context.userId) {
            system.get("realtimeActor")?.send({ type: "START", userId: context.userId });
          }
        }),
      ],
      exit: enqueueActions(({ system }) => {
        system.get("realtimeActor")?.send({ type: "STOP" });
      }),
      invoke: [
        {
          id: "syncResources",
          systemId: "syncResources",
          src: "syncResources",
          input: ({ context }) => ({
            repository: context.repository as UnifiedSyncedNoteRepository,
          }),
        },
        {
          id: "pendingOpsPoller",
          systemId: "pendingOpsPoller",
          src: "pendingOpsPoller",
        },
        {
          id: "realtimeActor",
          systemId: "realtimeActor",
          src: "realtimeActor",
          input: ({ context }) => ({
            supabase: context.supabase,
          }),
        },
        {
          id: "periodicSync",
          src: "periodicSync",
        },
      ],
      on: {
        INPUTS_CHANGED: [
          {
            guard: ({ event }) => !event.enabled || !event.repository,
            target: "#disabled",
            actions: assign(({ event }) => ({
              repository: event.repository,
              enabled: event.enabled,
              online: event.online,
              userId: event.userId,
              supabase: event.supabase,
              pendingOps: initialPendingOps,
              syncError: null,
              status: SyncStatus.Idle,
              realtimeConnected: false,
              syncCompletionCount: 0,
            })),
          },
          {
            guard: ({ event }) =>
              event.enabled && !!event.repository && !event.online,
            target: "#offline",
            actions: assign(({ event }) => ({
              repository: event.repository,
              enabled: event.enabled,
              online: event.online,
              userId: event.userId,
              supabase: event.supabase,
              status: SyncStatus.Offline,
            })),
          },
          {
            guard: ({ context, event }) =>
              event.enabled &&
              !!event.repository &&
              event.online &&
              !context.online,
            target: "#initializing",
            actions: assign(({ event }) => ({
              repository: event.repository,
              enabled: event.enabled,
              online: event.online,
              userId: event.userId,
              supabase: event.supabase,
              status: SyncStatus.Idle,
              syncError: null,
            })),
          },
          {
            actions: assign(({ event }) => ({
              repository: event.repository,
              enabled: event.enabled,
              online: event.online,
              userId: event.userId,
              supabase: event.supabase,
            })),
          },
        ],
        REQUEST_SYNC: {
          actions: enqueueActions(({ event, system }) => {
            system.get("syncResources")?.send({
              type: "REQUEST_SYNC",
              immediate: Boolean(event.immediate),
            });
          }),
        },
        REQUEST_IDLE_SYNC: {
          actions: enqueueActions(({ event, system }) => {
            system.get("pendingOpsPoller")?.send({ type: "REFRESH" });
            system.get("syncResources")?.send({
              type: "REQUEST_IDLE_SYNC",
              delayMs: event.delayMs,
            });
          }),
        },
        SYNC_REQUESTED: {
          guard: ({ context }) => context.online,
          actions: enqueueActions(({ enqueue, system }) => {
            enqueue.assign({ status: SyncStatus.Syncing });
            system.get("syncResources")?.send({ type: "SYNC_NOW" });
          }),
        },
        SYNC_STARTED: {
          target: "#syncing",
          actions: assign({ status: SyncStatus.Syncing }),
        },
        SYNC_FINISHED: [
          {
            guard: ({ event }) => event.status === SyncStatus.Offline,
            target: "#offline",
            actions: [
              assign(({ event, context }) => ({
                status: event.status,
                syncError: null,
                lastSynced:
                  event.status === SyncStatus.Synced
                    ? new Date()
                    : context.lastSynced,
                syncCompletionCount: context.syncCompletionCount + 1,
              })),
              enqueueActions(({ system }) => {
                system.get("pendingOpsPoller")?.send({ type: "REFRESH" });
              }),
            ],
          },
          {
            guard: ({ event }) => event.status === SyncStatus.Error,
            target: "#error",
            actions: [
              assign(({ event, context }) => ({
                status: event.status,
                lastSynced:
                  event.status === SyncStatus.Synced
                    ? new Date()
                    : context.lastSynced,
                syncCompletionCount: context.syncCompletionCount + 1,
              })),
              enqueueActions(({ system }) => {
                system.get("pendingOpsPoller")?.send({ type: "REFRESH" });
              }),
            ],
          },
          {
            target: "#ready",
            actions: [
              assign(({ event, context }) => ({
                status: event.status,
                syncError: null,
                lastSynced:
                  event.status === SyncStatus.Synced ? new Date() : null,
                syncCompletionCount: context.syncCompletionCount + 1,
              })),
              enqueueActions(({ system }) => {
                system.get("pendingOpsPoller")?.send({ type: "REFRESH" });
              }),
            ],
          },
        ],
        SYNC_FAILED: {
          target: "#error",
          actions: [
            assign(({ event }) => ({
              status: SyncStatus.Error,
              syncError: event.error,
            })),
            enqueueActions(({ system }) => {
              system.get("pendingOpsPoller")?.send({ type: "REFRESH" });
            }),
          ],
        },
        PENDING_OPS_REFRESHED: {
          actions: assign(({ event }) => ({ pendingOps: event.summary })),
        },
        PENDING_OPS_FAILED: {
          actions: assign({ pendingOps: initialPendingOps }),
        },
        REALTIME_NOTE_CHANGED: {
          actions: [
            assign(({ event }) => ({ lastRealtimeChangedDate: event.date })),
            enqueueActions(({ system }) => {
              system.get("syncResources")?.send({ type: "REQUEST_SYNC", immediate: true });
              system.get("pendingOpsPoller")?.send({ type: "REFRESH" });
            }),
          ],
        },
        REALTIME_CONNECTED: {
          actions: [
            assign({ realtimeConnected: true }),
            // Sync on reconnect to catch missed events
            enqueueActions(({ system }) => {
              system.get("syncResources")?.send({ type: "REQUEST_SYNC", immediate: true });
            }),
          ],
        },
        REALTIME_DISCONNECTED: {
          actions: assign({ realtimeConnected: false }),
        },
        WINDOW_FOCUSED: {
          actions: enqueueActions(({ system }) => {
            system.get("syncResources")?.send({ type: "REQUEST_SYNC", immediate: true });
            system.get("pendingOpsPoller")?.send({ type: "REFRESH" });
          }),
        },
        CLEAR_REALTIME_CHANGED: {
          actions: assign({ lastRealtimeChangedDate: null }),
        },
      },
      initial: "initializing",
      states: {
        initializing: {
          id: "initializing",
          entry: enqueueActions(({ system }) => {
            system.get("syncResources")?.send({
              type: "REQUEST_SYNC",
              immediate: true,
            });
          }),
          always: { target: "#ready" },
        },
        offline: {
          id: "offline",
          entry: assign({ status: SyncStatus.Offline }),
        },
        ready: {
          id: "ready",
        },
        syncing: {
          id: "syncing",
        },
        error: {
          id: "error",
          entry: assign({ status: SyncStatus.Error }),
        },
      },
    },
  },
});
