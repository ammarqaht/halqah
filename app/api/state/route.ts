import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
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

export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const [txns, batches, codes, gifts, orders, exams, questions, bookings,
         curriculum, plans, topics] = await Promise.all([
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

/** Every list the browser owns, replaced wholesale in one transaction. */
export async function PUT(req: Request) {
  if (!await readSession()) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const s = await req.json();
  const started = Date.now();
  let dropped = 0;

  /* Rows are keyed by ids the browser already minted, so this is a replace
     rather than a merge — and it happens inside ONE transaction, so a device
     that loses its connection half-way through leaves the previous state
     intact rather than half of two. */
  try {
    await db.$transaction(async (tx) => {
      const roster = await tx.student.findMany({ select: { id: true, dedupeKey: true } });
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
      /* Read only. This route never writes a student — that is /api/import's
         job, and a save must not be able to invent a roster. */
      const byDedupe = new Map(roster.filter((r) => r.dedupeKey).map((r) => [r.dedupeKey!, r.id]));
      const keyFor = new Map<string, string>();
      for (const st of (s.students ?? []) as { id: string; dedupeKey?: string }[]) {
        const kept = st.dedupeKey ? byDedupe.get(st.dedupeKey) : undefined;
        if (kept) keyFor.set(st.id, kept);
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
      await tx.pointTxn.deleteMany();
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

      const orders = mine<{ studentId: string } & Record<string, unknown>>(s.orders ?? []);
      if (orders.length) await tx.order.createMany({ data: orders.map((o) => ({
        ...o, createdAt: d(o.createdAt) ?? new Date(), deliveredAt: d(o.deliveredAt),
      })) as Prisma.OrderCreateManyInput[] });

      const txns = mine<{ studentId: string } & Record<string, unknown>>(s.txns ?? []);
      if (txns.length) await tx.pointTxn.createMany({ data: txns.map((t) => ({
        ...t, createdAt: d(t.createdAt) ?? new Date() })) as Prisma.PointTxnCreateManyInput[] });

      const bookings = mine<{ studentId: string } & Record<string, unknown>>(s.bookings ?? []);
      if (bookings.length) await tx.examBooking.createMany({ data: bookings.map((b) => ({
        ...b, createdAt: d(b.createdAt) ?? new Date() })) as Prisma.ExamBookingCreateManyInput[] });

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
  return NextResponse.json({ ok: true, ms: Date.now() - started, orphaned: dropped });
}
