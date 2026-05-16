import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DATA_DIR = resolve(process.cwd(), 'data');
export const IMAGES_DIR = join(DATA_DIR, 'images');
const DB_PATH = join(DATA_DIR, 'photo_wall.sqlite');

mkdirSync(IMAGES_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    filename     TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type    TEXT NOT NULL,
    size         INTEGER NOT NULL,
    width        INTEGER,
    height       INTEGER,
    favorite     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
`);

export type ImageRow = {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  favorite: number;
  created_at: string;
};

export type Image = Omit<ImageRow, 'favorite'> & { favorite: boolean };

function toImage(row: ImageRow): Image {
  return { ...row, favorite: row.favorite === 1 };
}

const stmts = {
  insert: db.prepare<[string, string, string, number, number | null, number | null]>(
    `INSERT INTO images (filename, original_name, mime_type, size, width, height)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  getById: db.prepare<[number]>(`SELECT * FROM images WHERE id = ?`),
  getByFilename: db.prepare<[string]>(`SELECT * FROM images WHERE filename = ?`),
  deleteById: db.prepare<[number]>(`DELETE FROM images WHERE id = ?`),
  setFavorite: db.prepare<[number, number]>(
    `UPDATE images SET favorite = ? WHERE id = ?`
  ),
  count: db.prepare(`SELECT COUNT(*) AS n FROM images`),
  listPage: db.prepare<[number, number]>(
    `SELECT * FROM images ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ),
  listAllIds: db.prepare(`SELECT id FROM images`)
};

export function insertImage(input: {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
}): Image {
  const res = stmts.insert.run(
    input.filename,
    input.originalName,
    input.mimeType,
    input.size,
    input.width,
    input.height
  );
  const row = stmts.getById.get(Number(res.lastInsertRowid)) as ImageRow;
  return toImage(row);
}

export function getImage(id: number): Image | null {
  const row = stmts.getById.get(id) as ImageRow | undefined;
  return row ? toImage(row) : null;
}

export function deleteImage(id: number): Image | null {
  const existing = getImage(id);
  if (!existing) return null;
  stmts.deleteById.run(id);
  return existing;
}

export function setFavorite(id: number, favorite: boolean): Image | null {
  stmts.setFavorite.run(favorite ? 1 : 0, id);
  return getImage(id);
}

export function countImages(): number {
  const row = stmts.count.get() as { n: number };
  return row.n;
}

export function listImages(page: number, pageSize: number): {
  images: Image[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = countImages();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;
  const rows = stmts.listPage.all(pageSize, offset) as ImageRow[];
  return {
    images: rows.map(toImage),
    total,
    page: safePage,
    pageSize,
    totalPages
  };
}

export function listAllIds(): number[] {
  const rows = stmts.listAllIds.all() as { id: number }[];
  return rows.map((r) => r.id);
}

export default db;
