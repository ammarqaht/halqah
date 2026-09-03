'use client';
/* إحصائية الجمعية — the counts the association asks for, on one printable page. */
import { Suspense, useMemo } from 'react';
import { useDB } from '@/lib/store';
import { Num, toArabicDigits } from '@/components/Num';
import { TRACK_AR } from '@/lib/types';
import { formatDate } from '@/lib/dates';
import { isoDate } from '@/lib/dates';

function Table({ title, data }: { title: string; data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-t1 text-ink-900">{title}</h2>
      <table className="w-full border-collapse text-base2">
        <tbody>
          {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <tr key={k} className="border-b border-ink-150">
              <td className="py-2">{k}</td>
              <td className="w-24 py-2 text-start"><Num className="font-medium">{v}</Num></td>
              <td className="w-20 py-2 text-start text-ink-500">
                <Num>{total ? Math.round((v / total) * 100) : 0}</Num>٪
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-ink-300 font-medium">
            <td className="py-2">المجموع</td>
            <td className="py-2"><Num>{total}</Num></td>
            <td />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Statistics() {
  const db = useDB();

  const stats = useMemo(() => {
    const count = <T extends string>(pick: (s: (typeof db.students)[number]) => T | null | undefined) => {
      const m: Record<string, number> = {};
      for (const s of db.students) { const k = pick(s); if (k) m[k] = (m[k] ?? 0) + 1; }
      return m;
    };
    return {
      tracks: count((s) => (s.track ? TRACK_AR[s.track] : null)),
      stages: count((s) => s.stage || null),
      nationalities: count((s) => s.nationality || null),
      halaqat: db.halaqat.reduce<Record<string, number>>((m, h) => {
        m[h.teacher] = db.students.filter((s) => s.halaqaId === h.id).length; return m;
      }, {}),
    };
  }, [db]);

  const passed = db.exams.filter((e) => e.passed).length;
  const ajza = db.exams
    .filter((e) => e.passed && e.type === 'ASSOCIATION')
    .reduce((n, e) => n + (e.ajza ?? 0), 0);

  return (
    <div className="mx-auto max-w-[794px] p-10 print:p-0">
      <header className="mb-8 border-b-2 border-ink-900 pb-4">
        <p className="text-xs2 text-ink-600">جمعية تحفيظ القرآن الكريم بالمنطقة الشرقية — فرع غرب الدمام</p>
        <h1 className="mt-1 font-display text-d1 text-ink-900">إحصائية الحلقات</h1>
        <p className="mt-1 text-xs2 text-ink-600">
          حلقات جامع محمد العبدالكريم — الدمام، حي أُحد · بتاريخ{' '}
          <Num>{toArabicDigits(formatDate(isoDate(new Date())))}</Num>
        </p>
      </header>

      <div className="mb-8 grid grid-cols-4 gap-4">
        {[
          { l: 'الطلاب', v: db.students.length },
          { l: 'الحلقات', v: db.halaqat.length },
          { l: 'الاختبارات', v: db.exams.length },
          { l: 'المجتازة', v: passed },
        ].map((k) => (
          <div key={k.l} className="rounded-lg border border-ink-200 p-4 text-center">
            <p className="font-display text-d2 text-ink-900"><Num>{k.v}</Num></p>
            <p className="mt-1 text-xs2 text-ink-600">{k.l}</p>
          </div>
        ))}
      </div>

      <Table title="الطلاب في كل حلقة" data={stats.halaqat} />
      <Table title="المسارات" data={stats.tracks} />
      <Table title="المراحل الدراسية" data={stats.stages} />
      <Table title="الجنسيات" data={stats.nationalities} />

      <section className="mb-8">
        <h2 className="mb-3 font-display text-t1 text-ink-900">اختبارات الجمعية</h2>
        <p className="text-base2 text-ink-700">
          مجموع الأجزاء المختبَرة والمجتازة: <Num className="font-medium">{ajza}</Num> جزءًا،
          من <Num className="font-medium">{db.exams.filter((e) => e.type === 'ASSOCIATION').length}</Num> اختبارًا.
        </p>
      </section>

      <footer className="mt-12 border-t border-ink-200 pt-4 text-micro text-ink-500">
        صدرت من نظام «حلقة» — الأرقام محسوبة من بيانات النظام لحظة الطباعة.
      </footer>
    </div>
  );
}

export default function Page() { return <Suspense><Statistics /></Suspense>; }
