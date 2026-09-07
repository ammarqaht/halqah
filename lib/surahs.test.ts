import { test, expect } from 'vitest';
import { SURAHS, findSurah, nextSurah, matchSurahs, ayahCount } from './surahs';

test('the 114', () => {
  expect(SURAHS).toHaveLength(114);
  SURAHS.forEach((s, i) => expect(s.n).toBe(i + 1));
  expect(SURAHS.reduce((a, s) => a + s.ayahs, 0)).toBe(6236);
});
test('folding finds what the files write', () => {
  expect(findSurah('الأعلى')?.n).toBe(87);
  expect(findSurah('الاعلى')?.n).toBe(87);
  expect(findSurah('سورة العنكبوت')?.n).toBe(29);
  expect(findSurah('سبا')?.n).toBe(34);
  expect(findSurah('نبأ')?.n).toBe(78);
});
test('what comes next', () => {
  expect(nextSurah('العنكبوت')?.name).toBe('الروم');
  expect(nextSurah('الناس')).toBeNull();
  expect(ayahCount('العنكبوت')).toBe(69);
  expect(matchSurahs('العن')[0].name).toBe('العنكبوت');
});
