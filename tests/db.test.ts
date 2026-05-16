import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type DbHandle } from '../src/lib/server/db';

let db: DbHandle;

function seed(name: string) {
  return db.insertImage({
    filename: `${name}.jpg`,
    originalName: `${name}.jpg`,
    mimeType: 'image/jpeg',
    size: 1234,
    width: 100,
    height: 200
  });
}

beforeEach(() => {
  db = createDb(':memory:');
});

afterEach(() => {
  db.close();
});

describe('insertImage / getImage', () => {
  it('round-trips a row with favorite cast to boolean', () => {
    const inserted = seed('a');
    expect(inserted.favorite).toBe(false);
    expect(inserted.original_name).toBe('a.jpg');
    expect(inserted.width).toBe(100);

    const fetched = db.getImage(inserted.id);
    expect(fetched).toEqual(inserted);
  });

  it('returns null for missing ids', () => {
    expect(db.getImage(9999)).toBeNull();
  });
});

describe('deleteImage', () => {
  it('returns the deleted row and removes it', () => {
    const row = seed('a');
    const removed = db.deleteImage(row.id);
    expect(removed?.id).toBe(row.id);
    expect(db.getImage(row.id)).toBeNull();
  });

  it('returns null when the id does not exist', () => {
    expect(db.deleteImage(404)).toBeNull();
  });
});

describe('setFavorite', () => {
  it('flips the favorite flag and returns the updated row', () => {
    const row = seed('a');
    const updated = db.setFavorite(row.id, true);
    expect(updated?.favorite).toBe(true);
    const re = db.setFavorite(row.id, false);
    expect(re?.favorite).toBe(false);
  });

  it('returns null when the id does not exist', () => {
    expect(db.setFavorite(404, true)).toBeNull();
  });
});

describe('listImages / pagination', () => {
  it('reports empty state with sane totals', () => {
    const page = db.listImages(1, 10);
    expect(page).toEqual({
      images: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1
    });
  });

  it('paginates and clamps out-of-range page numbers', () => {
    for (let i = 0; i < 5; i++) seed(`img${i}`);
    const first = db.listImages(1, 2);
    expect(first.total).toBe(5);
    expect(first.totalPages).toBe(3);
    expect(first.images).toHaveLength(2);

    const last = db.listImages(99, 2);
    expect(last.page).toBe(3);
    expect(last.images).toHaveLength(1);

    const negative = db.listImages(-2, 2);
    expect(negative.page).toBe(1);
  });

  it('returns ids in created-at-desc order', () => {
    const a = seed('a');
    const b = seed('b');
    const c = seed('c');
    const page = db.listImages(1, 10);
    // SQLite created_at has 1s resolution; tie-break is by id DESC, so the
    // last-inserted row should appear first.
    expect(page.images.map((i) => i.id)).toEqual([c.id, b.id, a.id]);
  });
});

describe('countImages / listAllIds', () => {
  it('reflects the current row count', () => {
    expect(db.countImages()).toBe(0);
    seed('a');
    seed('b');
    expect(db.countImages()).toBe(2);
    expect(db.listAllIds()).toHaveLength(2);
  });
});
