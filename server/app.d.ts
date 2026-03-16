export const API_PREFIX: string;
export const HARDCODED_PASSWORD: string;

export interface ServerSearchResult {
  date: string;
  snippet: string;
  matchIndex: number;
  matchLength: number;
}

export function sha256(value: string): string;
export function buildSearchText(html: string): string;
export function buildSearchResult(
  row: { date: string; searchText?: string; content?: string },
  query: string,
): ServerSearchResult | null;
export function initDb(db: unknown): void;
export function searchNotes(
  db: unknown,
  query: unknown,
  limit?: unknown,
): ServerSearchResult[];
export function upsertNote(
  db: unknown,
  payload: {
    date: string;
    content: string;
    updatedAt: string;
    weatherCity?: string | null;
    weatherTemperature?: number | null;
    weatherIcon?: string | null;
    weatherUnit?: string | null;
  },
): void;
export function createApp(options: {
  db: unknown;
  jwtSecret?: string;
}): {
  router: {
    stack: Array<{ route?: { path?: string } }>;
  };
};
