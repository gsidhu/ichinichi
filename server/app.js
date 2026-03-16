import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { HttpError, normalizeImageUploadRequest } from "./imageUpload.js";

export const API_PREFIX = "/ichinichi/api";
export const HARDCODED_PASSWORD = "ichinichi";
const AUTH_COOKIE_NAME = "ichinichi_session";
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const IMAGE_UPLOAD_LIMIT_BYTES = Number(
  process.env.IMAGE_UPLOAD_LIMIT_BYTES || 5 * 1024 * 1024,
);
const DEFAULT_JWT_SECRET =
  process.env.JWT_SECRET || "ichinichi-local-session-secret-change-me";
const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 50;
const SNIPPET_RADIUS = 50;

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const HARDCODED_PASSWORD_HASH = sha256(HARDCODED_PASSWORD);

const base64UrlEncode = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
};

export function buildSearchText(html) {
  if (typeof html !== "string" || html.length === 0) {
    return "";
  }

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, (match, entity) => {
      switch (entity.toLowerCase()) {
        case "nbsp":
          return " ";
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return "\"";
        case "apos":
        case "#39":
          return "'";
        default:
          return match;
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function buildSnippet(text, index, queryLength) {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + queryLength + SNIPPET_RADIUS);
  let snippet = text.slice(start, end);
  let matchOffset = index - start;

  if (start > 0) {
    snippet = "..." + snippet;
    matchOffset += 3;
  }

  if (end < text.length) {
    snippet += "...";
  }

  return { snippet, matchIndex: matchOffset };
}

export function buildSearchResult(row, query) {
  const searchText =
    typeof row.searchText === "string"
      ? row.searchText
      : buildSearchText(row.content ?? "");
  const normalizedQuery = query.trim().toLowerCase();
  const matchIndex = searchText.toLowerCase().indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return null;
  }

  const snippet = buildSnippet(searchText, matchIndex, query.length);
  return {
    date: row.date,
    snippet: snippet.snippet,
    matchIndex: snippet.matchIndex,
    matchLength: query.length,
  };
}

function createAuthHelpers(jwtSecret) {
  function signToken(payload) {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
      .createHmac("sha256", jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  function verifyToken(token) {
    if (!token) {
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(base64UrlDecode(encodedPayload));
      if (
        typeof payload.exp !== "number" ||
        payload.exp <= Math.floor(Date.now() / 1000)
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  function getCookies(req) {
    const header = req.headers.cookie;
    if (!header) {
      return {};
    }

    return header.split(";").reduce((cookies, part) => {
      const [rawKey, ...rawValue] = part.trim().split("=");
      if (!rawKey) {
        return cookies;
      }
      cookies[rawKey] = decodeURIComponent(rawValue.join("="));
      return cookies;
    }, {});
  }

  function getSessionPayload(req) {
    const cookies = getCookies(req);
    const token = cookies[AUTH_COOKIE_NAME];
    return verifyToken(token);
  }

  function setAuthCookie(res, rememberMe) {
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const token = signToken({
      sub: "local-user",
      exp,
      iat: Math.floor(Date.now() / 1000),
    });

    const cookieParts = [
      `${AUTH_COOKIE_NAME}=${token}`,
      "HttpOnly",
      "SameSite=Strict",
      "Path=/ichinichi",
    ];

    if (process.env.NODE_ENV === "production") {
      cookieParts.push("Secure");
    }

    if (rememberMe) {
      cookieParts.push(`Max-Age=${SESSION_TTL_SECONDS}`);
    }

    res.setHeader("Set-Cookie", cookieParts.join("; "));
  }

  function clearAuthCookie(res) {
    const cookieParts = [
      `${AUTH_COOKIE_NAME}=`,
      "HttpOnly",
      "SameSite=Strict",
      "Path=/ichinichi",
      "Max-Age=0",
    ];

    if (process.env.NODE_ENV === "production") {
      cookieParts.push("Secure");
    }

    res.setHeader("Set-Cookie", cookieParts.join("; "));
  }

  function requireAuth(req, res, next) {
    if (!getSessionPayload(req)) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  }

  return {
    clearAuthCookie,
    getSessionPayload,
    requireAuth,
    setAuthCookie,
  };
}

function isValidPasswordHash(passwordHash) {
  if (typeof passwordHash !== "string") {
    return false;
  }

  const provided = Buffer.from(passwordHash, "utf8");
  const expected = Buffer.from(HARDCODED_PASSWORD_HASH, "utf8");

  return (
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected)
  );
}

function readRequestBuffer(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;
    let settled = false;

    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onData = (chunk) => {
      if (settled) {
        return;
      }

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalLength += buffer.length;

      if (totalLength > limitBytes) {
        req.resume();
        fail(new HttpError(413, "IMAGE_TOO_LARGE"));
        return;
      }

      chunks.push(buffer);
    };

    const onEnd = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    const onError = (error) => {
      if (settled) {
        return;
      }
      fail(error);
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

function normalizeSearchLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_SEARCH_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SEARCH_LIMIT;
  }
  return Math.min(parsed, MAX_SEARCH_LIMIT);
}

export function initDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      date TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      weatherCity TEXT,
      weatherTemperature REAL,
      weatherIcon TEXT,
      weatherUnit TEXT,
      searchText TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      noteDate TEXT NOT NULL,
      type TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      size INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);

  const noteColumns = new Set(
    db.prepare("PRAGMA table_info(notes)").all().map((column) => column.name),
  );

  if (!noteColumns.has("weatherCity")) {
    db.exec("ALTER TABLE notes ADD COLUMN weatherCity TEXT");
  }
  if (!noteColumns.has("weatherTemperature")) {
    db.exec("ALTER TABLE notes ADD COLUMN weatherTemperature REAL");
  }
  if (!noteColumns.has("weatherIcon")) {
    db.exec("ALTER TABLE notes ADD COLUMN weatherIcon TEXT");
  }
  if (!noteColumns.has("weatherUnit")) {
    db.exec("ALTER TABLE notes ADD COLUMN weatherUnit TEXT");
  }
  if (!noteColumns.has("searchText")) {
    db.exec("ALTER TABLE notes ADD COLUMN searchText TEXT NOT NULL DEFAULT ''");
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date)");

  const rows = db
    .prepare("SELECT date, content, searchText FROM notes")
    .all();
  const updateSearchText = db.prepare(
    "UPDATE notes SET searchText = ? WHERE date = ?",
  );

  for (const row of rows) {
    const searchText = buildSearchText(row.content);
    if (row.searchText !== searchText) {
      updateSearchText.run(searchText, row.date);
    }
  }
}

export function searchNotes(db, query, limit = DEFAULT_SEARCH_LIMIT) {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  if (normalizedQuery.length === 0) {
    return [];
  }

  const rows = db
    .prepare(`
      SELECT date, searchText
      FROM notes
      WHERE instr(lower(searchText), lower(?)) > 0
      ORDER BY substr(date, 7, 4) || substr(date, 4, 2) || substr(date, 1, 2) DESC
      LIMIT ?
    `)
    .all(normalizedQuery, normalizeSearchLimit(limit));

  return rows
    .map((row) => buildSearchResult(row, normalizedQuery))
    .filter(Boolean);
}

export function upsertNote(
  db,
  {
    date,
    content,
    updatedAt,
    weatherCity = null,
    weatherTemperature = null,
    weatherIcon = null,
    weatherUnit = null,
  },
) {
  const searchText = buildSearchText(content);
  const stmt = db.prepare(`
    INSERT INTO notes (
      date,
      content,
      updatedAt,
      weatherCity,
      weatherTemperature,
      weatherIcon,
      weatherUnit,
      searchText
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      content=excluded.content,
      updatedAt=excluded.updatedAt,
      weatherCity=excluded.weatherCity,
      weatherTemperature=excluded.weatherTemperature,
      weatherIcon=excluded.weatherIcon,
      weatherUnit=excluded.weatherUnit,
      searchText=excluded.searchText
  `);

  stmt.run(
    date,
    content,
    updatedAt,
    weatherCity,
    weatherTemperature,
    weatherIcon,
    weatherUnit,
    searchText,
  );
}

export function createApp({ db, jwtSecret = DEFAULT_JWT_SECRET } = {}) {
  if (!db) {
    throw new Error("createApp requires a database instance");
  }

  initDb(db);

  const app = express();
  const auth = createAuthHelpers(jwtSecret);

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  app.get(`${API_PREFIX}/auth/session`, (req, res) => {
    const payload = auth.getSessionPayload(req);
    res.json({
      authenticated: Boolean(payload),
      expiresAt: payload ? new Date(payload.exp * 1000).toISOString() : null,
    });
  });

  app.post(`${API_PREFIX}/auth/login`, (req, res) => {
    const { passwordHash, rememberMe = true } = req.body ?? {};

    if (!isValidPasswordHash(passwordHash)) {
      auth.clearAuthCookie(res);
      return res.status(401).json({ authenticated: false });
    }

    auth.setAuthCookie(res, rememberMe !== false);
    res.json({
      authenticated: true,
      expiresInMs: SESSION_TTL_MS,
    });
  });

  app.post(`${API_PREFIX}/auth/logout`, (_req, res) => {
    auth.clearAuthCookie(res);
    res.json({ authenticated: false });
  });

  app.use(`${API_PREFIX}/notes`, auth.requireAuth);
  app.use(`${API_PREFIX}/images`, auth.requireAuth);

  app.get(`${API_PREFIX}/notes/dates`, (_req, res) => {
    try {
      const rows = db.prepare("SELECT date FROM notes").all();
      res.json(rows.map((row) => row.date));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get(`${API_PREFIX}/notes/search`, (req, res) => {
    try {
      res.json(searchNotes(db, req.query.q, req.query.limit));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get(`${API_PREFIX}/notes/:date`, (req, res) => {
    try {
      const { date } = req.params;
      const note = db.prepare("SELECT * FROM notes WHERE date = ?").get(date);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.put(`${API_PREFIX}/notes/:date`, (req, res) => {
    try {
      const { date } = req.params;
      const {
        content,
        updatedAt,
        weatherCity = null,
        weatherTemperature = null,
        weatherIcon = null,
        weatherUnit = null,
      } = req.body;

      if (content === undefined || !updatedAt) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      upsertNote(db, {
        date,
        content,
        updatedAt,
        weatherCity,
        weatherTemperature,
        weatherIcon,
        weatherUnit,
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete(`${API_PREFIX}/notes/:date`, (req, res) => {
    try {
      const { date } = req.params;
      db.prepare("DELETE FROM notes WHERE date = ?").run(date);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get(`${API_PREFIX}/images/:id`, (req, res) => {
    try {
      const { id } = req.params;
      const image = db.prepare("SELECT * FROM images WHERE id = ?").get(id);
      if (!image) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json(image);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.put(`${API_PREFIX}/images/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      const isMultipart = (req.headers["content-type"] || "").includes(
        "multipart/form-data",
      );
      const rawBody = isMultipart
        ? await readRequestBuffer(req, IMAGE_UPLOAD_LIMIT_BYTES)
        : null;
      const payload = normalizeImageUploadRequest({
        contentType: req.headers["content-type"] || "",
        jsonBody: req.body,
        rawBody,
        maxBytes: IMAGE_UPLOAD_LIMIT_BYTES,
      });
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
      } = payload;

      const stmt = db.prepare(`
        INSERT INTO images (id, noteDate, type, filename, mimeType, width, height, size, createdAt, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          noteDate=excluded.noteDate,
          type=excluded.type,
          filename=excluded.filename,
          mimeType=excluded.mimeType,
          width=excluded.width,
          height=excluded.height,
          size=excluded.size,
          createdAt=excluded.createdAt,
          data=excluded.data
      `);

      stmt.run(
        id,
        noteDate,
        type,
        filename,
        mimeType,
        width,
        height,
        size,
        createdAt,
        data,
      );
      res.json({ success: true });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.code });
      }
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete(`${API_PREFIX}/images/:id`, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("DELETE FROM images WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get(`${API_PREFIX}/images/note/:date`, (req, res) => {
    try {
      const { date } = req.params;
      const rows = db
        .prepare("SELECT id, type, width, height FROM images WHERE noteDate = ?")
        .all(date);
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get(`${API_PREFIX}/streak/longest`, (_req, res) => {
    try {
      const rows = db.prepare("SELECT date FROM notes ORDER BY date ASC").all();
      const dates = rows.map((r) => r.date);

      if (dates.length === 0) {
        return res.json({ length: 0, startDate: null });
      }

      let longestStart = dates[0];
      let longestLen = 1;
      let curStart = dates[0];
      let curLen = 1;

      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          curLen++;
        } else {
          curStart = dates[i];
          curLen = 1;
        }

        if (curLen > longestLen) {
          longestLen = curLen;
          longestStart = curStart;
        }
      }

      const [y, m, d] = longestStart.split("-");
      res.json({ length: longestLen, startDate: `${d}-${m}-${y}` });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get(`${API_PREFIX}/streak/current`, (_req, res) => {
    try {
      const rows = db.prepare("SELECT date FROM notes ORDER BY date DESC").all();
      const dates = rows.map((r) => r.date);

      if (dates.length === 0) {
        return res.json({ length: 0 });
      }

      const fmt = (d) => {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      };

      const todayDate = new Date();
      const yesterday = new Date(Date.now() - 864e5);
      const today = fmt(todayDate);
      const yesterdayStr = fmt(yesterday);

      if (dates[0] !== today && dates[0] !== yesterdayStr) {
        return res.json({ length: 0 });
      }

      let streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = (prev - curr) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }

      res.json({ length: streak });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  return app;
}
