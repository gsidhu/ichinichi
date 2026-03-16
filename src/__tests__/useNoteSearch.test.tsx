// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { ok } from "../domain/result";
import { useNoteSearch } from "../hooks/useNoteSearch";
import type { NoteRepository, SearchResult } from "../storage/noteRepository";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createRepository(
  searchImpl: NoteRepository["search"],
): NoteRepository {
  return {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getAllDates: vi.fn(),
    getAllDatesForYear: vi.fn(),
    search: vi.fn(searchImpl),
  };
}

describe("useNoteSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces and calls repository.search", async () => {
    const repository = createRepository(async () =>
      ok<SearchResult[]>([
        {
          date: "16-03-2026",
          snippet: "hello world",
          matchIndex: 0,
          matchLength: 5,
        },
      ]),
    );
    const { result } = renderHook(() => useNoteSearch(repository));

    act(() => {
      result.current.search("hello");
    });

    expect(repository.search).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(repository.search).toHaveBeenCalledWith(
      "hello",
      expect.objectContaining({ limit: 50, signal: expect.any(AbortSignal) }),
    );
    expect(result.current.results).toEqual([
      {
        date: "16-03-2026",
        snippet: "hello world",
        matchIndex: 0,
        matchLength: 5,
      },
    ]);
    expect(result.current.isSearching).toBe(false);
  });

  it("clears immediately for empty queries without hitting the repository", async () => {
    const repository = createRepository(async () => ok<SearchResult[]>([]));
    const { result } = renderHook(() => useNoteSearch(repository));

    act(() => {
      result.current.search("hello");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(repository.search).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.search("   ");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(repository.search).toHaveBeenCalledTimes(1);
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it("ignores stale responses after a newer query starts", async () => {
    const first = createDeferred<Awaited<ReturnType<NoteRepository["search"]>>>();
    const second = createDeferred<Awaited<ReturnType<NoteRepository["search"]>>>();
    const searchMock = vi
      .fn<NoteRepository["search"]>()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);
    const repository = createRepository(searchMock);
    const { result } = renderHook(() => useNoteSearch(repository));

    act(() => {
      result.current.search("old");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    const firstSignal = searchMock.mock.calls[0]?.[1]?.signal;

    act(() => {
      result.current.search("new");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      first.resolve(
        ok([
          {
            date: "15-03-2026",
            snippet: "old result",
            matchIndex: 0,
            matchLength: 3,
          },
        ]),
      );
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([]);

    await act(async () => {
      second.resolve(
        ok([
          {
            date: "16-03-2026",
            snippet: "new result",
            matchIndex: 0,
            matchLength: 3,
          },
        ]),
      );
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([
      {
        date: "16-03-2026",
        snippet: "new result",
        matchIndex: 0,
        matchLength: 3,
      },
    ]);
    expect(result.current.isSearching).toBe(false);
  });
});
