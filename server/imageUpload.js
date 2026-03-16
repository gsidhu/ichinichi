export class HttpError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getMultipartBoundary(contentType) {
  const match = /boundary=([^;]+)/i.exec(contentType ?? "");
  if (!match) {
    throw new HttpError(400, "INVALID_IMAGE_UPLOAD");
  }

  return match[1].trim().replace(/^"|"$/g, "");
}

function parseMultipartFormData(bodyBuffer, boundary) {
  const text = bodyBuffer.toString("latin1");
  const marker = `--${boundary}`;
  const rawParts = text.split(marker);
  const fields = new Map();
  const files = new Map();

  for (const rawPart of rawParts) {
    if (!rawPart || rawPart === "--" || rawPart === "--\r\n") {
      continue;
    }

    let part = rawPart;
    if (part.startsWith("\r\n")) {
      part = part.slice(2);
    }
    if (part.endsWith("\r\n")) {
      part = part.slice(0, -2);
    }
    if (part.endsWith("--")) {
      part = part.slice(0, -2);
    }

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      continue;
    }

    const headerText = part.slice(0, headerEnd);
    const bodyText = part.slice(headerEnd + 4);
    const headers = headerText.split("\r\n").reduce((acc, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return acc;
      }
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});

    const disposition = headers["content-disposition"];
    if (!disposition) {
      continue;
    }

    const nameMatch = /name="([^"]+)"/i.exec(disposition);
    if (!nameMatch) {
      continue;
    }

    const fieldName = nameMatch[1];
    const filenameMatch = /filename="([^"]*)"/i.exec(disposition);
    if (filenameMatch) {
      files.set(fieldName, {
        filename: filenameMatch[1],
        mimeType: headers["content-type"] || "application/octet-stream",
        data: Buffer.from(bodyText, "latin1"),
      });
      continue;
    }

    fields.set(fieldName, bodyText);
  }

  return { fields, files };
}

function getRequiredField(fields, name) {
  const value = fields.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, "INVALID_IMAGE_UPLOAD");
  }
  return value;
}

function parseIntegerField(fields, name) {
  const value = Number.parseInt(getRequiredField(fields, name), 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new HttpError(400, "INVALID_IMAGE_UPLOAD");
  }
  return value;
}

function normalizeJsonUploadPayload(jsonBody) {
  const {
    noteDate,
    type,
    filename,
    mimeType,
    width,
    height,
    size,
    createdAt,
    data,
  } = jsonBody ?? {};

  if (
    typeof noteDate !== "string" ||
    (type !== "inline" && type !== "background") ||
    typeof filename !== "string" ||
    typeof mimeType !== "string" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    typeof size !== "number" ||
    typeof createdAt !== "string" ||
    typeof data !== "string"
  ) {
    throw new HttpError(400, "INVALID_IMAGE_UPLOAD");
  }

  return {
    noteDate,
    type,
    filename,
    mimeType,
    width,
    height,
    size,
    createdAt,
    data,
  };
}

function normalizeMultipartUploadPayload(contentType, rawBody) {
  const boundary = getMultipartBoundary(contentType);
  const { fields, files } = parseMultipartFormData(rawBody, boundary);
  const file = files.get("file");

  if (!file) {
    throw new HttpError(400, "INVALID_IMAGE_UPLOAD");
  }

  const type = getRequiredField(fields, "type");
  if (type !== "inline" && type !== "background") {
    throw new HttpError(400, "INVALID_IMAGE_UPLOAD");
  }

  return {
    noteDate: getRequiredField(fields, "noteDate"),
    type,
    filename: getRequiredField(fields, "filename"),
    mimeType: file.mimeType,
    width: parseIntegerField(fields, "width"),
    height: parseIntegerField(fields, "height"),
    size: file.data.length,
    createdAt: getRequiredField(fields, "createdAt"),
    data: file.data.toString("base64"),
  };
}

export function normalizeImageUploadRequest({
  contentType,
  jsonBody,
  rawBody,
  maxBytes,
}) {
  if (typeof maxBytes === "number" && rawBody && rawBody.length > maxBytes) {
    throw new HttpError(413, "IMAGE_TOO_LARGE");
  }

  if ((contentType || "").includes("multipart/form-data")) {
    if (!rawBody) {
      throw new HttpError(400, "INVALID_IMAGE_UPLOAD");
    }
    return normalizeMultipartUploadPayload(contentType, rawBody);
  }

  return normalizeJsonUploadPayload(jsonBody);
}
