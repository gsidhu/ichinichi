import {
  API_PREFIX,
  buildSearchResult,
  createApp,
  initDb,
  searchNotes,
  upsertNote,
} from "../../server/app.js";

interface FakeNoteRecord {
  date: string;
  content: string;
  updatedAt: string;
  weatherCity: string | null;
  weatherTemperature: number | null;
  weatherIcon: string | null;
  weatherUnit: string | null;
  searchText?: string;
}

class FakeDb {
  notes = new Map<string, FakeNoteRecord>();
  noteColumns = new Set([
    "date",
    "content",
    "updatedAt",
    "weatherCity",
    "weatherTemperature",
    "weatherIcon",
    "weatherUnit",
  ]);

  constructor(initialNotes: FakeNoteRecord[] = []) {
    for (const note of initialNotes) {
      this.notes.set(note.date, { ...note });
    }
  }

  exec(sql: string) {
    if (sql.includes("ALTER TABLE notes ADD COLUMN weatherCity")) {
      this.noteColumns.add("weatherCity");
    }
    if (sql.includes("ALTER TABLE notes ADD COLUMN weatherTemperature")) {
      this.noteColumns.add("weatherTemperature");
    }
    if (sql.includes("ALTER TABLE notes ADD COLUMN weatherIcon")) {
      this.noteColumns.add("weatherIcon");
    }
    if (sql.includes("ALTER TABLE notes ADD COLUMN weatherUnit")) {
      this.noteColumns.add("weatherUnit");
    }
    if (
      sql.includes("ALTER TABLE notes ADD COLUMN searchText") ||
      sql.includes("CREATE TABLE IF NOT EXISTS notes")
    ) {
      this.noteColumns.add("searchText");
    }
  }

  prepare(sql: string) {
    if (sql.startsWith("PRAGMA table_info(notes)")) {
      return {
        all: () => Array.from(this.noteColumns).map((name) => ({ name })),
      };
    }

    if (sql.startsWith("SELECT date, content, searchText FROM notes")) {
      return {
        all: () =>
          Array.from(this.notes.values()).map((note) => ({
            date: note.date,
            content: note.content,
            searchText: note.searchText ?? "",
          })),
      };
    }

    if (sql.startsWith("UPDATE notes SET searchText = ? WHERE date = ?")) {
      return {
        run: (searchText: string, date: string) => {
          const note = this.notes.get(date);
          if (note) {
            note.searchText = searchText;
          }
        },
      };
    }

    if (sql.includes("SELECT date, searchText")) {
      return {
        all: (query: string, limit: number) =>
          Array.from(this.notes.values())
            .filter((note) =>
              (note.searchText ?? "").toLowerCase().includes(query.toLowerCase()),
            )
            .sort((a, b) => {
              const aKey = `${a.date.slice(6, 10)}${a.date.slice(3, 5)}${a.date.slice(0, 2)}`;
              const bKey = `${b.date.slice(6, 10)}${b.date.slice(3, 5)}${b.date.slice(0, 2)}`;
              return bKey.localeCompare(aKey);
            })
            .slice(0, limit)
            .map((note) => ({
              date: note.date,
              searchText: note.searchText ?? "",
            })),
      };
    }

    if (sql.includes("INSERT INTO notes")) {
      return {
        run: (
          date: string,
          content: string,
          updatedAt: string,
          weatherCity: string | null,
          weatherTemperature: number | null,
          weatherIcon: string | null,
          weatherUnit: string | null,
          searchText: string,
        ) => {
          this.notes.set(date, {
            date,
            content,
            updatedAt,
            weatherCity,
            weatherTemperature,
            weatherIcon,
            weatherUnit,
            searchText,
          });
        },
      };
    }

    if (sql.startsWith("SELECT date FROM notes")) {
      return {
        all: () =>
          Array.from(this.notes.values()).map((note) => ({ date: note.date })),
      };
    }

    if (sql.startsWith("SELECT * FROM notes WHERE date = ?")) {
      return {
        get: (date: string) => this.notes.get(date) ?? null,
      };
    }

    if (sql.startsWith("DELETE FROM notes WHERE date = ?")) {
      return {
        run: (date: string) => {
          this.notes.delete(date);
        },
      };
    }

    if (sql.startsWith("SELECT * FROM images WHERE id = ?")) {
      return { get: () => null };
    }

    if (sql.includes("INSERT INTO images")) {
      return { run: () => undefined };
    }

    if (sql.startsWith("DELETE FROM images WHERE id = ?")) {
      return { run: () => undefined };
    }

    if (
      sql.startsWith(
        "SELECT id, type, width, height FROM images WHERE noteDate = ?",
      )
    ) {
      return { all: () => [] };
    }

    throw new Error(`Unsupported SQL in test fake: ${sql}`);
  }
}

describe("server search API", () => {
  it("registers /notes/search before /notes/:date", () => {
    const app = createApp({ db: new FakeDb() });
    const stack = app.router.stack
      .map((layer: { route?: { path?: string } }) => layer.route?.path)
      .filter(Boolean);

    expect(stack.indexOf(`${API_PREFIX}/notes/search`)).toBeGreaterThan(-1);
    expect(stack.indexOf(`${API_PREFIX}/notes/search`)).toBeLessThan(
      stack.indexOf(`${API_PREFIX}/notes/:date`),
    );
  });

  it("matches case-insensitively and sorts DD-MM-YYYY descending", () => {
    const db = new FakeDb([
      {
        date: "01-01-2025",
        content: "<p>Search term</p>",
        updatedAt: "2025-01-01T10:00:00.000Z",
        weatherCity: null,
        weatherTemperature: null,
        weatherIcon: null,
        weatherUnit: null,
        searchText: "Search term",
      },
      {
        date: "16-03-2026",
        content: "<p>search term</p>",
        updatedAt: "2026-03-16T10:00:00.000Z",
        weatherCity: null,
        weatherTemperature: null,
        weatherIcon: null,
        weatherUnit: null,
        searchText: "search term",
      },
    ]);

    expect(searchNotes(db, "SEARCH")).toEqual([
      {
        date: "16-03-2026",
        snippet: "search term",
        matchIndex: 0,
        matchLength: 6,
      },
      {
        date: "01-01-2025",
        snippet: "Search term",
        matchIndex: 0,
        matchLength: 6,
      },
    ]);
  });

  it("backfills searchText on init and refreshes it on save", () => {
    const db = new FakeDb([
      {
        date: "15-03-2026",
        content: "<p>Alpha <strong>Beta</strong></p>",
        updatedAt: "2026-03-15T10:00:00.000Z",
        weatherCity: null,
        weatherTemperature: null,
        weatherIcon: null,
        weatherUnit: null,
      },
    ]);

    initDb(db);
    expect(db.notes.get("15-03-2026")?.searchText).toBe("Alpha Beta");

    upsertNote(db, {
      date: "15-03-2026",
      content: "<p>Gamma <em>Delta</em></p>",
      updatedAt: "2026-03-16T10:00:00.000Z",
    });

    expect(db.notes.get("15-03-2026")?.searchText).toBe("Gamma Delta");
  });

  it("builds snippets whose match index points at the highlighted text", () => {
    const result = buildSearchResult(
      {
        date: "16-03-2026",
        searchText:
          "Before text with enough padding to force truncation around the keyword SearchValue in the middle and more after it",
      },
      "Search",
    );

    expect(result).not.toBeNull();
    expect(
      result?.snippet.slice(
        result.matchIndex,
        result.matchIndex + result.matchLength,
      ),
    ).toBe("Search");
  });
});
