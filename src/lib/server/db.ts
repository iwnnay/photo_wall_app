import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const DATA_DIR = resolve(process.cwd(), 'data');
export const IMAGES_DIR = join(DATA_DIR, 'images');
const DEFAULT_DB_PATH = join(DATA_DIR, 'photo_wall.sqlite');

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

export type DbHandle = ReturnType<typeof createDb>;

function rowToImage(row: ImageRow): Image {
  return { ...row, favorite: row.favorite === 1 };
}

/**
 * Open (or create) a SQLite DB at `path`, apply migrations, and return a small
 * handle bundling prepared statements + image helpers. Pass `':memory:'` in
 * tests. The default singleton (exported below) is what runtime code uses.
 */
export function createDb(path: string) {
  const isMemory = path === ':memory:';
  if (!isMemory) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  if (!isMemory) db.pragma('journal_mode = WAL');
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

  function insertImage(input: {
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
    return rowToImage(row);
  }

  function getImage(id: number): Image | null {
    const row = stmts.getById.get(id) as ImageRow | undefined;
    return row ? rowToImage(row) : null;
  }

  function deleteImage(id: number): Image | null {
    const existing = getImage(id);
    if (!existing) return null;
    stmts.deleteById.run(id);
    return existing;
  }

  function setFavorite(id: number, favorite: boolean): Image | null {
    stmts.setFavorite.run(favorite ? 1 : 0, id);
    return getImage(id);
  }

  function countImages(): number {
    const row = stmts.count.get() as { n: number };
    return row.n;
  }

  function listImages(page: number, pageSize: number) {
    const total = countImages();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * pageSize;
    const rows = stmts.listPage.all(pageSize, offset) as ImageRow[];
    return {
      images: rows.map(rowToImage),
      total,
      page: safePage,
      pageSize,
      totalPages
    };
  }

  function listAllIds(): number[] {
    const rows = stmts.listAllIds.all() as { id: number }[];
    return rows.map((r) => r.id);
  }

  return {
    raw: db,
    insertImage,
    getImage,
    deleteImage,
    setFavorite,
    countImages,
    listImages,
    listAllIds,
    close: () => db.close()
  };
}

// Runtime singleton. `PHOTO_WALL_DB` lets ops point at an alternate path
// without editing code.
mkdirSync(IMAGES_DIR, { recursive: true });
const singleton = createDb(process.env.PHOTO_WALL_DB ?? DEFAULT_DB_PATH);

export const insertImage = singleton.insertImage;
export const getImage = singleton.getImage;
export const deleteImage = singleton.deleteImage;
export const setFavorite = singleton.setFavorite;
export const countImages = singleton.countImages;
export const listImages = singleton.listImages;
export const listAllIds = singleton.listAllIds;

export default singleton.raw;
