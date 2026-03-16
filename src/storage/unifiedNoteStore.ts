import type { Note } from "../types";
import type { Result } from "../domain/result";
import { ok, err } from "../domain/result";
import type { RepositoryError } from "../domain/errors";
import type { NoteRepository } from "./noteRepository";
import { apiFetch } from "../services/apiClient";

const API_BASE = "/ichinichi/api";

function toRepoError(error: unknown): RepositoryError {
  if (error instanceof Error) {
    return { type: "IO", message: error.message };
  }
  return { type: "Unknown", message: "Repository operation failed" };
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
        updatedAt: record.updatedAt,
      });
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async save(date: string, content: string): Promise<Result<void, RepositoryError>> {
    try {
      const updatedAt = new Date().toISOString();
      const res = await apiFetch(`${API_BASE}/notes/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, updatedAt }),
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
};
