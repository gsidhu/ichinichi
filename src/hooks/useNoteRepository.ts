import { useCallback, useMemo } from "react";
import type { RepositoryError } from "../domain/errors";
import { useNoteContent } from "./useNoteContent";
import { useNoteDates } from "./useNoteDates";
import { createNoteRepository, createImageRepository } from "../domain/notes/repositoryFactory";
import type { ImageRepository } from "../storage/imageRepository";
import type { NoteRepository } from "../storage/noteRepository";
import type { NoteWeather } from "../types";

interface UseNoteRepositoryProps {
  date: string | null;
  year: number;
}

export interface UseNoteRepositoryReturn {
  repository: NoteRepository;
  imageRepository: ImageRepository | null;
  capabilities: { canSync: boolean; canUploadImages: boolean };
  content: string;
  setContent: (content: string) => void;
  activeDate: string | null;
  noteWeather: NoteWeather | null;
  setNoteWeather: (weather: NoteWeather | null) => void;
  flushSave: () => Promise<void>;
  hasEdits: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  hasNote: (date: string) => boolean;
  noteDates: Set<string>;
  refreshNoteDates: (options?: { immediate?: boolean }) => void;
  isDecrypting: boolean;
  isContentReady: boolean;
  isOfflineStub: boolean;
  noteError: RepositoryError | null;
}

export function useNoteRepository({
  date,
  year,
}: UseNoteRepositoryProps): UseNoteRepositoryReturn {
  const repository = useMemo(() => createNoteRepository(), []);
  const imageRepository = useMemo(() => createImageRepository(), []);

  const { hasNote, noteDates, refreshNoteDates, applyNoteChange } =
    useNoteDates(repository, year);

  const capabilities = useMemo(
    () => ({
      canSync: false,
      canUploadImages: true,
    }),
    [],
  );

  const handleAfterSave = useCallback(
    (snapshot: { date: string; isEmpty: boolean }) => {
      applyNoteChange(snapshot.date, snapshot.isEmpty);
    },
    [applyNoteChange],
  );

  const {
    content,
    setContent,
    noteWeather,
    setNoteWeather,
    flushSave,
    isDecrypting,
    hasEdits,
    isSaving,
    lastSavedAt,
    isContentReady,
    isOfflineStub,
    error: noteError,
  } = useNoteContent(date, repository, hasNote, handleAfterSave);

  return {
    repository,
    imageRepository,
    capabilities,
    content,
    setContent,
    activeDate: date,
    noteWeather,
    setNoteWeather,
    flushSave,
    hasEdits,
    isSaving,
    lastSavedAt,
    hasNote,
    noteDates,
    refreshNoteDates,
    isDecrypting,
    isContentReady,
    isOfflineStub,
    noteError,
  };
}
