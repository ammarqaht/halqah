/* قواعد بوابة المعلم — كل تأكيد يقتبس جملته من الوثيقة لا من الشيفرة.
   The suite is written against the requirements document (third revision,
   15 Sep 2026) and the client's calendar answer of 17 Sep 2026, so it fails if
   the implementation drifts from what was agreed rather than agreeing with
   whatever the implementation happens to do. */
import { describe, expect, it } from 'vitest';
import {
  ABSENCE_IN_WINDOW, ABSENCE_STREAK, DEFAULT_DAILY_POINTS, DEFAULT_HALAQA_WEEKDAYS,
  MAX_ERRORS, absence, advance, advances, badgeAt, clampErrors, countsAsPresent,
  applyFactor, dailyAward, dayHeading, dayState, daysInPeriod, hijri, inFuture,
  isIncomplete, knightDay, knightOfWeek, opensItself, reconcile, talqeenStart,
} from './teacher';
import type { LineInput } from './teacher';

const PLAN = { dayCount: 24, examDays: { BADGE_GOLDEN: 12, BADGE_DIAMOND: 24 } };

const line = (kind: LineInput['kind'], recited: boolean, errors = 0): LineInput =>
  ({ kind, recited, errors });
const full = (recited = true) => [
  line('MURAJAA_KUBRA', recited), line('MURAJAA_SUGHRA', recited), line('DARS', recited),
];

/* ── التقويم ──────────────────────────────────────────────────────────────── */

describe('التقويم — «أيّ يوم يكون فيه تحضير يُعتبر يوم حلقة»', () => {
  it('الأصل من الأحد إلى الخميس، فتفتح أنفسها', () => {
    expect(DEFAULT_HALAQA_WEEKDAYS).toEqual([0, 1, 2, 3, 4]);
    expect(opensItself('2026-09-20')).toBe(true);   // Sunday
    expect(opensItself('2026-09-24')).toBe(true);   // Thursday
  });

  it('الجمعة والسبت لا تفتحان أنفسهما — وتُفتحان كيوم استثنائي بضغطة', () => {
    expect(opensItself('2026-09-18')).toBe(false);  // Friday
    expect(opensItself('2026-09-19')).toBe(false);  // Saturday
  });

  it('ومَن غيّر أيام حلقته غيّر ما يفتح نفسه، بلا شيفرة جديدة', () => {
    expect(opensItself('2026-09-19', [5, 6])).toBe(true);
    expect(opensItself('2026-09-20', [5, 6])).toBe(false);
  });

  it('«ولا يقبل النظام تسجيلًا على يوم لم يأتِ بعد»', () => {
    expect(inFuture('2026-09-20', '2026-09-17')).toBe(true);
    expect(inFuture('2026-09-17', '2026-09-17')).toBe(false);
    expect(inFuture('2026-09-16', '2026-09-17')).toBe(false);
  });

  it('«فترة لطالب» تعرض أيام الحلقة وحدها، ولا تعرض يومًا لم يأتِ بعد', () => {
    /* 2026-09-13 الأحد … 2026-09-19 السبت */
    const days = daysInPeriod('2026-09-13', '2026-09-19', DEFAULT_HALAQA_WEEKDAYS, '2026-09-17');
    expect(days).toEqual([
      '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
    ]);
  });

  it('وفترة مقلوبة لا تعطي شيئًا بدل أن تعطي شيئًا خاطئًا', () => {
    expect(daysInPeriod('2026-09-19', '2026-09-13')).toEqual([]);
  });
});

/* ── مؤشّر المقرّر ─────────────────────────────────────────────────────────── */

describe('الانتقال إلى المقرّر التالي — «بإنجاز الدرس وحده»', () => {
  it('سمّع درسه فانتقل', () => {
    const a = advance({ assignmentNo: 7, awaitingExam: null }, full(), PLAN);
    expect(a.assignmentNo).toBe(8);
    expect(a.incomplete).toBe(false);
  });

  it('«ومَن سمّع مراجعته ولم يسمّع درسه بقي على مقرّره»', () => {
    const lines = [line('MURAJAA_KUBRA', true), line('MURAJAA_SUGHRA', true), line('DARS', false)];
    expect(advances(lines)).toBe(false);
    expect(advance({ assignmentNo: 7, awaitingExam: null }, lines, PLAN).assignmentNo).toBe(7);
  });

  it('«سمّع الدرس دون المراجعة: ينتقل، ويُعلَّم يومه ناقصًا»', () => {
    const lines = [line('MURAJAA_KUBRA', false), line('MURAJAA_SUGHRA', true), line('DARS', true)];
    expect(isIncomplete(lines)).toBe(true);
    const a = advance({ assignmentNo: 7, awaitingExam: null }, lines, PLAN);
    expect(a.assignmentNo).toBe(8);
    expect(a.incomplete).toBe(true);
  });

  it('واليوم الكامل ليس ناقصًا', () => {
    expect(isIncomplete(full())).toBe(false);
  });

  it('ومَن لم يسمّع شيئًا لا يُعلَّم يومه ناقصًا — فالنقص وصفُ انتقالٍ لا وصفُ غياب', () => {
    expect(isIncomplete(full(false))).toBe(false);
  });

  it('«بلوغ المقرّر ١٢ يقف عنده» — والإشعار يخرج في اللحظة نفسها', () => {
    const a = advance({ assignmentNo: 11, awaitingExam: null }, full(), PLAN);
    expect(a.assignmentNo).toBe(12);
    expect(a.awaitingExam).toBe('BADGE_GOLDEN');
    expect(a.reachedExam).toBe(true);
  });

  it('«ولا يمضي حتى تُسجَّل نتيجته» — فالواقف لا يتحرّك ولو سمّع', () => {
    const a = advance({ assignmentNo: 12, awaitingExam: 'BADGE_GOLDEN' }, full(), PLAN);
    expect(a.assignmentNo).toBe(12);
    expect(a.awaitingExam).toBe('BADGE_GOLDEN');
    expect(a.reachedExam).toBe(false);
  });

  it('والماسي آخر المستوى، فلا يجاوز المؤشّر ورقته', () => {
    const a = advance({ assignmentNo: 23, awaitingExam: null }, full(), PLAN);
    expect(a.assignmentNo).toBe(24);
    expect(a.awaitingExam).toBe('BADGE_DIAMOND');
  });

  it('«لم يُحدَّد مقرّره بعد» لا يُخترع له رقم عند الحفظ', () => {
    const a = advance({ assignmentNo: null, awaitingExam: null }, full(), PLAN);
    expect(a.reachedExam).toBe(false);
    expect(a.incomplete).toBe(false);
  });

  it('حفظ البطاقة مرة أخرى لا يقدّمه مرتين — فاليوم واحد والدرس واحد', () => {
    /* The rule `lib/day.ts` leans on: the anchor is the مقرّر THE DAY recorded,
       not where the pointer now stands. Recomputing from the day's own value is
       what makes a second save a correction rather than a second advance. */
    const first = advance({ assignmentNo: 10, awaitingExam: null }, full(), PLAN);
    expect(first.assignmentNo).toBe(11);
    const again = advance({ assignmentNo: 10, awaitingExam: null }, full(), PLAN);
    expect(again.assignmentNo).toBe(11);
  });

  it('ورفع علامة الدرس في الحفظ الثاني يعيده إلى مقرّره', () => {
    const undone = advance({ assignmentNo: 10, awaitingExam: null }, full(false), PLAN);
    expect(undone.assignmentNo).toBe(10);
  });

  it('مقرّرا الاختبار يُقرآن من الخطة لا من رقمين مكتوبين', () => {
    /* خطة عُدِّل فيها موضع الوسامين وطولها: ٢٦ مقرّرًا، والذهبي على ١٣ */
    const moved = { dayCount: 26, examDays: { BADGE_GOLDEN: 13, BADGE_DIAMOND: 26 } };
    expect(badgeAt(12, moved.examDays)).toBe(null);
    expect(badgeAt(13, moved.examDays)).toBe('BADGE_GOLDEN');
    expect(advance({ assignmentNo: 12, awaitingExam: null }, full(), moved).awaitingExam)
      .toBe('BADGE_GOLDEN');
  });

  it('التقدّم بترتيب التسجيل لا بترتيب التقويم: خمسة عشر يومًا دفعةً تُقدّمه بعدد دروسه', () => {
    let at: number | null = 1;
    let waiting: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null = null;
    /* عشرة أيام: سمّع درسه في سبعةٍ منها فقط */
    const recitedDars = [true, true, false, true, true, true, false, true, true, false];
    for (const r of recitedDars) {
      const a = advance({ assignmentNo: at, awaitingExam: waiting },
        [line('MURAJAA_KUBRA', r), line('MURAJAA_SUGHRA', r), line('DARS', r)], PLAN);
      at = a.assignmentNo; waiting = a.awaitingExam;
    }
    expect(at).toBe(8);          // ١ + ٧ دروس، لا ١ + ١٠ أيام
    expect(waiting).toBe(null);
  });
});

/* ── عدد الأخطاء ──────────────────────────────────────────────────────────── */

describe('عدد الأخطاء — «وحدّه الأعلى خمسون، وما جاوزها فهو خطأ إدخال»', () => {
  it('الحدّ خمسون', () => {
    expect(MAX_ERRORS).toBe(50);
    expect(clampErrors(51)).toBe(50);
    expect(clampErrors(9999)).toBe(50);
  });

  it('والسالب والفراغ صفر، لا رقم غريب في السجل', () => {
    expect(clampErrors(-3)).toBe(0);
    expect(clampErrors('')).toBe(0);
    expect(clampErrors(null)).toBe(0);
    expect(clampErrors('٧')).toBe(0);     // أرقام عربية لا تُقرأ عددًا — ولا تُخترع
    expect(clampErrors('7')).toBe(7);
    expect(clampErrors(3.8)).toBe(3);
  });
});

/* ── النقاط اليومية ───────────────────────────────────────────────────────── */

describe('النقاط اليومية — §١٣ بقيم ورقة العميل', () => {
  it('«حضور ١٠ · ثوب ٢ · الدرس ٥ · م.ص ٢ · م.ك ٥»', () => {
    expect(DEFAULT_DAILY_POINTS).toEqual({
      ATTENDANCE: 10, THOBE: 2, DARS: 5, MURAJAA_SUGHRA: 2, MURAJAA_KUBRA: 5,
    });
  });

  it('اليوم الكامل في المسار الفضي أربعٌ وعشرون نقطة', () => {
    const a = dailyAward({ track: 'SILVER', status: 'PRESENT', thobe: true, lines: full() });
    expect(a.total).toBe(24);
    expect(a.items.map((i) => i.code))
      .toEqual(['ATTENDANCE', 'THOBE', 'MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS']);
  });

  it('«ونقاط السطر كاملة بمجرد التسميع لا تنقص بالأخطاء» — فالتسميع اليومي ليس اختبارًا', () => {
    const clean = dailyAward({ track: 'SILVER', status: 'PRESENT', thobe: false, lines: full() });
    const messy = dailyAward({ track: 'SILVER', status: 'PRESENT', thobe: false,
      lines: [line('MURAJAA_KUBRA', true, 40), line('MURAJAA_SUGHRA', true, 50),
              line('DARS', true, 12)] });
    expect(messy.total).toBe(clean.total);
  });

  it('ولكل مسار جدوله، والمعتمد في الذهبي ضِعف الأسطر دون الحضور والثوب', () => {
    const silver = dailyAward({ track: 'SILVER', status: 'PRESENT', thobe: true, lines: full() });
    const golden = dailyAward({ track: 'GOLDEN', status: 'PRESENT', thobe: true, lines: full() });
    expect(silver.total).toBe(24);          // ١٠ + ٢ + ٥ + ٢ + ٥
    expect(golden.total).toBe(36);          // ١٠ + ٢ + ١٠ + ٤ + ١٠
    expect(golden.items.find((i) => i.code === 'ATTENDANCE')!.points).toBe(10);
    expect(golden.items.find((i) => i.code === 'THOBE')!.points).toBe(2);
  });

  /* «أبي خانة الذهبي قابلة للتعديل، والمضاعفة تشمل الحضور والثوب وليست مفصولة»
     (client, 18 Sep 2026) — so the golden track is a TABLE, and what the
     supervisor typed is what is paid, digit for digit. */
  it('وما يُكتب في عمود الذهبي هو ما يُصرف، بلا مضاعفة عند الدفع', () => {
    const golden = dailyAward({ track: 'GOLDEN', status: 'PRESENT', thobe: true, lines: full(),
      golden: { ATTENDANCE: 20, THOBE: 4, DARS: 10, MURAJAA_SUGHRA: 4, MURAJAA_KUBRA: 10 } });
    expect(golden.items.find((i) => i.code === 'ATTENDANCE')!.points).toBe(20);
    expect(golden.items.find((i) => i.code === 'THOBE')!.points).toBe(4);
    expect(golden.total).toBe(48);
  });

  it('والمضاعفة أداة تملأ العمود دفعةً واحدة، وتشمل البنود الخمسة', () => {
    const doubled = applyFactor(DEFAULT_DAILY_POINTS, 2);
    expect(doubled).toEqual({
      ATTENDANCE: 20, THOBE: 4, DARS: 10, MURAJAA_SUGHRA: 4, MURAJAA_KUBRA: 10 });
    /* وصفر أو سالب لا يوقف الدفع صامتًا: أقلّها واحد. */
    expect(applyFactor(DEFAULT_DAILY_POINTS, 0)).toEqual(DEFAULT_DAILY_POINTS);
  });

  it('«متأخر» حاضرٌ يأخذ نقاطه — «النظام يحسب ولا يحكم»، ولا خصم في هذه البوابة', () => {
    expect(countsAsPresent('LATE')).toBe(true);
    const late = dailyAward({ track: 'SILVER', status: 'LATE', thobe: true, lines: full() });
    expect(late.total).toBe(24);
  });

  it('والغائب لا شيء له، فخاناته مغلقة أصلًا', () => {
    expect(countsAsPresent('ABSENT')).toBe(false);
    expect(dailyAward({ track: 'SILVER', status: 'ABSENT', thobe: true, lines: full() }).total)
      .toBe(0);
  });

  it('و«غائب بعذر» لم يعد حالةً أصلًا — حُذفت بقرار العميل ١٨ سبتمبر ٢٠٢٦', () => {
    /* Not a state the enum can hold any more. Anything that is not one of the
       three is simply not present, and earns nothing. */
    expect(countsAsPresent('EXCUSED')).toBe(false);
    expect(dailyAward({ track: 'SILVER', status: 'EXCUSED', thobe: true, lines: full() }).total)
      .toBe(0);
  });

  it('«وطلاب التلقين خارج هذا كله» — والصفر من القاعدة لا من إخفاء التبويب', () => {
    expect(dailyAward({ track: 'TALQEEN', status: 'PRESENT', thobe: true, lines: full() }))
      .toEqual({ items: [], total: 0 });
    expect(dailyAward({ track: null, status: 'PRESENT', thobe: true, lines: full() }).total).toBe(0);
  });

  it('وبند بقيمة صفر لا يُكتب سطرًا في السجل', () => {
    const a = dailyAward({ track: 'SILVER', status: 'PRESENT', thobe: true, lines: full(),
      items: { ...DEFAULT_DAILY_POINTS, THOBE: 0 } });
    expect(a.items.some((i) => i.code === 'THOBE')).toBe(false);
  });

  it('«أُعيد الحساب على ما حُفظ أخيرًا — زيادةً أو نقصًا» بحركة تصحيح لا بحذف', () => {
    expect(reconcile(24, 24)).toBe(0);       // الحفظ الذي لم يغيّر شيئًا لا يكتب شيئًا
    expect(reconcile(24, 12)).toBe(-12);     // رُفعت علامة تسميع فسُحبت نقاطها
    expect(reconcile(12, 24)).toBe(12);
    expect(reconcile(0, 24)).toBe(24);
  });
});

/* ── الغياب المتكرر ───────────────────────────────────────────────────────── */

describe('الغياب المتكرر — «ثلاثة أيام حلقة متتالية، أو خمسة في الشهر»', () => {
  const rec = (day: string, status: string) => ({ day, status });

  it('الحدّان ثلاثة وخمسة', () => {
    expect(ABSENCE_STREAK).toBe(3);
    expect(ABSENCE_IN_WINDOW).toBe(5);
  });

  it('ثلاثة أيام حلقة متتالية تُنبّه', () => {
    const a = absence([
      rec('2026-09-15', 'ABSENT'), rec('2026-09-16', 'ABSENT'), rec('2026-09-17', 'ABSENT'),
    ], '2026-09-17');
    expect(a.streak).toBe(3);
    expect(a.flagged).toBe(true);
  });

  it('واثنان لا', () => {
    const a = absence([
      rec('2026-09-15', 'PRESENT'), rec('2026-09-16', 'ABSENT'), rec('2026-09-17', 'ABSENT'),
    ], '2026-09-17');
    expect(a.streak).toBe(2);
    expect(a.flagged).toBe(false);
  });

  it('والمتأخر حاضرٌ يقطع التتابع، فليس غيابًا', () => {
    const a = absence([
      rec('2026-09-13', 'ABSENT'), rec('2026-09-14', 'LATE'),
      rec('2026-09-15', 'ABSENT'), rec('2026-09-16', 'ABSENT'),
    ], '2026-09-16');
    expect(a.streak).toBe(2);
    expect(a.days).not.toContain('2026-09-14');
  });

  it('والحضور يقطعه', () => {
    const a = absence([
      rec('2026-09-13', 'ABSENT'), rec('2026-09-14', 'PRESENT'),
      rec('2026-09-15', 'ABSENT'), rec('2026-09-16', 'ABSENT'),
    ], '2026-09-16');
    expect(a.streak).toBe(2);
  });

  it('«وأيام الإجازة لا تقطع التتابع ولا تُحسب فيه» — بلا شيفرة، فلا يوم لها أصلًا', () => {
    /* الخميس ١٧، ثم الجمعة والسبت بلا تحضير، ثم الأحد ٢٠ والاثنين ٢١ */
    const a = absence([
      rec('2026-09-17', 'ABSENT'), rec('2026-09-20', 'ABSENT'), rec('2026-09-21', 'ABSENT'),
    ], '2026-09-21');
    expect(a.streak).toBe(3);
    expect(a.flagged).toBe(true);
  });

  it('خمسة في ثلاثين يومًا متحركة تُنبّه ولو تفرّقت', () => {
    const a = absence([
      rec('2026-08-25', 'ABSENT'), rec('2026-08-31', 'ABSENT'), rec('2026-09-03', 'ABSENT'),
      rec('2026-09-09', 'ABSENT'), rec('2026-09-15', 'ABSENT'), rec('2026-09-17', 'PRESENT'),
    ], '2026-09-17');
    expect(a.streak).toBe(0);
    expect(a.inWindow).toBe(5);
    expect(a.flagged).toBe(true);
  });

  it('وما خرج من النافذة لا يُحسب فيها، ويبقى في الكشف', () => {
    const a = absence([
      rec('2026-07-01', 'ABSENT'), rec('2026-09-17', 'ABSENT'),
    ], '2026-09-17');
    expect(a.inWindow).toBe(1);
    expect(a.days).toHaveLength(2);
  });

  it('وسجلٌّ فارغ لا يُنبّه على أحد', () => {
    expect(absence([], '2026-09-17')).toEqual({
      streak: 0, inWindow: 0, flagged: false, days: [] });
  });
});

/* ── حال اليوم ────────────────────────────────────────────────────────────── */

describe('حال اليوم — «لم يُسَّجل بعد · سُجِّل ١٢ من ٢٥ · اكتمل»', () => {
  it('ولا نعرض صفرًا في أول النهار يوهم أن الحلقة فارغة', () => {
    expect(dayState(0, 25)).toBe('NOT_STARTED');
    expect(dayState(12, 25)).toBe('PARTIAL');
    expect(dayState(25, 25)).toBe('COMPLETE');
  });

  it('وحلقة بلا طلاب ليست يومًا مكتملًا', () => {
    expect(dayState(0, 0)).toBe('NOT_STARTED');
  });
});

/* ── التاريخ ──────────────────────────────────────────────────────────────── */

describe('«التاريخ باليومين الهجري والميلادي» (مع-٢)', () => {
  it('الهجري بتقويم أم القرى مسمًّى صريحًا، لا بلغة الجهاز', () => {
    /* ٢٠٢٦-٠٩-١٧ = ٦ ربيع الآخر ١٤٤٨ */
    expect(hijri('2026-09-17')).toBe('6 ربيع الآخر 1448');
  });

  it('وبطاقة اليوم تحمل اليوم والتاريخين', () => {
    const h = dayHeading('2026-09-17');
    expect(h.weekday).toBe('الخميس');
    expect(h.gregorian).toBe('2026/09/17');
    expect(h.hijri).toContain('1448');
  });

  it('وتاريخ فاسد يقول «—» ولا يقول رقمًا مخترعًا', () => {
    expect(hijri('')).toBe('—');
    expect(dayHeading('ليس تاريخًا').weekday).toBe('—');
  });
});

/* ── فرسان الأسبوع ────────────────────────────────────────────────────────── */

describe('«من حقّقوا كل المتطلبات اليوم لمدة أسبوع: الحضور — الثوب — التسميع كامل»', () => {
  const full = (): LineInput[] => [
    { kind: 'DARS', recited: true, errors: 0 },
    { kind: 'MURAJAA_SUGHRA', recited: true, errors: 0 },
    { kind: 'MURAJAA_KUBRA', recited: true, errors: 0 },
  ];
  const perfect = { status: 'PRESENT', thobe: true, lines: full() };

  it('اليوم الكامل: حاضر، وبثوبه، وسمّع أسطره الثلاثة', () => {
    expect(knightDay(perfect)).toBe(true);
  });

  it('وبلا ثوب ليس يومًا كاملًا، فالثوب بند مستقل في الورقة', () => {
    expect(knightDay({ ...perfect, thobe: false })).toBe(false);
  });

  it('وسطر واحد لم يُسمَّع يكسر اليوم — «التسميع كامل» لا بعضه', () => {
    const lines = full();
    lines[2].recited = false;
    expect(knightDay({ ...perfect, lines })).toBe(false);
  });

  it('والمتأخر لا يكون فارسًا وإن كان حاضرًا يُحسب له حضوره', () => {
    /* countsAsPresent يعدّه حاضرًا في النقاط، وهذا الباب أضيق منه عمدًا. */
    expect(countsAsPresent('LATE')).toBe(true);
    expect(knightDay({ ...perfect, status: 'LATE' })).toBe(false);
  });

  it('ومن لا مقرّر أمامه ليس فارسًا — أسبوعٌ بلا تسميع ليس تسميعًا كاملًا', () => {
    expect(knightDay({ ...perfect, lines: [] })).toBe(false);
  });

  it('الفارس من أتمّ كل أيام حلقته المسجَّلة في المدة', () => {
    const days = ['2026-09-13', '2026-09-14', '2026-09-15'];
    const on = Object.fromEntries(days.map((d) => [d, { ...perfect, lines: full() }]));
    expect(knightOfWeek(days, on)).toEqual({ knight: true, met: 3, of: 3 });
  });

  it('ويومٌ واحد ناقص يُخرجه، ويبقى العدد ظاهرًا ليُقرأ', () => {
    const days = ['2026-09-13', '2026-09-14', '2026-09-15'];
    const on: Record<string, { status: string; thobe: boolean; lines: LineInput[] }> =
      Object.fromEntries(days.map((d) => [d, { ...perfect, lines: full() }]));
    on['2026-09-14'] = { ...perfect, thobe: false, lines: full() };
    expect(knightOfWeek(days, on)).toEqual({ knight: false, met: 2, of: 3 });
  });

  it('واليوم الذي لم يُسجَّل له فيه شيء يُخرجه — لا يُفترض له حضور', () => {
    const days = ['2026-09-13', '2026-09-14'];
    expect(knightOfWeek(days, { '2026-09-13': { ...perfect, lines: full() } }))
      .toEqual({ knight: false, met: 1, of: 2 });
  });

  it('ومدّة لا يوم حلقة فيها لا فرسان لها — لم يُثبت أحد شيئًا', () => {
    expect(knightOfWeek([], {})).toEqual({ knight: false, met: 0, of: 0 });
  });

  /* «واللي عنده اختبار إذا اختبر واجتاز يُحسب ذلك اليوم أنه حقّق المتطلب لذلك
     اليوم» (client, 18 Sep 2026). */
  it('ويومُ اختبارٍ اجتازه يومٌ محقَّق، وإن لم يكن في صفّ حلقته', () => {
    const days = ['2026-09-13', '2026-09-14'];
    const on = { '2026-09-13': { ...perfect, lines: full() } };
    /* لا تحضير له يوم الاختبار: هو عند المختبِر. */
    expect(knightOfWeek(days, on, { '2026-09-14': true }))
      .toEqual({ knight: true, met: 2, of: 2 });
  });

  it('ولم يجتزه فليس يومًا محقَّقًا — الشرط «اجتاز» لا «اختبر»', () => {
    const days = ['2026-09-13', '2026-09-14'];
    const on = { '2026-09-13': { ...perfect, lines: full() } };
    expect(knightOfWeek(days, on, { '2026-09-14': false }))
      .toEqual({ knight: false, met: 1, of: 2 });
  });

  it('ومن ينتظر اختباره ولم يختبر بعدُ لا يُحسب له يومه — لا مقرّر أمامه', () => {
    const days = ['2026-09-13'];
    expect(knightOfWeek(days, { '2026-09-13': { ...perfect, lines: [] } }, {}))
      .toEqual({ knight: false, met: 0, of: 1 });
  });
});

/* ── موضع التلقين ─────────────────────────────────────────────────────────── */

describe('«يسجّل لهم المعلم آخر سورة قرأوها وآخر آية حفظوها، وفي اليوم التالي يعرض من أين يبدأ»', () => {
  it('يبدأ من الآية التي تلي آخر ما حفظ', () => {
    expect(talqeenStart('الضحى', 5)).toBe('الضحى — الآية 6');
  });

  it('وإن أتمّ السورة بدأ بالتي بعدها من أولها', () => {
    /* الضحى إحدى عشرة آية. */
    expect(talqeenStart('الضحى', 11)).toBe('الشرح — من أولها');
  });

  it('ومن لم يُسجَّل له موضع لا يُخترع له — فالافتتاح بالفاتحة تخمين', () => {
    expect(talqeenStart(null, null)).toBe('لم يُسجَّل له موضع بعد');
  });

  it('وسورةٌ بلا آية تُذكر وحدها', () => {
    expect(talqeenStart('البقرة', null)).toBe('البقرة');
  });
});
