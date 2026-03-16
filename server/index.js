import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import cors from "cors";
import {Database} from "bun:sqlite";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const API_PREFIX = "/ichinichi/api";
const AUTH_COOKIE_NAME = "ichinichi_session";
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const JWT_SECRET =
  process.env.JWT_SECRET || "ichinichi-local-session-secret-change-me";
const HARDCODED_PASSWORD = "ichinichi";

const DB_PATH = path.join(process.cwd(), "dailynotes.sqlite");
const db = new Database(DB_PATH);

function sha256(value) {
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

function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
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
    .createHmac("sha256", JWT_SECRET)
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
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
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

function requireAuth(req, res, next) {
  if (!getSessionPayload(req)) {
    clearAuthCookie(res);
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      date TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updatedAt TEXT NOT NULL
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
};
initDb();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));

app.get(`${API_PREFIX}/auth/session`, (req, res) => {
  const payload = getSessionPayload(req);
  res.json({
    authenticated: Boolean(payload),
    expiresAt: payload ? new Date(payload.exp * 1000).toISOString() : null,
  });
});

app.post(`${API_PREFIX}/auth/login`, (req, res) => {
  const { passwordHash, rememberMe = true } = req.body ?? {};

  if (!isValidPasswordHash(passwordHash)) {
    clearAuthCookie(res);
    return res.status(401).json({ authenticated: false });
  }

  setAuthCookie(res, rememberMe !== false);
  res.json({
    authenticated: true,
    expiresInMs: SESSION_TTL_MS,
  });
});

app.post(`${API_PREFIX}/auth/logout`, (_req, res) => {
  clearAuthCookie(res);
  res.json({ authenticated: false });
});

app.use(`${API_PREFIX}/notes`, requireAuth);
app.use(`${API_PREFIX}/images`, requireAuth);

app.get(`${API_PREFIX}/notes/dates`, (req, res) => {
  try {
    const rows = db.prepare("SELECT date FROM notes").all();
    res.json(rows.map((row) => row.date));
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
    const { content, updatedAt } = req.body;

    if (content === undefined || !updatedAt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const stmt = db.prepare(`
      INSERT INTO notes (date, content, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        content=excluded.content,
        updatedAt=excluded.updatedAt
    `);

    stmt.run(date, content, updatedAt);
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

app.put(`${API_PREFIX}/images/:id`, (req, res) => {
  try {
    const { id } = req.params;
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
    } = req.body;

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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}${API_PREFIX}`);
  console.log(`Local app password: ${HARDCODED_PASSWORD}`);
});
