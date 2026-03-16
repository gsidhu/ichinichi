import { plaintextImageRepository } from "../storage/unifiedImageStore";

describe("plaintextImageRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads images as multipart form data instead of JSON base64", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000123",
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const blob = new Blob(["pixels"], { type: "image/png" });
    const result = await plaintextImageRepository.upload(
      "16-03-2026",
      blob,
      "inline",
      "photo.png",
      { width: 640, height: 480 },
    );

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(
      "/ichinichi/api/images/00000000-0000-4000-8000-000000000123",
    );
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toBeUndefined();
    expect(init?.body).toBeInstanceOf(FormData);

    const body = init?.body as FormData;
    expect(body.get("noteDate")).toBe("16-03-2026");
    expect(body.get("type")).toBe("inline");
    expect(body.get("filename")).toBe("photo.png");
    expect(body.get("width")).toBe("640");
    expect(body.get("height")).toBe("480");
    expect(body.get("size")).toBe(String(blob.size));
    expect(body.get("createdAt")).toEqual(expect.any(String));

    const file = body.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("photo.png");
    expect((file as File).type).toBe("image/png");
    expect(await (file as File).text()).toBe("pixels");
  });
});
