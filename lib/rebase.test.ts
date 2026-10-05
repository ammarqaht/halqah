import { describe, expect, it } from 'vitest';
import { rebaseList } from './store';

/* «ما يقدر يطبع الخطة … ولا يغير مستواه» (client, 5 Oct 2026): the older page
   saved its morning copy over the afternoon's work. A refused save rebases its
   own changes onto the newer data instead — these are the rules it keeps. */
type R = { id: string; v: string };
const row = (id: string, v: string): R => ({ id, v });

describe('rebaseList — this page\'s changes on top of the server\'s', () => {
  const a = row('a', 'morning'), b = row('b', 'morning'), c = row('c', 'morning');
  const base = new Map<string, R>([['a', a], ['b', b], ['c', c]]);

  it('takes the other machine\'s edits to rows this page did not touch', () => {
    const server = [row('a', 'afternoon'), b, c];
    expect(rebaseList(server, [a, b, c], base).find((r) => r.id === 'a')?.v).toBe('afternoon');
  });

  it('keeps this page\'s own edit', () => {
    const mine = row('b', 'edited here');
    const out = rebaseList([a, row('b', 'afternoon'), c], [a, mine, c], base);
    expect(out.find((r) => r.id === 'b')?.v).toBe('edited here');
  });

  it('keeps a row added on the other machine (the plan the level screen issued)', () => {
    const out = rebaseList([a, b, c, row('p', 'plan 47')], [a, b, c], base);
    expect(out.map((r) => r.id)).toContain('p');
  });

  it('keeps a row added here', () => {
    const out = rebaseList([a, b, c], [a, b, c, row('n', 'new here')], base);
    expect(out.map((r) => r.id)).toContain('n');
  });

  it('honours a deletion made here', () => {
    const out = rebaseList([a, b, c], [a, b], base);
    expect(out.map((r) => r.id)).not.toContain('c');
  });

  it('honours a deletion made on the other machine', () => {
    const out = rebaseList([a, b], [a, b, c], base);
    expect(out.map((r) => r.id)).not.toContain('c');
  });

  it('keeps a row this page changed even if the other machine deleted it', () => {
    const mine = row('c', 'edited here');
    const out = rebaseList([a, b], [a, b, mine], base);
    expect(out.find((r) => r.id === 'c')?.v).toBe('edited here');
  });
});
