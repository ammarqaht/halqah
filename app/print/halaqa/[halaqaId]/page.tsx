'use client';
/* تقرير حلقة المعلّم — SPEC.md §6.11 (إد-٥-هـ), layout approved 1 Sep 2026.
   The teacher's whole roster on one sheet, and the client's manual green
   highlighting replaced structurally: a student the association has examined
   gets a shaded row AND a ✓ in its own column, so the mark survives a
   greyscale photocopier (DESIGN.md §1.4 — colour is never the only carrier). */
import { use, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { PrintHead, PrintFoot, PCELL } from '@/components/PrintHead';
import { Num, toArabicDigits, plural } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';
import { followUpRows, followedRows } from '@/lib/followup';
import { EXAM_TYPE_SHORT_AR, type ExamType } from '@/lib/points';
import { TRACK_AR } from '@/lib/types';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

export default function HalaqaReport({ params }: { params: Promise<{ halaqaId: string }> }) {
  const { halaqaId } = use(params);
  const db = useDB();

  const halaqa = db.halaqat.find((h) => h.id === halaqaId) ?? null;
  const rows = useMemo(() => followedRows(followUpRows(db))
    .filter((r) => r.student.halaqaId === halaqaId)
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, 'ar')),
  [db, halaqaId]);

  if (!halaqa) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا حلقة بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">افتح التقرير من شاشة التقارير.</p>
      </div>
    );
  }

  const examined = rows.filter((r) => r.lastAssociation !== null).length;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-2">
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <PrintHead title={`تقرير حلقة ${halaqa.teacher}`}
          sub={`${halaqa.timeSlot} · جامع محمد العبدالكريم — ${toArabicDigits(plural(rows.length, 'طالب واحد', 'طالبان', 'طلاب', 'طالبًا'))}`} />

        {rows.length === 0 ? (
          <p className="py-12 text-center text-lg2 text-ink-500">لا طلاب نشطين في هذه الحلقة.</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-page/60 text-[10px] text-ink-700">
                {['#', 'الطالب', 'الصف', 'المسار', 'المستوى', 'آخر اختبار', 'جمعية', 'النقاط'].map((h) => (
                  <th key={h} className={PCELL}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const s = r.student;
                /* ONE definition of «آخر اختبار» — the row's own, so this
                   paper can never disagree with the follow-up screen. */
                const last = r.lastExam;
                const byAssoc = r.lastAssociation !== null;
                return (
                  <tr key={s.id} className={cx('keep h-[26px]', byAssoc && 'bg-ok-100')}>
                    <td className={PCELL}><Num>{toArabicDigits(i + 1)}</Num></td>
                    <td className={`${PCELL} text-start`}>{s.fullName}</td>
                    <td className={PCELL}>{s.grade || '—'}</td>
                    <td className={PCELL}>{s.track ? TRACK_AR[s.track] : '—'}</td>
                    <td className={PCELL}>
                      {s.track === 'TALQEEN' ? '—'
                        : s.currentLevel != null ? <Num>{toArabicDigits(s.currentLevel)}</Num> : '—'}
                    </td>
                    <td className={`${PCELL} text-start`}>
                      {last
                        ? <>{EXAM_TYPE_SHORT_AR[last.type as ExamType] ?? last.type}{' '}
                            <Num className="text-ink-500">{toArabicDigits(formatDate(last.takenOn))}</Num></>
                        : '—'}
                    </td>
                    <td className={`${PCELL} font-bold text-ok-700`}>{byAssoc ? '✓' : ''}</td>
                    <td className={PCELL}>
                      {s.track === 'TALQEEN' ? '—' : <Num>{toArabicDigits(r.balance)}</Num>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <PrintFoot>
          الصف المظلَّل مع ✓: اختبرته الجمعية
          {examined > 0 && <> — <Num>{toArabicDigits(examined)}</Num> من <Num>{toArabicDigits(rows.length)}</Num></>}.
          العلامة تبقى مقروءة في النسخ الرمادي.
        </PrintFoot>
      </div>
    </>
  );
}
