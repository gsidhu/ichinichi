import type { Note, NoteWeather } from "../types";
import type { Result } from "../domain/result";
import type { RepositoryError } from "../domain/errors";

export interface SearchResult {
  date: string;
  snippet: string;
  matchIndex: number;
  matchLength: number;
}

export interface NoteRepository {
  // Core CRUD
  get(date: string): Promise<Result<Note | null, RepositoryError>>;
  save(
    date: string,
    content: string,
    weather?: NoteWeather | null,
  ): Promise<Result<void, RepositoryError>>;
  delete(date: string): Promise<Result<void, RepositoryError>>;
  getAllDates(): Promise<Result<string[], RepositoryError>>;
  getAllDatesForYear(year: number): Promise<Result<string[], RepositoryError>>;
  search(
    query: string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<Result<SearchResult[], RepositoryError>>;
}
