import { describe, it, expect } from 'vitest';
import { DEFAULT_PAGES, juzOfLevel, pagesFor, readPages } from './pages';

/* حسبة الأوجه — من ورقة «مسارات الحفظ» التي أرسلها العميل (18 Sep 2026).
   The sheet is the specification; these are its rows, read back. */

describe('أيّ جزء هو فيه — من مستواه', () => {
  it('الذهبي: كل مستوى جزء، والمستويات تنزل', () => {
    expect(juzOfLevel('GOLDEN', 30)).toBe(1);
    expect(juzOfLevel('GOLDEN', 21)).toBe(10);
    expect(juzOfLevel('GOLDEN', 20)).toBe(11);
    expect(juzOfLevel('GOLDEN', 1)).toBe(30);
  });

  it('الفضي: كل مستويين جزء', () => {
    expect(juzOfLevel('SILVER', 60)).toBe(1);
    expect(juzOfLevel('SILVER', 59)).toBe(1);
    expect(juzOfLevel('SILVER', 58)).toBe(2);
    expect(juzOfLevel('SILVER', 1)).toBe(30);
  });

  /* A boy with no level is not a boy on the first one. The figures are summed
     across a halaqa, and a guess is indistinguishable from a fact once added. */
  it('لا مستوى ⇒ لا جزء، والتلقين خارجها', () => {
    expect(juzOfLevel('SILVER', null)).toBeNull();
    expect(juzOfLevel('TALQEEN', 10)).toBeNull();
    expect(juzOfLevel(null, 10)).toBeNull();
  });
});

describe('كم وجهًا في يومه', () => {
  it('الذهبي: وجه للدرس، وثلاثة للصغرى', () => {
    const p = pagesFor('GOLDEN', 30);
    expect(p.dars).toBe(1);
    expect(p.sughra).toBe(3);        // آخر ثلاث دروس × وجه
  });

  it('الفضي: نصف وجه للدرس، ووجه للصغرى', () => {
    const p = pagesFor('SILVER', 60);
    expect(p.dars).toBe(0.5);
    expect(p.sughra).toBe(1);        // آخر درسين × نصف وجه
  });

  it('الكبرى تكبر كلما تقدّم — الذهبي', () => {
    expect(pagesFor('GOLDEN', 30).kubra).toBe(10);   // الجزء ١
    expect(pagesFor('GOLDEN', 21).kubra).toBe(10);   // الجزء ١٠
    expect(pagesFor('GOLDEN', 20).kubra).toBe(15);   // الجزء ١١
    expect(pagesFor('GOLDEN', 11).kubra).toBe(15);   // الجزء ٢٠
    expect(pagesFor('GOLDEN', 10).kubra).toBe(20);   // الجزء ٢١
    expect(pagesFor('GOLDEN', 1).kubra).toBe(20);    // الجزء ٣٠
  });

  it('الكبرى تكبر كلما تقدّم — الفضي', () => {
    expect(pagesFor('SILVER', 60).kubra).toBe(5);    // الجزء ١
    expect(pagesFor('SILVER', 52).kubra).toBe(5);    // الجزء ٥
    expect(pagesFor('SILVER', 50).kubra).toBe(10);   // الجزء ٦
    expect(pagesFor('SILVER', 32).kubra).toBe(10);   // الجزء ١٥
    expect(pagesFor('SILVER', 30).kubra).toBe(15);   // الجزء ١٦
    expect(pagesFor('SILVER', 1).kubra).toBe(15);    // الجزء ٣٠
  });

  it('التلقين ومن لا مستوى له: أصفار', () => {
    expect(pagesFor('TALQEEN', 5)).toEqual({ dars: 0, sughra: 0, kubra: 0 });
    expect(pagesFor('SILVER', null)).toEqual({ dars: 0, sughra: 0, kubra: 0 });
  });
});

describe('القاعدة تُقرأ من قاعدة البيانات', () => {
  it('قيمة فارغة ترجع المعتمدة', () => {
    expect(readPages(null)).toEqual(DEFAULT_PAGES);
    expect(readPages({})).toEqual(DEFAULT_PAGES);
  });

  it('يُقرأ المكتوب، ويُكمَّل الناقص من المعتمدة', () => {
    const r = readPages({ SILVER: { lesson: 0.25 } });
    expect(r.SILVER.lesson).toBe(0.25);
    expect(r.SILVER.sughraLessons).toBe(2);
    expect(r.SILVER.kubra).toEqual(DEFAULT_PAGES.SILVER.kubra);
    expect(r.GOLDEN).toEqual(DEFAULT_PAGES.GOLDEN);
  });

  it('الحدود تُرتَّب، فلا يقلب ترتيبُها الحسبة', () => {
    const r = readPages({ GOLDEN: { kubra: [
      { upToJuz: 30, pages: 20 }, { upToJuz: 10, pages: 9 }, { upToJuz: 20, pages: 15 },
    ] } });
    expect(r.GOLDEN.kubra.map((b) => b.upToJuz)).toEqual([10, 20, 30]);
    expect(pagesFor('GOLDEN', 30, r).kubra).toBe(9);
  });

  it('عددٌ غير صالح يُرفض ولا يُخزَّن أثره', () => {
    const r = readPages({ GOLDEN: { lesson: -2, sughraLessons: 'كثير' } });
    expect(r.GOLDEN.lesson).toBe(1);
    expect(r.GOLDEN.sughraLessons).toBe(3);
  });
});
