import { error, json } from '@sveltejs/kit';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { imageSize } from 'image-size';
import { IMAGES_DIR, insertImage, type Image } from '$lib/server/db';
import { buildStoredFilename, validateUpload } from '$lib/server/uploads';
import type { RequestHandler } from './$types';

function probeDimensions(buf: Buffer): { width: number | null; height: number | null } {
  try {
    const dim = imageSize(buf);
    return {
      width: typeof dim.width === 'number' ? dim.width : null,
      height: typeof dim.height === 'number' ? dim.height : null
    };
  } catch {
    return { width: null, height: null };
  }
}

export const POST: RequestHandler = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw error(400, 'Expected multipart/form-data');
  }
  const files = form.getAll('files').filter((v): v is File => v instanceof File);
  if (!files.length) throw error(400, 'No files in upload');

  const uploaded: Image[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const file of files) {
    const check = validateUpload(file);
    if (!check.ok) {
      skipped.push({ name: file.name, reason: check.reason });
      continue;
    }

    const filename = buildStoredFilename(file.name, file.type, () =>
      randomBytes(6).toString('hex')
    );
    const dest = join(IMAGES_DIR, filename);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buf);

    const { width, height } = probeDimensions(buf);
    uploaded.push(
      insertImage({
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        width,
        height
      })
    );
  }

  return json({ uploaded, skipped });
};
