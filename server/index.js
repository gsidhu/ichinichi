import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(process.cwd(), 'dailynotes.sqlite');

// Init DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Migrations / Create Tables
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

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// --- Notes API ---

app.get('/api/notes/dates', (req, res) => {
  try {
    const rows = db.prepare(`SELECT date FROM notes`).all();
    res.json(rows.map(r => r.date));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/notes/:date', (req, res) => {
  try {
    const { date } = req.params;
    const note = db.prepare(`SELECT * FROM notes WHERE date = ?`).get(date);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/notes/:date', (req, res) => {
  try {
    const { date } = req.params;
    const { content, updatedAt } = req.body;

    if (content === undefined || !updatedAt) {
      return res.status(400).json({ error: 'Missing required fields' });
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
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/notes/:date', (req, res) => {
  try {
    const { date } = req.params;
    db.prepare(`DELETE FROM notes WHERE date = ?`).run(date);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Images API ---

app.get('/api/images/:id', (req, res) => {
  try {
    const { id } = req.params;
    const image = db.prepare(`SELECT * FROM images WHERE id = ?`).get(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json(image);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/images/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      noteDate, type, filename, mimeType, width, height, size, createdAt, data
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

    stmt.run(id, noteDate, type, filename, mimeType, width, height, size, createdAt, data);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/images/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM images WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// For calendar to quickly get images for a note
app.get('/api/images/note/:date', (req, res) => {
  try {
    const { date } = req.params;
    const rows = db.prepare(`SELECT id, type, width, height FROM images WHERE noteDate = ?`).all(date);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
