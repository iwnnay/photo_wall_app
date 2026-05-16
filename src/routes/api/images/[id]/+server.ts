import { error, json } from '@sveltejs/kit';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { IMAGES_DIR, deleteImage, getImage, setFavorite } from '$lib/server/db';
import type { RequestHandler } from './$types';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid id');
  return id;
}

export const GET: RequestHandler = ({ params }) => {
  const id = parseId(params.id!);
  const img = getImage(id);
  if (!img) throw error(404, 'Image not found');
  return json(img);
};

export const DELETE: RequestHandler = async ({ params }) => {
  const id = parseId(params.id!);
  const row = deleteImage(id);
  if (!row) throw error(404, 'Image not found');
  try {
    await unlink(join(IMAGES_DIR, row.filename));
  } catch {
    // ignore missing file
  }
  return json({ deleted: id });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = parseId(params.id!);
  let body: { favorite?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }
  if (typeof body.favorite !== 'boolean') {
    throw error(400, 'favorite must be a boolean');
  }
  const row = setFavorite(id, body.favorite);
  if (!row) throw error(404, 'Image not found');
  return json(row);
};
