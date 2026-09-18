/* قواعد بوابة المعلم — §١٥ «قواعد النظام الآلية», and the calendar rule the
   client settled on 17 Sep 2026. Pure functions. No storage, no React — the
   same contract as `lib/points.ts` and `lib/exams.ts`.

   Every rule here produces a number that appears on a screen or in a report, so
   each one is tested against the sentence it came from rather than against the
   implementation. A wrong rule in this file is a wrong figure in seven
   teachers' hands and a hundred and seventeen boys' ledgers. */
import type { PlanKind, Track } from './types';
import { PLAN_KIND_ORDER } from './types';
import { asDate, isoDate } from './dates';
import { ayahCount, nextSurah } from './surahs';

/* ── التقويم — «أيّ يوم يكون فيه تحضير يُعتبر يوم حلقة» ──────────────────────
   The client's own answer, and it is simpler than the calendar the requirements
   document proposed: there is no holiday table to maintain and no chance of a
   holiday being recorded as absence, because a day nobody registered is not a
   halaqa day at all.

   The weekdays below are only what OPENS ITSELF. Sunday to Thursday the day is
   waiting when the teacher arrives; a Friday on which a halaqa is held is opened
   by hand and counts exactly the same once it is. Nothing here refuses a day. */

/** 0 is Sunday — `Date.getDay()`'s own numbering. الأحد → الخميس. */
export const DEFAULT_HALAQA_WEEKDAYS = [0, 1, 2, 3, 4];

export const WEEKDAY_AR = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
] as const;

/** Does this date open itself, or does the teacher have to ask for it? */
export function opensItself(
  day: string | Date, weekdays: number[] = DEFAULT_HALAQA_WEEKDAYS,
): boolean {
  const d = typeof day === 'string' ? asDate(day) : day;
  return d ? weekdays.includes(d.getDay()) : false;
}

/** What the day card says when it is not one of the halaqa's own days. */
export const dayKindAr = (
  day: string, weekdays: number[] = DEFAULT_HALAQA_WEEKDAYS,
): 'ORDINARY' | 'EXCEPTIONAL' => (opensItself(day, weekdays) ? 'ORDINARY' : 'EXCEPTIONAL');

/** «ولا يقبل النظام تسجيلًا على يوم لم يأتِ بعد» (§١٥). */
export const inFuture = (day: string, today: string = isoDate(new Date())) => day > today;

/* ── مؤشّر المقرّر ───────────────────────────────────────────────────────────
   The pointer is WHAT HE MUST RECITE TODAY, not the last thing he recited.
   «المقرّر ٧ من ٢٤» on his card is the passage in front of him. Every rule below
   reads it that way, and getting this backwards shifts every figure in the
   portal by one. */

export type Progress = {
  track: Track | null;
  level: number | null;
  /** 1..dayCount. Null = nobody has said where he stopped yet. */
  assignmentNo: number | null;
  /** He has reached an exam مقرّر and waits for the supervisor's result. */
  awaitingExam: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
};

/** Which badge, if any, sits on this مقرّر — read from the PLAN, never 12/24.
    The two badge days are `DEFAULT_EXAM_DAYS` and a plan may move them, and a
    level's curriculum may run to more than twenty-four days. A rule that
    hard-coded the pair would be right today and wrong the first time the
    supervisor edited a level. */
export function badgeAt(
  assignmentNo: number,
  examDays: { BADGE_GOLDEN?: number; BADGE_DIAMOND?: number },
): 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null {
  if (examDays.BADGE_DIAMOND === assignmentNo) return 'BADGE_DIAMOND';
  if (examDays.BADGE_GOLDEN === assignmentNo) return 'BADGE_GOLDEN';
  return null;
}

/** What a line was recorded as. Two facts and no third — «هل سمّعه، وكم خطأ». */
export type LineInput = { kind: PlanKind; recited: boolean; errors: number };

/** «لكل سطر عدّاده، وحدّه الأعلى خمسون — وما جاوزها فهو خطأ إدخال لا تسميع». */
export const MAX_ERRORS = 50;

export const clampErrors = (n: unknown): number => {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v, MAX_ERRORS);
};

/**
 * «الانتقال إلى المقرّر التالي: بإنجاز الدرس وحده».
 *
 * And «مَن سمّع مراجعته ولم يسمّع درسه بقي على مقرّره» — so the two مراجعة lines
 * are recorded, counted and paid for, and move nothing. The day a boy recites
 * his درس without them still advances him and is marked «ناقص»: «فينتقل إلى
 * المقرّر التالي لأن الدرس أُنجز، ويُعلَّم يومه بأنه ناقص».
 */
export const advances = (lines: LineInput[]) =>
  lines.some((l) => l.kind === 'DARS' && l.recited);

/** التسميع الناقص — the درس recited while some مراجعة was not. */
export function isIncomplete(lines: LineInput[]): boolean {
  if (!advances(lines)) return false;
  return lines.some((l) => l.kind !== 'DARS' && !l.recited);
}

export type Advance = {
  /** Where the pointer stands after this save. */
  assignmentNo: number;
  awaitingExam: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  /** True when the day is to be marked «ناقص». */
  incomplete: boolean;
  /** True when he has just reached a badge مقرّر — the moment three notices go
      out at once, «إلى ثلاثتهم: المعلم، والمشرف، والطالب». */
  reachedExam: boolean;
};

/**
 * Move the pointer for one saved card.
 *
 * «ويقع بترتيب التسجيل لا بترتيب التقويم: مَن سُجِّل له أسبوع متأخر تقدّم بعدد ما
 * سمّع من دروس» — which is why this takes no dates at all. Registering a
 * fortnight at once advances him once per درس, not once per day that passed.
 */
export function advance(
  progress: Pick<Progress, 'assignmentNo' | 'awaitingExam'>,
  lines: LineInput[],
  plan: { dayCount: number; examDays: { BADGE_GOLDEN?: number; BADGE_DIAMOND?: number } },
): Advance {
  const at = progress.assignmentNo;
  const incomplete = isIncomplete(lines);

  /* No pointer yet, or already stopped for an exam: nothing moves. A boy
     waiting on his badge «لا يمضي في الحفظ قبل اختباره», and the card does not
     even offer him lines to recite. */
  if (at == null || progress.awaitingExam) {
    return {
      assignmentNo: at ?? 1,
      awaitingExam: progress.awaitingExam ?? null,
      incomplete: at == null ? false : incomplete,
      reachedExam: false,
    };
  }

  if (!advances(lines)) {
    return { assignmentNo: at, awaitingExam: null, incomplete: false, reachedExam: false };
  }

  /* The last مقرّر of the level is the diamond, so a pointer cannot run past
     the sheet: it stops on the last one and waits for the result. */
  const next = Math.min(at + 1, plan.dayCount);
  const badge = badgeAt(next, plan.examDays);

  return {
    assignmentNo: next,
    awaitingExam: badge,
    incomplete,
    reachedExam: badge !== null,
  };
}

/* ── النقاط اليومية — §١٣ ────────────────────────────────────────────────────
   «حضور ١٠ · ثوب ٢ · الدرس ٥ · م.ص ٢ · م.ك ٥ … تُحسب من التسجيل وتُضاف لحظة حفظ
   البطاقة، ونقاط السطر كاملة بمجرد التسميع لا تنقص بالأخطاء».

   These are the client's own figures from his paper, and they are DEFAULTS, not
   laws: the document requires them «قابلة للتعديل من إعدادات النقاط كما هي بنود
   الاختبارات اليوم», so `lib/settings.ts` stores an override and this object is
   what a fresh database behaves as. */

export type DailyPointItems = {
  ATTENDANCE: number;
  THOBE: number;
  DARS: number;
  MURAJAA_SUGHRA: number;
  MURAJAA_KUBRA: number;
};

export const DEFAULT_DAILY_POINTS: DailyPointItems = {
  ATTENDANCE: 10, THOBE: 2, DARS: 5, MURAJAA_SUGHRA: 2, MURAJAA_KUBRA: 5,
};

/**
 * «نقاط المسار الذهبي ضِعف الفضي في كل بند عدا الحضور والثوب».
 *
 * §١٨ leaves this as an open question to the client — «هل تشمل الحضور، فيصير ٢٠
 * للذهبي و١٠ للفضي؟» — with our proposal recorded: it does NOT, because
 * attendance and the thobe «ليسا مقياس اجتهاد». That proposal is the default,
 * and it is a number in settings so his answer costs an edit rather than a
 * migration.
 */
export type GoldenDoubling = {
  /** Multiplier applied to the three recitation lines on the golden track. */
  lines: number;
  /** Multiplier applied to attendance and thobe. 1 = not doubled. */
  attendance: number;
};

/** @deprecated The golden track is a table of its own since 18 Sep 2026. This
    survives to name what the OLD stored value meant, so `readDaily` can migrate
    a database written before the change without changing what it pays. */
export const DEFAULT_GOLDEN_DOUBLING: GoldenDoubling = { lines: 2, attendance: 1 };

/**
 * ذهبي: the same five items with their own figures.
 *
 * It was a MULTIPLIER — `×2` on the three recitation lines and `×1` on الحضور
 * and الثوب — and the client changed both halves of that on 18 Sep 2026: «وأبي
 * خانة الذهبي قابلة للتعديل، والمضاعفة تشمل الحضور والثوب وليست مفصولة».
 *
 * So the golden track is a COLUMN of five numbers like the silver one, and the
 * multiplier survives only as a way to FILL that column in one stroke — one
 * factor over all five, which is «ليست مفصولة» made structural. A supervisor
 * who wants a figure the multiplier cannot express now types it.
 *
 * Two editable columns is also the shape of the client's own paper, which lists
 * فضي and ذهبي as rows of a table and never mentions a factor at all.
 */
export const applyFactor = (items: DailyPointItems, factor: number): DailyPointItems => {
  const f = Math.max(1, Math.trunc(factor) || 1);
  const out = { ...items };
  for (const k of Object.keys(out) as (keyof DailyPointItems)[]) out[k] = items[k] * f;
  return out;
};

/** The approved golden figures: §١٣'s silver table with the doubling it named —
    the three lines at ×٢, الحضور and الثوب as they are. A database that has never
    been touched therefore pays exactly what it paid before this became a column. */
export const DEFAULT_GOLDEN_POINTS: DailyPointItems = {
  ATTENDANCE: DEFAULT_DAILY_POINTS.ATTENDANCE * DEFAULT_GOLDEN_DOUBLING.attendance,
  THOBE: DEFAULT_DAILY_POINTS.THOBE * DEFAULT_GOLDEN_DOUBLING.attendance,
  DARS: DEFAULT_DAILY_POINTS.DARS * DEFAULT_GOLDEN_DOUBLING.lines,
  MURAJAA_SUGHRA: DEFAULT_DAILY_POINTS.MURAJAA_SUGHRA * DEFAULT_GOLDEN_DOUBLING.lines,
  MURAJAA_KUBRA: DEFAULT_DAILY_POINTS.MURAJAA_KUBRA * DEFAULT_GOLDEN_DOUBLING.lines,
};

/** «متأخر» is a present boy: the states are for FOLLOW-UP, and this portal has
    no deduction in it at all — «النظام يحسب ولا يحكم». His lateness shows in his
    attendance grid and in his teacher's reports, not in his balance. `ABSENT`
    earns nothing.

    There were four states and «غائب بعذر» was one; the client removed it on
    18 Sep 2026. It is gone from the enum as well as from the buttons, so there
    is no third case here to forget. */
export const countsAsPresent = (status: string) => status === 'PRESENT' || status === 'LATE';

/**
 * «من أين يبدأ» — the next ayah after the last one he memorised.
 *
 * It rolls over: a boy who finished الضحى at its eleventh ayah starts at الشرح,
 * and that is the whole reason `lib/surahs.ts` carries the counts. When nothing
 * has been recorded it says so plainly rather than naming الفاتحة — a starting
 * point nobody chose is a guess, and this surface does not make those.
 */
export function talqeenStart(surah: string | null, ayah: number | null): string {
  if (!surah) return 'لم يُسجَّل له موضع بعد';
  const total = ayahCount(surah);
  if (ayah == null) return surah;
  if (total != null && ayah >= total) {
    const next = nextSurah(surah);
    return next ? `${next.name} — من أولها` : `${surah} — أتمّها`;
  }
  return `${surah} — الآية ${ayah + 1}`;
}

/* ── فرسان الأسبوع ───────────────────────────────────────────────────────────
   «وهم من حقّقوا كل المتطلبات اليوم لمدة أسبوع، وهي: الحضور — الثوب — التسميع
   كامل» (client, 18 Sep 2026).

   Not a ranking. There is no first and no fifth: a boy either did everything
   asked of him on every day his halaqa met that week, or he did not, and the
   sheet is however many names that turns out to be — none, or all of them. That
   is the whole difference between this and لوحة الشرف, which orders balances and
   always has exactly five names on it whatever anyone did.

   TWO READINGS ARE SETTLED HERE, and both are recorded because they narrow the
   gate rather than widen it:

     · «الحضور» is `PRESENT` and not `countsAsPresent`. متأخر is a present boy
       everywhere else in this file — the states are for follow-up and this
       portal has no deduction in it — but «حقّق كل المتطلبات» is a statement of
       perfection for the week, and arriving late is not perfect. He keeps his
       points; he does not get the title.
     · «أيام الأسبوع» are the days the halaqa was REGISTERED on, not the days its
       weekday setting says it opens. It follows the calendar rule the client
       settled on 17 Sep 2026 — «أيّ يوم فيه تحضير يُعتبر يوم حلقة» — so a day
       nobody registered cannot be a day a boy failed to attend.                */

export type KnightDay = {
  status: string;
  thobe: boolean;
  lines: LineInput[];
};

/** One day that met every requirement — الحضور والثوب والتسميع كامل. */
export const knightDay = (d: KnightDay) =>
  d.status === 'PRESENT'
  && d.thobe
  /* No lines is not a full recitation. A talqeen boy and a boy whose plan has
     not been issued have nothing in front of them to recite, and a week of
     nothing recited is not a week of «التسميع كامل». The boy stopped at his
     badge مقرّر is the exception, and it is `passedOn` below. */
  && d.lines.length > 0
  && d.lines.every((l) => l.recited);

/**
 * Whether one student was a فارس over a set of halaqa days.
 *
 * `passedOn` is the day-keyed set of exams he SAT AND PASSED: «واللي عنده
 * اختبار، إذا اختبر واجتاز، يُحسب ذلك اليوم أنه حقّق المتطلب لذلك اليوم»
 * (client, 18 Sep 2026).
 *
 * It stands ALONE — it does not ask for attendance or a thobe beside it —
 * because a boy sitting his badge exam is with the examiner and not in his
 * halaqa's row, and there may be no تحضير for him that afternoon at all. What
 * was required of him that day was the exam, and he passed it. Failing it is
 * not a met day: the requirement was «اجتاز».
 *
 * `met` and `of` come back with the verdict so the sheet can say «٥ من ٥» —
 * a title with no figure behind it is a title nobody can check.
 */
export function knightOfWeek(
  days: string[],
  entryOn: Record<string, KnightDay | undefined>,
  passedOn: Record<string, boolean> = {},
): { knight: boolean; met: number; of: number } {
  const of = days.length;
  const met = days.filter((d) => {
    if (passedOn[d]) return true;
    const e = entryOn[d];
    return !!e && knightDay(e);
  }).length;
  /* A week with no halaqa day in it has no فرسان: nobody proved anything. */
  return { knight: of > 0 && met === of, met, of };
}

export type DailyAward = {
  /** One line per item, so the ledger reads «حضور ١٠» and not a lump of 24. */
  items: { code: keyof DailyPointItems; label: string; points: number }[];
  total: number;
};

export const DAILY_ITEM_AR: Record<keyof DailyPointItems, string> = {
  ATTENDANCE: 'حضور', THOBE: 'ثوب',
  DARS: 'درس', MURAJAA_SUGHRA: 'مراجعة صغرى', MURAJAA_KUBRA: 'مراجعة كبرى',
};

/**
 * What one saved card is worth — and it is the ONLY place a daily point is
 * decided, so the teacher's screen, the recompute on a second save, the
 * student's ledger and the reports cannot disagree.
 *
 * A talqeen boy earns nothing: «وطلاب التلقين خارج هذا كله: لا نقاط لهم ولا
 * متجر ولا ترتيب … وهو مطبَّق في الخادم نفسه لا في إخفاء التبويب وحده». So the
 * zero is returned HERE, where every path goes through, and not left to a
 * screen to remember.
 */
export function dailyAward(args: {
  track: Track | null;
  status: string;
  thobe: boolean;
  lines: LineInput[];
  /** المسار الفضي. */
  items?: DailyPointItems;
  /** المسار الذهبي — its own five figures, no longer a factor over the silver. */
  golden?: DailyPointItems;
}): DailyAward {
  const { track, status, thobe, lines } = args;

  if (!track || track === 'TALQEEN') return { items: [], total: 0 };
  if (!countsAsPresent(status)) return { items: [], total: 0 };

  /* One table per track, and the track chooses which one is read. Nothing is
     multiplied at pay time any more: what the supervisor sees in the ذهبي column
     is what a golden boy is paid, digit for digit. */
  const table = track === 'GOLDEN'
    ? (args.golden ?? DEFAULT_GOLDEN_POINTS)
    : (args.items ?? DEFAULT_DAILY_POINTS);

  const out: DailyAward['items'] = [
    { code: 'ATTENDANCE', label: DAILY_ITEM_AR.ATTENDANCE, points: table.ATTENDANCE },
  ];
  if (thobe) out.push({ code: 'THOBE', label: DAILY_ITEM_AR.THOBE, points: table.THOBE });

  /* In the order the sheet prints them: م.ك · م.ص · الدرس. */
  for (const kind of PLAN_KIND_ORDER) {
    const l = lines.find((x) => x.kind === kind);
    if (!l?.recited) continue;
    out.push({ code: kind, label: DAILY_ITEM_AR[kind], points: table[kind] });
  }

  return { items: out.filter((i) => i.points !== 0), total: out.reduce((n, i) => n + i.points, 0) };
}

/**
 * «إن فُتح تسجيل محفوظ وعُدِّل وحُفظ ثانيةً، أُعيد الحساب كله على ما حُفظ أخيرًا —
 * زيادةً أو نقصًا — وسُحبت نقاط ما رُفعت علامته بحركة تصحيح مسجّلة».
 *
 * The ledger is append-only (§٣.٥), so a correction is a row and never an
 * edit. This returns the single delta that reconciles what was already paid
 * with what the card is now worth — zero when nothing changed, which is the
 * ordinary case and must not write a row at all.
 */
export const reconcile = (alreadyPaid: number, nowWorth: number) => nowWorth - alreadyPaid;

/* ── الغياب المتكرر — §١٥ ────────────────────────────────────────────────────
   «تنبيه عند ثلاثة أيام حلقة متتالية، أو خمسة في الشهر … وأيام الإجازة لا تقطع
   التتابع ولا تُحسب فيه».

   The holiday clause needs no code: a holiday has no registered day, so it is
   absent from the sequence entirely — it neither breaks the run nor joins it.
   That is the whole benefit of letting التحضير be the calendar.

   And §١٥'s «والغياب بعذر لا يُحتسب فيه» has nothing left to describe: the state
   was removed on 18 Sep 2026, so every absence counts and a present day — late
   or not — breaks the run. */

export const ABSENCE_STREAK = 3;
export const ABSENCE_IN_WINDOW = 5;
/** A rolling thirty days, not a calendar month whose counter empties on the
    first — a boy who missed three days on the 29th and three on the 2nd has
    missed six in a week, and a calendar month would report neither. */
export const ABSENCE_WINDOW_DAYS = 30;

export type DayRecord = { day: string; status: string };

export type AbsenceFlag = {
  /** Consecutive REGISTERED halaqa days absent, ending at the latest one. */
  streak: number;
  /** Absences inside the rolling window. */
  inWindow: number;
  /** Either threshold reached. */
  flagged: boolean;
  /** The days themselves, newest first — what the كشف الغياب prints. */
  days: string[];
};

/** Absence over the days that were actually registered — newest first, and a
    day the teacher never registered is not in the sequence at all. */
export function absence(
  records: DayRecord[], today: string = isoDate(new Date()),
): AbsenceFlag {
  const sorted = [...records].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const absentDays = sorted.filter((r) => r.status === 'ABSENT').map((r) => r.day);

  let streak = 0;
  for (const r of sorted) {
    if (r.status !== 'ABSENT') break;
    streak++;
  }

  const from = isoDate(new Date(Date.parse(`${today}T00:00:00`)
    - (ABSENCE_WINDOW_DAYS - 1) * 86_400_000));
  const inWindow = absentDays.filter((d) => d >= from && d <= today).length;

  return {
    streak,
    inWindow,
    flagged: streak >= ABSENCE_STREAK || inWindow >= ABSENCE_IN_WINDOW,
    days: absentDays,
  };
}

/* ── حال اليوم — the one sentence the home card leads with ─────────────────── */

export type DayState = 'NOT_STARTED' | 'PARTIAL' | 'COMPLETE';

export const DAY_STATE_AR: Record<DayState, string> = {
  NOT_STARTED: 'لم يُسجَّل بعد', PARTIAL: 'قيد التسجيل', COMPLETE: 'اكتمل',
};

/** «لم يُسَّجل بعد · سُجِّل ١٢ من ٢٥ · اكتمل» — and never a bare zero at the top
    of the afternoon, which would read as an empty halaqa rather than an
    afternoon that has not begun. */
export function dayState(saved: number, roster: number): DayState {
  if (saved <= 0) return 'NOT_STARTED';
  return saved >= roster ? 'COMPLETE' : 'PARTIAL';
}

/* ── التاريخ الهجري ──────────────────────────────────────────────────────────
   «التاريخ باليومين الهجري والميلادي» (مع-٢). `lib/dates.ts` deliberately never
   asks the runtime for a locale's calendar, because `ar-SA` resolves to Hijri
   on some engines and Gregorian on others and the same row would read
   differently on two phones. So the calendar is NAMED here — Umm al-Qura, the
   one the Kingdom prints — and the numerals are forced Latin like every other
   figure on a screen, with `<Num>` around them at the call site. */

const HIJRI_MONTH_AR = [
  'محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة',
] as const;

/** `١٥ ربيع الأول ١٤٤٨` — as `15 ربيع الأول 1448`, for `<Num>` to isolate. */
export function hijri(day: string | Date): string {
  const d = typeof day === 'string' ? asDate(day) : day;
  if (!d) return '—';
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Riyadh',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const month = Number(get('month'));
    if (!month) return '—';
    /* `year` can arrive as «1448 AH» depending on the engine. */
    const year = get('year').replace(/\D+/g, '');
    return `${Number(get('day'))} ${HIJRI_MONTH_AR[month - 1]} ${year}`;
  } catch {
    /* An engine without the calendar is not a reason to show nothing: the
       Gregorian date beside it still says which day this is. */
    return '—';
  }
}

/**
 * The same date in its three pieces.
 *
 * A joined «7 ربيع الآخر 1448» has to be laid out by the bidi algorithm, and it
 * gets it wrong in either direction: forced LTR the day number ends up on the
 * left of an Arabic line, and left to the paragraph it depends on what sits
 * beside it. Whoever renders it can isolate the two NUMBERS and let the Arabic
 * flow around them, which is the only arrangement that is right at every width.
 */
export function hijriParts(day: string | Date): { day: string; month: string; year: string } {
  const text = hijri(day);
  if (text === '—') return { day: '—', month: '', year: '' };
  const bits = text.split(' ');
  return {
    day: bits[0] ?? '',
    month: bits.slice(1, -1).join(' '),
    year: bits[bits.length - 1] ?? '',
  };
}

/** `الأحد ١٥ ربيع الأول · 2026/09/17` — what the day card carries. */
export function dayHeading(day: string): { weekday: string; hijri: string; gregorian: string } {
  const d = asDate(day);
  return {
    weekday: d ? WEEKDAY_AR[d.getDay()] : '—',
    hijri: hijri(day),
    gregorian: d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : '—',
  };
}

/* ── الفترة — وضع «فترة لطالب» ─────────────────────────────────────────────── */

/** Every day between two dates that opens itself, oldest first — what the
    period mode lists. «ولا يعرض فيها يومًا لا حلقة فيه»: a Friday inside the
    range is skipped rather than shown as an unregistered absence. Days already
    registered are included, because the mode exists to correct them too. */
export function daysInPeriod(
  from: string, to: string, weekdays: number[] = DEFAULT_HALAQA_WEEKDAYS,
  today: string = isoDate(new Date()),
): string[] {
  const start = asDate(from);
  const end = asDate(to);
  if (!start || !end || from > to) return [];
  const out: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoDate(d);
    if (iso > today) break;                       // «ولا يقبل النظام فترة لم تأتِ بعد»
    if (weekdays.includes(d.getDay())) out.push(iso);
  }
  return out;
}
