import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { NoteRepository } from "../storage/noteRepository";
import {
  type SaveSnapshot,
  type NoteContentState as StoreState,
  type NoteContentStore,
} from "../stores/noteContentStore";
import type { RepositoryError } from "../domain/errors";
import { useServiceContext } from "../contexts/serviceContext";

export type { SaveSnapshot };

export interface UseNoteContentReturn {
  content: string;
  setContent: (content: string) => void;
  isDecrypting: boolean;
  hasEdits: boolean;
  /** True when the note is being saved (dirty or saving state) */
  isSaving: boolean;
  /** Timestamp of the last successful save */
  lastSavedAt: number | null;
  isContentReady: boolean;
  isOfflineStub: boolean;
  /** Error from loading/decrypting the note (e.g. DecryptFailed) */
  error: RepositoryError | null;
  /** Error from the last failed save attempt */
  saveError: RepositoryError | null;

}

// Zustand selectors for fine-grained re-renders
function useStoreSelector<T>(
  store: NoteContentStore,
  selector: (state: StoreState) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/**
 * Main hook for note content management.
 *
 * Thin wrapper over noteContentStore (Zustand vanilla store).
 * Composes local storage + remote refresh in a single store.
 */
export function useNoteContent(
  date: string | null,
  repository: NoteRepository | null,
  _hasNoteForDate?: (date: string) => boolean,
  onAfterSave?: (snapshot: SaveSnapshot) => void,
): UseNoteContentReturn {
  const { noteContentStore: store } = useServiceContext();

  // Track previous date/repository to detect changes
  const prevDateRef = useRef<string | null>(null);
  const prevRepoRef = useRef<NoteRepository | null>(null);

  // Keep afterSave callback in sync
  useEffect(() => {
    store.getState().setAfterSave(onAfterSave);
  }, [onAfterSave, store]);

  // Init / switchNote / dispose lifecycle
  useEffect(() => {
    if (!date || !repository) {
      // Dispose if we had something before
      if (prevDateRef.current || prevRepoRef.current) {
        void store.getState().dispose();
      }
      prevDateRef.current = null;
      prevRepoRef.current = null;
      return;
    }

    const dateChanged = date !== prevDateRef.current;
    const repoChanged = repository !== prevRepoRef.current;

    if (repoChanged) {
      // Repository changed — full re-init
      store.getState().init(date, repository, onAfterSave);
    } else if (dateChanged) {
      // Same repo, different date — switch note (flushes save first)
      void store.getState().switchNote(date);
    }

    prevDateRef.current = date;
    prevRepoRef.current = repository;

    return () => {
      void store.getState().dispose();
      prevDateRef.current = null;
      prevRepoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, repository]);

  // Subscribe to store slices for fine-grained re-renders
  const content = useStoreSelector(store, (s) => s.content);
  const hasEdits = useStoreSelector(store, (s) => s.hasEdits);
  const isSaving = useStoreSelector(store, (s) => s.isSaving);
  const lastSavedAt = useStoreSelector(store, (s) => s.lastSavedAt);
  const status = useStoreSelector(store, (s) => s.status);
  const error = useStoreSelector(store, (s) => s.error);
  const saveError = useStoreSelector(store, (s) => s.saveError);

  const isReady =
    status === "ready" || status === "error";
  // Treat "date set but no repository yet" as loading so the editor
  // shows "Decrypting..." while the vault is still unlocking.
  const isLoading =
    status === "loading" || (date !== null && repository === null);

  // Determine offline stub
  const isOfflineStub = false;

  const setContent = useCallback(
    (newContent: string) => store.getState().setContent(newContent),
    [store],
  );


  return {
    content,
    setContent,
    isDecrypting: isLoading,
    hasEdits,
    isSaving,
    lastSavedAt,
    isContentReady: isReady,
    isOfflineStub,
    error,
    saveError,
  };
}
