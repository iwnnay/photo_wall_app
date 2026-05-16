export const ANIMATIONS = [
  'fade',
  'zoom-in',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'ken-burns'
] as const;
export type Animation = (typeof ANIMATIONS)[number];

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickAnimation(rng: Rng = Math.random): Animation {
  return ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)];
}

export type StepInput<T extends { id: number }> = {
  images: readonly T[];
  order: readonly number[];
  cursor: number;
  direction: 1 | -1;
  rng?: Rng;
};

export type StepResult<T extends { id: number }> =
  | { kind: 'empty' }
  | { kind: 'advanced'; images: T[]; order: number[]; cursor: number; current: T };

/**
 * Pure, deterministic-with-rng step that mirrors what `+page.svelte` does.
 * Returns the new images/order/cursor/current, or { kind: 'empty' } if nothing
 * is showable. Wraps the order with a fresh shuffle at either end.
 */
export function step<T extends { id: number }>(input: StepInput<T>): StepResult<T> {
  const rng = input.rng ?? Math.random;
  let images = input.images.slice();
  let order = input.order.slice();
  let cursor = input.cursor + input.direction;

  if (images.length === 0) return { kind: 'empty' };

  if (cursor >= order.length) {
    order = shuffle(images.map((i) => i.id), rng);
    cursor = 0;
  } else if (cursor < 0) {
    order = shuffle(images.map((i) => i.id), rng);
    cursor = order.length - 1;
  }

  // The id at `cursor` may reference an image we no longer have (e.g. it was
  // deleted between loads). Drop it everywhere and recurse.
  let id = order[cursor];
  let found = images.find((i) => i.id === id);
  while (!found) {
    images = images.filter((i) => i.id !== id);
    order = order.filter((x) => x !== id);
    if (cursor >= order.length) cursor = order.length - 1;
    if (!order.length) return { kind: 'empty' };
    id = order[cursor];
    found = images.find((i) => i.id === id);
  }

  return { kind: 'advanced', images, order, cursor, current: found };
}

/**
 * Builds the order for a freshly loaded image list while keeping the currently
 * displayed image (if any) pinned to the front, so the visible photo doesn't
 * jump when the list refreshes.
 */
export function buildOrderKeepingCurrent<T extends { id: number }>(
  images: readonly T[],
  current: T | null,
  rng: Rng = Math.random
): { order: number[]; cursor: number } {
  const remaining = images.filter((i) => i.id !== current?.id);
  const next = shuffle(remaining, rng).map((i) => i.id);
  if (current && images.some((i) => i.id === current.id)) {
    return { order: [current.id, ...next], cursor: 0 };
  }
  return { order: next, cursor: -1 };
}
