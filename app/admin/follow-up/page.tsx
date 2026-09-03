'use client';
/* المتابعة — SPEC.md §6.10, approved PDF §9 (إد-٥-د).

   Two ways of looking at the same rows, switched in place rather than split
   into destinations:
   - «بالحلقة» replaces the client's «البحث بالحلقة» sheet: one row per student
     with his plan, his last association exam and his last internal one. A
     student with no plan reads «لا توجد خطة» — never blanks.
   - «بالطالب» replaces «البحث باسم الطالب»: search a name, get the whole
     follow-up card — plan, readiness, exams, the Ratel snapshot, the balance.

   The four ready-made lists live in the contextual panel (DESIGN.md §4) and
   filter this same table; nothing is a separate report page. Every figure is
   computed by `lib/followup.ts` in one pass — the screen only sorts and shows. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users, Award, Hourglass, CalendarClock, Search, Inbox, Printer, FileText,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, Segmented, INPUT } from '@/components/ui';
import { KPI } from '@/components/Stat';
import { Tooltip } from '@/components/Tooltip';
import { Combobox } from '@/components/Combobox';
import { Num, Count, plural, pointWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { useDB } from '@/lib/store';
import { followUpRows, followedRows, listRows, type FollowUpRow, type ListKey } from '@/lib/followup';
import { LEVEL_LATE_AFTER_DAYS, UNEXAMINED_AFTER_DAYS, isMidJuz, scoreMax } from '@/lib/exams';
import { earnsPoints, EXAM_TYPE_AR, EXAM_TYPE_TONE, type ExamType } from '@/lib/points';
import { TRACK_AR, STATUS_AR } from '@/lib/types';
import { foldArabic, shortName, teacherName } from '@/lib/normalise';
import { formatDate, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

const LIST_META: Record<ListKey, { title: string; hint: React.ReactNode }> = {
  ready: {
    title: 'الجاهزون لاختبار الجمعية',
    hint: 'أتمّ الجزء واجتاز الوسام الماسي عليه، ولم تختبره الجمعية على هذا الجزء بعد',
  },
  late: {
    title: 'المتأخرون في مستواهم',
    hint: <>أمضى أكثر من <Num>{LEVEL_LATE_AFTER_DAYS}</Num> يومًا على ورقة مستواه ولم يصدر له ما بعدها</>,
  },
  unexamined: {
    title: 'لم يُختبروا مؤخرًا',
    hint: <>لا اختبار مسجَّل له منذ أكثر من <Num>{UNEXAMINED_AFTER_DAYS}</Num> يومًا — أو لم يُختبر قط</>,
  },
  top: { title: 'المتفوقون', hint: 'أعلى عشرة أرصدة نقاط — وهم أنفسهم لوحة الشرف' },
};

/** «آخر اختبار جمعية» — date on the first line, juz and result under it. */
function AssocCell({ exam }: { exam: FollowUpRow['lastAssociation'] }) {
  if (!exam) return <span className="text-ink-400">—</span>;
  return (
    <div>
      <Num className="text-panel text-ink-700">{formatDate(exam.takenOn)}</Num>
      <span className="mt-0.5 block text-micro text-ink-500">
        {exam.ajza != null && <>جزء <Num>{exam.ajza}</Num> · </>}
        {exam.passed === null ? 'بلا نتيجة'
          : exam.passed ? <span className="text-ok-700">اجتاز</span>
          : <span className="text-risk-700">لم يجتز</span>}
      </span>
    </div>
  );
}

/**
 * «آخر اختبار داخلي» — the type alone in the cell, everything else behind the
 * hover (client decision, 1 Sep 2026): the column stays scannable and the
 * detail stays one gesture away, like the score breakdown in the exams log.
 */
function InternalCell({ exam }: { exam: FollowUpRow['lastInternal'] }) {
  if (!exam) return <span className="text-ink-400">—</span>;
  const rows: [string, React.ReactNode][] = [
    ['التاريخ', <Num key="d">{formatDate(exam.takenOn)}</Num>],
    ...(exam.type === 'TAJWEED' && exam.tajweedTopic
      ? [['الموضوع', exam.tajweedTopic] as [string, React.ReactNode]] : []),
    ...(exam.level != null
      ? [['المستوى', <Num key="l">{exam.level}</Num>] as [string, React.ReactNode]] : []),
    ['الدرجة', <Num key="s">{`${exam.score ?? '—'} / ${scoreMax(exam.type)}`}</Num>],
    ...(exam.passed !== null
      ? [['النتيجة', exam.passed
          ? <span key="p" className="text-ok-700">اجتاز</span>
          : <span key="p" className="text-risk-700">لم يجتز</span>] as [string, React.ReactNode]]
      : []),
    ...(exam.note ? [['ملاحظة', exam.note] as [string, React.ReactNode]] : []),
  ];
  return (
    <Tooltip content={
      <div className="min-w-[13rem]">
        <p className="mb-1.5 text-micro uppercase tracking-[.1em] text-ink-500">آخر اختبار داخلي</p>
        {rows.map(([label, val]) => (
          <p key={label} className="flex items-baseline justify-between gap-4 border-b border-ink-150 py-0.5 last:border-0">
            <span className="shrink-0 text-ink-500">{label}</span>
            <span className="min-w-0 text-end font-medium text-ink-900">{val}</span>
          </p>
        ))}
      </div>
    }>
      <Chip tone={EXAM_TYPE_TONE[exam.type as ExamType] ?? 'ink'}>
        {EXAM_TYPE_AR[exam.type as ExamType] ?? exam.type}
      </Chip>
    </Tooltip>
  );
}

/** One labelled line of the student card. */
function Def({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-150 py-2 last:border-0">
      <span className="shrink-0 text-panel text-ink-500">{label}</span>
      <span className="min-w-0 text-end text-body text-ink-900">{children}</span>
    </div>
  );
}

function FollowUpScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();

  const [view, setView] = useState<'sheet' | 'student'>('sheet');
  const [studentId, setStudentId] = useState('');
  const [q, setQ] = useState('');

  const halaqaFilter = sp.get('halaqa');
  const listParam = sp.get('list');
  const list: ListKey | null = listParam && listParam in LIST_META ? (listParam as ListKey) : null;

  /* A panel click means «show me that list» — it always lands on the sheet. */
  useEffect(() => { setView('sheet'); }, [listParam, halaqaFilter]);

  /* The KPI cards navigate: same URL contract as the panel, so the two agree. */
  const openList = (key: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (key === null) next.delete('list'); else next.set('list', key);
    setView('sheet');
    router.replace(`/admin/follow-up${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const all = useMemo(() => followUpRows(db), [db]);
  const followed = useMemo(() => followedRows(all), [all]);
  const inHalaqa = useMemo(
    () => (halaqaFilter ? followed.filter((r) => r.student.halaqaId === halaqaFilter) : followed),
    [followed, halaqaFilter]);

  const counts = useMemo(() => ({
    ready: listRows(inHalaqa, 'ready').length,
    late: listRows(inHalaqa, 'late').length,
    overdue: listRows(inHalaqa, 'unexamined').length,
  }), [inHalaqa]);

  const rows = useMemo(() => {
    /* The list predicates and orders live in lib/followup.ts — one rule for
       this table, the panel counts, the alerts and the printed sheets alike.
       Only the default name order is this screen's own. */
    const out = list
      ? listRows(inHalaqa, list)
      : [...inHalaqa].sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, 'ar'));
    const needle = foldArabic(q);
    return needle
      ? out.filter((r) => foldArabic(r.student.fullName).includes(needle))
      : out;
  }, [inHalaqa, list, q]);

  const teacherOf = useMemo(
    () => (id: string | null) => teacherName(db.halaqat, id), [db.halaqat]);
  const halaqa = halaqaFilter ? db.halaqat.find((h) => h.id === halaqaFilter) ?? null : null;

  const studentOptions = useMemo(() => followed.map((r) => ({
    value: r.student.id,
    label: r.student.fullName,
    hint: [teacherOf(r.student.halaqaId),
           r.student.track ? TRACK_AR[r.student.track] : 'بلا مسار'].join(' · '),
  })).sort((a, b) => a.label.localeCompare(b.label, 'ar')),
  [followed, teacherOf]);

  const sel = useMemo(
    () => all.find((r) => r.student.id === studentId) ?? null, [all, studentId]);
  const selExams = useMemo(() => (sel
    ? db.exams.filter((e) => e.studentId === sel.student.id)
        .sort((a, b) => (a.takenOn < b.takenOn ? 1 : a.takenOn > b.takenOn ? -1
          : (a.createdAt < b.createdAt ? 1 : -1)))
    : []), [db.exams, sel]);

  if (!db.students.length) {
    return (
      <>
        <TopBar title="المتابعة" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا طلاب بعد"
              body="شاشة المتابعة تبحث بالحلقة وبالطالب، وتعدّ لك أربعة كشوف جاهزة: الجاهزين للجمعية، والمتأخرين في مستواهم، ومن لم يُختبروا مؤخرًا، والمتفوقين. ابدأ برفع ملف الطلاب."
              action={<Link href="/admin/students/import">
                <Btn variant="primary" size="lg">رفع ملف</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  const crumbs = [
    ...(halaqa ? [`حلقة ${shortName(halaqa.teacher)}`] : []),
    ...(list ? [LIST_META[list].title] : []),
  ];

  return (
    <>
      <TopBar title="المتابعة" crumbs={crumbs.length ? crumbs : undefined}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {/* كل بطاقة تفتح كشفها — والسهم أسفل يسارها يقول ذلك (قرار العميل ١ سبتمبر). */}
        <div className="rise mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI label="طلاب يُتابَعون" value={inHalaqa.length} icon={Users} accent
            sub={halaqa ? `في حلقة ${shortName(halaqa.teacher)}` : 'النشطون في كل الحلقات'}
            onClick={() => openList(null)} />
          <KPI label="جاهزون للجمعية" value={counts.ready} icon={Award} delay={60}
            sub="أتمّوا الجزء واجتازوا الماسي"
            onClick={() => openList('ready')} />
          <KPI label="متأخرون في مستواهم" value={counts.late} icon={Hourglass} delay={120}
            sub={<>أكثر من <Num>{LEVEL_LATE_AFTER_DAYS}</Num> يومًا على الورقة</>}
            onClick={() => openList('late')} />
          <KPI label="لم يُختبروا مؤخرًا" value={counts.overdue} icon={CalendarClock} delay={180}
            sub={<>أكثر من <Num>{UNEXAMINED_AFTER_DAYS}</Num> يومًا بلا اختبار</>}
            onClick={() => openList('unexamined')} />
        </div>

        <div className="rise mb-4 flex flex-wrap items-center gap-3">
          <Segmented value={view} onChange={setView}
            options={[{ value: 'sheet', label: 'بالحلقة' }, { value: 'student', label: 'بالطالب' }]} />
          {view === 'sheet' && (
            <>
              <div className="relative min-w-[14rem] flex-1">
                <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث باسم الطالب…" className={cx(INPUT, 'pe-10')} />
              </div>
              <span className="text-panel text-ink-500">
                <Num className="font-medium text-ink-900">{rows.length}</Num> من <Num>{inHalaqa.length}</Num>
              </span>
            </>
          )}
        </div>

        {view === 'sheet' ? (
          <>
            {list && (
              <div className="rise mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ink-150 bg-paper px-4 py-3">
                <p className="min-w-0 flex-1">
                  <span className="font-medium text-ink-900">{LIST_META[list].title}</span>
                  <span className="block text-micro text-ink-500">{LIST_META[list].hint}</span>
                </p>
                {list === 'top' && (
                  <Link href={`/print/honour${halaqaFilter ? `?halaqa=${halaqaFilter}` : ''}`}>
                    <Btn size="sm" icon={Printer}>لوحة الشرف للطباعة</Btn>
                  </Link>
                )}
              </div>
            )}

            <Sheet className="rise" pad={false}>
              {rows.length === 0 ? (
                <Empty icon={Users}
                  title={list ? 'الكشف فارغ' : 'لا نتائج'}
                  body={list === 'ready' ? 'لا طالب استوفى الشرطين الآن — يظهر هنا فور اجتيازه الوسام الماسي على جزء أتمّه.'
                    : list === 'late' ? 'لا أحد أمضى على ورقته أكثر من المدة. هذا هو المطلوب.'
                    : list === 'unexamined' ? 'كل الطلاب اختُبروا خلال المدة.'
                    : list === 'top' ? 'لا أرصدة نقاط بعد.'
                    : 'جرّب توسيع التصفية أو مسح البحث.'} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[64rem] border-collapse text-body">
                    <thead>
                      <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                        {['الطالب',
                          ...(halaqaFilter ? [] : ['الحلقة']),
                          'الصف', 'الحضور', 'حفظ اليوم', 'المستوى',
                          'تاريخ الإصدار', 'الأيام',
                          ...(list === 'ready' ? ['الجزء الجاهز'] : []),
                          ...(list === 'top' ? ['الرصيد'] : []),
                          'آخر اختبار جمعية', 'آخر اختبار داخلي'].map((h) => (
                          <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.student.id}
                          onClick={() => { setStudentId(r.student.id); setView('student'); }}
                          title="افتح بطاقة المتابعة"
                          className="cursor-pointer border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50">
                          <td className="px-3 py-3 text-ink-900">
                            {list === 'top' && (
                              <Num className="me-2 inline-block w-5 text-center text-panel font-medium text-ink-500">{i + 1}</Num>
                            )}
                            {r.student.fullName}
                          </td>
                          {!halaqaFilter && (
                            <td className="px-3 py-3 text-panel text-ink-600">{teacherOf(r.student.halaqaId)}</td>
                          )}
                          <td className="px-3 py-3 text-panel text-ink-600">{r.student.grade || '—'}</td>
                          <td className="px-3 py-3">
                            {r.student.attended === undefined ? <span className="text-ink-400">—</span>
                              : r.student.attended ? <Chip tone="ok">حاضر</Chip> : <Chip tone="risk">غائب</Chip>}
                          </td>
                          <td className="px-3 py-3">
                            {r.student.hifzPages !== undefined
                              ? <Num className="text-panel text-ink-700">{r.student.hifzPages}</Num>
                              : <span className="text-ink-400">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {r.student.track === 'TALQEEN'
                              ? <Chip tone="ink">تلقين</Chip>
                              : <Num className="text-panel text-ink-700">
                                  {r.student.currentLevel ?? r.plan?.level ?? '—'}
                                </Num>}
                          </td>
                          {r.plan ? (
                            <>
                              <td className="whitespace-nowrap px-3 py-3">
                                <Num className="text-panel text-ink-600">{formatDate(r.plan.issuedAt)}</Num>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3">
                                <Num className={cx('font-medium', r.late ? 'text-warn-700' : 'text-ink-700')}>
                                  {r.daysHeld}
                                </Num>
                                {r.late && <span className="ms-1.5 align-middle"><Chip tone="warn">متأخر</Chip></span>}
                              </td>
                            </>
                          ) : (
                            /* «لا توجد خطة»، لا فراغات — SPEC §6.10 */
                            <td colSpan={2} className="px-3 py-3 text-panel text-ink-400">
                              {r.student.track === 'TALQEEN' ? 'التلقين بلا خطة' : 'لا توجد خطة'}
                            </td>
                          )}
                          {list === 'ready' && (
                            <td className="whitespace-nowrap px-3 py-3">
                              <Chip tone="ok">جزء <Num>{r.ready.ajza}</Num></Chip>
                            </td>
                          )}
                          {list === 'top' && (
                            <td className="whitespace-nowrap px-3 py-3">
                              <Num className="font-medium text-brand-800">{r.balance}</Num>
                            </td>
                          )}
                          <td className="px-3 py-3"><AssocCell exam={r.lastAssociation} /></td>
                          <td className="px-3 py-3"><InternalCell exam={r.lastInternal} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Sheet>
          </>
        ) : (
          <div className="rise">
            <Sheet className="mb-4">
              <SheetHead title="البحث باسم الطالب"
                meta="بديل كشف «البحث باسم الطالب» — الخطة والجاهزية والاختبارات والرصيد في بطاقة واحدة" />
              <div className="max-w-md">
                <Combobox value={studentId} onChange={setStudentId} options={studentOptions}
                  placeholder="اختر طالبًا…" searchPlaceholder="ابحث بالاسم…" />
              </div>
            </Sheet>

            {sel && (
              <>
                <div className="mb-4 grid gap-4 lg:grid-cols-2">
                  <Sheet>
                    <SheetHead title={sel.student.fullName}
                      meta={[teacherOf(sel.student.halaqaId) === '—' ? 'بلا حلقة' : `حلقة ${teacherOf(sel.student.halaqaId)}`,
                             STATUS_AR[sel.student.status]].join(' · ')} />
                    <Def label="المسار">
                      {sel.student.track
                        ? <Chip tone={sel.student.track === 'TALQEEN' ? 'ink' : 'brand'}>{TRACK_AR[sel.student.track]}</Chip>
                        : <span className="text-ink-400">—</span>}
                    </Def>
                    <Def label="الصف">{sel.student.grade || '—'}</Def>
                    <Def label="الجنسية">{sel.student.nationality || '—'}</Def>
                    <Def label="رقم الهوية">
                      {sel.student.nationalId ? <Num>{sel.student.nationalId}</Num> : '—'}
                    </Def>
                    {earnsPoints(sel.student) && (
                      <Def label="رصيد النقاط">
                        <Num className="font-medium text-brand-800">{sel.balance}</Num> {pointWord(sel.balance)}
                      </Def>
                    )}
                    <Def label="لقطة رتل الأسبوعية">
                      {sel.student.attended === undefined && sel.student.hifzPages === undefined
                        ? <span className="text-ink-400">لم يرد في آخر ملف</span>
                        : <>
                            {sel.student.attended !== undefined && (sel.student.attended
                              ? <Chip tone="ok">حاضر</Chip> : <Chip tone="risk">غائب</Chip>)}
                            {' '}حفظ <Num>{sel.student.hifzPages ?? '—'}</Num> ·
                            {' '}مراجعة <Num>{sel.student.reviewPages ?? '—'}</Num>
                          </>}
                    </Def>
                  </Sheet>

                  <Sheet>
                    <SheetHead title="المستوى والخطة" />
                    {sel.student.track === 'TALQEEN' ? (
                      <p className="text-base2 text-ink-600">
                        مسار التلقين بلا مستوى وبلا خطة وبلا نقاط — §13.1. تُتابَع اختباراته وحضوره فقط.
                      </p>
                    ) : sel.plan ? (
                      <>
                        <Def label="المستوى الحالي">
                          <Num className="font-medium">{sel.student.currentLevel ?? sel.plan.level}</Num>
                          {isMidJuz(sel.student.track, sel.student.currentLevel) && (
                            <span className="ms-1.5 text-micro text-ink-500">منتصف الجزء</span>
                          )}
                        </Def>
                        <Def label="ورقة المستوى">
                          <Num>{sel.plan.level}</Num> — {TRACK_AR[sel.plan.track]}
                        </Def>
                        <Def label="تاريخ الإصدار">
                          <Num>{formatDate(sel.plan.issuedAt)}</Num>
                          <span className="ms-1.5 text-micro text-ink-500">{relativeDay(sel.plan.issuedAt)}</span>
                        </Def>
                        <Def label="الأيام منذ الإصدار">
                          <Num className={cx('font-medium', sel.late && 'text-warn-700')}>{sel.daysHeld}</Num>
                          {sel.late && <span className="ms-1.5"><Chip tone="warn">متأخر في مستواه</Chip></span>}
                        </Def>
                        <Def label="المقدار اليومي">{sel.plan.dailyAmount}</Def>
                        <Def label="الطباعة">
                          {sel.plan.printedCount > 0
                            ? <>طُبعت <Count n={sel.plan.printedCount} one="مرة" two="مرتين" few="مرات" many="مرة" /></>
                            : 'لم تُطبع بعد'}
                        </Def>
                        <div className="mt-4">
                          <Link href={`/print/plan/${sel.plan.id}`}>
                            <Btn size="sm" icon={FileText}>ورقة المستوى</Btn>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-base2 text-ink-600">لا توجد خطة مُصدرة لهذا الطالب.</p>
                        <div className="mt-4">
                          <Link href={`/admin/plans?student=${sel.student.id}`}>
                            <Btn size="sm" variant="primary" icon={FileText}>إصدار خطة</Btn>
                          </Link>
                        </div>
                      </>
                    )}

                    <div className="mt-5 border-t border-ink-150 pt-4">
                      <p className="mb-2 text-2xs font-medium uppercase tracking-[.12em] text-ink-500">
                        الجاهزية لاختبار الجمعية
                      </p>
                      {sel.ready.ready ? (
                        <p className="text-base2 text-ink-800">
                          <Chip tone="ok">جاهز</Chip>
                          <span className="ms-2">أتمّ جزء <Num>{sel.ready.ajza}</Num> واجتاز وسامه الماسي —
                            يظهر في كشف الجاهزين.</span>
                        </p>
                      ) : (
                        <p className="text-base2 text-ink-600">{sel.ready.reason}</p>
                      )}
                    </div>
                  </Sheet>
                </div>

                <Sheet pad={false}>
                  <div className="px-6 pt-5">
                    <SheetHead title="اختباراته"
                      meta={selExams.length
                        ? plural(selExams.length, 'اختبار واحد مسجَّل', 'اختباران مسجَّلان', 'اختبارات مسجَّلة', 'اختبارًا مسجَّلًا')
                        : undefined} />
                  </div>
                  {selExams.length === 0 ? (
                    <p className="px-6 pb-6 text-base2 text-ink-500">لم يُختبر بعد.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[36rem] border-collapse text-body">
                        <thead>
                          <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                            {['التاريخ', 'النوع', 'المستوى', 'الأجزاء', 'الدرجة', 'النتيجة', 'ملاحظة'].map((h) => (
                              <th key={h} className="px-3 py-2.5 text-start font-medium">{h}</th>))}
                          </tr>
                        </thead>
                        <tbody>
                          {selExams.slice(0, 8).map((e) => (
                            <tr key={e.id} className="border-b border-ink-150 last:border-0">
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <Num className="text-panel text-ink-600">{formatDate(e.takenOn)}</Num>
                              </td>
                              <td className="px-3 py-2.5">
                                <Chip tone={e.type === 'ASSOCIATION' ? 'assoc' : 'ink'}>
                                  {EXAM_TYPE_AR[e.type as ExamType] ?? e.type}
                                </Chip>
                              </td>
                              <td className="px-3 py-2.5"><Num className="text-panel text-ink-700">{e.level ?? '—'}</Num></td>
                              <td className="px-3 py-2.5"><Num className="text-panel text-ink-700">{e.ajza ?? '—'}</Num></td>
                              <td className="px-3 py-2.5"><Num className="text-panel text-ink-700">{e.score ?? '—'}</Num></td>
                              <td className="px-3 py-2.5">
                                {e.passed === null ? <span className="text-ink-400">—</span>
                                  : e.passed ? <Chip tone="ok">اجتاز</Chip> : <Chip tone="risk">لم يجتز</Chip>}
                              </td>
                              <td className="max-w-[12rem] px-3 py-2.5 text-panel text-ink-600">
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
                      {selExams.length > 8 && (
                        <p className="border-t border-ink-150 px-6 py-3 text-micro text-ink-500">
                          يُعرض آخر <Num>8</Num> اختبارات — البقية في <Link className="text-brand-800 underline" href="/admin/exams">سجلّ الاختبارات</Link>.
                        </p>
                      )}
                    </div>
                  )}
                </Sheet>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><FollowUpScreen /></Suspense>;
}
