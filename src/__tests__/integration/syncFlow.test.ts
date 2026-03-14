// @vitest-environment jsdom
import { ok } from "../../domain/result";
import { createTestHarness, type TestHarness } from "./helpers/testHarness";
import type { NoteRepository } from "../../storage/noteRepository";

function createRepository(initialContent = ""): NoteRepository {
  return {
    get: vi.fn().mockResolvedValue(
      ok({
        date: "2026-01-10",
        content: initialContent,
        updatedAt: "2026-01-10T10:00:00.000Z",
      }),
    ),
    save: vi.fn().mockResolvedValue(ok(undefined)),
    delete: vi.fn().mockResolvedValue(ok(undefined)),
    getAllDates: vi.fn().mockResolvedValue(ok([])),
    getAllDatesForYear: vi.fn().mockResolvedValue(ok([])),
  } as unknown as NoteRepository;
}

async function waitForStatus(
  harness: TestHarness,
  status: string,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (harness.contentStore.getState().status !== status) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for status "${status}", ` +
          `got "${harness.contentStore.getState().status}"`,
      );
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("sync flow integration", () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.dispose();
  });

  it("sync completion triggers reload from local", async () => {
    harness = createTestHarness();
    const repository = createRepository("initial");

    harness.contentStore.getState().init("2026-01-10", repository);
    await waitForStatus(harness, "ready");

    // Simulate sync completion by incrementing counter
    const prev = harness.syncStore.getState().syncCompletionCount;
    harness.syncStore.setState({ syncCompletionCount: prev + 1 });

    await new Promise((r) => setTimeout(r, 50));

    // reloadFromLocal should have been called (repository.get called again)
    expect(repository.get).toHaveBeenCalledTimes(2);
  });

  it("realtime change refreshes current note", async () => {
    harness = createTestHarness();
    const repository = createRepository("initial");

    harness.contentStore.getState().init("2026-01-10", repository);
    await waitForStatus(harness, "ready");

    // Simulate realtime change for current date
    harness.syncStore.setState({
      lastRealtimeChangedDate: "2026-01-10",
    });

    await new Promise((r) => setTimeout(r, 50));

    // forceRefresh should have cleared hasRefreshedForDate
    expect(
      harness.contentStore.getState().hasRefreshedForDate,
    ).toBeNull();
  });

  it("realtime change for different date does not refresh", async () => {
    harness = createTestHarness();
    const repository = createRepository("initial");

    harness.contentStore.getState().init("2026-01-10", repository);
    await waitForStatus(harness, "ready");

    // Wait for initial auto-refresh to complete
    await new Promise((r) => setTimeout(r, 100));
    const refreshedDate =
      harness.contentStore.getState().hasRefreshedForDate;

    // Simulate realtime change for different date
    harness.syncStore.setState({
      lastRealtimeChangedDate: "2026-02-15",
    });

    await new Promise((r) => setTimeout(r, 50));

    // hasRefreshedForDate should be unchanged
    expect(
      harness.contentStore.getState().hasRefreshedForDate,
    ).toBe(refreshedDate);
  });

  it("local edits prevent sync reload", async () => {
    harness = createTestHarness();
    const repository = createRepository("initial");

    harness.contentStore.getState().init("2026-01-10", repository);
    await waitForStatus(harness, "ready");

    // Make local edit
    harness.contentStore.getState().setContent("my edit");

    // Simulate sync completion
    const prev = harness.syncStore.getState().syncCompletionCount;
    harness.syncStore.setState({ syncCompletionCount: prev + 1 });

    await new Promise((r) => setTimeout(r, 50));

    // Content should be preserved (reloadFromLocal skips when hasEdits)
    expect(harness.contentStore.getState().content).toBe("my edit");
  });
});
