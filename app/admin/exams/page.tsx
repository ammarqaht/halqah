'use client';
/* سجلّ الاختبارات — approved PDF §9 (إد-٥-ب), the screen that replaces
   «ملف الاختبارات». Recording lives at `/admin/exams/new`; this is the record
   itself, and the place the supervisor comes to check what was entered.

   The counters across the top are his own file's totals, computed rather than
   tallied by hand: «سجلّاتكم تحوي: ١٧٢ وسامًا ذهبيًا، ١٥٧ اختبار جمعية،
   ١٣٩ وسامًا ماسيًا، و٤٧ اختبار تجويد». */
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardCheck, Plus, Search, Coins, AlertTriangle, Inbox } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty, Chip, INPUT } from '@/components/ui';
import { KPI } from '@/components/Stat';
import { Tooltip } from '@/components/Tooltip';
import { Num, pointWord, plural } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { scoreMax, SCORE_DEDUCTIONS } from '@/lib/exams';
import type { Exam } from '@/lib/types';
import { foldArabic, shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

const TYPE_TONE: Record<string, 'warn' | 'brand' | 'assoc' | 'info' | 'ink'> = {
  BADGE_GOLDEN: 'warn', BADGE_DIAMOND: 'brand', ASSOCIATION: 'assoc',
  MOCK: 'ink', TAJWEED: 'info',
};

/** A tajweed exam carries no counters in the client's sheet, so there is
    nothing to break down — and an empty tooltip is worse than none. */
const hasCounters = (e: Exam) =>
  e.errors !== null || e.warnings !== null || e.tajweedErrors !== null;

/** How the score was arrived at: each counter, and what it cost. */
function Breakdown({ exam }: { exam: Exam }) {
  const rows: [string, number, number][] = [
    ['أخطاء', exam.errors ?? 0, SCORE_DEDUCTIONS.error],
    ['تنبيهات', exam.warnings ?? 0, SCORE_DEDUCTIONS.warning],
    ['أخطاء تجويدية', exam.tajweedErrors ?? 0, SCORE_DEDUCTIONS.tajweedError],
  ];
  const lost = rows.reduce((n, [, count, each]) => n + count * each, 0);
  return (
    <div className="min-w-[11rem]">
      <p className="mb-1.5 text-micro uppercase tracking-[.1em] text-ink-500">تفصيل الدرجة</p>
      <table className="w-full text-panel">
        <tbody>
          {rows.map(([label, count, each]) => (
            <tr key={label} className={count === 0 ? 'text-ink-400' : 'text-ink-800'}>
              <td className="py-0.5 pe-3">{label}</td>
              <td className="py-0.5 pe-3 text-end"><Num className="font-medium">{count}</Num></td>
              {/* The operator goes INSIDE the isolate. Left outside it, RTL
                  reorders «−٦» into «٦−» — DESIGN.md §2.2, the same reason a
                  time range needs isolating as one run. */}
              <td className="py-0.5 text-end text-micro text-ink-500">
                {count > 0 ? <Num>{`− ${count * each}`}</Num> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The whole equation is ONE isolated run. Three separate <Num>s with bare
          operators between them let RTL reorder the sum into «٩٠ = ١٠ − ١٠٠»,
          which reads as nonsense. */}
      <p className="mt-1.5 border-t border-ink-150 pt-1.5 text-panel text-ink-700">
        <Num className="font-medium text-ink-900">
          {`${scoreMax(exam.type)} − ${lost} = ${exam.score ?? 0}`}
        </Num>
      </p>
    </div>
  );
}

function ExamsScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const [q, setQ] = useState('');

  const typeFilter = sp.get('type');
  const halaqaFilter = sp.get('halaqa');

  const nameOf = (id: string) => db.students.find((s) => s.id === id)?.fullName ?? '—';
  const halaqaOf = (id: string | null) => {
    const t = id ? db.halaqat.find((h) => h.id === id)?.teacher : null;
    return t ? shortName(t) : '—';
  };

  const rows = useMemo(() => {
    const needle = foldArabic(q);
    return db.exams.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (halaqaFilter && e.halaqaId !== halaqaFilter) return false;
      if (needle && !foldArabic(nameOf(e.studentId)).includes(needle)
        && !foldArabic(e.note).includes(needle)
        && !foldArabic(e.examiner).includes(needle)) return false;
      return true;
    }).sort((a, b) => (a.takenOn < b.takenOn ? 1 : a.takenOn > b.takenOn ? -1
      : (a.createdAt < b.createdAt ? 1 : -1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.exams, db.students, typeFilter, halaqaFilter, q]);

  const totals = useMemo(() => {
    const byType = new Map<string, number>();
    for (const e of db.exams) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
    return {
      all: db.exams.length,
      byType,
      passed: db.exams.filter((e) => e.passed === true).length,
      /* «اجتاز ولم تُصرف نقاطه» — SPEC §6.1 lists this alert against phase 5,
         and it is computable now that exams exist. */
      unpaid: db.exams.filter((e) => e.passed === true && e.pointsAwarded > 0 && !e.pointsPaid),
    };
  }, [db.exams]);

  const unpaidPoints = totals.unpaid.reduce((n, e) => n + e.pointsAwarded, 0);

  if (!db.exams.length) {
    return (
      <>
        <TopBar title="الاختبارات" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
          action={<Link href="/admin/exams/new">
            <Btn variant="primary" icon={Plus}>تسجيل اختبار</Btn></Link>} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا اختبارات مسجَّلة بعد"
              body="شاشة إدخال واحدة تُغني عن ملف الاختبارات: تختار الطالب، فتظهر حلقته ومساره ومستواه، وتُحسب الدرجة من العدّادات وتُقترح النقاط — وتصل كل الشاشات فور الحفظ."
              action={<Link href="/admin/exams/new">
                <Btn variant="primary" size="lg" icon={Plus}>تسجيل أول اختبار</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="الاختبارات"
        crumbs={typeFilter ? [EXAM_TYPE_AR[typeFilter as ExamType] ?? typeFilter] : undefined}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={<Link href="/admin/exams/new">
          <Btn variant="primary" icon={Plus}>تسجيل اختبار</Btn></Link>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        <div className="rise mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI label="اختبارات مسجَّلة" value={totals.all} icon={ClipboardCheck} accent />
          <KPI label="اجتازوا" value={totals.passed} delay={60}
            sub="من إجمالي الاختبارات" />
          <KPI label="أوسمة ذهبية" value={totals.byType.get('BADGE_GOLDEN') ?? 0} delay={120} />
          <KPI label="أوسمة ماسية" value={totals.byType.get('BADGE_DIAMOND') ?? 0} delay={180} />
        </div>

        {/* «اجتاز ولم تُصرف نقاطه» — actionable, so it says what to do about it */}
        {totals.unpaid.length > 0 && (
          <div className="rise mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warn-200 bg-warn-100 px-4 py-3">
            <AlertTriangle size={18} className="shrink-0 text-warn-700" />
            <p className="min-w-0 flex-1 text-base2 text-warn-700">
              لم تُصرف نقاط {plural(totals.unpaid.length, 'اختبار واحد', 'اختبارين', 'اختبارات', 'اختبارًا')} —
              بمجموع <Num className="font-medium">{unpaidPoints}</Num> {pointWord(unpaidPoints)}.
            </p>
            <Btn size="sm" icon={Coins}
              onClick={() => totals.unpaid.forEach((e) => store.saveExam({ ...e, pointsPaid: true }))}>
              صرفها كلّها
            </Btn>
          </div>
        )}

        <div className="rise mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالطالب أو الملاحظة أو المختبِر…" className={cx(INPUT, 'pe-10')} />
          </div>
          <span className="text-panel text-ink-500">
            <Num className="font-medium text-ink-900">{rows.length}</Num> من <Num>{db.exams.length}</Num>
          </span>
        </div>

        <Sheet className="rise" pad={false}>
          {rows.length === 0 ? (
            <Empty icon={ClipboardCheck} title="لا نتائج" body="جرّب توسيع التصفية أو مسح البحث." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                    {['التاريخ', 'الطالب', 'الحلقة', 'النوع', 'المستوى', 'الأجزاء',
                      'الدرجة', 'النتيجة', 'النقاط', 'ملاحظة'].map((h) => (
                      <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50">
                      <td className="whitespace-nowrap px-3 py-3">
                        <Num className="text-panel text-ink-600">{formatDate(e.takenOn)}</Num>
                      </td>
                      <td className="px-3 py-3 text-ink-900">{nameOf(e.studentId)}</td>
                      <td className="px-3 py-3 text-panel text-ink-600">{halaqaOf(e.halaqaId)}</td>
                      <td className="px-3 py-3">
                        <Chip tone={TYPE_TONE[e.type] ?? 'ink'}>
                          {EXAM_TYPE_AR[e.type as ExamType] ?? e.type}
                        </Chip>
                        {e.tajweedTopic && (
                          <span className="mt-0.5 block max-w-[10rem] truncate text-micro text-ink-500"
                            title={e.tajweedTopic}>{e.tajweedTopic}</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><Num className="text-panel text-ink-700">{e.level ?? '—'}</Num></td>
                      <td className="px-3 py-3"><Num className="text-panel text-ink-700">{e.ajza ?? '—'}</Num></td>
                      {/* The breakdown that produced the score, on hover rather
                          than in three more columns. §3 of DESIGN: a column that
                          is mostly empty costs every row; the exception does not. */}
                      <td className="px-3 py-3">
                        {hasCounters(e) ? (
                          <Tooltip content={<Breakdown exam={e} />}>
                            <span className="font-medium text-ink-900"><Num>{e.score ?? '—'}</Num></span>
                            <span className="text-micro text-ink-500"> / <Num>{scoreMax(e.type)}</Num></span>
                          </Tooltip>
                        ) : (
                          <>
                            <span className="font-medium text-ink-900"><Num>{e.score ?? '—'}</Num></span>
                            <span className="text-micro text-ink-500"> / <Num>{scoreMax(e.type)}</Num></span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {e.passed === null ? <span className="text-ink-400">—</span>
                          : e.passed ? <Chip tone="ok">اجتاز</Chip> : <Chip tone="risk">لم يجتز</Chip>}
                      </td>
                      <td className="px-3 py-3">
                        {e.pointsAwarded > 0 ? (
                          e.pointsPaid
                            ? <span className="font-medium text-ok-700"><Num>+{e.pointsAwarded}</Num></span>
                            : <button onClick={() => store.saveExam({ ...e, pointsPaid: true })}
                                title="صرف النقاط الآن"
                                className="rounded px-1.5 py-0.5 text-panel text-warn-700 transition-colors hover:bg-warn-100">
                                <Num>{e.pointsAwarded}</Num> لم تُصرف
                              </button>
                        ) : <span className="text-ink-400">—</span>}
                      </td>
                      <td className="max-w-[12rem] px-3 py-3 text-panel text-ink-600">
                        {e.note
                          ? <Tooltip content={<span className="leading-relaxed">{e.note}</span>}>
                              <span className="block max-w-[11rem] truncate">{e.note}</span>
                            </Tooltip>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Sheet>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><ExamsScreen /></Suspense>;
}
