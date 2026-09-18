import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { issueMissingAccounts, type IssuedAccount } from '@/lib/credentials';
import { readSession } from '@/lib/auth';
import { toStudent, toHalaqa } from '@/lib/serialize';
import type { Prisma } from '@prisma/client';

/* The whole working set, in one request and out in one.
   Eleven of the fourteen entities lived in localStorage: the points ledger,
   every exam, every plan, the curriculum, the store. That is not a sync
   problem so much as a durability one — the work existed in one browser
   profile on one machine, and a cleared cache was a wiped system.

   GET hydrates a device. PUT saves what that device changed. The system is one
   supervisor's, so last write wins; what matters is that the write LANDS
   somewhere both devices read from. */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** What `/api/teacher/day` stamps on the point rows it writes. The ONE string
    that keeps the teacher's ledger out of the supervisor's bulk save; it is
    written in `lib/day.ts` and read here, and the two must not drift. */
const DAY_REF = 'day';

export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const holdRows = await db.studentProgress.findMany({
    where: { examHoldAt: { not: null } },
    select: { studentId: true, examHoldAt: true, examHoldBy: true, examHoldNote: true },
  });
  const holds = new Map(holdRows.map((h) => [h.studentId, {
    at: h.examHoldAt!.toISOString(), by: h.examHoldBy ?? '', note: h.examHoldNote,
  }]));

  const [students, halaqat,
         txns, batches, codes, gifts, orders, exams, questions, bookings,
         curriculum, plans, topics] = await Promise.all([
    db.student.findMany(),
    db.halaqa.findMany(),
    db.pointTxn.findMany({ orderBy: { createdAt: 'asc' } }),
    db.pointCodeBatch.findMany(),
    db.pointCode.findMany(),
    db.gift.findMany(),
    db.order.findMany(),
    db.exam.findMany(),
    db.examQuestion.findMany(),
    db.examBooking.findMany(),
    db.curriculumDay.findMany(),
    db.studentPlan.findMany(),
    db.tajweedTopic.findMany(),
  ]);

  /* The stamp a reset leaves. A browser holding a copy from before it must
     empty itself rather than upload it back. */
  const resetAt = (await db.setting.findUnique({ where: { key: 'reset_at' } }))?.value ?? null;

  return NextResponse.json({
    resetAt,
    /* The roster comes DOWN too. It only ever went up — through /api/import —
       so every browser showed its own copy of the students and disagreed with
       the server about who they were and what رتل last said about them. That
       is why «أوجه الحفظ» read 0.00 on screen while the database held 0.6. */
    /* «ويظهر عند المشرف» — the teacher's opinion rides down with the roster.
       READ-ONLY by construction: `student_progress` is a teacher-portal table,
       and the PUT whitelist below has no column for it, so no browser sync can
       overwrite a judgement made in the other portal. */
    students: students.map((s) => {
      const h = holds.get(s.id);
      return h ? { ...toStudent(s), examHold: h } : toStudent(s);
    }),
    halaqat: halaqat.map(toHalaqa),
    txns: txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    batches: batches.map((b) => ({
      ...b, expiresAt: iso(b.expiresAt), revokedAt: iso(b.revokedAt),
      createdAt: b.createdAt.toISOString() })),
    codes: codes.map((c) => ({ ...c, redeemedAt: iso(c.redeemedAt) })),
    gifts: gifts.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })),
    orders: orders.map((o) => ({
      ...o, createdAt: o.createdAt.toISOString(), deliveredAt: iso(o.deliveredAt) })),
    exams: exams.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    examQuestions: questions,
    bookings: bookings.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
    curriculum,
    plans: plans.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    tajweedTopics: topics,
  });
}

/** Is this row already what we are about to write?
    Compares only the fields being written, and compares them loosely enough
    that null and '' and undefined do not count as a change — they arrive that
    way from a browser and would make every save rewrite every row. */
const SAME = (cur: Record<string, unknown>, next: Record<string, unknown>) =>
  Object.keys(next).every((k) => {
    const a = cur[k] ?? null, b = next[k] ?? null;
    if (a === null && (b === null || b === '')) return true;
    if (b === null && a === '') return true;
    return String(a) === String(b);
  });

/** Every list the browser owns, replaced wholesale in one transaction. */
export async function PUT(req: Request) {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const s = await req.json();
  const started = Date.now();
  let dropped = 0;

  /* A SAVE MUST NOT BE ABLE TO EMPTY THE SYSTEM.

     This endpoint replaces every list wholesale, which is right for a device
     reporting what it holds and catastrophic for one that holds nothing yet: a
     browser that has not finished hydrating, or that emptied itself after a
     reset stamp, sends `{exams: []}` and 394 exams are gone. That is exactly
     what happened — the roster survived because it is written by /api/import,
     and everything this route owns did not.

     So a payload that is empty where the database is not is refused. Wiping is
     a deliberate act with its own endpoint and its own confirmation phrase;
     it is not something a save should ever do by omission. */
  const HELD = ['exams', 'plans', 'txns', 'orders', 'curriculum'] as const;
  const sending = Object.fromEntries(
    HELD.map((k) => [k, Array.isArray(s[k]) ? (s[k] as unknown[]).length : 0]));
  if (HELD.some((k) => sending[k] === 0)) {
    const held = {
      exams: await db.exam.count(),
      plans: await db.studentPlan.count(),
      txns: await db.pointTxn.count(),
      orders: await db.order.count(),
      curriculum: await db.curriculumDay.count(),
    };
    const wouldLose = HELD.filter((k) => sending[k] === 0 && held[k] > 0);
    if (wouldLose.length) {
      return NextResponse.json({
        error: 'حفظ فارغ — رُفض حتى لا تُمحى البيانات.',
        refused: Object.fromEntries(wouldLose.map((k) => [k, held[k]])),
      }, { status: 409 });
    }
  }

  /* Rows are keyed by ids the browser already minted, so this is a replace
     rather than a merge — and it happens inside ONE transaction, so a device
     that loses its connection half-way through leaves the previous state
     intact rather than half of two. */
  let newAccounts: IssuedAccount[] = [];
  let accountsWithoutId: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      /* The whole row, not just the key: the roster is written now, and writing
         it back unconditionally meant a hundred and seventeen sequential
         UPDATEs inside the transaction — against a database across a network,
         that alone spent the thirty-second budget and the save died of a
         timeout. Only what actually differs is written, which on an ordinary
         save is nothing at all. */
      const roster = await tx.student.findMany();
      const known = new Set(roster.map((r) => r.id));

      /* Every parse mints its own student ids, so a browser that imported
         before its ids were reconciled sends rows naming a student under an id
         this database has never used — the SAME boy, under another name for
         him. Dropping them silently is how a save reported success over an
         empty table; refusing the save outright would lose the work.

         So the boy is looked up by the id the ROW carries, and by the dedupe
         key if the payload names one, before anything is discarded. What is
         still unrecognisable belongs to a roster that was never imported here,
         and that is reported rather than invented. */
      const byDedupe = new Map(roster.filter((r) => r.dedupeKey).map((r) => [r.dedupeKey!, r.id]));
      const keyFor = new Map<string, string>();
      for (const st of (s.students ?? []) as { id: string; dedupeKey?: string }[]) {
        const kept = st.dedupeKey ? byDedupe.get(st.dedupeKey) : undefined;
        if (kept) keyFor.set(st.id, kept);
      }

      /* Halaqat, before the students who point at them.
         A halaqa DELETED in the browser is deleted here — but its students are
         not: they are moved to «بلا حلقة», which is the state the screens
         already know how to show and alert on. Cascading the delete would take
         a boy's whole history with the row that merely named his teacher. */
      const sentHalaqat = (s.halaqat ?? []) as Record<string, unknown>[];
      if (sentHalaqat.length) {
        const keep = new Set(sentHalaqat.map((h) => String(h.id)));
        const gone = (await tx.halaqa.findMany({ select: { id: true } }))
          .filter((h) => !keep.has(h.id)).map((h) => h.id);
        if (gone.length) {
          await tx.student.updateMany({
            where: { halaqaId: { in: gone } }, data: { halaqaId: null } });
          await tx.halaqa.deleteMany({ where: { id: { in: gone } } });
        }
        const haveHalaqa = new Map((await tx.halaqa.findMany()).map((h) => [h.id, h]));
        for (const h of sentHalaqat) {
          const row = {
            name: String(h.name ?? ''),
            teacher: String(h.teacher ?? ''),
            mosque: String(h.mosque ?? 'جامع محمد العبدالكريم — حي أُحد'),
            timeSlot: String(h.timeSlot ?? 'العصر'),
            track: (h.track as string) || null,
            notes: (h.notes as string) || null,
            active: h.active === undefined ? true : Boolean(h.active),
          } as Prisma.HalaqaUncheckedCreateInput;
          if (!row.name) continue;
          const cur = haveHalaqa.get(String(h.id));
          if (!cur) {
            await tx.halaqa.create({ data: { ...row, id: String(h.id) } });
          } else if (SAME(cur, row)) {
            /* unchanged — the ordinary case, and worth nothing to the database */
          } else {
            await tx.halaqa.update({ where: { id: String(h.id) }, data: row });
          }
        }
      }

      /* The roster is WRITTEN here now.
         It used to be read-only — «a save must not be able to invent a roster»
         — and the reasoning was sound about DELETION but wrong about the rest:
         a student added through «إضافة طالب» never left the browser he was
         typed into, and neither did any correction to an existing one. The
         guard that matters is kept: nothing here removes a student, and the
         409 above still refuses a save that would empty the tables. */
      const byId = new Map(roster.map((r) => [r.id, r as Record<string, unknown>]));
      const incoming = (s.students ?? []) as Record<string, unknown>[];
      const fresh: string[] = [];
      for (const st of incoming) {
        const id = keyFor.get(String(st.id)) ?? String(st.id);
        const row = {
          fullName: String(st.fullName ?? ''),
          nationalId: (st.nationalId as string) || null,
          track: (st.track as string) || null,
          halaqaId: (st.halaqaId as string) || null,
          grade: String(st.grade ?? ''),
          stage: String(st.stage ?? ''),
          nationality: String(st.nationality ?? ''),
          guardianPhone: String(st.guardianPhone ?? ''),
          /* Written like every other field the supervisor types. The whitelist
             is the guard: a column absent from it is one a browser can never
             overwrite, which is how the teacher-portal tables stay safe. */
          birthDate: (st.birthDate as string) || null,
          status: String(st.status ?? 'ACTIVE'),
          currentLevel: st.currentLevel == null ? null : Number(st.currentLevel),
          dedupeKey: (st.dedupeKey as string) || null,
        } as Prisma.StudentUncheckedCreateInput;
        if (!row.fullName) continue;
        if (known.has(id)) {
          const cur = byId.get(id);
          if (cur && !SAME(cur, row)) await tx.student.update({ where: { id }, data: row });
        } else {
          await tx.student.create({ data: { ...row, id } });
          known.add(id);
          fresh.push(id);
        }
      }

      /* And a new boy gets his account in the same breath — next free number
         from 1001, his own national id for a password. Asking the supervisor
         to remember a second screen is how a student ends up on the roster
         with no way to sign in. */
      if (fresh.length) {
        const r = await issueMissingAccounts(tx, fresh);
        newAccounts = r.issued;
        accountsWithoutId = r.noNationalId;
      }

      const countOrphan = () => { dropped++; };
      const mine = <T extends { studentId: string }>(rows: T[]): T[] => {
        const out: T[] = [];
        for (const r of rows) {
          if (known.has(r.studentId)) { out.push(r); continue; }
          const kept = keyFor.get(r.studentId);
          if (kept) { out.push({ ...r, studentId: kept }); continue; }
          countOrphan();
        }
        return out;
      };

      await tx.examQuestion.deleteMany();
      await tx.pointCode.deleteMany();
      await tx.order.deleteMany();
      /* NOT the teacher's rows.
         The ledger is the one table both portals write into: the supervisor's
         grants, cards and exam awards come through here, and the fixed daily
         حضور·ثوب·تسميع points are written by /api/teacher/day, which this
         browser has never seen and cannot send back. Deleting the lot and
         recreating it from his copy would erase an afternoon of التحضير every
         time he pressed save — and silently, because the rows he sent would all
         land. So the teacher's rows are recognised by `refType` and left alone,
         and the incoming list is filtered to match below. */
      /* `NOT { refType: 'day' }` is `ref_type <> 'day'` in SQL, and that is
         UNKNOWN for a NULL — so every row with no refType survived the delete
         and then arrived again in the incoming list, colliding on its own id.
         The supervisor's «تصحيح حركة» writes exactly such a row. NULLs are
         named explicitly, and «keep» means what it says: the teacher's rows,
         and nothing else. */
      await tx.pointTxn.deleteMany({
        where: { OR: [{ refType: { not: DAY_REF } }, { refType: null }] } });
      await tx.examBooking.deleteMany();
      await tx.exam.deleteMany();
      await tx.studentPlan.deleteMany();
      await tx.pointCodeBatch.deleteMany();
      await tx.gift.deleteMany();
      await tx.curriculumDay.deleteMany();
      await tx.tajweedTopic.deleteMany();

      const d = (v: unknown) => (v ? new Date(String(v)) : null);

      if (s.gifts?.length) await tx.gift.createMany({ data: s.gifts.map((g: Record<string, unknown>) => ({
        ...g, createdAt: d(g.createdAt) ?? new Date() })) as Prisma.GiftCreateManyInput[] });

      if (s.batches?.length) await tx.pointCodeBatch.createMany({
        data: s.batches.map((b: Record<string, unknown>) => ({
          ...b, expiresAt: d(b.expiresAt), revokedAt: d(b.revokedAt),
          createdAt: d(b.createdAt) ?? new Date() })) as Prisma.PointCodeBatchCreateManyInput[] });

      if (s.codes?.length) await tx.pointCode.createMany({
        data: s.codes.map((c: Record<string, unknown>) => ({
          ...c, redeemedAt: d(c.redeemedAt) })) as Prisma.PointCodeCreateManyInput[] });

      const exams = mine<{ id: string; studentId: string } & Record<string, unknown>>(s.exams ?? []);
      if (exams.length) await tx.exam.createMany({ data: exams.map((e) => ({
        ...e, createdAt: d(e.createdAt) ?? new Date() })) as Prisma.ExamCreateManyInput[] });

      const examIds = new Set(exams.map((e) => e.id));
      const qs = (s.examQuestions ?? []).filter((q: { examId: string }) => examIds.has(q.examId));
      if (qs.length) await tx.examQuestion.createMany({ data: qs });

      const plans = mine<{ id: string; studentId: string } & Record<string, unknown>>(s.plans ?? []);
      if (plans.length) await tx.studentPlan.createMany({ data: plans.map((p) => ({
        ...p, createdAt: d(p.createdAt) ?? new Date() })) as Prisma.StudentPlanCreateManyInput[] });

      /* An order whose gift has been deleted keeps its snapshots and loses only
         the link. Carried through as it stood, it named a row that this save
         had just removed, and the foreign key took the entire transaction down
         with it — so deleting a gift anyone had bought saved NOTHING. */
      const giftIds = new Set((s.gifts ?? []).map((g: Record<string, unknown>) => String(g.id)));
      const orders = mine<{ studentId: string } & Record<string, unknown>>(s.orders ?? []);
      if (orders.length) await tx.order.createMany({ data: orders.map((o) => ({
        ...o,
        giftId: o.giftId && giftIds.has(String(o.giftId)) ? o.giftId : null,
        createdAt: d(o.createdAt) ?? new Date(), deliveredAt: d(o.deliveredAt),
      })) as Prisma.OrderCreateManyInput[] });

      /* The browser HAS the teacher's rows — GET sends them, because the
         supervisor's balances and ledger must include them. They simply are not
         his to write, so they are dropped on the way back in rather than
         colliding with the rows that were just preserved. */
      const txns = mine<{ studentId: string } & Record<string, unknown>>(
        (s.txns ?? []).filter((t: Record<string, unknown>) => t.refType !== DAY_REF));
      if (txns.length) await tx.pointTxn.createMany({ data: txns.map((t) => ({
        ...t, createdAt: d(t.createdAt) ?? new Date() })) as Prisma.PointTxnCreateManyInput[] });

      const bookings = mine<{ studentId: string } & Record<string, unknown>>(s.bookings ?? []);
      if (bookings.length) await tx.examBooking.createMany({ data: bookings.map((b) => ({
        ...b, createdAt: d(b.createdAt) ?? new Date() })) as Prisma.ExamBookingCreateManyInput[] });

      /* «المستوى الحالي» is empty in the roster file, so a student's level is
         only ever known from the newest sheet he was handed. The browser store
         derives it on ingest; the server never did — so every one of the 117
         had `currentLevel: null` here while the plans beside them said 60, and
         the student portal showed «المستوى 0».

         Derived here, from the same rule: the newest plan a boy holds is the
         level he is on. Only for students who have none — a level set by hand
         on the students screen is a decision and must not be overwritten. */
      if (plans.length) {
        const newest = new Map<string, { level: number; issuedAt: string }>();
        for (const pl of plans) {
          const cur = newest.get(pl.studentId as string);
          const issuedAt = String(pl.issuedAt ?? '');
          if (!cur || issuedAt > cur.issuedAt) {
            newest.set(pl.studentId as string, { level: Number(pl.level), issuedAt });
          }
        }
        const blank = await tx.student.findMany({
          where: { id: { in: [...newest.keys()] }, currentLevel: null },
          select: { id: true },
        });
        for (const st of blank) {
          await tx.student.update({
            where: { id: st.id }, data: { currentLevel: newest.get(st.id)!.level } });
        }
      }

      if (s.curriculum?.length) await tx.curriculumDay.createMany({ data: s.curriculum });
      if (s.tajweedTopics?.length) await tx.tajweedTopic.createMany({ data: s.tajweedTopics });
    }, { timeout: 30_000 });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر الحفظ على الخادم.', detail: e instanceof Error ? e.message : '' },
      { status: 500 });
  }

  /* Named, not swallowed. A save that quietly kept two thirds of what it was
     given is the failure this whole endpoint exists to avoid. */
  return NextResponse.json({
    ok: true, ms: Date.now() - started, orphaned: dropped,
    /* So the screen can tell the supervisor the number to write on the card,
       and name the boy who could not be given one. */
    newAccounts, accountsWithoutId,
  });
}
