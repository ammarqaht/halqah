import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scope } from '../_scope';
import { isoDate } from '@/lib/dates';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';

/** Written out, not abbreviated. «ملاحظة معلمك على م.ك» is a line of a printed
    column read aloud to a child; «على المراجعة الكبرى» is a sentence. */
const KIND_AR: Record<string, string> = {
  DARS: 'الدرس', MURAJAA_SUGHRA: 'المراجعة الصغرى', MURAJAA_KUBRA: 'المراجعة الكبرى',
};

/* تنبيهاتي — الطالب.
   «أضف زرّ الجرس للطالب، وبلوك التنبيهات كذلك أسفل بلوك الاختبارات، وتعرض
   للطالب التنبيهات التي تُسجَّل له من قِبل المعلم أثناء تسجيل التسميع، وترسل له
   تنبيهات الاختبارات وتنبيهات الهدايا والتي تُرسل من قِبل المشرف» (client,
   18 Sep 2026).

   FIVE KINDS, AND ALL OF THEM ARE ROWS. The same rule the teacher's alerts are
   built on holds here and matters more: «والتنبيه الذي لا يستطيع النظام حسابه
   لا يُعرض أصلًا». A boy must not be told anything the system cannot point at.

     NOTE     ملاحظة كتبها معلمه أثناء التسميع — على مقرّر بعينه أو على يومه
     EXAM     نتيجة اختبار سُجِّلت له
     BOOKED   اختبار حُجز له، ويومه
     GIFT     طلبه من المتجر: قُبل، أو سُلِّم، أو أُلغي
     MESSAGE  رسالة من الإدارة، إليه أو إلى الطلاب جميعًا

   NOTHING IS ADDRESSED TO HIM THAT ISN'T HIS. Every query here is keyed on the
   id in his COOKIE, and the admin messages are filtered on `audience` as well —
   a teachers' announcement must never land on a boy's screen. */

/** How far back a thing is still news. A fortnight, as on the teacher's side. */
const NEWS_DAYS = 14;

export type StudentAlert = {
  kind: 'NOTE' | 'EXAM' | 'BOOKED' | 'GIFT' | 'MESSAGE';
  key: string;
  read: boolean;
  /** Where a tap goes, when there is anywhere. */
  href?: string;
  title: string;
  body: string;
  at: string;
};

const alertKey = (kind: StudentAlert['kind'], ...parts: (string | number | null)[]) =>
  [kind, ...parts.map((p) => String(p ?? ''))].join(':');

const ORDER_AR: Record<string, string> = {
  PENDING: 'طلبك في الانتظار', DELIVERED: 'تسلَّمت هديتك', CANCELLED: 'أُلغي طلبك',
};

export async function GET() {
  const g = await scope();
  if (!g.ok) return g.res;
  const me = g.s.sub;

  const today = isoDate(new Date());
  const since = isoDate(new Date(Date.now() - NEWS_DAYS * 86_400_000));

  const [days, exams, bookings, orders, messages, reads] = await Promise.all([
    /* «التنبيهات التي تُسجَّل له من قِبل المعلم أثناء تسجيل التسميع» — the note on
       the day and the note beside each مقرّر, which is what that box writes. */
    db.dayEntry.findMany({
      where: { studentId: me, day: { gte: since } },
      include: { lines: true },
      orderBy: { day: 'desc' },
    }),
    db.exam.findMany({
      where: { studentId: me, createdAt: { gte: new Date(`${since}T00:00:00`) } },
      orderBy: { createdAt: 'desc' },
    }),
    db.examBooking.findMany({
      where: { studentId: me, status: 'BOOKED', scheduledOn: { gte: today } },
      orderBy: { scheduledOn: 'asc' },
    }),
    db.order.findMany({
      where: { studentId: me, createdAt: { gte: new Date(`${since}T00:00:00`) } },
      orderBy: { createdAt: 'desc' }, take: 20,
    }),
    db.adminMessage.findMany({
      where: {
        audience: 'STUDENTS',
        OR: [{ studentId: null }, { studentId: me }],
        createdAt: { gte: new Date(`${since}T00:00:00`) },
      },
      orderBy: { createdAt: 'desc' }, take: 20,
    }),
    db.studentAlertRead.findMany({ where: { studentId: me }, select: { key: true } }),
  ]);

  const seen = new Set(reads.map((r) => r.key));
  const out: StudentAlert[] = [];
  const push = (a: Omit<StudentAlert, 'read'>) => out.push({ ...a, read: seen.has(a.key) });

  /* ── ملاحظات معلمه ─────────────────────────────────────────────────────── */
  for (const d of days) {
    for (const l of d.lines) {
      const note = (l.note ?? '').trim();
      if (!note) continue;
      push({
        kind: 'NOTE',
        key: alertKey('NOTE', d.id, l.kind),
        title: `ملاحظة معلمك على ${KIND_AR[l.kind] ?? l.kind}`,
        body: note,
        at: d.day,
        href: '/student/my-level',
      });
    }
    const dayNote = (d.note ?? '').trim();
    if (dayNote) {
      push({
        kind: 'NOTE',
        key: alertKey('NOTE', d.id, 'DAY'),
        title: 'ملاحظة معلمك على يومك',
        body: dayNote,
        at: d.day,
        href: '/student/my-level',
      });
    }
  }

  /* ── اختباراته ─────────────────────────────────────────────────────────── */
  for (const e of exams) {
    const name = EXAM_TYPE_AR[e.type as ExamType] ?? e.type;
    push({
      kind: 'EXAM',
      key: alertKey('EXAM', e.id),
      title: e.passed === true ? `اجتزت ${name}`
        : e.passed === false ? `نتيجة ${name}` : `سُجِّلت نتيجة ${name}`,
      body: e.score != null
        ? `درجتك ${e.score} من 100${e.passed === true ? ' — بارك الله فيك' : ''}`
        : 'اضغط لترى تفاصيلها',
      at: e.takenOn,
      href: '/student',
    });
  }

  for (const b of bookings) {
    const away = Math.max(0, Math.round(
      (Date.parse(`${b.scheduledOn}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000));
    push({
      kind: 'BOOKED',
      key: alertKey('BOOKED', b.id, b.scheduledOn),
      title: 'اختبارك القادم',
      body: away === 0 ? 'اختبارك اليوم — استعدّ'
        : away === 1 ? 'اختبارك غدًا — استعدّ'
        : `بقي على اختبارك ${away} ${away <= 10 ? 'أيام' : 'يومًا'}`,
      at: b.scheduledOn,
      href: '/student/my-level',
    });
  }

  /* ── هداياه ────────────────────────────────────────────────────────────── */
  for (const o of orders) {
    push({
      kind: 'GIFT',
      key: alertKey('GIFT', o.id, o.status),
      title: ORDER_AR[o.status] ?? 'طلبك',
      body: `${o.giftNameSnapshot} — ${o.pointsSpent} نقطة`,
      at: isoDate(o.createdAt),
      href: '/student/store',
    });
  }

  /* ── من الإدارة ────────────────────────────────────────────────────────── */
  for (const m of messages) {
    push({
      kind: 'MESSAGE',
      key: alertKey('MESSAGE', m.id),
      title: 'من الإدارة',
      body: m.body,
      at: m.createdAt.toISOString(),
    });
  }

  /* Newest first — the same order his teacher's list reads in. */
  out.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return NextResponse.json({
    alerts: out.slice(0, 60),
    unread: out.filter((a) => !a.read).length,
  });
}

/** Tick them off. Server-side, so a boy who read it on his phone has read it. */
export async function POST(req: Request) {
  const g = await scope();
  if (!g.ok) return g.res;

  const body = await req.json().catch(() => null);
  const keys = Array.isArray(body?.keys)
    ? [...new Set((body.keys as unknown[]).map((k) => String(k ?? '')).filter(Boolean))].slice(0, 100)
    : [];
  if (!keys.length) return NextResponse.json({ ok: true, marked: 0 });

  await db.studentAlertRead.createMany({
    data: keys.map((key) => ({ studentId: g.s.sub, key })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, marked: keys.length });
}
