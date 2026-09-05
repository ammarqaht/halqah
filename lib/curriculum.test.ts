/* SPEC.md §4: «Unit-test every one of these.» The stake here is higher than a
   wrong figure on a screen — these functions decide what a child is handed on
   paper and told to memorise for the next five weeks. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAY_COUNT, DEFAULT_EXAM_DAYS, dailyAmountFor, resolvePlan,
  levelAvailable, coverage, removeDay, insertDay, matchesCurriculum, isCustomised,
  incompleteDays,
} from './curriculum';
import { normaliseAyah, normaliseSurah, parseCurriculumSheet } from './importers/curriculum';
import type { CurriculumDay, PlanDayOverride, PlanKind, StudentPlan } from './types';
import { PLAN_KIND_ORDER } from './types';

const day = (level: number, dayNo: number, kind: CurriculumDay['kind'], over: Partial<CurriculumDay> = {}): CurriculumDay => ({
  track: 'GOLDEN', level, dayNo, kind,
  fromSurah: 'البقرة', fromAyah: '1', toSurah: 'البقرة', toAyah: '10', note: '', ...over,
});

/** A level with all 24 days: 22 recitation days × 3 kinds, and 12 & 24 as exams. */
const fullLevel = (level = 26): CurriculumDay[] => {
  const out: CurriculumDay[] = [];
  for (let d = 1; d <= 24; d++) {
    if (d === 12 || d === 24) continue;
    for (const k of ['DARS', 'MURAJAA_SUGHRA', 'MURAJAA_KUBRA'] as const) {
      out.push(day(level, d, k, { fromAyah: String(d), toAyah: String(d + 5) }));
    }
  }
  return out;
};

const plan = (over: Partial<StudentPlan> = {}): StudentPlan => ({
  id: 'p1', studentId: 's1', track: 'GOLDEN', level: 26,
  issuedAt: '2026-09-01T10:00:00Z', issuedBy: 'المشرف',
  dayCount: DEFAULT_DAY_COUNT, examDays: { ...DEFAULT_EXAM_DAYS },
  dailyAmount: 'وجه', printedCount: 0, createdAt: '2026-09-01T10:00:00Z', ...over,
});

const override = (dayNo: number, kind: PlanDayOverride['kind'], over: Partial<PlanDayOverride> = {}): PlanDayOverride => ({
  planId: 'p1', dayNo, kind,
  fromSurah: 'النساء', fromAyah: '1', toSurah: 'النساء', toAyah: 'آخر', note: '', ...over,
});

describe('the daily amount — §1 glossary', () => {
  it('is a page for Golden and half a page for Silver', () => {
    expect(dailyAmountFor('GOLDEN')).toBe('وجه');
    expect(dailyAmountFor('SILVER')).toBe('نصف وجه');
  });
  it('says nothing for talqeen, which has no curriculum at all', () => {
    expect(dailyAmountFor('TALQEEN')).toBe('—');
  });
});

describe('resolving a plan — §3.3', () => {
  const cur = fullLevel();

  it('runs 24 days by default', () => {
    expect(resolvePlan(plan(), cur, [])).toHaveLength(24);
  });

  /* «يظهران في الورقة بصفّهما وخانة تاريخ … لا بمقرّر حفظ» */
  it('gives days 12 and 24 to the badges, with no recitation rows', () => {
    const days = resolvePlan(plan(), cur, []);
    expect(days[11]).toMatchObject({ dayNo: 12, examBadge: 'BADGE_GOLDEN', rows: [] });
    expect(days[23]).toMatchObject({ dayNo: 24, examBadge: 'BADGE_DIAMOND', rows: [] });
  });

  it('prints the three lines in sheet order — م.ك then م.ص then درس', () => {
    const d = resolvePlan(plan(), cur, [])[0];
    expect(d.rows.map((r) => r.kind)).toEqual(['MURAJAA_KUBRA', 'MURAJAA_SUGHRA', 'DARS']);
  });

  it('takes its content from the curriculum when nothing was edited', () => {
    const d = resolvePlan(plan(), cur, [])[2];        // day 3
    expect(d.rows[0]).toMatchObject({ fromSurah: 'البقرة', fromAyah: '3', toAyah: '8' });
    expect(d.rows.every((r) => r.overridden === false)).toBe(true);
  });

  /* The whole point of the join: the override wins, and only for its own row. */
  it('lets an override win for its (day, kind) and leaves the rest alone', () => {
    const days = resolvePlan(plan(), cur, [override(3, 'DARS')]);
    const d3 = days[2];
    const dars = d3.rows.find((r) => r.kind === 'DARS')!;
    const msug = d3.rows.find((r) => r.kind === 'MURAJAA_SUGHRA')!;
    expect(dars).toMatchObject({ fromSurah: 'النساء', toAyah: 'آخر', overridden: true });
    expect(msug).toMatchObject({ fromSurah: 'البقرة', overridden: false });
  });

  it('ignores overrides belonging to another plan', () => {
    const foreign = { ...override(3, 'DARS'), planId: 'p2' };
    const dars = resolvePlan(plan(), cur, [foreign])[2].rows.find((r) => r.kind === 'DARS')!;
    expect(dars.overridden).toBe(false);
  });

  /* «لا يُفقد الأصل أبدًا … زرّ إرجاع إلى المنهج الأصلي» — restoring is just
     dropping the overrides, because the curriculum was never written over. */
  it('restores the original exactly when the overrides are dropped', () => {
    const edited = resolvePlan(plan(), cur, [override(3, 'DARS'), override(7, 'MURAJAA_KUBRA')]);
    const restored = resolvePlan(plan(), cur, []);
    expect(edited).not.toEqual(restored);
    expect(restored).toEqual(resolvePlan(plan(), cur, []));
    expect(restored[2].rows.find((r) => r.kind === 'DARS')!.fromSurah).toBe('البقرة');
  });

  /* «تزيد أيامًا على الأربعة والعشرين» — a day past the curriculum is valid and
     arrives empty for him to fill, not missing. */
  it('gives an added day empty rows rather than dropping it', () => {
    const days = resolvePlan(plan({ dayCount: 26 }), cur, []);
    expect(days).toHaveLength(26);
    expect(days[24].rows.map((r) => r.fromSurah)).toEqual(['', '', '']);
  });

  it('follows the badges when they are moved', () => {
    const days = resolvePlan(plan({ examDays: { BADGE_GOLDEN: 10, BADGE_DIAMOND: 20 } }), cur, []);
    expect(days[9].examBadge).toBe('BADGE_GOLDEN');
    expect(days[19].examBadge).toBe('BADGE_DIAMOND');
    expect(days[11].examBadge).toBeNull();          // day 12 is ordinary again
    expect(days[11].rows).toHaveLength(3);
  });
});

describe('a level the uploaded file does not cover — §9(f)', () => {
  it('reports the missing level by name and by track', () => {
    const r = levelAvailable('SILVER', 39, fullLevel());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('39');
      expect(r.reason).toContain('الفضي');
      expect(r.reason).toContain('لن تُطبع ورقة فارغة');
    }
  });

  it('accepts a level that is there, and says how many days it has', () => {
    expect(levelAvailable('GOLDEN', 26, fullLevel())).toEqual({ ok: true, days: 22 });
  });

  it('reports what the upload actually covers', () => {
    const cur = [...fullLevel(26), ...fullLevel(25)];
    expect(coverage(cur)).toEqual([{ track: 'GOLDEN', levels: [26, 25], count: 2, max: 26, min: 25 }]);
  });
});

describe('adding and removing days — «فيعيد النظام ترقيمها من نفسه»', () => {
  it('renumbers what follows a removed day', () => {
    const r = removeDay(plan(), [override(5, 'DARS'), override(20, 'DARS')], 10);
    expect(r.dayCount).toBe(23);
    expect(r.overrides.map((o) => o.dayNo)).toEqual([5, 19]);
  });

  /* The badge must ride along, or it ends up marking a different day's work. */
  it('carries the badges down with everything else', () => {
    const r = removeDay(plan(), [], 5);
    expect(r.examDays).toEqual({ BADGE_GOLDEN: 11, BADGE_DIAMOND: 23 });
  });

  it('drops the removed day\'s own overrides', () => {
    const r = removeDay(plan(), [override(10, 'DARS'), override(10, 'MURAJAA_KUBRA')], 10);
    expect(r.overrides).toHaveLength(0);
  });

  it('pushes everything below an inserted day down', () => {
    const r = insertDay(plan(), [override(15, 'DARS')], 12);
    expect(r.dayCount).toBe(25);
    expect(r.overrides[0].dayNo).toBe(16);
    expect(r.examDays).toEqual({ BADGE_GOLDEN: 12, BADGE_DIAMOND: 25 });
  });

  it('never shrinks below a single day', () => {
    expect(removeDay(plan({ dayCount: 1 }), [], 1).dayCount).toBe(1);
  });
});

describe('knowing when a sheet still matches the curriculum', () => {
  const cur = fullLevel();

  it('spots an override that no longer changes anything', () => {
    const same = override(3, 'DARS', { fromSurah: 'البقرة', fromAyah: '3', toSurah: 'البقرة', toAyah: '8' });
    expect(matchesCurriculum(same, 'GOLDEN', 26, cur)).toBe(true);
    expect(matchesCurriculum(override(3, 'DARS'), 'GOLDEN', 26, cur)).toBe(false);
  });

  it('calls a plan customised when anything at all was changed', () => {
    expect(isCustomised(plan(), [])).toBe(false);
    expect(isCustomised(plan(), [override(3, 'DARS')])).toBe(true);
    expect(isCustomised(plan({ dayCount: 25 }), [])).toBe(true);
    expect(isCustomised(plan({ examDays: { BADGE_GOLDEN: 11, BADGE_DIAMOND: 24 } }), [])).toBe(true);
  });
});

describe('parsing «منهج الحفظ» — §5.4', () => {
  /* The file writes the end of a surah three different ways. */
  it('normalises every spelling of «آخر» and keeps it text', () => {
    for (const v of ['أخ', 'اخ', 'آخ', 'آخر', 'اخر']) expect(normaliseAyah(v)).toBe('آخر');
    expect(normaliseAyah(' 12 ')).toBe('12');
    expect(normaliseAyah('')).toBe('');
  });

  it('expands the ﷴ ligature the file uses for محمد', () => {
    expect(normaliseSurah('ﷴ')).toBe('محمد');
    expect(normaliseSurah('  آل  عمران ')).toBe('آل عمران');
  });

  const sheet = (extra: unknown[][] = []) => [
    ['منهج الحفظ — المسار الذهبي'],                                  // a banner row
    ['المستوى', 'اليوم', 'المقرر', 'من سورة', 'آية', 'الى سورة', 'آية', 'ملاحظة'],
    [30, 1, 'درس', 'البقرة', 1, 'البقرة', 5, ''],
    [30, 1, 'م.ص', 'البقرة', 1, 'البقرة', 'أخ', ''],
    [30, 1, 'م.ك', 'ﷴ', 1, 'ﷴ', 38, 'راجع مع المعلّم'],
    [30, 12, '', 'الوسام الذهبي', '', '', '', ''],
    ...extra,
  ];

  it('finds the header wherever it sits, and maps both «آية» columns', () => {
    const p = parseCurriculumSheet(sheet(), 'ذهبي', 'GOLDEN');
    expect(p.days).toHaveLength(3);
    expect(p.days[0]).toMatchObject({ level: 30, dayNo: 1, kind: 'DARS', fromAyah: '1', toAyah: '5' });
    expect(p.days[1].toAyah).toBe('آخر');
    expect(p.days[2]).toMatchObject({ fromSurah: 'محمد', toSurah: 'محمد', note: 'راجع مع المعلّم' });
  });

  it('reads an exam row as a badge, not as a recitation range', () => {
    const p = parseCurriculumSheet(sheet(), 'ذهبي', 'GOLDEN');
    expect(p.examDays).toEqual([{ level: 30, dayNo: 12, badge: 'BADGE_GOLDEN' }]);
    expect(p.days.some((d) => d.dayNo === 12)).toBe(false);
  });

  /* §5.4: «assert 24 days for every level, or fail loudly». */
  it('reports a level that does not add up to 24 days', () => {
    const p = parseCurriculumSheet(sheet(), 'ذهبي', 'GOLDEN');
    expect(p.issues).toHaveLength(1);
    expect(p.issues[0].message).toContain('المستوى 30');
    expect(p.issues[0].message).toContain('٢٤');
  });
});

describe('naming the days a level has not filled in', () => {
  const line = (dayNo: number, kind: PlanKind, fromSurah: string): CurriculumDay => ({
    track: 'SILVER', level: 40, dayNo, kind,
    fromSurah, fromAyah: '1', toSurah: fromSurah, toAyah: 'آخر', note: '',
  });

  it('counts a day incomplete when any line has no «من سورة»', () => {
    const days = [
      ...PLAN_KIND_ORDER.map((k) => line(1, k, 'العنكبوت')),   // complete
      line(2, 'MURAJAA_KUBRA', 'الروم'), line(2, 'DARS', ''),   // two lines short
    ];
    const gaps = incompleteDays(days, 3);
    expect(gaps.map((g) => g.day)).toEqual([2, 3]);
    /* Day 2 is missing the small revision entirely and the lesson's surah. */
    expect(gaps[0].missing).toEqual(['MURAJAA_SUGHRA', 'DARS']);
    /* Day 3 has no rows at all, so all three are missing. */
    expect(gaps[1].missing).toHaveLength(3);
  });

  it('a level with every line filled has no gaps', () => {
    const days = [1, 2].flatMap((n) => PLAN_KIND_ORDER.map((k) => line(n, k, 'الملك')));
    expect(incompleteDays(days, 2)).toEqual([]);
  });
});
