import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, scope, teacherSettings } from '../_scope';
import { absence, dayState, opensItself, type DayRecord } from '@/lib/teacher';
import { badgeAr } from '@/lib/day';
import { isoDate } from '@/lib/dates';
import { halaqaLabel, shortName } from '@/lib/normalise';

/* مع-٢ — who is signed in, the state of today, and what the system can tell him.
   «أن يعرف المعلم في خمس ثوانٍ ما المطلوب منه الآن، ويصل إلى عمله بنقرة واحدة». */

/** How far back a result or a delivery is still news worth putting on a card.
    A fortnight covers the gap a teacher can be away for; older than that and it
    belongs in the student's file, where it always is. */
const NEWS_DAYS = 14;

export type Alert = {
  kind: 'EXAM_DUE' | 'BOOKED' | 'RESULT' | 'PLAN' | 'ABSENCE' | 'MESSAGE';
  /** Stable for as long as the alert means the same thing — see `alertKey`. */
  key: string;
  /** False until the teacher has opened it. «التنبيه غير المقروء فيه دائرة
      خضراء صغيرة» (client, 18 Sep 2026). */
  read: boolean;
  /** Where a tap goes. «وكل تنبيه ينقل بنقرة إلى مكانه». */
  href: string;
  body: string;
  studentId?: string;
  at?: string;
};

/**
 * The string an alert is remembered by.
 *
 * Five of the six kinds are COMPUTED from rows rather than stored, so there is
 * no id to hang a read-marker on. The key is derived from what the alert is
 * ABOUT, which gives it the property that matters: it stays the same while the
 * alert means the same thing, and it changes when the meaning does. A boy who
 * reaches the diamond after his golden badge gets `EXAM_DUE:<id>:BADGE_DIAMOND`
 * — a new alert, unread, rather than one silently inheriting the last one's tick.
 */
const alertKey = (kind: Alert['kind'], ...parts: (string | number | null)[]) =>
  [kind, ...parts.map((p) => String(p ?? ''))].join(':');

export async function GET(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  const { who } = g;

  const halaqa = await db.halaqa.findUnique({ where: { id: who.halaqaId } });
  if (!halaqa) return fail('لم يُعثر على الحلقة.', 404);

  const { weekdays } = await teacherSettings(who.halaqaId);
  const today = isoDate(new Date());

  const students = await db.student.findMany({
    where: { halaqaId: who.halaqaId, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    include: { progress: true },
  });
  const ids = students.map((s) => s.id);
  const nameOf = new Map(students.map((s) => [s.id, s.fullName]));

  const since = isoDate(new Date(Date.now() - NEWS_DAYS * 86_400_000));

  const [todayEntries, bookings, results, plans, history, messages, reads] = await Promise.all([
    db.dayEntry.findMany({
      where: { studentId: { in: ids }, day: today }, include: { lines: true } }),
    db.examBooking.findMany({
      where: { studentId: { in: ids }, status: 'BOOKED', scheduledOn: { gte: today } },
      orderBy: { scheduledOn: 'asc' } }),
    db.exam.findMany({
      where: { studentId: { in: ids }, createdAt: { gte: new Date(`${since}T00:00:00`) } },
      orderBy: { createdAt: 'desc' } }),
    db.studentPlan.findMany({
      where: { studentId: { in: ids }, issuedAt: { gte: since } },
      orderBy: { issuedAt: 'desc' } }),
    /* Enough history for both absence thresholds — the streak reaches back
       through whatever days were registered, and the window is thirty days. */
    db.dayEntry.findMany({
      where: { studentId: { in: ids }, day: { gte: isoDate(new Date(Date.now() - 60 * 86_400_000)) } },
      select: { studentId: true, day: true, status: true },
      orderBy: { day: 'desc' } }),
    /* `audience` as well as the id: a message to the STUDENTS is not news a
       teacher was sent, and since 18 Sep 2026 both live in one table. */
    db.adminMessage.findMany({
      where: {
        audience: 'TEACHERS',
        OR: [{ teacherId: null }, { teacherId: who.role === 'TEACHER' ? who.id : '—' }],
        createdAt: { gte: new Date(`${since}T00:00:00`) },
      },
      orderBy: { createdAt: 'desc' }, take: 20 }),
    who.role === 'TEACHER'
      ? db.teacherAlertRead.findMany({ where: { teacherId: who.id }, select: { key: true } })
      : Promise.resolve([] as { key: string }[]),
  ]);

  const seen = new Set(reads.map((r) => r.key));

  /* ── الأرقام ───────────────────────────────────────────────────────────────
     «كلها محسوبة من تسجيله هو، ولا نعرض صفرًا في أول النهار يوهم أن الحلقة
     فارغة — بل يظهر لم يبدأ التسجيل». The zero is returned honestly and the
     screen decides how to say it; what matters here is `state`. */
  const present = todayEntries.filter(
    (e) => e.status === 'PRESENT' || e.status === 'LATE').length;
  const absent = todayEntries.filter((e) => e.status === 'ABSENT').length;
  const recited = todayEntries.filter((e) => e.lines.some((l) => l.recited)).length;
  const dueForExam = students.filter((s) => s.progress?.awaitingExam).length;

  /* ── التنبيهات ──────────────────────────────────────────────────────────── */
  const alerts: Alert[] = [];
  const push = (a: Omit<Alert, 'read'>) => alerts.push({ ...a, read: seen.has(a.key) });

  for (const s of students) {
    if (!s.progress?.awaitingExam) continue;
    push({
      kind: 'EXAM_DUE',
      key: alertKey('EXAM_DUE', s.id, s.progress.awaitingExam),
      href: `/teacher/students/${s.id}`,
      studentId: s.id,
      /* The day the pointer stopped on his badge مقرّر — «يكون معها تاريخ
         التنبيه», and for this kind the date IS «منذ متى وهو ينتظر». */
      at: isoDate(s.progress.updatedAt),
      body: `${shortName(s.fullName)} أنجز مقرّراته حتى ${s.progress.assignmentNo ?? ''}`
        + ` — يستحق ${badgeAr(s.progress.awaitingExam)} عند المشرف`,
    });
  }

  for (const b of bookings) {
    const away = Math.max(0, Math.round(
      (Date.parse(`${b.scheduledOn}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000));
    push({
      kind: 'BOOKED',
      key: alertKey('BOOKED', b.id, b.scheduledOn),
      href: `/teacher/students/${b.studentId}`,
      studentId: b.studentId,
      at: b.scheduledOn,
      body: `اختبار ${shortName(nameOf.get(b.studentId) ?? '')} يوم ${b.scheduledOn}`
        + (away === 0 ? ' — اليوم' : away === 1 ? ' — بقي عليه يوم'
          : ` — بقي عليه ${away} ${away <= 10 ? 'أيام' : 'يومًا'}`),
    });
  }

  for (const e of results) {
    push({
      kind: 'RESULT',
      key: alertKey('RESULT', e.id),
      href: `/teacher/students/${e.studentId}`,
      studentId: e.studentId,
      at: e.takenOn,
      body: `نتيجة ${shortName(nameOf.get(e.studentId) ?? '')}: `
        + (e.score != null ? `${e.score} من 100` : 'سُجِّلت')
        + ' — اضغط للتفاصيل',
    });
  }

  for (const p of plans) {
    push({
      kind: 'PLAN',
      key: alertKey('PLAN', p.id, p.issuedAt),
      href: `/teacher/students/${p.studentId}`,
      studentId: p.studentId,
      at: p.issuedAt,
      body: `سُلِّم ${shortName(nameOf.get(p.studentId) ?? '')} المستوى ${p.level}`
        + ` بتاريخ ${p.issuedAt}`,
    });
  }

  const byStudent = new Map<string, DayRecord[]>();
  for (const h of history) {
    const list = byStudent.get(h.studentId) ?? [];
    list.push({ day: h.day, status: h.status });
    byStudent.set(h.studentId, list);
  }
  for (const s of students) {
    const a = absence(byStudent.get(s.id) ?? [], today);
    if (!a.flagged) continue;
    /* Keyed by the newest absent day, so a boy who misses another afternoon
       raises a fresh alert rather than one the teacher already ticked off. */
    push({
      kind: 'ABSENCE',
      key: alertKey('ABSENCE', s.id, a.days[0] ?? ''),
      href: `/teacher/students/${s.id}`,
      studentId: s.id,
      /** آخر يوم غابه — the day this alert is about, and what it is keyed by. */
      at: a.days[0] ?? today,
      body: a.streak >= 3
        ? `${shortName(s.fullName)} غاب ${a.streak} أيام حلقة متتالية`
        : `${shortName(s.fullName)} غاب ${a.inWindow} أيام في آخر شهر`,
    });
  }

  for (const m of messages) {
    push({
      kind: 'MESSAGE',
      key: alertKey('MESSAGE', m.id),
      href: '/teacher',
      at: m.createdAt.toISOString(),
      body: m.body,
    });
  }

  return NextResponse.json({
    who: { id: who.id, name: who.name, role: who.role },
    halaqa: {
      id: halaqa.id,
      name: halaqaLabel(halaqa.name || halaqa.teacher),
      teacher: halaqaLabel(shortName(halaqa.teacher)),
      timeSlot: halaqa.timeSlot,
      mosque: halaqa.mosque,
    },
    today,
    opensItself: opensItself(today, weekdays),
    weekdays,
    state: dayState(todayEntries.length, students.length),
    counts: {
      roster: students.length,
      saved: todayEntries.length,
      present,
      absent,
      recited,
      dueForExam,
    },
    alerts,
    unread: alerts.filter((a) => !a.read).length,
  });
}

/** Mark alerts read — «التنبيه غير المقروء فيه دائرة خضراء صغيرة»، فالقراءة فعل.
    Server-side rather than in the browser: a teacher who read it on his phone
    has read it, and the dot must not come back on his other device. */
export async function POST(req: Request) {
  const g = await scope(req);
  if (!g.ok) return g.res;
  /* Only a teacher has alerts of his own. A supervisor standing in for one is
     reading somebody else's, and ticking them off for him would be wrong. */
  if (g.who.role !== 'TEACHER') return NextResponse.json({ ok: true, marked: 0 });

  const body = await req.json().catch(() => null);
  const keys = Array.isArray(body?.keys)
    ? [...new Set(body.keys.map((k: unknown) => String(k ?? '')).filter(Boolean))].slice(0, 100)
    : [];
  if (!keys.length) return NextResponse.json({ ok: true, marked: 0 });

  await db.teacherAlertRead.createMany({
    data: (keys as string[]).map((key) => ({ teacherId: g.who.id, key })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, marked: keys.length });
}
