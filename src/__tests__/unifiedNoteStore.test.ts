import { plaintextNoteRepository } from "../storage/unifiedNoteStore";

describe("plaintextNoteRepository weather persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads weather fields from the note payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          date: "16-03-2026",
          content: "<p>Hello</p>",
          updatedAt: "2026-03-16T10:00:00.000Z",
          weatherCity: "Tokyo",
          weatherTemperature: 23,
          weatherIcon: "☀️",
          weatherUnit: "C",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await plaintextNoteRepository.get("16-03-2026");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      date: "16-03-2026",
      content: "<p>Hello</p>",
      updatedAt: "2026-03-16T10:00:00.000Z",
      weather: {
        city: "Tokyo",
        temperature: 23,
        icon: "☀️",
        unit: "C",
      },
    });
  });

  it("sends weather fields when saving a note", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await plaintextNoteRepository.save("16-03-2026", "<p>Hello</p>", {
      city: "Osaka",
      temperature: 19,
      icon: "🌧️",
      unit: "F",
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(init?.method).toBe("PUT");
    expect(String(init?.body)).toContain('"weatherCity":"Osaka"');
    expect(String(init?.body)).toContain('"weatherTemperature":19');
    expect(String(init?.body)).toContain('"weatherIcon":"🌧️"');
    expect(String(init?.body)).toContain('"weatherUnit":"F"');
  });

  it("queries the server search endpoint with query params", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            date: "16-03-2026",
            snippet: "hello world",
            matchIndex: 0,
            matchLength: 5,
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await plaintextNoteRepository.search("hello world", {
      limit: 25,
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/ichinichi/api/notes/search?q=hello+world&limit=25",
      expect.objectContaining({
        credentials: "include",
        signal: undefined,
      }),
    );
    if (!result.ok) {
      return;
    }
    expect(result.value).toEqual([
      {
        date: "16-03-2026",
        snippet: "hello world",
        matchIndex: 0,
        matchLength: 5,
      },
    ]);
  });

  it("maps search failures to repository errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await plaintextNoteRepository.search("hello");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toEqual({
      type: "IO",
      message: "Failed to search notes",
    });
  });
});
