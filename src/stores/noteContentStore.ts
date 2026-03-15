import { createStore } from "zustand/vanilla";
import type { NoteRepository } from "../storage/noteRepository";
import { isNoteEmpty, isContentEmpty } from "../utils/sanitize";
import type { RepositoryError } from "../domain/errors";


export interface SaveSnapshot {
  date: string;
  content: string;
  isEmpty: boolean;
}

const SAVE_IDLE_DELAY_MS = 500;

export interface NoteContentState {
  // Core note
  status: "idle" | "loading" | "ready" | "error";
  date: string | null;
  content: string;
  hasEdits: boolean;
  error: RepositoryError | null;
  loadedWithContent: boolean;

  // Save
  isSaving: boolean;
  lastSavedAt: number | null;
  saveError: RepositoryError | null;
  _saveTimer: number | null;
  _savePromise: Promise<void> | null;

  // Dependencies (set via init)
  repository: NoteRepository | null;
  afterSave: ((snapshot: SaveSnapshot) => void) | null;

  // Actions
  init: (
    date: string,
    repository: NoteRepository,
    afterSave?: (snapshot: SaveSnapshot) => void,
  ) => void;
  switchNote: (date: string) => Promise<void>;
  dispose: () => Promise<void>;
  setContent: (content: string) => void;
  flushSave: () => Promise<void>;
  setAfterSave: (callback?: (snapshot: SaveSnapshot) => void) => void;
}

export function createNoteContentStore() {
  return createStore<NoteContentState>()((set, get) => {
  // --- internal helpers ---

  let _loadGeneration = 0;
  let _disposeGeneration = 0;
  let _contentVersion = 0;

  const _clearSaveTimer = () => {
    const timer = get()._saveTimer;
    if (timer !== null) {
      window.clearTimeout(timer);
      set({ _saveTimer: null });
    }
  };

  const _doSave = async (): Promise<void> => {
    const { date, content, repository, loadedWithContent } = get();
    if (!date || !repository) return;

    const isEmpty = isNoteEmpty(content);

    // Guard: never delete a note that was loaded with content
    if (isEmpty && loadedWithContent) {
      set({ isSaving: false, hasEdits: false });
      return;
    }

    const result = isEmpty
      ? await repository.delete(date)
      : await repository.save(date, content);

    // Re-read current state after await
    const current = get();

    if (result.ok) {
      // Only clear dirty state if content hasn't changed AND no new save is pending
      if (
        current.date === date &&
        current.content === content &&
        current._saveTimer === null
      ) {
        set({ hasEdits: false, isSaving: false, lastSavedAt: Date.now() });
      } else if (current._saveTimer === null) {
        set({ isSaving: false, lastSavedAt: Date.now() });
      }
      // else: new save timer pending — leave isSaving true

      // Clear previous save error on success; re-read afterSave to avoid stale callback
      if (current.saveError) set({ saveError: null });
      current.afterSave?.({ date, content, isEmpty });
    } else {
      set({ isSaving: false, saveError: result.error });
    }
  };

  const _scheduleSave = () => {
    _clearSaveTimer();
    const timer = window.setTimeout(() => {
      set({ _saveTimer: null, isSaving: true });
      const promise = _doSave();
      set({ _savePromise: promise });
      void promise.finally(() => {
        // Only clear if this is still the active promise
        if (get()._savePromise === promise) {
          set({ _savePromise: null });
        }
      });
    }, SAVE_IDLE_DELAY_MS);
    set({ _saveTimer: timer });
  };

  const _loadNote = async (
    date: string,
    repository: NoteRepository,
  ): Promise<void> => {
    const gen = ++_loadGeneration;
    set({
      status: "loading",
      date,
      content: "",
      hasEdits: false,
      error: null,
      loadedWithContent: false,
    });

    const result = await repository.get(date);
    if (gen !== _loadGeneration) return; // superseded

    if (result.ok) {
      const content = result.value?.content ?? "";
      set({
        status: "ready",
        content,
        hasEdits: false,
        error: null,
        loadedWithContent: !isContentEmpty(content),
      });
    } else {
      set({
        status: "error",
        content: "",
        hasEdits: false,
        error: result.error,
      });
    }
  };

  // --- visibility handler ---
  const _handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      void get().flushSave();
    }
  };

  return {
    // Initial state
    status: "idle",
    date: null,
    content: "",
    hasEdits: false,
    error: null,
    loadedWithContent: false,
    isSaving: false,
    lastSavedAt: null,
    saveError: null,
    _saveTimer: null,
    _savePromise: null,
    repository: null,
    afterSave: null,

    init: (date, repository, afterSave) => {
      // Cancel any in-flight dispose to prevent it from clobbering this init
      _disposeGeneration++;
      // Remove previous listener to avoid duplicates on re-init
      document.removeEventListener("visibilitychange", _handleVisibilityChange);
      document.addEventListener("visibilitychange", _handleVisibilityChange);
      set({ repository, afterSave: afterSave ?? null });
      void _loadNote(date, repository);
    },

    switchNote: async (date) => {
      await get().flushSave();
      const { repository } = get();
      if (!repository) return;
      void _loadNote(date, repository);
    },

    dispose: async () => {
      const disposeGen = ++_disposeGeneration;
      // Invalidate in-flight loads immediately so they can't
      // write back after the reset below.
      _loadGeneration++;
      document.removeEventListener("visibilitychange", _handleVisibilityChange);
      await get().flushSave();
      // If init() was called while we were flushing, abort — the new
      // init owns the store now and our reset would clobber its state.
      if (disposeGen !== _disposeGeneration) return;
      set({
        status: "idle",
        date: null,
        content: "",
        hasEdits: false,
        error: null,
        saveError: null,
        loadedWithContent: false,
        isSaving: false,
        lastSavedAt: null,
        _saveTimer: null,
        _savePromise: null,
        repository: null,
        afterSave: null,
      });
    },

    setContent: (content) => {
      const { content: current, status } = get();
      if (
        content === current ||
        (status !== "ready" && status !== "error")
      ) {
        return;
      }
      _contentVersion++;
      set({ content, hasEdits: true, error: null });
      _scheduleSave();
    },

    flushSave: async () => {
      const { _saveTimer, hasEdits, _savePromise } = get();

      // If there's a pending timer, fire the save now
      if (_saveTimer !== null) {
        _clearSaveTimer();
        if (hasEdits) {
          set({ isSaving: true });
          const promise = _doSave();
          set({ _savePromise: promise });
          await promise;
          if (get()._savePromise === promise) {
            set({ _savePromise: null });
          }
          return;
        }
      }

      // If there's an in-flight save, wait for it
      if (_savePromise) {
        await _savePromise;
      }
    },



    setAfterSave: (callback) => {
      set({ afterSave: callback ?? null });
    },
  };
  });
}

export type NoteContentStore = ReturnType<typeof createNoteContentStore>;

export const noteContentStore = createNoteContentStore();
