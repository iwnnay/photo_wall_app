import { extname } from 'node:path';

export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff'
]);

export const MAX_BYTES = 100 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff'
};

/**
 * Pick a safe filesystem extension for an uploaded file. Prefers the original
 * name's extension when it looks plausible; otherwise falls back to a mapping
 * keyed off the MIME type.
 */
export function safeExt(name: string, mime: string): string {
  const fromName = extname(name).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return EXT_BY_MIME[mime] ?? '.bin';
}

export type UploadValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateUpload(file: { type: string; size: number }): UploadValidation {
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, reason: `Unsupported type: ${file.type || 'unknown'}` };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: 'File exceeds 100MB limit' };
  }
  return { ok: true };
}

/** Generate a unique filename for storage. Time-prefixed for chronological-ish ordering. */
export function buildStoredFilename(
  originalName: string,
  mime: string,
  random: () => string = () => Math.random().toString(36).slice(2, 14),
  now: () => number = Date.now
): string {
  return `${now()}-${random()}${safeExt(originalName, mime)}`;
}
