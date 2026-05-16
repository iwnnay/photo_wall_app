import { error } from '@sveltejs/kit';

export function parseId(raw: string | undefined | null): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid id');
  return id;
}

/** Parse-or-return-default for pagination query params. Clamps to [min, max]. */
export function parsePositiveInt(
  raw: string | null,
  fallback: number,
  { min = 1, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}
): number {
  const n = Number(raw ?? fallback) || fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
