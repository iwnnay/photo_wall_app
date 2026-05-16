import { error } from '@sveltejs/kit';
import { createReadStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGES_DIR, getImage } from '$lib/server/db';
import type { RequestHandler } from './$types';
import type { Readable } from 'node:stream';

export const GET: RequestHandler = ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid id');

  const img = getImage(id);
  if (!img) throw error(404, 'Image not found');

  const filePath = join(IMAGES_DIR, img.filename);
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    throw error(404, 'File missing on disk');
  }

  const nodeStream = createReadStream(filePath) as Readable;
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        const data = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
        controller.enqueue(new Uint8Array(data));
      });
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    }
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': img.mime_type,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
};
