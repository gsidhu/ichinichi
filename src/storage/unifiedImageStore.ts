import type { NoteImage } from "../types";
import type { Result } from "../domain/result";
import { ok, err } from "../domain/result";
import type { RepositoryError } from "../domain/errors";
import type { ImageRepository } from "./imageRepository";

const API_BASE = "/ichinichi/api";

function toRepoError(error: unknown): RepositoryError {
  if (error instanceof Error) {
    return { type: "IO", message: error.message };
  }
  return { type: "Unknown", message: "Repository operation failed" };
}

// Helper to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export const plaintextImageRepository: ImageRepository = {
  async upload(
    noteDate: string,
    file: Blob,
    type: "background" | "inline",
    filename: string,
    options?: { width?: number; height?: number }
  ): Promise<Result<NoteImage, RepositoryError>> {
    try {
      const id = crypto.randomUUID();
      const base64 = await blobToBase64(file);
      const createdAt = new Date().toISOString();
      const meta = {
        id,
        noteDate,
        type,
        filename,
        mimeType: file.type,
        width: options?.width ?? 0,
        height: options?.height ?? 0,
        size: file.size,
        createdAt,
        data: base64,
      };

      const res = await fetch(`${API_BASE}/images/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      });
      if (!res.ok) throw new Error("Failed to save image");

      return ok({
        id, noteDate, type, filename, mimeType: file.type, width: meta.width, height: meta.height, size: file.size, createdAt
      });
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async get(imageId: string): Promise<Result<Blob | null, RepositoryError>> {
    try {
      const res = await fetch(`${API_BASE}/images/${imageId}`);
      if (res.status === 404) return ok(null);
      if (!res.ok) throw new Error("Failed to fetch image");
      const record = await res.json();
      return ok(base64ToBlob(record.data, record.mimeType));
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async getUrl(): Promise<Result<string | null, RepositoryError>> {
    return ok(null); // Return null, editor will fallback to get() and Blob URL
  },

  async delete(imageId: string): Promise<Result<void, RepositoryError>> {
    try {
      const res = await fetch(`${API_BASE}/images/${imageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete image");
      return ok(undefined);
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async getByNoteDate(noteDate: string): Promise<Result<NoteImage[], RepositoryError>> {
    try {
      const res = await fetch(`${API_BASE}/images/note/${noteDate}`);
      if (!res.ok) throw new Error("Failed to fetch image meta by date");
      const records = await res.json();
      return ok(records);
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async deleteByNoteDate(noteDate: string): Promise<Result<void, RepositoryError>> {
    try {
      const images = await this.getByNoteDate(noteDate);
      if (!images.ok) return images;
      for (const img of images.value) {
        await this.delete(img.id);
      }
      return ok(undefined);
    } catch (e) {
      return err(toRepoError(e));
    }
  },
};
