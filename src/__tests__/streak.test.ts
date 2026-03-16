// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentStreak, getLongestStreak } from "../utils/streak";

const originalFetch = global.fetch;

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
  } as unknown as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("streak utils", () => {
  it("fetches the current streak from the API", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ length: 4 }));

    await expect(getCurrentStreak()).resolves.toEqual({ length: 4 });
    expect(global.fetch).toHaveBeenCalledWith("/ichinichi/api/streak/current", {
      credentials: "include",
    });
  });

  it("fetches the longest streak from the API", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ length: 9, startDate: "01-03-2026" }));

    await expect(getLongestStreak()).resolves.toEqual({
      length: 9,
      startDate: "01-03-2026",
    });
    expect(global.fetch).toHaveBeenCalledWith("/ichinichi/api/streak/longest", {
      credentials: "include",
    });
  });
});
