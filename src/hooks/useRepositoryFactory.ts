import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteRepository } from "../storage/noteRepository";
import type { ImageRepository } from "../storage/imageRepository";
import type { SyncedRepositoryFactories } from "../domain/notes/repositoryFactory";
import {
  createNoteRepository,
  createImageRepository,
} from "../domain/notes/repositoryFactory";
import { createNoteEnvelopeAdapter } from "../storage/noteEnvelopeAdapter";
import { createRemoteDateIndexAdapter } from "../storage/remoteDateIndexAdapter";
import { AppMode } from "./useAppMode";

interface UseRepositoryFactoryProps {
  mode: AppMode;
  userId: string | null;
  vaultKey: CryptoKey | null;
  keyring: Map<string, CryptoKey>;
  activeKeyId: string | null;
  syncedFactories: SyncedRepositoryFactories;
}

export interface UseRepositoryFactoryReturn {
  repository: NoteRepository | null;
  imageRepository: ImageRepository | null;
  repositoryVersion: number;
  invalidateRepository: () => void;
}

export function useRepositoryFactory({
  mode,
  userId,
  vaultKey,
  keyring,
  activeKeyId,
  syncedFactories,
}: UseRepositoryFactoryProps): UseRepositoryFactoryReturn {
  const [repositoryVersion, setRepositoryVersion] = useState(0);
  const invalidateRepository = useCallback(() => {
    setRepositoryVersion((current) => current + 1);
  }, []);

  const envelopePort = useMemo(() => createNoteEnvelopeAdapter(), []);
  const remoteDateIndex = useMemo(
    () => createRemoteDateIndexAdapter(),
    [],
  );

  // Ref keeps keyProvider.getKey() reading the latest keyring without
  // recreating the repository on every keyring reference change.
  const keyringRef = useRef(keyring);
  useEffect(() => {
    keyringRef.current = keyring;
  }, [keyring]);

  const repository = useMemo<NoteRepository | null>(() => {
    if (!vaultKey || !activeKeyId) return null;
    void repositoryVersion;
    const keyProvider = {
      activeKeyId,
      getKey: (keyId: string) => keyringRef.current.get(keyId) ?? null,
    };

    // getKey reads the ref at I/O time (decrypt), never during render
    // eslint-disable-next-line react-hooks/refs
    return createNoteRepository({
      mode,
      userId,
      keyProvider,
      envelopePort,
      remoteDateIndex,
      syncedFactories,
    });
  }, [
    mode,
    userId,
    vaultKey,
    activeKeyId,
    syncedFactories,
    envelopePort,
    remoteDateIndex,
    repositoryVersion,
  ]);

  const imageRepository = useMemo<ImageRepository | null>(() => {
    if (!vaultKey || !activeKeyId) return null;
    void repositoryVersion;
    const keyProvider = {
      activeKeyId,
      getKey: (keyId: string) => keyringRef.current.get(keyId) ?? null,
    };
    // eslint-disable-next-line react-hooks/refs
    return createImageRepository({
      mode,
      userId,
      keyProvider,
      syncedFactories,
    });
  }, [vaultKey, activeKeyId, mode, userId, syncedFactories, repositoryVersion]);

  return { repository, imageRepository, repositoryVersion, invalidateRepository };
}
