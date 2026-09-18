import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertMine, fail, scope, teacherSettings, type Who } from '../_scope';
import {
  cardsFor, clearCard, reducesData, saveCard, REASON_AR, type SaveCard,
} from '@/lib/day';
import { dayHeading, dayState, inFuture, opensItself } from '@/lib/teacher';
import { isoDate } from '@/lib/dates';
import { PLAN_KIND_ORDER } from '@/lib/types';

/* مع-٣ — صفحة التسجيل. «قلب البوابة كلها».

   One route serves two of the three modes, because they are one screen: وضع
   «اليوم» is `?day=` omitted, and وضع «يوم سابق» is `?day=` given. The third —
   «فترة لطالب» — is `/api/teacher/period`, because its axis is days for one
   student rather than students for one day.

   There is no start and no close: «لا زرّ بدء ولا إقفال». A GET for a day that
   has nothing saved returns the same cards with empty values. */

export async function GET(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const url = new URL(req.url);
  const today = isoDate(new Date());
  const day = (url.searchParams.get('day') || today).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail('تاريخ غير صحيح.');
  /* «ولا يقبل النظام تسجيلًا على يوم لم يأتِ بعد» — refused at the read too, so
     the screen cannot show a future day it would then fail to save. */
  if (inFuture(day, today)) return fail('لا يمكن التسجيل على يوم لم يأتِ بعد.', 422);

  const { weekdays, daily } = await teacherSettings(who.halaqaId);
  const cards = await cardsFor({ halaqaId: who.halaqaId, day, daily });
  const saved = cards.filter((c) => c.status !== null).length;

  return NextResponse.json({
    day,
    heading: dayHeading(day),
    /* Not a gate: «أيّ يوم يكون فيه تحضير يُعتبر يوم حلقة». This only says
       whether the day was waiting for him or whether he is opening one that
       was not his halaqa's — which the screen marks, «بلون منبّه حتى لا يُدخل
       يومًا مكان يوم». */
    opensItself: opensItself(day, weekdays),
    isToday: day === today,
    state: dayState(saved, cards.length),
    counts: {
      roster: cards.length,
      saved,
      present: cards.filter((c) => c.status === 'PRESENT' || c.status === 'LATE').length,
      absent: cards.filter((c) => c.status === 'ABSENT').length,
      recited: cards.filter((c) => c.lines.some((l) => l.recited)).length,
      /* «ملخّص اليوم في أعلى الصفحة محسوب على الدوام» — so no end-of-halaqa tap. */
      points: cards.reduce((n, c) => n + c.points, 0),
    },
    reasons: REASON_AR,
    /* The table the card's own «نقاط اليوم» box is computed from. The screen
       could not be trusted to guess it: the supervisor may have switched to the
       first requirements document's figures, and a box on the card disagreeing
       with the ledger it writes is worse than no box. */
    daily,
    cards,
  });
}

/**
 * Save a card — «ثم زرّ حفظ للبطاقة، فيُحفظ تسجيل الطالب وينتهي أمره».
 *
 * One card is the ordinary case and the one the document describes. `cards` is
 * the other: «زر حفظ الكل» (client, 18 Sep 2026), and it is served here rather
 * than by the screen firing twenty-five requests — a phone on mosque wifi makes
 * that the difference between a second and a minute. Each card is still its own
 * transaction, so a bad one fails alone and the rest land.
 */
export async function POST(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('طلب غير صحيح.');

  if (Array.isArray(body.cards)) {
    if (body.cards.length > 60) return fail('عدد البطاقات أكبر مما تحتمله دفعة واحدة.');
    const results: Record<string, unknown>[] = [];
    for (const one of body.cards) {
      const r = await saveOne(who, { ...one, day: one?.day ?? body.day });
      results.push(r);
    }
    return NextResponse.json({
      ok: true,
      saved: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
      results,
    });
  }

  const r = await saveOne(who, body);
  return NextResponse.json(r, { status: r.ok ? 200 : Number(r.status ?? 400) });
}

/** One card, start to finish — validation, the offline guard, and the write. */
async function saveOne(who: Who, body: Record<string, never> | Record<string, unknown>) {
  const today = isoDate(new Date());
  const day = String(body.day ?? today).slice(0, 10);
  const studentId = String(body.studentId ?? '');
  const status = String(body.status ?? '');
  const no = (error: string, status = 400) => ({ ok: false as const, studentId, error, status });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return no('تاريخ غير صحيح.');
  if (inFuture(day, today)) return no('لا يمكن التسجيل على يوم لم يأتِ بعد.', 422);
  /* The halaqa comes from the cookie; the student is checked against it in the
     DATABASE. A body naming someone else's boy is refused, not filtered. */
  if (!studentId || !(await assertMine(who.halaqaId, studentId))) {
    return no('هذا الطالب ليس في حلقتك.', 403);
  }

  /* A card whose attendance was CLEARED — «إذا شلت تحضير اليوم المفروض إنه
     يمديني أحفظ التعديل». The day's record goes, its points come back, and the
     boy returns to the مقرّر it was about. */
  if (body.status === null || body.status === '') {
    try {
      const r = await clearCard({ halaqaId: who.halaqaId, studentId, day, by: who });
      return { ok: true as const, studentId, cleared: r.cleared, pointsDelta: r.pointsDelta,
        assignmentNo: null, awaitingExam: null, reachedExam: false, incomplete: false,
        points: 0, entryId: '' };
    } catch (e) {
      return { ...no('تعذّر مسح التسجيل. أعد المحاولة.', 500),
        detail: e instanceof Error ? e.message : '' };
    }
  }

  if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) return no('حالة حضور غير معروفة.');

  const card: SaveCard = {
    studentId,
    day,
    status: status as SaveCard['status'],
    thobe: !!body.thobe,
    note: String(body.note ?? ''),
    /* مسار التلقين وحده. Passed through as typed and settled in `lib/day.ts`,
       which matches the name against the 114 and clamps the ayah to it — the
       shape of the request is not the place to decide what a surah is. */
    talqeenSurah: body.talqeenSurah == null ? null : String(body.talqeenSurah),
    talqeenAyah: body.talqeenAyah == null ? null
      : Math.trunc(Number(body.talqeenAyah)) || null,
    lines: PLAN_KIND_ORDER.map((kind) => {
      const sent = Array.isArray(body.lines)
        ? body.lines.find((l: { kind?: string }) => l?.kind === kind) as
            { recited?: boolean; errors?: number; note?: string } | undefined
        : undefined;
      return {
        kind,
        recited: !!sent?.recited,
        errors: Number(sent?.errors ?? 0),
        note: String(sent?.note ?? ''),
      };
    }),
  };

  /* الحارس — §٩-د, and ONLY on what a reconnecting device sends back.

     «ما يُرفع من جهاز المعلم بعد انقطاع لا يُقبل قبل أن يُقاس بما في الخادم:
     فإن كان يُنقص بيانات موجودة رُفض وعُرض على المعلم.» That is the case it was
     written for: a phone that has been offline holds a stale card, and an empty
     save from a browser has wiped live data in the supervisor's portal twice
     already.

     It must NOT apply to a save the teacher is making right now. He can see the
     card, he ticked the boxes, and un-ticking one is a correction — which is the
     whole reason the three recording modes exist. Refusing it would leave him
     facing an error he has no way to clear, over an edit the document explicitly
     grants him. What protects the data there is the revision log: nothing is
     overwritten into nothing, «ويُسجَّل السابق في سجّل التعديل».

     So the outbox stamps what it replays, and only that is measured. */
  if (body.queued === true) {
    const held = await db.dayEntry.findUnique({
      where: { studentId_day: { studentId, day } },
      select: { status: true, thobe: true, lines: { select: { recited: true } } },
    });
    if (reducesData(card, held)) {
      return no('بطاقة محفوظة على جهازك أقدم مما في الخادم — رُفضت حتى لا تُنقص'
        + ' المحفوظ. افتح اليوم وراجع البطاقة.', 409);
    }
  }

  const { daily } = await teacherSettings(who.halaqaId);

  try {
    const r = await saveCard({
      halaqaId: who.halaqaId, card, by: who, items: daily.items, golden: daily.golden });
    return { ok: true as const, studentId, ...r };
  } catch (e) {
    return { ...no('تعذّر الحفظ. أعد المحاولة.', 500),
      detail: e instanceof Error ? e.message : '' };
  }
}
