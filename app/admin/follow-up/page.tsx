'use client';
/* المتابعة — SPEC.md §6.10 (إد-٥-د)
   The live replacement for «البحث بالحلقة» and «البحث باسم الطالب». Two views:
   a halaqa's roster with everything the supervisor tracked by hand, and the
   ready-made lists he used to assemble himself. */
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Users2, Inbox, AlertTriangle, CheckCircle2, XCircle, Printer } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip, INPUT } from '@/components/ui';
import { Num, juzWord } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { useDB } from '@/lib/store';
import { buildRows, applyList, LIST_AR, LATE_AFTER_DAYS, type ListKind } from '@/lib/followup';
import { TRACK_AR } from '@/lib/types';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { formatDate } from '@/lib/dates';
import { foldArabic, shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

const TRACK_TONE = { GOLDEN: 'warn', SILVER: 'ink', TALQEEN: 'info' } as const;

function FollowScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState('');

  const list = (sp.get('list') as ListKind) || 'all';
  const halaqaId = sp.get('halaqa');
  const halaqa = halaqaId ? db.halaqat.find((h) => h.id === halaqaId) ?? null : null;

  const rows = useMemo(() => buildRows(db), [db]);

  const shown = useMemo(() => {
    let r = applyList(rows, list);
    if (halaqaId) r = r.filter((x) => x.student.halaqaId === halaqaId);
    const needle = foldArabic(q);
    if (needle) r = r.filter((x) => foldArabic(x.student.fullName).includes(needle));
    return r;
  }, [rows, list, halaqaId, q]);

  const counts = useMemo(() => ({
    ready: rows.filter((r) => r.ready).length,
    late: rows.filter((r) => r.isLate).length,
    stale: rows.filter((r) => r.examStale).length,
  }), [rows]);

  if (!db.students.length) {
    return (
      <>
        <TopBar title="المتابعة" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
        <div className="mx-auto max-w-column px-6 py-8">
          <Sheet className="rise">
            <Empty icon={Inbox} title="لا توجد بيانات بعد"
              body="ارفع تقرير رتل أو قاعدة بيانات الطلاب، وستمتلئ هذه الشاشة من نفسها."
              action={<Link href="/admin/students/import"><Btn variant="primary" size="lg">رفع ملف</Btn></Link>} />
          </Sheet>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="المتابعة" crumbs={halaqa ? [`حلقة ${shortName(halaqa.teacher)}`] : [LIST_AR[list]]}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={<Link href="/admin/reports"><Btn icon={Printer}>التقارير</Btn></Link>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {/* ── the ready-made lists he used to assemble by hand ───────────── */}
        <div className="rise mb-5 flex flex-wrap gap-2">
          {(['all', 'ready', 'late', 'stale', 'top'] as ListKind[]).map((k) => {
            const n = k === 'ready' ? counts.ready : k === 'late' ? counts.late
              : k === 'stale' ? counts.stale : k === 'all' ? rows.length : null;
            const active = list === k;
            return (
              <button key={k}
                onClick={() => {
                  const p = new URLSearchParams(sp.toString());
                  if (k === 'all') p.delete('list'); else p.set('list', k);
                  router.replace(`/admin/follow-up${p.toString() ? `?${p}` : ''}`, { scroll: false });
                }}
                className={cx('rounded-lg border px-3.5 py-2 text-panel transition-colors',
                  active ? 'border-brand-700 bg-brand-50 font-medium text-brand-800'
                         : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
                {LIST_AR[k]}
                {n !== null && (
                  <span className={cx('ms-2 rounded px-1.5 py-0.5 text-2xs',
                    active ? 'bg-brand-200 text-brand-900' : 'bg-ink-100 text-ink-600')}>
                    <Num>{n}</Num>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {list === 'late' && counts.late > 0 && (
          <div className="rise mb-4 flex items-start gap-3 rounded-xl border border-warn-200 bg-warn-100/50 p-4">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn-700" />
            <p className="text-panel text-ink-700">
              مضى على ورقتهم أكثر من <Num className="font-medium">{LATE_AFTER_DAYS}</Num> يومًا.
              خطة المستوى ٢٤ يوم عمل — أي نحو خمسة أسابيع بأيام الحلقة.
            </p>
          </div>
        )}

        <div className="rise mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم الطالب…" className={cx(INPUT, 'pe-10')} />
          </div>
          <span className="text-panel text-ink-500">
            <Num className="font-medium text-ink-900">{shown.length}</Num> من <Num>{rows.length}</Num>
          </span>
        </div>

        <Sheet className="rise" pad={false}>
          {shown.length === 0 ? (
            <Empty icon={Users2} title="لا نتائج"
              body={list === 'ready' ? 'لا أحد مستوفٍ للشرطين: إتمام الجزء واجتياز الوسام الماسي.'
                : list === 'late' ? 'لا أحد تأخّر على مستواه. '
                : list === 'stale' ? 'الجميع اختُبروا مؤخّرًا.'
                : 'جرّب توسيع البحث.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                    {['الطالب', 'الحلقة', 'المستوى', 'الأجزاء', 'على المستوى', 'آخر اختبار جمعية', 'آخر وسام', 'النقاط'].map((h) => (
                      <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.student.id} className="border-b border-ink-150 transition-colors last:border-0 hover:bg-brand-50">
                      <td className="px-3 py-3">
                        <span className="font-medium text-ink-900">{r.student.fullName}</span>
                        {r.student.track && (
                          <Chip tone={TRACK_TONE[r.student.track]}>{TRACK_AR[r.student.track]}</Chip>
                        )}
                        {r.ready && <Chip tone="ok"><CheckCircle2 size={10} />جاهز</Chip>}
                      </td>
                      <td className="px-3 py-3 text-panel text-ink-600">
                        {r.halaqa ? shortName(r.halaqa.teacher) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        {r.plan
                          ? <Num className="text-panel text-ink-800">{r.plan.level}</Num>
                          : <span className="text-micro text-ink-400">لا توجد خطة</span>}
                      </td>
                      <td className="px-3 py-3 text-panel text-ink-700">
                        {r.ajza !== null ? juzWord(r.ajza) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        {r.daysOnLevel === null ? <span className="text-micro text-ink-400">—</span> : (
                          <Chip tone={r.isLate ? 'warn' : 'ink'}>
                            <Num>{r.daysOnLevel}</Num> يومًا
                          </Chip>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {r.lastAssociation ? (
                          <span className="flex items-center gap-1.5 text-panel">
                            {r.lastAssociation.passed
                              ? <CheckCircle2 size={13} className="shrink-0 text-ok-500" />
                              : <XCircle size={13} className="shrink-0 text-risk-500" />}
                            <Num className="text-ink-700">{formatDate(r.lastAssociation.takenOn)}</Num>
                            {r.lastAssociation.score !== null && (
                              <Num className="text-ink-500">({r.lastAssociation.score})</Num>)}
                          </span>
                        ) : <span className="text-micro text-ink-400">لم يُختبر</span>}
                      </td>
                      <td className="px-3 py-3">
                        {r.lastInternal ? (
                          <span className="text-panel text-ink-700">
                            {EXAM_TYPE_AR[r.lastInternal.type as ExamType] ?? r.lastInternal.type}
                            {' · '}<Num>{formatDate(r.lastInternal.takenOn)}</Num>
                          </span>
                        ) : <span className="text-micro text-ink-400">لم يُختبر</span>}
                      </td>
                      <td className="px-3 py-3"><Num className="text-panel font-medium text-ink-900">{r.balance}</Num></td>
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
  return <Suspense><FollowScreen /></Suspense>;
}
