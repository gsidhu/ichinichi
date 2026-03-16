import type { NoteImage } from "../types";
import type { Result } from "../domain/result";
import { ok, err } from "../domain/result";
import type { RepositoryError } from "../domain/errors";
import type { ImageRepository } from "./imageRepository";
import { apiFetch } from "../services/apiClient";

const API_BASE = "/ichinichi/api";
const IMAGE_TOO_LARGE_CODE = "IMAGE_TOO_LARGE";
const IMAGE_TOO_LARGE_MESSAGE =
  "Image is too large for this server after compression.";

function toRepoError(error: unknown): RepositoryError {
  if (error instanceof Error) {
    return { type: "IO", message: error.message };
  }
  return { type: "Unknown", message: "Repository operation failed" };
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
      const createdAt = new Date().toISOString();
      const formData = new FormData();
      formData.set("noteDate", noteDate);
      formData.set("type", type);
      formData.set("filename", filename);
      formData.set("width", String(options?.width ?? 0));
      formData.set("height", String(options?.height ?? 0));
      formData.set("size", String(file.size));
      formData.set("createdAt", createdAt);
      formData.set("file", file, filename);

      const res = await apiFetch(`${API_BASE}/images/${id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 413) {
          const errorCode = await getErrorCode(res);
          if (errorCode === IMAGE_TOO_LARGE_CODE) {
            throw new Error(IMAGE_TOO_LARGE_MESSAGE);
          }
        }
        throw new Error("Failed to save image");
      }

      return ok({
        id,
        noteDate,
        type,
        filename,
        mimeType: file.type,
        width: options?.width ?? 0,
        height: options?.height ?? 0,
        size: file.size,
        createdAt,
      });
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async get(imageId: string): Promise<Result<Blob | null, RepositoryError>> {
    try {
      const res = await apiFetch(`${API_BASE}/images/${imageId}`);
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
      const res = await apiFetch(`${API_BASE}/images/${imageId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete image");
      return ok(undefined);
    } catch (e) {
      return err(toRepoError(e));
    }
  },

  async getByNoteDate(noteDate: string): Promise<Result<NoteImage[], RepositoryError>> {
    try {
      const res = await apiFetch(`${API_BASE}/images/note/${noteDate}`);
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

async function getErrorCode(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : null;
  } catch {
    return null;
  }
}
