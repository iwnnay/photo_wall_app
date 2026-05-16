import { error, json } from '@sveltejs/kit';
import { getImage, setFavorite } from '$lib/server/db';
import { removeImageFully } from '$lib/server/files';
import { parseId } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
  const img = getImage(parseId(params.id));
  if (!img) throw error(404, 'Image not found');
  return json(img);
};

export const DELETE: RequestHandler = async ({ params }) => {
  const id = parseId(params.id);
  const row = await removeImageFully(id);
  if (!row) throw error(404, 'Image not found');
  return json({ deleted: id });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = parseId(params.id);
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
