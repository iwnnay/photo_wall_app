import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MIME,
  MAX_BYTES,
  buildStoredFilename,
  safeExt,
  validateUpload
} from '../src/lib/server/uploads';

describe('safeExt', () => {
  it('uses the original name extension when it looks reasonable', () => {
    expect(safeExt('photo.JPG', 'image/jpeg')).toBe('.jpg');
    expect(safeExt('weird.webp', 'image/webp')).toBe('.webp');
  });

  it('falls back to a MIME-mapped extension when the name has none', () => {
    expect(safeExt('photo', 'image/png')).toBe('.png');
    expect(safeExt('', 'image/gif')).toBe('.gif');
  });

  it('falls back to a MIME-mapped extension for obviously bogus names', () => {
    expect(safeExt('a.weird-suffix-here', 'image/jpeg')).toBe('.jpg');
    expect(safeExt('a.', 'image/jpeg')).toBe('.jpg');
  });

  it('returns .bin when neither name nor MIME hint at an image', () => {
    expect(safeExt('photo', 'application/octet-stream')).toBe('.bin');
  });
});

describe('validateUpload', () => {
  it('accepts every MIME in the allow-list at reasonable sizes', () => {
    for (const mime of ALLOWED_MIME) {
      expect(validateUpload({ type: mime, size: 1024 })).toEqual({ ok: true });
    }
  });

  it('rejects unknown types with a reason', () => {
    const r = validateUpload({ type: 'application/pdf', size: 1024 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Unsupported type/);
  });

  it('reports an "unknown" reason for empty MIME', () => {
    const r = validateUpload({ type: '', size: 1024 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('unknown');
  });

  it('rejects files larger than the 100MB cap', () => {
    const r = validateUpload({ type: 'image/png', size: MAX_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/100MB/);
  });

  it('accepts files at exactly the cap', () => {
    expect(validateUpload({ type: 'image/png', size: MAX_BYTES })).toEqual({ ok: true });
  });
});

describe('buildStoredFilename', () => {
  it('combines time-prefix, random suffix, and the chosen extension', () => {
    const name = buildStoredFilename('me.jpg', 'image/jpeg', () => 'abc123', () => 1700000000000);
    expect(name).toBe('1700000000000-abc123.jpg');
  });

  it('uses the MIME-derived extension when the name has none', () => {
    const name = buildStoredFilename('no-ext', 'image/webp', () => 'x', () => 1);
    expect(name).toBe('1-x.webp');
  });
});
