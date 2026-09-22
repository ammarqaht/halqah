'use client';
/* المتابعة — SPEC.md §6.10, approved PDF §9 (إد-٥-د).

   Two questions, and nothing else:

   - «من يحتاج نظرك؟» — four ready-made lists in the contextual panel: الجاهزون
     للجمعية · المتأخرون في مستواهم · من لم يُختبروا مؤخرًا · المتفوقون. One row
     per student, with his plan, his last association exam and his last internal
     one. A student with no plan reads «لا توجد خطة» — never blanks.
   - «كيف كانت حلقة فلان هذا الأسبوع؟» — the halaqa's name opens its register:
     who was present, who recited what, الأحد إلى الخميس.

   WHAT LEFT, 22 Sep 2026. A table of every followed student, and a card holding
   one boy's whole file, both used to live here. The roster belongs on «الطلاب
   والحلقات» — that screen lists them and now opens each one's file, where every
   field is editable in place. This screen follows their PROGRESS; it does not
   hold their records. Clicking a row in any list opens him over there.

   Every figure is computed by `lib/followup.ts` in one pass — the screen only
   sorts and shows. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users, Award, Hourglass, CalendarClock, Search, Inbox, Printer, FileText,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, INPUT } from '@/components/ui';
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
import { Register } from '@/components/Register';
import { StudentWeek } from '@/components/StudentWeek';

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
    ...(exam.type === 'TAJWEED' && exam.tajweedTopics.length
      ? [[exam.tajweedTopics.length > 1 ? 'المواضيع' : 'الموضوع',
          exam.tajweedTopics.join('، ')] as [string, React.ReactNode]] : []),
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

  const [studentId, setStudentId] = useState('');
  const [q, setQ] = useState('');

  const halaqaFilter = sp.get('halaqa');
  const listParam = sp.get('list');
  const list: ListKey | null = listParam && listParam in LIST_META ? (listParam as ListKey) : null;

  /* A panel click means «show me that list» — it always lands on the sheet. */

  /* The KPI cards navigate: same URL contract as the panel, so the two agree. */
  const openList = (key: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (key === null) next.delete('list'); else next.set('list', key);
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
              body="شاشة المتابعة تعدّ لك أربعة كشوف جاهزة — الجاهزين للجمعية، والمتأخرين في مستواهم، ومن لم يُختبروا مؤخرًا، والمتفوقين — وتفتح لك حضور كل حلقة وتسميعها أسبوعًا أسبوعًا. ابدأ برفع ملفاتك من الصفحة الرئيسية."
              action={<Link href="/admin">
                <Btn variant="primary" size="lg">الصفحة الرئيسية</Btn></Link>} />
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

        {/* الحلقة تفتح متابعتها الأسبوعية — ما سجّله معلمها من حضور وتسميع.
            وكانت تفتح جدول طلابها؛ وذاك الجدول مكانه «الطلاب والحلقات» حيث
            تُفتح ملفات الطلاب وتُعدَّل، لا هنا حيث يُتابَع سيرهم.
            أمّا الكشوف الجاهزة فتعمل داخل الحلقة كما كانت. */}
        {halaqaFilter && halaqaFilter !== 'none' && !listParam ? (
          <Register halaqaId={halaqaFilter} />
        ) : (<>

        {/* كل بطاقة تفتح كشفها — والسهم أسفل يسارها يقول ذلك (قرار العميل ١ سبتمبر). */}
        {/* ثلاث بطاقات لا أربع: «طلاب يُتابَعون» كانت تفتح كشف كل الطلاب، وقد
            انتقل إلى «الطلاب والحلقات» حيث تُفتح ملفاتهم وتُعدَّل. */}
        <div className="rise mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPI label="جاهزون للجمعية" value={counts.ready} icon={Award} accent
            sub="أتمّوا الجزء واجتازوا الماسي"
            onClick={() => openList('ready')} />
          <KPI label="متأخرون في مستواهم" value={counts.late} icon={Hourglass} delay={120}
            sub={<>أكثر من <Num>{LEVEL_LATE_AFTER_DAYS}</Num> يومًا على الورقة</>}
            onClick={() => openList('late')} />
          <KPI label="لم يُختبروا مؤخرًا" value={counts.overdue} icon={CalendarClock} delay={180}
            sub={<>أكثر من <Num>{UNEXAMINED_AFTER_DAYS}</Num> يومًا بلا اختبار</>}
            onClick={() => openList('unexamined')} />
        </div>

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

            {/* بلا كشف ولا حلقة: لا يُعرض جدول بكل الطلاب — ذاك انتقل إلى
                «الطلاب والحلقات». هذه الشاشة للكشوف الأربعة ولأسابيع الحلقات. */}
            {!list ? (
              <Sheet className="rise">
                {/* سطر واحد. الشرح الطويل كان يشرح البار المفتوح بجانبه،
                    وزرّه يقود إلى شاشة أخرى من شاشة لم يختر فيها شيئًا بعد. */}
                <Empty icon={Users} title="اختر كشفًا أو حلقة"
                  body="من البار على اليمين." />
              </Sheet>
            ) : (
            <Sheet className="rise" pad={false}>
              {rows.length === 0 ? (
                <Empty icon={Users}
                  title="الكشف فارغ"
                  body={list === 'ready' ? 'لا طالب استوفى الشرطين الآن — يظهر هنا فور اجتيازه الوسام الماسي على جزء أتمّه.'
                    : list === 'late' ? 'لا أحد أمضى على ورقته أكثر من المدة. هذا هو المطلوب.'
                    : list === 'unexamined' ? 'كل الطلاب اختُبروا خلال المدة.'
                    : 'لا أرصدة نقاط بعد.'} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[64rem] border-collapse text-body">
                    <thead>
                      <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                        {['الطالب',
                          ...(halaqaFilter ? [] : ['الحلقة']),
                          /* Attendance and today's pages come from one Ratel
                             report on one day. Follow-up asks who is behind
                             ACROSS levels and exams, and a column of «غائب» and
                             zero for everybody answered nothing. */
                          'الصف', 'المستوى',
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
                          onClick={() => router.push(`/admin/students?student=${r.student.id}`)}
                          title="افتح ملفه في الطلاب والحلقات"
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
                                {r.student.examHold && (
                                  <span className="ms-1.5 align-middle">
                                    <Chip tone="risk">يحتاج مراجعة</Chip>
                                  </span>
                                )}
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
            )}
          </>
        </>)}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><FollowUpScreen /></Suspense>;
}
