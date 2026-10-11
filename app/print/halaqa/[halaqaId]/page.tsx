'use client';
/* تقرير حلقة المعلّم — SPEC.md §6.11 (إد-٥-هـ), layout approved 1 Sep 2026.
   The teacher's whole roster on one sheet, and the client's manual green
   highlighting replaced structurally: the row is shaded AND carries a mark in
   its own column, so it survives a greyscale photocopier (DESIGN.md §1.4 —
   colour is never the only carrier).

   THE SHADING IS FOR PASSING, not for sitting — 22 Sep 2026. It used to fall
   on everyone the association had examined, so a boy who failed printed the
   same green as one who passed, and the sheet was being read at a glance by
   someone who could not tell them apart. A pass is «✓ ٣» — the mark and how
   many ajza it covered; a failure is «✗ ٣» on an unshaded row. */
import { Suspense, use, useMemo } from 'react';
import { Num, toArabicDigits } from '@/components/Num';
import { PagedDoc, SecHead, Kpi, Kpis, TableTitle, type Block } from '@/components/print/Paged';
import { shortName } from '@/lib/normalise';
import { useDB } from '@/lib/store';
import { followUpRows, followedRows } from '@/lib/followup';
import { EXAM_TYPE_SHORT_AR, type ExamType } from '@/lib/points';
import { TRACK_AR } from '@/lib/types';
import { formatDate } from '@/lib/dates';
import { useAttendance } from '@/components/useAttendance';
import { useParts } from '@/lib/reportParts';

/* Each column with the part that switches it (lib/reportParts → `halaqa`);
   # and the name are always printed. */
const COLS: [string, string | null][] = [
  ['#', null], ['الطالب', null], ['الصف', 'grade'], ['الحضور', 'attendance'],
  ['المستوى', 'level'], ['استلم الخطة', 'issued'], ['آخر درس', 'lesson'],
  ['الجمعية', 'assoc'], ['الجزء', 'assoc'], ['آخر اختبار', 'lastExam'],
  ['مستواه', 'lastExam'], ['الدرجة', 'lastExam'], ['ملاحظة', 'note'],
];

/* Relative widths, so every page's slice of the table lines up. */
const WEIGHT: Record<string, number> = {
  '#': 3, 'الطالب': 19, 'الصف': 6, 'الحضور': 6, 'المستوى': 7, 'استلم الخطة': 8,
  'آخر درس': 10, 'الجمعية': 8, 'الجزء': 4, 'آخر اختبار': 12, 'مستواه': 5, 'الدرجة': 5, 'ملاحظة': 14,
};

function HalaqaReport({ params }: { params: Promise<{ halaqaId: string }> }) {
  const { halaqaId } = use(params);
  const db = useDB();
  const show = useParts('halaqa');
  const att = useAttendance({ halaqa: halaqaId });

  const halaqa = db.halaqat.find((h) => h.id === halaqaId) ?? null;
  const rows = useMemo(() => followedRows(followUpRows(db))
    .filter((r) => r.student.halaqaId === halaqaId)
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, 'ar')),
  [db, halaqaId]);

  /* The halaqa's attendance rate, over every afternoon actually RECORDED —
     not an average of per-boy averages, so a student with three records does
     not weigh the same as one with thirty. Null before the first save: a
     percentage with no register behind it is an invention. */
  const attRate = att && att.total.recorded > 0 ? att.total.rate : null;

  if (!halaqa) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا حلقة بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">افتح التقرير من شاشة التقارير.</p>
      </div>
    );
  }

  /* عدّان لا واحد: التظليل صار للناجح، فعدّ «من اختُبر» وحده يترك القارئ
     يحسب الفرق بنفسه — وهو الرقم الذي جاء يقرأ الورقة لأجله. */
  const passed = rows.filter((r) => r.lastAssociation?.passed === true).length;
  const failed = rows.filter((r) => r.lastAssociation && r.lastAssociation.passed !== true).length;

  const cols = COLS.filter(([, part]) => !part || show(part));
  const totalW = cols.reduce((a, [h]) => a + (WEIGHT[h] ?? 6), 0);

  const blocks: Block[] = [
    {
      key: 'head', section: halaqa.timeSlot || 'الحلقة',
      node: <SecHead kicker="تقرير الحلقة" title={`حلقة ${halaqa.teacher}`}
        lead={<>{halaqa.name} · جامع محمد العبدالكريم — حي أُحد</>} />,
    },
    {
      key: 'kpis',
      node: (
        <Kpis>
          <Kpi tone="deep" value={<Num>{toArabicDigits(rows.length)}</Num>} label="طالبًا نشطًا" />
          <Kpi tone="teal" value={attRate === null ? '—' : <Num>{toArabicDigits(attRate)}٪</Num>} label="نسبة الحضور"
            note={att && att.total.recorded > 0
              ? <><Num>{toArabicDigits(att.total.attended)}</Num> من <Num>{toArabicDigits(att.total.recorded)}</Num> تسجيلًا</>
              : 'لا تسجيل بعد'} />
          <Kpi tone="gold" value={<Num>{toArabicDigits(passed)}</Num>} label="اجتازوا اختبار الجمعية" />
          <Kpi tone="risk" value={<Num>{toArabicDigits(failed)}</Num>} label="لم يجتازوه" />
        </Kpis>
      ),
    },
  ];

  if (rows.length) {
    blocks.push({
      key: 'roster',
      table: {
        title: <TableTitle meta={show('assoc') ? '✓ اجتاز اختبار الجمعية (والرقم أجزاؤه) · ✗ لم يجتز · والصف المظلّل لمن اجتاز' : undefined}>
          طلاب الحلقة</TableTitle>,
        cols: cols.map(([h]) => `${(((WEIGHT[h] ?? 6) / totalW) * 100).toFixed(2)}%`),
        head: <tr>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr>,
        rows: rows.map((r, i) => {
          const s = r.student;
          const last = r.lastExam;
          const assoc = r.lastAssociation;
          const assocPassed = assoc?.passed === true;
          const a = att?.students[s.id];
          const l = att?.lastLesson?.[s.id];
          return (
            <tr key={s.id} className={assocPassed ? 'ok' : undefined}>
              <td><Num>{toArabicDigits(i + 1)}</Num></td>
              <td className="s">{s.fullName}</td>
              {show('grade') && <td>{s.grade || '—'}</td>}
              {show('attendance') && <td>{!a || a.recorded === 0 ? '—' : <>
                <Num>{toArabicDigits(a.attended)}</Num><span className="pd-mut">/{toArabicDigits(a.recorded)}</span></>}</td>}
              {show('level') && <td>{!s.track ? '—' : <>{TRACK_AR[s.track]}
                {s.track !== 'TALQEEN' && s.currentLevel != null && <> <Num>{toArabicDigits(s.currentLevel)}</Num></>}</>}</td>}
              {show('issued') && <td>{r.plan?.issuedAt ? <Num>{toArabicDigits(formatDate(r.plan.issuedAt))}</Num> : '—'}</td>}
              {show('lesson') && <td>{!l ? '—' : <>{l.surah}{l.ayah && <> <Num>{toArabicDigits(l.ayah)}</Num></>}</>}</td>}
              {show('assoc') && <td>{assoc ? <Num>{toArabicDigits(formatDate(assoc.takenOn))}</Num> : '—'}</td>}
              {show('assoc') && <td>{!assoc ? '' : (
                <span className={assocPassed ? 'pd-pos' : 'pd-neg'}>
                  {assocPassed ? '✓' : '✗'}{assoc.ajza != null && <> <Num>{toArabicDigits(assoc.ajza)}</Num></>}
                </span>)}</td>}
              {show('lastExam') && <td>{last
                ? <>{EXAM_TYPE_SHORT_AR[last.type as ExamType] ?? last.type}{' '}
                    <Num className="pd-mut">{toArabicDigits(formatDate(last.takenOn))}</Num></>
                : '—'}</td>}
              {show('lastExam') && <td>{last?.level != null ? <Num>{toArabicDigits(last.level)}</Num> : ''}</td>}
              {show('lastExam') && <td>{!last || last.score == null ? '' : (
                <span className={last.passed === true ? 'pd-pos' : last.passed === false ? 'pd-neg' : undefined}>
                  <Num>{toArabicDigits(last.score)}</Num></span>)}</td>}
              {show('note') && <td className="s">{last?.note || ''}</td>}
            </tr>
          );
        }),
      },
    });
  } else {
    blocks.push({ key: 'none', node: <p className="py-12 text-center text-[11pt] text-[var(--pd-mut)]">لا طلاب نشطين في هذه الحلقة.</p> });
  }

  /* عرضيّ — 22 Sep 2026: thirteen columns, two of them a passage and a note,
     do not fit a portrait page without crushing the names. */
  return (
    <PagedDoc landscape title={`تقرير حلقة ${shortName(halaqa.teacher)}`} blocks={blocks}
      deps={[rows, att, cols.length]} />
  );
}

export default function Page(props: { params: Promise<{ halaqaId: string }> }) {
  return <Suspense><HalaqaReport {...props} /></Suspense>;
}
