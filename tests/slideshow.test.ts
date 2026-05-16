import { describe, expect, it } from 'vitest';
import {
  ANIMATIONS,
  buildOrderKeepingCurrent,
  pickAnimation,
  shuffle,
  step
} from '../src/lib/slideshow';

type Img = { id: number };

// Deterministic RNG: feeds a fixed sequence then loops.
function seededRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

const imgs = (...ids: number[]): Img[] => ids.map((id) => ({ id }));

describe('shuffle', () => {
  it('returns a permutation, never mutates the input', () => {
    const input = [1, 2, 3, 4, 5];
    const before = input.slice();
    const out = shuffle(input, seededRng([0.1, 0.5, 0.9, 0.3]));
    expect(input).toEqual(before);
    expect(out.slice().sort()).toEqual(before.slice().sort());
  });

  it('is deterministic given a fixed rng', () => {
    const a = shuffle([1, 2, 3, 4], seededRng([0, 0, 0]));
    const b = shuffle([1, 2, 3, 4], seededRng([0, 0, 0]));
    expect(a).toEqual(b);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle<number>([])).toEqual([]);
    expect(shuffle([42])).toEqual([42]);
  });
});

describe('pickAnimation', () => {
  it('always picks something inside the ANIMATIONS list', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const out = pickAnimation(() => r);
      expect(ANIMATIONS).toContain(out);
    }
  });
});

describe('step', () => {
  it('returns kind:"empty" when there are no images', () => {
    const r = step({ images: [], order: [], cursor: 0, direction: 1 });
    expect(r.kind).toBe('empty');
  });

  it('advances the cursor and reports the image at that position', () => {
    const images = imgs(10, 20, 30);
    const r = step({ images, order: [10, 20, 30], cursor: 0, direction: 1 });
    expect(r.kind).toBe('advanced');
    if (r.kind !== 'advanced') return;
    expect(r.cursor).toBe(1);
    expect(r.current).toEqual({ id: 20 });
  });

  it('reshuffles when stepping forward past the end', () => {
    const images = imgs(10, 20, 30);
    const r = step({
      images,
      order: [10, 20, 30],
      cursor: 2,
      direction: 1,
      // First rng draw shapes the new shuffled order; subsequent draws unused.
      rng: seededRng([0, 0, 0])
    });
    expect(r.kind).toBe('advanced');
    if (r.kind !== 'advanced') return;
    expect(r.cursor).toBe(0);
    expect(r.order.slice().sort()).toEqual([10, 20, 30]);
  });

  it('reshuffles when stepping backward past zero', () => {
    const images = imgs(10, 20, 30);
    const r = step({
      images,
      order: [10, 20, 30],
      cursor: 0,
      direction: -1,
      rng: seededRng([0, 0, 0])
    });
    expect(r.kind).toBe('advanced');
    if (r.kind !== 'advanced') return;
    expect(r.cursor).toBe(r.order.length - 1);
  });

  it('drops ids that no longer exist in the image list and tries the next one', () => {
    const images = imgs(10, 30); // 20 was deleted server-side
    const r = step({ images, order: [10, 20, 30], cursor: 0, direction: 1 });
    expect(r.kind).toBe('advanced');
    if (r.kind !== 'advanced') return;
    expect(r.order).toEqual([10, 30]);
    expect(r.current).toEqual({ id: 30 });
  });

  it('returns empty when every remaining id is stale', () => {
    const r = step({
      images: imgs(99),
      order: [1, 2, 3],
      cursor: 0,
      direction: 1
    });
    expect(r.kind).toBe('empty');
  });
});

describe('buildOrderKeepingCurrent', () => {
  it('puts the current image at cursor 0 and shuffles the rest behind it', () => {
    const images = imgs(1, 2, 3, 4);
    const current = { id: 2 };
    const { order, cursor } = buildOrderKeepingCurrent(images, current, seededRng([0, 0, 0]));
    expect(order[0]).toBe(2);
    expect(order.slice().sort()).toEqual([1, 2, 3, 4]);
    expect(cursor).toBe(0);
  });

  it('produces cursor -1 (no current) when current is null', () => {
    const { order, cursor } = buildOrderKeepingCurrent(imgs(1, 2, 3), null);
    expect(cursor).toBe(-1);
    expect(order.slice().sort()).toEqual([1, 2, 3]);
  });

  it('does not pin a current that is no longer in the list', () => {
    const { order, cursor } = buildOrderKeepingCurrent(imgs(1, 2), { id: 99 });
    expect(order.slice().sort()).toEqual([1, 2]);
    expect(cursor).toBe(-1);
  });
});
