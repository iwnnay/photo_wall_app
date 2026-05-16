import { error } from '@sveltejs/kit';
import { createReadStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { IMAGES_DIR, getImage } from '$lib/server/db';
import { parseId } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
  const img = getImage(parseId(params.id));
  if (!img) throw error(404, 'Image not found');

  const filePath = join(IMAGES_DIR, img.filename);
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    throw error(404, 'File missing on disk');
  }

  const webStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': img.mime_type,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
};
