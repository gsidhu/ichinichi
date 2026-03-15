import type { NoteRepository } from "../../storage/noteRepository";
import type { ImageRepository } from "../../storage/imageRepository";
import { plaintextNoteRepository } from "../../storage/unifiedNoteStore";
import { plaintextImageRepository } from "../../storage/unifiedImageStore";

export function createNoteRepository(): NoteRepository {
  return plaintextNoteRepository;
}

export function createImageRepository(): ImageRepository {
  return plaintextImageRepository;
}
