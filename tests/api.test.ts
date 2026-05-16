import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as listGET } from '../src/routes/api/images/+server';
import {
  GET as imageGET,
  DELETE as imageDELETE,
  PATCH as imagePATCH
} from '../src/routes/api/images/[id]/+server';
import { POST as bulkDELETE } from '../src/routes/api/images/bulk-delete/+server';
import rawDb, { insertImage, getImage } from '../src/lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';

// Build a fake RequestEvent good enough for the handlers we test.
// Only the fields each handler reads need to be present.
function evt(opts: {
  params?: Record<string, string>;
  url?: string;
  body?: unknown;
}): RequestEvent {
  const url = new URL(opts.url ?? 'http://localhost/api');
  const body = opts.body;
  const event = {
    params: opts.params ?? {},
    url,
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  };
  return event as unknown as RequestEvent;
}

function seed(name: string) {
  return insertImage({
    filename: `${name}.jpg`,
    originalName: `${name}.jpg`,
    mimeType: 'image/jpeg',
    size: 100,
    width: null,
    height: null
  });
}

// The singleton DB is in-memory (vitest config sets PHOTO_WALL_DB=:memory:).
// Wipe rows between tests by truncating the table directly — going through the
// DELETE handler would do disk-unlinks for files we never wrote.
beforeEach(() => {
  rawDb.exec('DELETE FROM images');
});

afterEach(() => {
  rawDb.exec('DELETE FROM images');
});

describe('GET /api/images', () => {
  it('returns an empty page with sensible defaults', async () => {
    const res = await listGET(evt({}) as never);
    const body = await (res as Response).json();
    expect(body).toEqual({
      images: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 1
    });
  });

  it('respects page and pageSize, clamping pageSize to 200', async () => {
    for (let i = 0; i < 3; i++) seed(`a${i}`);
    const res = await listGET(
      evt({ url: 'http://localhost/api?page=1&pageSize=2' }) as never
    );
    const body = await (res as Response).json();
    expect(body.total).toBe(3);
    expect(body.pageSize).toBe(2);
    expect(body.images).toHaveLength(2);

    const clamped = await listGET(
      evt({ url: 'http://localhost/api?pageSize=99999' }) as never
    );
    const cBody = await (clamped as Response).json();
    expect(cBody.pageSize).toBe(200);
  });
});

describe('GET /api/images/[id]', () => {
  it('returns the image when it exists', async () => {
    const row = seed('a');
    const res = await imageGET(evt({ params: { id: String(row.id) } }) as never);
    const body = await (res as Response).json();
    expect(body.id).toBe(row.id);
    expect(body.original_name).toBe('a.jpg');
  });

  it('throws 404 for missing ids', () => {
    expect(() => imageGET(evt({ params: { id: '99999' } }) as never)).toThrow(
      expect.objectContaining({ status: 404 })
    );
  });

  it('throws 400 for invalid ids', () => {
    expect(() => imageGET(evt({ params: { id: 'abc' } }) as never)).toThrow(
      expect.objectContaining({ status: 400 })
    );
  });
});

describe('PATCH /api/images/[id]', () => {
  it('flips favorite to true', async () => {
    const row = seed('a');
    const res = await imagePATCH(
      evt({ params: { id: String(row.id) }, body: { favorite: true } }) as never
    );
    const body = await (res as Response).json();
    expect(body.favorite).toBe(true);
  });

  it('rejects non-boolean favorite with 400', async () => {
    const row = seed('a');
    await expect(
      imagePATCH(
        evt({ params: { id: String(row.id) }, body: { favorite: 'yes' } }) as never
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects malformed JSON with 400', async () => {
    const row = seed('a');
    const url = new URL('http://localhost/api');
    const ev = {
      params: { id: String(row.id) },
      url,
      request: new Request(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{ not json'
      })
    } as unknown as RequestEvent;
    await expect(imagePATCH(ev as never)).rejects.toMatchObject({ status: 400 });
  });

  it('returns 404 for unknown ids', async () => {
    await expect(
      imagePATCH(evt({ params: { id: '12345' }, body: { favorite: true } }) as never)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('DELETE /api/images/[id]', () => {
  it('removes the row and returns its id', async () => {
    const row = seed('a');
    const res = await imageDELETE(evt({ params: { id: String(row.id) } }) as never);
    const body = await (res as Response).json();
    expect(body).toEqual({ deleted: row.id });
    expect(getImage(row.id)).toBeNull();
  });

  it('returns 404 for missing ids', async () => {
    await expect(
      imageDELETE(evt({ params: { id: '12345' } }) as never)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('POST /api/images/bulk-delete', () => {
  it('deletes the rows whose ids exist and reports them', async () => {
    const a = seed('a');
    const b = seed('b');
    const c = seed('c');
    const res = await bulkDELETE(
      evt({ body: { ids: [a.id, b.id, 99999] } }) as never
    );
    const body = await (res as Response).json();
    expect(new Set(body.deleted)).toEqual(new Set([a.id, b.id]));
    expect(getImage(a.id)).toBeNull();
    expect(getImage(b.id)).toBeNull();
    expect(getImage(c.id)).not.toBeNull();
  });

  it('rejects an empty / missing ids array with 400', async () => {
    await expect(bulkDELETE(evt({ body: { ids: [] } }) as never)).rejects.toMatchObject({
      status: 400
    });
    await expect(bulkDELETE(evt({ body: {} }) as never)).rejects.toMatchObject({
      status: 400
    });
  });

  it('rejects malformed JSON with 400', async () => {
    const url = new URL('http://localhost/api');
    const ev = {
      url,
      request: new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ broken'
      })
    } as unknown as RequestEvent;
    await expect(bulkDELETE(ev as never)).rejects.toMatchObject({ status: 400 });
  });
});
