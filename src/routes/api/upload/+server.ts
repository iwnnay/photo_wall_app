import { error, json } from '@sveltejs/kit';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { imageSize } from 'image-size';
import { IMAGES_DIR, insertImage, type Image } from '$lib/server/db';
import type { RequestHandler } from './$types';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff'
]);

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB per file

function safeExt(file: File): string {
  const fromName = extname(file.name).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  switch (file.type) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'image/avif':
      return '.avif';
    case 'image/bmp':
      return '.bmp';
    case 'image/tiff':
      return '.tiff';
    default:
      return '.bin';
  }
}

export const POST: RequestHandler = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    throw error(400, 'Expected multipart/form-data');
  }
  const files = form.getAll('files').filter((v): v is File => v instanceof File);
  if (!files.length) throw error(400, 'No files in upload');

  const uploaded: Image[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      skipped.push({ name: file.name, reason: `Unsupported type: ${file.type || 'unknown'}` });
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push({ name: file.name, reason: 'File exceeds 100MB limit' });
      continue;
    }

    const ext = safeExt(file);
    const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const dest = join(IMAGES_DIR, filename);

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buf);

    let width: number | null = null;
    let height: number | null = null;
    try {
      const dim = imageSize(buf);
      if (typeof dim.width === 'number') width = dim.width;
      if (typeof dim.height === 'number') height = dim.height;
    } catch {
      // unknown format; leave dimensions null
    }

    const row = insertImage({
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      width,
      height
    });
    uploaded.push(row);
  }

  return json({ uploaded, skipped });
};
