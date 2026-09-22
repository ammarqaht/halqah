/* المزامنة: متى يغلب الخادم ومتى يغلب المتصفّح.

   The store hydrates from the server on boot and keeps anything the server does
   not have yet — which is right for a device holding work it could not send,
   and was wrong for every other case, because «does not have yet» was read from
   the server being EMPTY. Deleting the last gift in the catalogue therefore
   could not be made to stick: the server emptied, and the next browser to open
   — any of the four supervisors' — read the emptiness as loss, kept its stale
   copy and uploaded it back.

   These tests pin the two halves apart. A list this browser owes nothing on
   takes the server's word, emptiness included. A list with unsent rows carries
   them. Both are asserted on `gifts` because that is where it was found, and
   the rule is the same for all ten synced lists.

   The module is re-imported per test: `hydrateFromServer` runs once per page
   load by design, and a fresh import is how a test gets a fresh page. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Gift } from './types';

/** localStorage, small enough to read and real enough to survive a «reload». */
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

const DB_KEY = 'halqah.db.v1';
const UNSENT_KEY = 'halqah.unsent.v1';

const gift = (over: Partial<Gift> = {}): Gift => ({
  id: 'g1', name: 'قلم', description: '', image: null,
  pointsCost: 50, quantity: 3, lowStockThreshold: 1,
  category: 'أدوات مدرسية', status: 'VISIBLE',
  createdAt: '2026-09-01T10:00:00.000Z', ...over,
});

/** Everything `GET /api/state` answers with, with the lists left empty. */
const emptyServer = (over: Record<string, unknown> = {}) => ({
  resetAt: null,
  students: [], halaqat: [],
  txns: [], batches: [], codes: [], gifts: [], orders: [],
  exams: [], examQuestions: [], bookings: [], plans: [], tajweedTopics: [],
  ...over,
});

let storage: ReturnType<typeof memoryStorage>;

/** A page load: fresh module, the storage this browser woke up holding. */
async function boot(seed: Record<string, unknown>, serverBody: unknown, ok = true) {
  storage = memoryStorage();
  for (const [k, v] of Object.entries(seed)) storage.setItem(k, JSON.stringify(v));
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok, status: ok ? 200 : 503,
    json: async () => serverBody,
  })));
  vi.resetModules();
  return import('./store');
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('a list this browser owes nothing on takes the server’s word', () => {
  it('accepts an empty catalogue instead of resurrecting its own', async () => {
    const mod = await boot(
      { [DB_KEY]: { gifts: [gift()] } },        // stale copy, nothing outstanding
      emptyServer(),                            // the gifts were deleted elsewhere
    );
    await mod.hydrateFromServer();
    expect(mod.store.get().gifts).toEqual([]);
  });

  it('does not push the deleted rows back', async () => {
    const mod = await boot({ [DB_KEY]: { gifts: [gift()] } }, emptyServer());
    await mod.hydrateFromServer();
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    /* One GET, and no PUT behind it — the resurrection was the push. */
    expect(calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'PUT'))
      .toHaveLength(0);
  });

  it('still takes a NON-empty server list, as it always did', async () => {
    const mod = await boot(
      { [DB_KEY]: { gifts: [gift({ id: 'stale' })] } },
      emptyServer({ gifts: [gift({ id: 'live', name: 'دفتر' })] }),
    );
    await mod.hydrateFromServer();
    expect(mod.store.get().gifts.map((g) => g.id)).toEqual(['live']);
  });
});

describe('a list with unsent rows still carries them', () => {
  it('keeps work this device could not send', async () => {
    const mod = await boot(
      { [DB_KEY]: { gifts: [gift()] }, [UNSENT_KEY]: ['gifts'] },
      emptyServer(),
    );
    await mod.hydrateFromServer();
    expect(mod.store.get().gifts.map((g) => g.id)).toEqual(['g1']);
  });

  it('carries only the list it owes, not every empty one', async () => {
    const mod = await boot(
      { [DB_KEY]: { gifts: [gift()], exams: [] }, [UNSENT_KEY]: ['gifts'] },
      emptyServer(),
    );
    await mod.hydrateFromServer();
    expect(mod.store.get().gifts).toHaveLength(1);
    expect(mod.store.get().exams).toEqual([]);
  });
});

describe('the marks themselves', () => {
  it('an edit records the list it touched', async () => {
    const mod = await boot({ [DB_KEY]: { gifts: [] } }, emptyServer());
    await mod.hydrateFromServer();
    mod.store.upsertGift(gift());
    expect(JSON.parse(storage.getItem(UNSENT_KEY)!)).toContain('gifts');
  });

  it('a save that lands clears them', async () => {
    const mod = await boot({ [DB_KEY]: { gifts: [] } }, emptyServer());
    await mod.hydrateFromServer();
    mod.store.upsertGift(gift());
    await mod.flushToServer();
    expect(storage.getItem(UNSENT_KEY)).toBeNull();
  });

  it('a save that fails leaves them standing', async () => {
    const mod = await boot({ [DB_KEY]: { gifts: [] } }, emptyServer(), false);
    await mod.hydrateFromServer();
    mod.store.upsertGift(gift());
    await mod.flushToServer();
    expect(JSON.parse(storage.getItem(UNSENT_KEY)!)).toContain('gifts');
  });

  it('and a DELETE is an edit like any other, so it is not carried back', async () => {
    /* The whole bug in one test: delete, save, reload, and it stays deleted. */
    const mod = await boot({ [DB_KEY]: { gifts: [gift()] } }, emptyServer());
    await mod.hydrateFromServer();
    mod.store.upsertGift(gift());
    mod.store.removeGift('g1');
    await mod.flushToServer();
    expect(storage.getItem(UNSENT_KEY)).toBeNull();

    const reloaded = await boot(
      { [DB_KEY]: JSON.parse(storage.getItem(DB_KEY)!) },   // same browser, next morning
      emptyServer(),
    );
    await reloaded.hydrateFromServer();
    expect(reloaded.store.get().gifts).toEqual([]);
  });
});
