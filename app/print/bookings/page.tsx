'use client';
/* قائمة اختبارات اليوم — approved PDF §9 (إد-٥-ج):
   «فتُطبع قائمة اليوم أو تظهر على الشاشة».

   Printed because the supervisor walks the circle with it in his hand before he
   sits anyone down. Grouped by halaqa, for the same reason the gift pick-list
   is: he calls students circle by circle, not one by one across the mosque. */
import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits, plural } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { EXAM_TYPE_AR } from '@/lib/points';
import { ajzaForLevel } from '@/lib/exams';
import { isoDate, formatDate } from '@/lib/dates';

export default function BookingSheet() {
  const db = useDB();
  const today = isoDate(new Date());

  const groups = useMemo(() => {
    const due = db.bookings.filter((b) => b.scheduledOn === today && b.status === 'BOOKED');
    const by = new Map<string, { title: string; rows: typeof due }>();
    for (const b of due) {
      const s = db.students.find((x) => x.id === b.studentId);
      const h = s?.halaqaId ? db.halaqat.find((x) => x.id === s.halaqaId) ?? null : null;
      const key = h?.id ?? 'none';
      if (!by.has(key)) by.set(key, { title: h ? `حلقة ${h.teacher}` : 'طلاب بلا حلقة', rows: [] });
      by.get(key)!.rows.push(b);
    }
    /* «بلا حلقة» last — it is the exception, and he walks the circles first. */
    return [...by.entries()]
      .sort((a, b) => (a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : b[1].rows.length - a[1].rows.length))
      .map(([, g]) => g);
  }, [db.bookings, db.students, db.halaqat, today]);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const student = (id: string) => db.students.find((s) => s.id === id) ?? null;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-4 px-2">
        <p className="text-panel text-ink-600">
          <Num>{total}</Num> {plural(total, 'اختبار', 'اختباران', 'اختبارات', 'اختبارًا')} محجوزة اليوم.
        </p>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <header className="mb-6 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <LogoMark height={38} white={false} />
          <div className="text-center">
            <h1 className="font-display text-t1 text-ink-900">اختبارات اليوم</h1>
            <p className="mt-0.5 text-xs2 text-ink-600">
              <Num>{toArabicDigits(formatDate(today))}</Num>
            </p>
          </div>
          <LogoJamiyah height={38} />
        </header>

        {total === 0 ? (
          <p className="py-16 text-center text-lg2 text-ink-500">لا اختبارات محجوزة اليوم.</p>
        ) : groups.map((g) => (
          <section key={g.title} className="mb-7 last:mb-0">
            <h2 className="keep mb-2 flex items-baseline justify-between border-b border-ink-200 pb-1.5">
              <span className="font-display text-lg2 text-ink-900">{g.title}</span>
              <span className="text-xs2 text-ink-500">
                <Num>{toArabicDigits(g.rows.length)}</Num>{' '}
                {plural(g.rows.length, 'اختبار', 'اختباران', 'اختبارات', 'اختبارًا')}
              </span>
            </h2>
            <table className="w-full border-collapse text-sm2">
              <thead>
                <tr className="text-cap text-ink-500">
                  <th className="w-8 py-1.5 text-start font-medium">تمّ</th>
                  <th className="py-1.5 text-start font-medium">الطالب</th>
                  <th className="w-28 py-1.5 text-start font-medium">الوسام</th>
                  <th className="w-20 py-1.5 text-start font-medium">المستوى</th>
                  <th className="w-20 py-1.5 text-start font-medium">الأجزاء</th>
                  <th className="w-24 py-1.5 text-start font-medium">الدرجة</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((b) => {
                  const s = student(b.studentId);
                  return (
                    <tr key={b.id} className="keep border-t border-ink-150">
                      {/* filled in with a pen while he listens, entered after */}
                      <td className="py-2"><span className="block h-4 w-4 rounded-sm border border-ink-400" /></td>
                      <td className="py-2 text-ink-900">{s?.fullName ?? '—'}</td>
                      <td className="py-2 text-ink-700">{EXAM_TYPE_AR[b.badge]}</td>
                      <td className="py-2"><Num>{b.level != null ? toArabicDigits(b.level) : '—'}</Num></td>
                      <td className="py-2">
                        <Num>{(() => { const a = ajzaForLevel(s?.track ?? null, b.level);
                          return a !== null ? toArabicDigits(a) : '—'; })()}</Num>
                      </td>
                      <td className="py-2" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        <footer className="mt-8 flex items-center justify-between border-t border-ink-150 pt-3 text-micro text-ink-500">
          <span>الدرجة تُحسب في الشاشة — هذه الورقة للمناداة والترتيب</span>
          <span>حلقات جامع محمد العبدالكريم — الدمام، حي أُحد</span>
        </footer>
      </div>
    </>
  );
}
