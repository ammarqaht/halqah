'use client';
/* تقرير المعلّم عن حلقته — printed every three weeks and handed to the teacher.
   Association-examined students are shaded, which is what the supervisor used
   to do by hand with a green highlighter. */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDB } from '@/lib/store';
import { buildRows } from '@/lib/followup';
import { Num, toArabicDigits, juzWord } from '@/components/Num';
import { TRACK_AR } from '@/lib/types';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { formatDate, isoDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

function HalaqaReport() {
  const db = useDB();
  const sp = useSearchParams();
  const id = sp.get('halaqa');
  const halaqa = db.halaqat.find((h) => h.id === id) ?? null;
  const rows = useMemo(
    () => buildRows(db).filter((r) => r.student.halaqaId === id),
    [db, id]);

  if (!halaqa) {
    return <div className="p-10 text-center text-base2 text-ink-600">اختر حلقة من شاشة التقارير.</div>;
  }

  return (
    <div className="mx-auto max-w-[794px] p-10 print:p-0">
      <header className="mb-6 border-b-2 border-ink-900 pb-4">
        <p className="text-xs2 text-ink-600">حلقات جامع محمد العبدالكريم — الدمام، حي أُحد</p>
        <h1 className="mt-1 font-display text-d1 text-ink-900">حلقة {halaqa.teacher}</h1>
        <p className="mt-1 text-xs2 text-ink-600">
          {halaqa.timeSlot}
          {halaqa.track && ` · ${TRACK_AR[halaqa.track]}`}
          {' · '}<Num>{rows.length}</Num> طالبًا
          {' · '}بتاريخ <Num>{toArabicDigits(formatDate(isoDate(new Date())))}</Num>
        </p>
      </header>

      <table className="w-full border-collapse text-sm2">
        <thead>
          <tr className="border-b-2 border-ink-300 text-xs2 text-ink-600">
            <th className="w-8 py-2 text-start font-medium">م</th>
            <th className="py-2 text-start font-medium">الطالب</th>
            <th className="py-2 text-start font-medium">الصف</th>
            <th className="py-2 text-start font-medium">المستوى</th>
            <th className="py-2 text-start font-medium">الأجزاء</th>
            <th className="py-2 text-start font-medium">آخر وسام</th>
            <th className="py-2 text-start font-medium">اختبار الجمعية</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            /* shaded when the association has examined him — the green
               highlighter, done by the system */
            <tr key={r.student.id}
              className={cx('border-b border-ink-150',
                r.lastAssociation && 'bg-ok-100 print:bg-ok-100')}>
              <td className="py-2 text-ink-500"><Num>{i + 1}</Num></td>
              <td className="py-2 font-medium text-ink-900">{r.student.fullName}</td>
              <td className="py-2 text-ink-700">{r.student.grade || '—'}</td>
              <td className="py-2"><Num className="text-ink-800">{r.plan?.level ?? '—'}</Num></td>
              <td className="py-2 text-ink-700">{r.ajza !== null ? juzWord(r.ajza) : '—'}</td>
              <td className="py-2 text-ink-700">
                {r.lastInternal
                  ? `${EXAM_TYPE_AR[r.lastInternal.type as ExamType] ?? ''} · ${toArabicDigits(formatDate(r.lastInternal.takenOn))}`
                  : '—'}
              </td>
              <td className="py-2 text-ink-700">
                {r.lastAssociation
                  ? `${toArabicDigits(formatDate(r.lastAssociation.takenOn))} · ${r.lastAssociation.passed ? 'اجتاز' : 'لم يجتز'}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-5 text-micro text-ink-500">
        الصفوف المظلّلة: طلاب اختُبروا لدى الجمعية.
      </p>
    </div>
  );
}

export default function Page() { return <Suspense><HalaqaReport /></Suspense>; }
