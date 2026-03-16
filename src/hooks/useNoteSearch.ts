import { useCallback, useEffect, useRef, useState } from "react";
import type {
  NoteRepository,
  SearchResult,
} from "../storage/noteRepository";

interface UseNoteSearchReturn {
  results: SearchResult[];
  isSearching: boolean;
  search: (query: string) => void;
  clearSearch: () => void;
}

export function useNoteSearch(
  repository: NoteRepository | null,
): UseNoteSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestIdRef = useRef(0);

  const executeSearch = useCallback(
    async (query: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      if (!query.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      if (!repository) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const result = await repository.search(query, {
        limit: 50,
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setResults(result.ok ? result.value : []);
      setIsSearching(false);
    },
    [repository],
  );

  const search = useCallback(
    (query: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void executeSearch(query);
      }, 300);
    },
    [executeSearch],
  );

  const clearSearch = useCallback(() => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setResults([]);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { results, isSearching, search, clearSearch };
}
