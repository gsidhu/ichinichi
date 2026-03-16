import {
  HttpError,
  normalizeImageUploadRequest,
} from "../../server/imageUpload.js";

async function createMultipartRequest(fileBytes: Uint8Array) {
  const binary = new Uint8Array(fileBytes).buffer;
  const form = new FormData();
  form.set("noteDate", "16-03-2026");
  form.set("type", "inline");
  form.set("filename", "photo.png");
  form.set("width", "320");
  form.set("height", "200");
  form.set("size", String(fileBytes.length));
  form.set("createdAt", "2026-03-16T12:00:00.000Z");
  form.set(
    "file",
    new File([binary], "photo.png", {
      type: "image/png",
    }),
  );

  const request = new Request("http://example.test/upload", {
    method: "POST",
    body: form,
  });

  return {
    contentType: request.headers.get("content-type") || "",
    rawBody: Buffer.from(await request.arrayBuffer()),
  };
}

describe("server image upload normalization", () => {
  it("normalizes multipart uploads into the existing DB-ready image payload shape", async () => {
    const { contentType, rawBody } = await createMultipartRequest(
      new Uint8Array([0, 1, 2, 3, 4, 5]),
    );

    const payload = normalizeImageUploadRequest({
      contentType,
      rawBody,
      jsonBody: null,
      maxBytes: 1024,
    });

    expect(payload).toEqual({
      noteDate: "16-03-2026",
      type: "inline",
      filename: "photo.png",
      mimeType: "image/png",
      width: 320,
      height: 200,
      size: 6,
      createdAt: "2026-03-16T12:00:00.000Z",
      data: Buffer.from([0, 1, 2, 3, 4, 5]).toString("base64"),
    });
  });

  it("returns a stable 413 error when the multipart body exceeds the configured limit", async () => {
    const { contentType, rawBody } = await createMultipartRequest(
      new Uint8Array(128),
    );

    expect(() =>
      normalizeImageUploadRequest({
        contentType,
        rawBody,
        jsonBody: null,
        maxBytes: 32,
      }),
    ).toThrowError(HttpError);

    try {
      normalizeImageUploadRequest({
        contentType,
        rawBody,
        jsonBody: null,
        maxBytes: 32,
      });
    } catch (error) {
      expect(error).toMatchObject({
        status: 413,
        code: "IMAGE_TOO_LARGE",
      });
    }
  });
});
