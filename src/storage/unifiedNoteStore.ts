import type { Note, NoteWeather } from "../types";
import type { Result } from "../domain/result";
import { ok, err } from "../domain/result";
import type { RepositoryError } from "../domain/errors";
import type { NoteRepository, SearchResult } from "./noteRepository";
import { apiFetch } from "../services/apiClient";

const API_BASE = "/ichinichi/api";

function toRepoError(error: unknown): RepositoryError {
  if (error instanceof Error) {
    return { type: "IO", message: error.message };
  }
  return { type: "Unknown", message: "Repository operation failed" };
}

function parseNoteWeather(record: Record<string, unknown>): NoteWeather | null {
  if (typeof record.weatherTemperature !== "number") {
    return null;
  }

  return {
    city: typeof record.weatherCity === "string" ? record.weatherCity : "",
    temperature: record.weatherTemperature,
    icon: typeof record.weatherIcon === "string" ? record.weatherIcon : "🌡️",
    unit: record.weatherUnit === "F" ? "F" : "C",
  };
}

export const plaintextNoteRepository: NoteRepository = {
  async get(date: string): Promise<Result<Note | null, RepositoryError>> {
    try {
      const res = await apiFetch(`${API_BASE}/notes/${date}`);
      if (res.status === 404) return ok(null);
      if (!res.ok) throw new Error("Failed to fetch note");
      const record = await res.json();
      return ok({
        date: record.date,
        content: record.content,
        weather: parseNoteWeather(record),
        updatedAt: record.updatedAt,
      });
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async save(
    date: string,
    content: string,
    weather: NoteWeather | null = null,
  ): Promise<Result<void, RepositoryError>> {
    try {
      const updatedAt = new Date().toISOString();
      const res = await apiFetch(`${API_BASE}/notes/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          updatedAt,
          weatherCity: weather?.city ?? null,
          weatherTemperature: weather?.temperature ?? null,
          weatherIcon: weather?.icon ?? null,
          weatherUnit: weather?.unit ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      return ok(undefined);
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async delete(date: string): Promise<Result<void, RepositoryError>> {
    try {
      const res = await apiFetch(`${API_BASE}/notes/${date}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete note");
      return ok(undefined);
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async getAllDates(): Promise<Result<string[], RepositoryError>> {
    try {
      const res = await apiFetch(`${API_BASE}/notes/dates`);
      if (!res.ok) throw new Error("Failed to fetch dates");
      const dates: string[] = await res.json();
      return ok(dates);
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async getAllDatesForYear(year: number): Promise<Result<string[], RepositoryError>> {
    try {
      const res = await apiFetch(`${API_BASE}/notes/dates`);
      if (!res.ok) throw new Error("Failed to fetch dates");
      const dates: string[] = await res.json();
      const suffix = `-${year}`;
      return ok(dates.filter((d) => d.endsWith(suffix)));
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async search(
    query: string,
    options: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<Result<SearchResult[], RepositoryError>> {
    try {
      const params = new URLSearchParams({ q: query });
      if (typeof options.limit === "number") {
        params.set("limit", String(options.limit));
      }

      const res = await apiFetch(`${API_BASE}/notes/search?${params.toString()}`, {
        signal: options.signal,
      });
      if (!res.ok) throw new Error("Failed to search notes");
      const results: SearchResult[] = await res.json();
      return ok(results);
    } catch (e) {
      return err(toRepoError(e));
    }
  },
};
