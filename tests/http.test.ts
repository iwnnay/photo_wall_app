import { describe, expect, it } from 'vitest';
import { parseId, parsePositiveInt } from '../src/lib/server/http';

describe('parseId', () => {
  it('returns the number for valid positive integers', () => {
    expect(parseId('1')).toBe(1);
    expect(parseId('42')).toBe(42);
  });

  it('throws a 400-like error for non-integers, zero, negative, or junk', () => {
    for (const bad of ['0', '-3', '1.5', 'abc', '', null, undefined]) {
      let threw: unknown = null;
      try {
        parseId(bad as string | null | undefined);
      } catch (e) {
        threw = e;
      }
      expect(threw, `expected parseId(${JSON.stringify(bad)}) to throw`).not.toBeNull();
      expect((threw as { status?: number }).status).toBe(400);
    }
  });
});

describe('parsePositiveInt', () => {
  it('returns the fallback for null / empty / nonsense input', () => {
    expect(parsePositiveInt(null, 7)).toBe(7);
    expect(parsePositiveInt('', 7)).toBe(7);
    expect(parsePositiveInt('abc', 7)).toBe(7);
  });

  it('clamps to the [min, max] range', () => {
    expect(parsePositiveInt('5', 1, { min: 1, max: 3 })).toBe(3);
    expect(parsePositiveInt('-9', 1, { min: 1, max: 3 })).toBe(1);
    expect(parsePositiveInt('2', 1, { min: 1, max: 3 })).toBe(2);
  });

  it('floors fractional input', () => {
    expect(parsePositiveInt('2.9', 1)).toBe(2);
  });
});
