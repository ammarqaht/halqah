import { describe, it, expect } from 'vitest';
import { rankBoard, standingOf, boardWindow, type Scorer } from './rank';

const s = (id: string, points: number, fullName = id): Scorer => ({ id, fullName, points });

describe('rankBoard', () => {
  it('orders by points, best first', () => {
    const r = rankBoard([s('a', 100), s('b', 300), s('c', 200)]);
    expect(r.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it('shares a place on a tie, and consumes the ones beneath it', () => {
    const r = rankBoard([s('a', 300), s('b', 200), s('c', 200), s('d', 100)]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });

  it('breaks a tie by name so two renders agree, without moving the rank', () => {
    const r = rankBoard([s('x', 50, 'بدر'), s('y', 50, 'أحمد')]);
    expect(r.map((x) => x.fullName)).toEqual(['أحمد', 'بدر']);
    expect(r.map((x) => x.rank)).toEqual([1, 1]);
  });

  it('does not mutate what it was given', () => {
    const rows = [s('a', 1), s('b', 2)];
    rankBoard(rows);
    expect(rows.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('ranks a boy on zero rather than dropping him', () => {
    const r = rankBoard([s('a', 50), s('b', 0)]);
    expect(standingOf(r, 'b')).toEqual({ rank: 2, total: 2, points: 0 });
  });
});

describe('standingOf', () => {
  it('is null for someone not on this board', () => {
    expect(standingOf(rankBoard([s('a', 10)]), 'zz')).toBeNull();
  });
});

describe('boardWindow', () => {
  const board = rankBoard(Array.from({ length: 40 }, (_, i) => s(`s${i}`, 400 - i * 10)));

  it('sends one contiguous run when he is near the top', () => {
    const w = boardWindow(board, 's5');
    expect(w.gapAfter).toBeNull();
    expect(w.rows[0].rank).toBe(4);
  });

  it('cuts the middle out when he is far down, and says where', () => {
    const w = boardWindow(board, 's30');
    expect(w.gapAfter).toBe(6);
    expect(w.rows.some((r) => r.id === 's30')).toBe(true);
    /* head 6 + his neighbourhood 5 — and emphatically not all 37. */
    expect(w.rows).toHaveLength(11);
  });

  it('never sends the whole board to someone far down it', () => {
    expect(boardWindow(board, 's39').rows.length).toBeLessThan(board.length / 2);
  });

  it('sends only the head to someone who is not on the board', () => {
    const w = boardWindow(board, 'nobody');
    expect(w.gapAfter).toBeNull();
    expect(w.rows).toHaveLength(8);
  });

  it('leaves the top three to the podium', () => {
    expect(boardWindow(board, 's5').rows.every((r) => r.rank > 3)).toBe(true);
  });
});
