import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { IMAGES_DIR, deleteImage, type Image } from './db';

/**
 * Remove an image's DB row and its file on disk. Returns the deleted row, or
 * null if the id didn't exist. Missing file on disk is not an error — the row
 * is the source of truth.
 */
export async function removeImageFully(id: number): Promise<Image | null> {
  const row = deleteImage(id);
  if (!row) return null;
  try {
    await unlink(join(IMAGES_DIR, row.filename));
  } catch {
    // file already gone — DB row is authoritative
  }
  return row;
}
