'use client';
/* العمل بلا إنترنت — §٩-د, النسخة الأولى: «يوم العمل الجاري وحده».

   «شبكة المسجد قد تضعف، والحلقة لا تحتمل التوقف. فالشاشة تعمل والبيانات تُحفظ في
   جهاز المعلم مع شريط واضح: لا اتصال — سيُرفع تلقائيًا.»

   This is that queue, and it is deliberately small. It holds CARD SAVES only,
   keyed by (student, day), because a save is already scoped to one boy on one
   day — «والحفظ للبطاقة لا لليوم كله» — so the queue needs no merge logic: a
   second save of the same card replaces the first, which is exactly what «يغلب
   آخر حفظ» says should happen anyway.

   What it is NOT: a general offline database. The second phase is «عمل كامل بلا
   اتصال لعدة أيام مع مزامنة مؤجلة», and that needs the cards themselves cached,
   not just the writes. Building this now rather than later is still the right
   call: the save path either goes through a queue from the first line or it has
   to be torn out and rebuilt when the queue arrives.

   The server's guard is the other half (`reducesData` in lib/day.ts). A queued
   card that would blank data the server already holds is refused there and
   shown to the teacher — «فإن كان يُنقص بيانات موجودة رُفض وعُرض على المعلم» —
   because a device that has been offline is precisely where an empty save comes
   from, and an empty save from a browser has wiped live data in this system
   before. */

export type Queued = {
  /** `${studentId}:${day}` — one entry per card, so a retype replaces a retry. */
  key: string;
  body: unknown;
  /** When it was first queued, so the bar can say how long it has waited. */
  at: number;
  tries: number;
  /** The last refusal, when the server refused rather than being unreachable. */
  error?: string;
};

const KEY = 'halqah.teacher.outbox.v1';

function read(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];              // private mode, or a full quota — stay in memory
  }
}

function write(q: Queued[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* as above */ }
}

const subs = new Set<() => void>();
const emit = () => { for (const f of subs) f(); };

export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const pending = (): Queued[] => read();
export const pendingCount = (): number => read().length;

/** Queue a card, or replace the one already queued for it. */
export function enqueue(key: string, body: unknown) {
  const q = read().filter((e) => e.key !== key);
  q.push({ key, body, at: Date.now(), tries: 0 });
  write(q);
  emit();
}

export function forget(key: string) {
  write(read().filter((e) => e.key !== key));
  emit();
}

export type FlushResult = {
  sent: number;
  /** Cards the SERVER refused — a 4xx. These are shown, never retried blindly:
      a refusal is an answer, and repeating a rejected card forever is how a
      queue becomes a loop the teacher cannot see the end of. */
  refused: { key: string; error: string }[];
  /** True while the network is the problem, so the bar says «سيُرفع تلقائيًا»
      rather than blaming the teacher for something he did not do. */
  offline: boolean;
};

/**
 * Send everything waiting, oldest first.
 *
 * Order matters: two saves of one card were collapsed on the way in, but two
 * different cards were saved in the order the teacher worked through his halaqa,
 * and the revision log should read that way too.
 */
export async function flush(
  post: (body: unknown) => Promise<Response>,
): Promise<FlushResult> {
  const q = read().sort((a, b) => a.at - b.at);
  const refused: FlushResult['refused'] = [];
  let sent = 0;

  for (const e of q) {
    let res: Response;
    try {
      res = await post(e.body);
    } catch {
      /* Unreachable. Everything from here on stays queued, in order. */
      return { sent, refused, offline: true };
    }

    if (res.ok) { forget(e.key); sent++; continue; }

    /* 5xx and 429 are worth another attempt later; a 4xx is the server saying
       no, and it is put in front of the teacher instead. */
    if (res.status >= 500 || res.status === 429) {
      const all = read();
      const row = all.find((x) => x.key === e.key);
      if (row) { row.tries++; write(all); }
      continue;
    }

    const data = await res.json().catch(() => ({}));
    refused.push({ key: e.key, error: String(data.error ?? 'رُفض الحفظ.') });
    forget(e.key);
  }

  emit();
  return { sent, refused, offline: false };
}
