import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { resolvePlan, dayCountFor, DEFAULT_EXAM_DAYS } from '@/lib/curriculum';
import { findSurah } from '@/lib/surahs';
import {
  PLAN_KIND_AR, PLAN_KIND_ORDER,
  type CurriculumDay, type ExamDayMap, type PlanKind, type Track,
} from '@/lib/types';
import {
  advance, badgeAt, clampErrors, dailyAward, talqeenStart,
  type DailyPointItems, type LineInput,
} from '@/lib/teacher';
import type { DailyPointsSettings } from '@/lib/settings';

/* ─────────────────────────────────────────────────────────────────────────────
   بطاقة الطالب في يومه — reading it, and saving it.

   Kept out of the route handler because three callers need the same answer: the
   day mode, the single-student period mode, and the supervisor's copy of the
   screen when a teacher is absent. Three screens computing «أين وقف» three ways
   is three chances to disagree about a boy's مقرّر.
   ───────────────────────────────────────────────────────────────────────── */

export type CardLine = {
  kind: PlanKind;
  kindAr: string;
  /** From the level's curriculum — «لكل سطر سوره وآياته». */
  fromSurah: string; fromAyah: string; toSurah: string; toAyah: string;
  recited: boolean;
  errors: number;
  /** «ملاحظة على المقرّر» — beside the passage it is about, not on the day. */
  note: string;
};

export type Card = {
  studentId: string;
  fullName: string;
  track: Track | null;
  trackAr: string | null;
  level: number | null;
  /** «المقرّر ٧ من ٢٤» — null when nobody has said where he stopped. */
  assignmentNo: number | null;
  assignmentOf: number;
  /** Set when he has reached a badge مقرّر and waits for his result. */
  awaitingExam: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  /** Why this card has no recitation lines, when it has none. */
  reason: 'OK' | 'TALQEEN' | 'NO_PLAN' | 'NO_ASSIGNMENT' | 'AWAITING_EXAM';
  lines: CardLine[];
  /** What is already saved for this day, if anything. */
  status: 'PRESENT' | 'LATE' | 'ABSENT' | null;
  thobe: boolean;
  note: string;
  incomplete: boolean;
  savedAt: string | null;
  savedByName: string;
  savedByRole: string;
  /** What the card is worth as it stands — for the day's running total only;
      «ولا نقاط ولا حسابات في هذه الصفحة» keeps it off the card itself. */
  points: number;
  /**
   * مسار التلقين وحده — «يسجّل لهم المعلم آخر سورة قرأوها وآخر آية حفظوها، وفي
   * اليوم التالي يعرض من أين يبدأ» (client, 18 Sep 2026).
   *
   * `from` is where his teacher left him, read off the pointer: the ayah AFTER
   * the last he memorised, or the surah after it when that was its last ayah.
   * `surah`/`ayah` are what this day itself recorded, empty until it is saved.
   */
  talqeen?: {
    from: string;
    surah: string;
    ayah: number | null;
  };
};

export const REASON_AR: Record<Card['reason'], string> = {
  OK: '',
  TALQEEN: 'مسار التلقين — حضور فقط، بلا مقرّر ولا نقاط',
  NO_PLAN: 'لم تُصدر خطته بعد — حضور وثوب فقط',
  NO_ASSIGNMENT: 'لم يُسجَّل له مقرّر بعد — تحديده عند مشرف الحلقة',
  AWAITING_EXAM: 'يستحق الاختبار — راجع المشرف',
};

const BADGE_AR = { BADGE_GOLDEN: 'الوسام الذهبي', BADGE_DIAMOND: 'الوسام الماسي' } as const;
export const badgeAr = (b: string | null) => (b ? BADGE_AR[b as keyof typeof BADGE_AR] ?? b : '');

/**
 * آخر سورة وآخر آية، مقروءتين من بطاقة محفوظة.
 *
 * The surah is matched against the 114 rather than stored as typed, so a
 * misspelling cannot become a position nobody can search for; and the ayah is
 * clamped to that surah's own count, because «آخر آية حفظها» in الناس cannot be
 * the ninth.
 */
function readTalqeen(card: SaveCard): { surah: string | null; ayah: number | null } {
  const found = findSurah(card.talqeenSurah);
  if (!found) return { surah: null, ayah: null };
  const raw = Math.trunc(Number(card.talqeenAyah));
  const ayah = Number.isFinite(raw) && raw > 0 ? Math.min(raw, found.ayahs) : null;
  return { surah: found.name, ayah };
}

/**
 * Build every card for one halaqa on one day.
 *
 * One query per table, whatever the roster size — the non-functional bar the
 * rest of the system is held to. Twenty-five students × three lines is
 * seventy-five rows, and it must not become seventy-five queries.
 */
export async function cardsFor(args: {
  halaqaId: string;
  day: string;
  daily: DailyPointsSettings;
}): Promise<Card[]> {
  const { halaqaId, day, daily } = args;

  const students = await db.student.findMany({
    where: { halaqaId, status: 'ACTIVE' },
    orderBy: [{ fullName: 'asc' }],
    include: { progress: true },
  });
  if (!students.length) return [];

  const ids = students.map((s) => s.id);

  const [entries, plans, curriculum] = await Promise.all([
    db.dayEntry.findMany({ where: { studentId: { in: ids }, day }, include: { lines: true } }),
    /* Every plan these students hold; the newest per student is his sheet. */
    db.studentPlan.findMany({ where: { studentId: { in: ids } }, orderBy: { issuedAt: 'asc' } }),
    db.curriculumDay.findMany(),
  ]);

  const entryOf = new Map(entries.map((e) => [e.studentId, e]));
  const planOf = new Map<string, (typeof plans)[number]>();
  for (const p of plans) planOf.set(p.studentId, p);   // ascending, so the last wins

  return students.map((st) => {
    const entry = entryOf.get(st.id) ?? null;
    const track = (st.track as Track | null) ?? null;
    const prog = st.progress;
    const plan = planOf.get(st.id) ?? null;

    /* ── A SAVED DAY IS A RECORD, NOT A PROPOSAL ──────────────────────────
       The pointer says what he must recite TODAY, and saving a day MOVES it. So
       reading a day back through the pointer showed the NEXT مقرّر on the day
       that had just been saved — «إذا سجلت أن الطالب سمّع الدرس وسويت حفظ
       فيتغير عندي مقرّر التسميع في هذا اليوم، والمفروض أنه يبقى كما هو ويتغير
       اليوم الذي بعده فقط» (client, 18 Sep 2026).

       `day_entries` already carries the مقرّر and the level the day was recorded
       at, and its own column comment says why: «kept here as well as on
       StudentProgress because the pointer moves on and this row must still say
       what was recited». It was written and never read. It is read now, and the
       pointer is only consulted for a day that has nothing saved on it — which
       is also what makes clearing a day put its مقرّر back on the card, since the
       row that anchored it is gone. */
    const level = entry?.level ?? prog?.level ?? plan?.level ?? st.currentLevel ?? null;
    const planTrack = (entry?.track ?? prog?.track ?? plan?.track ?? track) as Track | null;

    const dayCount = planTrack && level != null
      ? dayCountFor(planTrack, level, curriculum as unknown as CurriculumDay[]) : 0;

    const examDays = (plan?.examDays as unknown as ExamDayMap | null) ?? DEFAULT_EXAM_DAYS;

    const at = entry?.assignmentNo ?? prog?.assignmentNo ?? null;
    const awaiting = (prog?.awaitingExam as Card['awaitingExam']) ?? null;
    /* A day already written keeps its lines even if the pointer has since
       stopped at a badge: the boy who reached ١٢ by reciting on Thursday must
       still see Thursday's recitation when he opens Thursday. */
    const recorded = !!entry && at != null;

    let reason: Card['reason'] = 'OK';
    if (!track || track === 'TALQEEN') reason = 'TALQEEN';
    else if (!plan) reason = 'NO_PLAN';
    else if (awaiting && !recorded) reason = 'AWAITING_EXAM';
    else if (at == null) reason = 'NO_ASSIGNMENT';

    /* The three lines, with the passages the level's own curriculum names.
       `resolvePlan` is the ONE place a sheet is resolved (SPEC §3.3), so the
       teacher's card and the student's plan grid cannot show different آيات for
       one مقرّر. */
    let lines: CardLine[] = [];
    if (reason === 'OK' && planTrack && level != null && at != null) {
      const resolved = resolvePlan(
        { track: planTrack, level, dayCount: Math.max(dayCount, at), examDays },
        curriculum as unknown as CurriculumDay[],
      );
      const today = resolved.find((d) => d.dayNo === at);
      const saved = new Map((entry?.lines ?? []).map((l) => [l.kind, l]));
      lines = PLAN_KIND_ORDER.map((kind) => {
        const row = today?.rows.find((r) => r.kind === kind);
        const was = saved.get(kind);
        return {
          kind, kindAr: PLAN_KIND_AR[kind],
          fromSurah: row?.fromSurah ?? '', fromAyah: row?.fromAyah ?? '',
          toSurah: row?.toSurah ?? '', toAyah: row?.toAyah ?? '',
          recited: was?.recited ?? false,
          errors: was?.errors ?? 0,
          note: was?.note ?? '',
        };
      });
    }

    const points = entry
      ? dailyAward({
          track, status: entry.status, thobe: entry.thobe,
          lines: (entry.lines ?? []).map((l) => ({
            kind: l.kind as PlanKind, recited: l.recited, errors: l.errors })),
          items: daily.items, golden: daily.golden,
        }).total
      : 0;

    return {
      studentId: st.id,
      fullName: st.fullName,
      track,
      ...(reason === 'TALQEEN' ? { talqeen: {
        from: talqeenStart(prog?.talqeenSurah ?? null, prog?.talqeenAyah ?? null),
        surah: entry?.talqeenSurah ?? '',
        ayah: entry?.talqeenAyah ?? null,
      } } : {}),
      trackAr: track ? ({ SILVER: 'الفضي', GOLDEN: 'الذهبي', TALQEEN: 'التلقين' })[track] : null,
      level,
      assignmentNo: at,
      assignmentOf: dayCount,
      awaitingExam: awaiting,
      reason,
      lines,
      status: entry?.status ?? null,
      thobe: entry?.thobe ?? false,
      note: entry?.note ?? '',
      incomplete: entry?.incomplete ?? false,
      savedAt: entry?.savedAt.toISOString() ?? null,
      savedByName: entry?.savedByName ?? '',
      savedByRole: entry?.savedByRole ?? '',
      points,
    };
  });
}

/* ── الحفظ ───────────────────────────────────────────────────────────────── */

export type SaveCard = {
  studentId: string;
  day: string;
  /** Null CLEARS the day — see `clearCard`. */
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  thobe: boolean;
  note: string;
  lines: { kind: PlanKind; recited: boolean; errors: number; note?: string }[];
  /** مسار التلقين وحده: آخر سورة قرأها وآخر آية حفظها. */
  talqeenSurah?: string | null;
  talqeenAyah?: number | null;
};

export type SaveResult = {
  entryId: string;
  /** Where his pointer stands after this save. */
  assignmentNo: number | null;
  awaitingExam: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  /** True the moment he reaches a badge — three notices go out at once. */
  reachedExam: boolean;
  incomplete: boolean;
  /** What the card is worth now, and what actually moved in the ledger. */
  points: number;
  pointsDelta: number;
};

/**
 * Save ONE student's card, and everything that follows from it, in one
 * transaction.
 *
 * «والحفظ للبطاقة وحدها، فلا يتصادم جهازان إلا على طالب واحد بعينه» — and when
 * they do, «يغلب آخر حفظ، ويُسجَّل السابق في سجّل التعديل». That is what the
 * revision row is for: nothing is overwritten into nothing.
 *
 * The points are recomputed from scratch and reconciled against what was
 * already paid for this card, so a second save moves the difference «زيادةً أو
 * نقصًا» with a correction row rather than by editing an earlier one — the
 * ledger stays append-only (§٣.٥).
 */
export async function saveCard(args: {
  halaqaId: string;
  card: SaveCard;
  by: { id: string; name: string; role: 'TEACHER' | 'SUPERVISOR' };
  items: DailyPointItems;
  golden: DailyPointItems;
}): Promise<SaveResult> {
  const { halaqaId, card, by, items, golden } = args;

  return db.$transaction(async (tx) => {
    const st = await tx.student.findFirstOrThrow({
      where: { id: card.studentId, halaqaId },
      include: { progress: true },
    });
    const track = (st.track as Track | null) ?? null;

    const plan = await tx.studentPlan.findFirst({
      where: { studentId: st.id }, orderBy: { issuedAt: 'desc' } });
    const curriculum = plan
      ? await tx.curriculumDay.findMany({ where: { track: plan.track, level: plan.level } })
      : [];

    const examDays = (plan?.examDays as unknown as ExamDayMap | null) ?? DEFAULT_EXAM_DAYS;
    const dayCount = plan
      ? dayCountFor(plan.track as Track, plan.level, curriculum as unknown as CurriculumDay[])
      : 0;

    /* A talqeen boy and a boy without a plan get attendance and thobe only:
       «تُفتح له خانات الحضور والثوب فقط». Lines sent for either are dropped
       HERE rather than trusted — the screen closes those inputs, and the server
       does not rely on the screen having done so. */
    const recordsLines = !!track && track !== 'TALQEEN' && !!plan;
    const lines: (LineInput & { note: string })[] =
      recordsLines && card.status !== 'ABSENT'
      ? PLAN_KIND_ORDER.map((kind) => {
          const sent = card.lines.find((l) => l.kind === kind);
          return {
            kind,
            recited: !!sent?.recited,
            errors: clampErrors(sent?.errors),
            note: String(sent?.note ?? '').slice(0, 280),
          };
        })
      : [];

    const existing = await tx.dayEntry.findUnique({
      where: { studentId_day: { studentId: st.id, day: card.day } },
      include: { lines: true },
    });

    /* WHICH مقرّر THIS DAY IS ABOUT — and it is not «where his pointer stands».
       A saved card that is opened and saved again is the SAME afternoon: he
       recited one درس on it, not two, so the second save must recompute from
       where he stood BEFORE the day rather than advance him a second time.
       Without this, correcting a typo in a note pushes a boy forward a مقرّر he
       never recited, and «أُعيد الحساب على ما حُفظ أخيرًا — زيادةً أو نقصًا»
       would hold for his points and not for his place in the sheet.

       So the anchor is the entry's own `assignmentNo` when there is one. His
       pointer is the anchor only for a day being registered for the FIRST time
       — which is also what makes «الانتقال يقع بترتيب التسجيل لا بترتيب
       التقويم» true: registering last week's missed day moves him on by one
       from wherever he is now, exactly as §١٥ says. */
    /* «المعلم لا يمكن ان يحدد مقرر الطالب» (client, 18 Sep 2026). There is no
       third fallback any more: a boy nobody has placed stays unplaced, his card
       takes حضور and ثوب only, and the supervisor sets the pointer from بوابة
       الإدارة. Anything else would let a teacher invent a starting point for a
       boy already halfway through a level. */
    const prog = st.progress;
    const at = existing?.assignmentNo ?? prog?.assignmentNo ?? null;

    /* And whether he was stopped for an exam BEFORE this day: on a re-save that
       is a property of the day's own مقرّر, not of the pointer, which this very
       card may have moved into the stop. */
    const wasAwaiting = existing
      ? badgeAt(at ?? 0, examDays)
      : ((prog?.awaitingExam as SaveResult['awaitingExam']) ?? null);

    const moved = advance(
      { assignmentNo: at, awaitingExam: wasAwaiting },
      lines,
      { dayCount: Math.max(dayCount, at ?? 1), examDays },
    );

    /* التلقين: the name is matched against the 114 so a typo cannot become a
       position, and the ayah is clamped to the surah's own count — «آخر آية
       حفظها» in سورة الناس cannot be the ninth. */
    const talqeen = track === 'TALQEEN' ? readTalqeen(card) : null;

    const row = {
      halaqaId,
      status: card.status,
      thobe: card.status === 'ABSENT' ? false : card.thobe,
      assignmentNo: at,
      talqeenSurah: talqeen?.surah ?? null,
      talqeenAyah: talqeen?.ayah ?? null,
      level: plan?.level ?? st.currentLevel ?? null,
      track: track ?? null,
      incomplete: moved.incomplete,
      note: String(card.note ?? '').slice(0, 280),
      savedById: by.id,
      savedByRole: by.role,
      savedByName: by.name,
      savedAt: new Date(),
    };

    let entryId: string;
    if (existing) {
      /* «ويُسجَّل السابق في سجّل التعديل» — before the update, not after. */
      await tx.dayEntryRevision.create({
        data: {
          entryId: existing.id,
          before: {
            status: existing.status, thobe: existing.thobe, note: existing.note,
            assignmentNo: existing.assignmentNo, incomplete: existing.incomplete,
            lines: existing.lines.map((l) => ({
              kind: l.kind, recited: l.recited, errors: l.errors, note: l.note })),
          },
          after: { ...row, savedAt: undefined, lines },
          byId: by.id, byRole: by.role, byName: by.name,
        },
      });
      await tx.dayEntry.update({ where: { id: existing.id }, data: row });
      await tx.recitationLine.deleteMany({ where: { entryId: existing.id } });
      entryId = existing.id;
    } else {
      const created = await tx.dayEntry.create({
        data: { ...row, studentId: st.id, day: card.day },
        select: { id: true },
      });
      entryId = created.id;
    }

    if (lines.length) {
      await tx.recitationLine.createMany({
        data: lines.map((l) => ({
          entryId, kind: l.kind, recited: l.recited, errors: l.errors, note: l.note })),
      });
    }

    /* ── موضع التلقين ─────────────────────────────────────────────────────
       His own pointer, and the only one he has. Written even when the surah is
       cleared, because «لم يُسجَّل له موضع» is a state a teacher may want back. */
    if (track === 'TALQEEN') {
      await tx.studentProgress.upsert({
        where: { studentId: st.id },
        create: {
          studentId: st.id, track: 'TALQEEN',
          talqeenSurah: talqeen?.surah ?? null, talqeenAyah: talqeen?.ayah ?? null,
          setById: by.id, setByRole: by.role, setByName: by.name,
        },
        update: {
          talqeenSurah: talqeen?.surah ?? null, talqeenAyah: talqeen?.ayah ?? null,
          setById: by.id, setByRole: by.role, setByName: by.name,
        },
      });
    }

    /* ── the pointer ─────────────────────────────────────────────────────── */
    if (at != null || moved.awaitingExam) {
      await tx.studentProgress.upsert({
        where: { studentId: st.id },
        create: {
          studentId: st.id,
          track: plan?.track ?? track ?? null,
          level: plan?.level ?? st.currentLevel ?? null,
          assignmentNo: moved.assignmentNo,
          awaitingExam: moved.awaitingExam,
          setById: by.id, setByRole: by.role, setByName: by.name,
        },
        update: {
          track: plan?.track ?? track ?? null,
          level: plan?.level ?? st.currentLevel ?? null,
          assignmentNo: moved.assignmentNo,
          awaitingExam: moved.awaitingExam,
          setById: by.id, setByRole: by.role, setByName: by.name,
        },
      });
    }

    /* ── the points ──────────────────────────────────────────────────────── */
    const award = dailyAward({
      track, status: card.status, thobe: row.thobe, lines, items, golden });

    const paidRows = await tx.pointTxn.findMany({
      where: { refType: 'day', refId: entryId }, select: { delta: true } });
    const paid = paidRows.reduce((n, t) => n + t.delta, 0);
    const delta = award.total - paid;

    if (paidRows.length === 0 && award.total > 0) {
      /* First save: one row per item, so the student's own ledger reads «حضور
         ١٠» and «درس ٥» rather than a lump of twenty-four he cannot account
         for. Dated by the HALAQA's day, not by this moment. */
      await tx.pointTxn.createMany({
        data: award.items.map((i, n) => ({
          id: `day-${entryId}-${i.code}-${n}`,
          studentId: st.id,
          delta: i.points,
          kind: 'DAILY',
          reason: i.label,
          refType: 'day',
          refId: entryId,
          effectiveOn: card.day,
          createdBy: by.name,
        })),
      });
    } else if (delta !== 0) {
      /* A second save moves only the difference, and as its own row: the ledger
         is append-only, so «سُحبت نقاطها بحركة تصحيح مسجّلة». */
      await tx.pointTxn.create({
        data: {
          id: `day-${entryId}-fix-${Date.now()}`,
          studentId: st.id,
          delta,
          kind: 'CORRECTION',
          reason: delta > 0 ? 'تصحيح تسجيل اليوم — زيادة' : 'تصحيح تسجيل اليوم — سحب',
          refType: 'day',
          refId: entryId,
          effectiveOn: card.day,
          createdBy: by.name,
        },
      });
    }

    return {
      entryId,
      assignmentNo: moved.assignmentNo,
      awaitingExam: moved.awaitingExam,
      reachedExam: moved.reachedExam,
      incomplete: moved.incomplete,
      points: award.total,
      pointsDelta: delta,
    };
  });
}

/**
 * مسح تسجيل يوم — «إذا شلت تحضير اليوم المفروض إنه يمديني أحفظ التعديل».
 *
 * A teacher who marked the wrong boy present needs the card to go back to
 * having nothing on it, and that is a SAVE like any other: the entry is
 * removed, its points are pulled back by a correction row, and the pointer
 * returns to the مقرّر the day had recorded.
 *
 * The row is deleted rather than blanked — a card with no attendance state is
 * not a state the enum can hold, and «لم يُسجَّل» must read the same whether the
 * day was never touched or was touched and undone. What survives is the
 * revision: «حذف يوم أو حركة نقاط — التصحيح مسجَّل لا محذوف», so what the card
 * held is written down before it goes, and the ledger keeps every row it ever
 * had plus the one that reverses them.
 */
export async function clearCard(args: {
  halaqaId: string;
  studentId: string;
  day: string;
  by: { id: string; name: string; role: 'TEACHER' | 'SUPERVISOR' };
}): Promise<{ cleared: boolean; pointsDelta: number }> {
  const { halaqaId, studentId, day, by } = args;

  return db.$transaction(async (tx) => {
    const st = await tx.student.findFirstOrThrow({
      where: { id: studentId, halaqaId }, select: { id: true } });

    const entry = await tx.dayEntry.findUnique({
      where: { studentId_day: { studentId: st.id, day } },
      include: { lines: true },
    });
    /* Nothing saved — clearing an untouched card is a no-op, not an error. */
    if (!entry) return { cleared: false, pointsDelta: 0 };

    await tx.dayEntryRevision.create({
      data: {
        entryId: entry.id,
        before: {
          status: entry.status, thobe: entry.thobe, note: entry.note,
          assignmentNo: entry.assignmentNo, incomplete: entry.incomplete,
          lines: entry.lines.map((l) => ({
            kind: l.kind, recited: l.recited, errors: l.errors, note: l.note })),
        },
        after: { cleared: true },
        byId: by.id, byRole: by.role, byName: by.name,
      },
    });

    /* Pull the points back before the row they point at disappears. */
    const paidRows = await tx.pointTxn.findMany({
      where: { refType: 'day', refId: entry.id }, select: { delta: true } });
    const paid = paidRows.reduce((n, t) => n + t.delta, 0);
    if (paid !== 0) {
      await tx.pointTxn.create({
        data: {
          id: `day-${entry.id}-clear-${Date.now()}`,
          studentId: st.id,
          delta: -paid,
          kind: 'CORRECTION',
          reason: 'مسح تسجيل اليوم',
          /* The refID is dropped — the entry is going, and a row pointing at a
             deleted id would look like an unpaid card on the next save — but
             the TYPE stays `day`, because that is what marks a row as the
             teacher portal's own.
             `PUT /api/state` keeps exactly the `day` rows and rewrites every
             other one from the supervisor's browser. With the type dropped too,
             this correction survived the delete AND came back in the incoming
             list, so the insert collided with itself on the primary key and
             took the whole save down: after any «امسح تسجيله», the supervisor
             could never save again. */
          refType: 'day',
          refId: null,
          effectiveOn: day,
          createdBy: by.name,
        },
      });
    }

    /* And he goes back to the مقرّر this day was about — the same anchor a
       re-save computes from, so clearing and re-saving land in the same place. */
    if (entry.assignmentNo != null) {
      const plan = await tx.studentPlan.findFirst({
        where: { studentId: st.id }, orderBy: { issuedAt: 'desc' } });
      const examDays = (plan?.examDays as unknown as ExamDayMap | null) ?? DEFAULT_EXAM_DAYS;
      await tx.studentProgress.updateMany({
        where: { studentId: st.id },
        data: {
          assignmentNo: entry.assignmentNo,
          awaitingExam: badgeAt(entry.assignmentNo, examDays),
          setById: by.id, setByRole: by.role, setByName: by.name,
        },
      });
    }

    /* The revision cascades with the entry — it is a record OF that entry, and
       the deletion is already written in the audit of the points. */
    await tx.dayEntry.delete({ where: { id: entry.id } });

    return { cleared: true, pointsDelta: -paid };
  });
}

/** The guard §٩-د demands, applied to what comes back from a phone that was
    offline: «ما يُرفع من جهاز المعلم بعد انقطاع لا يُقبل قبل أن يُقاس بما في
    الخادم: فإن كان يُنقص بيانات موجودة رُفض وعُرض على المعلم».

    Concretely: a queued card may not turn a SAVED day into an unsaved one, and
    may not blank recitation the server already holds. It may change anything —
    a correction is the point of the three modes — but it may not arrive empty
    and quietly delete. */
export function reducesData(
  incoming: SaveCard,
  held: { status: string; thobe: boolean; lines: { recited: boolean }[] } | null,
): boolean {
  if (!held) return false;
  const heldRecited = held.lines.filter((l) => l.recited).length;
  const sentRecited = incoming.lines.filter((l) => l.recited).length;
  /* An absent boy has no lines by definition, so marking him absent is a
     deliberate change and not a loss — only silence is. */
  const sentIsBlank = incoming.status === 'PRESENT' && sentRecited === 0 && !incoming.thobe
    && !String(incoming.note ?? '').trim();
  return sentIsBlank && (heldRecited > 0 || held.thobe);
}

export type { Prisma };
