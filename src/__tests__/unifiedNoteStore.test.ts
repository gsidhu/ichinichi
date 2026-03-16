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
});
