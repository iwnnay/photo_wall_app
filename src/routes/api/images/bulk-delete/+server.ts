import { error, json } from '@sveltejs/kit';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { IMAGES_DIR, deleteImage } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (!ids.length) throw error(400, 'ids must be a non-empty array');

  const deleted: number[] = [];
  for (const id of ids) {
    const row = deleteImage(id);
    if (!row) continue;
    try {
      await unlink(join(IMAGES_DIR, row.filename));
    } catch {
      // file may have been removed already; row is gone, that's fine
    }
    deleted.push(id);
  }
  return json({ deleted });
};
