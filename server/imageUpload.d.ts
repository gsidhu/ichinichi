export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string);
}

export interface NormalizedImageUploadPayload {
  noteDate: string;
  type: "background" | "inline";
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  createdAt: string;
  data: string;
}

export interface NormalizeImageUploadRequestOptions {
  contentType?: string;
  jsonBody?: unknown;
  rawBody?: Buffer | null;
  maxBytes?: number;
}

export function normalizeImageUploadRequest(
  options: NormalizeImageUploadRequestOptions,
): NormalizedImageUploadPayload;
