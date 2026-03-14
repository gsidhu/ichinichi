import { useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncedRepositoryFactories } from "../domain/notes/repositoryFactory";
import type { E2eeServiceFactory } from "../domain/crypto/e2eeService";
import { createSyncedNoteRepository } from "../domain/notes/syncedNoteRepository";
import { createNoteCrypto } from "../domain/crypto/noteCrypto";
import { createNoteSyncEngine } from "../domain/sync/noteSyncEngine";
import { createRemoteNotesGateway } from "../storage/remoteNotesGateway";
import { syncEncryptedImages } from "../storage/unifiedImageSyncService";
import { createUnifiedSyncedImageRepository } from "../storage/unifiedSyncedImageRepository";
import { runtimeClock, runtimeConnectivity } from "../storage/runtimeAdapters";
import { syncStateStore } from "../storage/syncStateStore";

/**
 * Creates gateway/crypto/engine wiring for synced repositories.
 * Memoized on supabase + e2eeFactory identity.
 */
export function useSyncedFactories(
  supabase: SupabaseClient,
  e2eeFactory: E2eeServiceFactory,
): SyncedRepositoryFactories {
  return useMemo<SyncedRepositoryFactories>(
    () => ({
      createSyncedNoteRepository: ({
        userId,
        keyProvider,
        envelopePort,
        remoteDateIndex,
      }) => {
        const gateway = createRemoteNotesGateway(supabase, userId);
        const e2ee = e2eeFactory.create(keyProvider);
        const crypto = createNoteCrypto(e2ee);
        const engine = createNoteSyncEngine(
          gateway,
          keyProvider.activeKeyId,
          () => syncEncryptedImages(supabase, userId),
          runtimeConnectivity,
          runtimeClock,
          syncStateStore,
          envelopePort,
          remoteDateIndex,
        );
        return createSyncedNoteRepository(
          crypto,
          engine,
          envelopePort,
          remoteDateIndex,
        );
      },
      createSyncedImageRepository: ({ userId, keyProvider }) =>
        createUnifiedSyncedImageRepository(supabase, userId, keyProvider),
      e2eeFactory,
    }),
    [e2eeFactory, supabase],
  );
}
