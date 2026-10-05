/**
 * SQLite ledger of niches already turned into books — prevents planning the same
 * niche twice by accident (KDP flags near-duplicate titles from one account).
 */
import Database from "better-sqlite3";

const DB_PATH = "pipeline.sqlite";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id          TEXT PRIMARY KEY,
      niche       TEXT NOT NULL,
      title       TEXT NOT NULL,
      audience    TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      assembled_at TEXT,
      page_count  INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_books_niche ON books(niche);
  `);
  return _db;
}

export function recordBook(b: { id: string; niche: string; title: string; audience: string; createdAt: string }): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO books (id, niche, title, audience, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run(b.id, b.niche.toLowerCase().trim(), b.title, b.audience, b.createdAt);
}

export function booksForNiche(niche: string): { id: string; title: string }[] {
  return getDb()
    .prepare(`SELECT id, title FROM books WHERE niche = ? ORDER BY created_at`)
    .all(niche.toLowerCase().trim()) as { id: string; title: string }[];
}

export function markAssembled(id: string, pageCount: number): void {
  getDb()
    .prepare(`UPDATE books SET assembled_at = ?, page_count = ? WHERE id = ?`)
    .run(new Date().toISOString(), pageCount, id);
}
