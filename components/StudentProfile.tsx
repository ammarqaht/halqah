'use client';
/* ملف الطالب — كل ما عنه، وتعديله من مكانه.
 *
 * Clicking a boy's name on «الطلاب والحلقات» opened a form: eleven fields to
 * change and not one fact to read. His level, his plan, his exams, his points,
 * whether he was in the halaqa this week — all of it lived on OTHER screens,
 * so the supervisor had to hold a name in his head and go looking.
 *
 * Reading and editing are the same act here. Every fact is shown as a fact
 * until it is clicked, and then it is a field; «حفظ» writes it and it is a
 * fact again. Nothing is hidden behind a mode, and nothing is a form when it
 * did not need to be.
 *
 * What is NOT editable here is deliberate: his exams, his points ledger and
 * his teacher's register are records of things that happened, and they are
 * corrected where they were made — «لا تُحذف حركة أبدًا» is the same rule
 * everywhere in this system.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  X, Pencil, Check, Trophy, ClipboardCheck, Coins, CalendarCheck,
  ArrowLeft, AlertTriangle, FileText,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Num, pointWord } from '@/components/Num';
import { Btn, Chip, INPUT } from '@/components/ui';
import { StudentWeek } from '@/components/StudentWeek';
import { store, useDB } from '@/lib/store';
import { balanceOf, earnsPoints, EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import {
  TRACK_AR, STATUS_AR, levelsFor,
  type Student, type Track, type StudentStatus,
} from '@/lib/types';
import { halaqaLabel, shortName, normaliseNationalId, normalisePhone } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';
import { ajzaForLevel, daysSince, isLate, readyForAssociation } from '@/lib/exams';
import { cx } from '@/lib/cx';

/** سطر: عنوانه، وقيمته، وتعديله في مكانه. */
function Row({
  label, children, edit, onSave, wide = false,
}: {
  label: string;
  children: React.ReactNode;
  /** The field, given the live draft and a setter. Absent ⇒ read-only. */
  edit?: (done: () => void) => React.ReactNode;
  onSave?: () => void;
  wide?: boolean;
}) {
  const [on, setOn] = useState(false);
  return (
    <div className={cx('group flex gap-4 border-b border-ink-150 py-2.5 last:border-0',
      wide ? 'flex-col' : 'items-baseline')}>
      <dt className={cx('shrink-0 text-panel text-ink-500', !wide && 'w-28')}>{label}</dt>
      <dd className="min-w-0 flex-1">
        {on && edit ? (
          <div className="flex items-center gap-2">
            {edit(() => setOn(false))}
            <button onClick={() => { onSave?.(); setOn(false); }}
              aria-label="حفظ"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-800 text-white transition hover:bg-brand-900">
              <Check size={14} />
            </button>
            <button onClick={() => setOn(false)} aria-label="إلغاء"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-page">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="min-w-0 text-body text-ink-900">{children}</span>
            {edit && (
              <button onClick={() => setOn(true)} aria-label={`تعديل ${label}`}
                className="shrink-0 rounded p-1 text-ink-300 opacity-0 transition group-hover:opacity-100 hover:text-brand-800 focus:opacity-100">
                <Pencil size={13} />
              </button>
            )}
          </div>
        )}
      </dd>
    </div>
  );
}

export function StudentProfile({
  student, onClose, onFullEdit,
}: {
  student: Student;
  onClose: () => void;
  /** «تعديل كل البيانات» — the full form, for the fields not worth a row each. */
  onFullEdit: () => void;
}) {
  const db = useDB();
  const [d, setD] = useState<Student>(student);

  /* The row being edited holds a draft; saving writes the whole student, which
     is what `upsertStudent` takes and what the sync sends. */
  const put = (patch: Partial<Student>) => {
    const next = { ...d, ...patch };
    setD(next);
    store.upsertStudent(next);
  };

  const halaqa = db.halaqat.find((h) => h.id === d.halaqaId) ?? null;
  const balance = useMemo(() => balanceOf(db.txns, d.id), [db.txns, d.id]);
  const exams = useMemo(() => db.exams
    .filter((e) => e.studentId === d.id)
    .sort((a, b) => (a.takenOn < b.takenOn ? 1 : -1)), [db.exams, d.id]);
  const plan = useMemo(() => db.plans
    .filter((p) => p.studentId === d.id)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))[0] ?? null, [db.plans, d.id]);

  const talqeen = d.track === 'TALQEEN';
  const level = d.currentLevel ?? plan?.level ?? null;
  const ajza = ajzaForLevel(d.track, level);
  const daysHeld = daysSince(plan?.issuedAt, new Date());
  const late = isLate(plan ?? null);
  /* حكم §٤٫٨ نفسه الذي يبني كشف الجاهزين — لا نسخة ثانية منه هنا. */
  const ready = readyForAssociation({
    track: d.track, level,
    exams: db.exams.filter((e) => e.studentId === d.id),
  });

  return (
    <div className="space-y-4">
      {/* ── الرأس ──────────────────────────────────────────────────────────── */}
      <Sheet className="rise">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-t1 text-ink-900">{d.fullName}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-panel text-ink-500">
              <span>{halaqa ? `حلقة ${halaqaLabel(shortName(halaqa.teacher))}` : 'بلا حلقة'}</span>
              <span>·</span>
              <span className={cx(d.status !== 'ACTIVE' && 'text-warn-700')}>{STATUS_AR[d.status]}</span>
              {d.track && (
                <Chip tone={talqeen ? 'ink' : 'brand'}>{TRACK_AR[d.track]}</Chip>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Btn size="sm" icon={Pencil} onClick={onFullEdit}>تعديل كل البيانات</Btn>
            <button onClick={onClose} aria-label="إغلاق"
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-page">
              <X size={16} />
            </button>
          </div>
        </div>
      </Sheet>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── بياناته ──────────────────────────────────────────────────────── */}
        <Sheet>
          <SheetHead title="بياناته" meta="اضغط أيّ سطر لتعديله" />
          <dl>
            <Row label="المستوى"
              edit={talqeen ? undefined : () => (
                <select className={cx(INPUT, 'h-9 py-0')} value={d.currentLevel ?? ''}
                  onChange={(e) => put({ currentLevel: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">—</option>
                  {levelsFor(d.track).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              )}>
              {talqeen ? <span className="text-ink-400">مسار التلقين بلا مستوى</span>
                : d.currentLevel != null ? <Num className="font-medium">{d.currentLevel}</Num>
                : <span className="text-ink-400">لم يُحدَّد</span>}
            </Row>

            <Row label="الحلقة"
              edit={() => (
                <select className={cx(INPUT, 'h-9 py-0')} value={d.halaqaId ?? ''}
                  onChange={(e) => put({ halaqaId: e.target.value || null })}>
                  <option value="">بلا حلقة</option>
                  {db.halaqat.map((h) => (
                    <option key={h.id} value={h.id}>{shortName(h.teacher)}</option>
                  ))}
                </select>
              )}>
              {halaqa ? halaqaLabel(shortName(halaqa.teacher))
                : <span className="text-warn-700">بلا حلقة</span>}
            </Row>

            <Row label="المسار"
              edit={() => (
                <select className={cx(INPUT, 'h-9 py-0')} value={d.track ?? ''}
                  onChange={(e) => {
                    const t = (e.target.value || null) as Track | null;
                    /* A level that does not exist on the new track cannot ride
                       across with him — «٦٠ فضي» is not a golden level. */
                    const keep = d.currentLevel != null && levelsFor(t).includes(d.currentLevel);
                    put({ track: t, currentLevel: t === 'TALQEEN' || !keep ? null : d.currentLevel });
                  }}>
                  <option value="">—</option>
                  {(['GOLDEN', 'SILVER', 'TALQEEN'] as const).map((t) => (
                    <option key={t} value={t}>{TRACK_AR[t]}</option>
                  ))}
                </select>
              )}>
              {d.track ? TRACK_AR[d.track] : <span className="text-ink-400">—</span>}
            </Row>

            <Row label="الحالة"
              edit={() => (
                <select className={cx(INPUT, 'h-9 py-0')} value={d.status}
                  onChange={(e) => put({ status: e.target.value as StudentStatus })}>
                  {(['ACTIVE', 'INACTIVE', 'GRADUATED'] as const).map((s) => (
                    <option key={s} value={s}>{STATUS_AR[s]}</option>
                  ))}
                </select>
              )}>
              <span className={cx(d.status !== 'ACTIVE' && 'text-warn-700')}>{STATUS_AR[d.status]}</span>
            </Row>

            <Row label="رقم الهوية"
              edit={() => (
                <input className={cx(INPUT, 'num h-9 py-0')} dir="ltr" inputMode="numeric"
                  value={d.nationalId ?? ''}
                  onChange={(e) => {
                    const { id, flag } = normaliseNationalId(e.target.value);
                    put({ nationalId: id, nationalIdFlag: flag });
                  }} />
              )}>
              {d.nationalId ? (
                <span className="flex items-center gap-2">
                  <Num>{d.nationalId}</Num>
                  {d.nationalIdFlag && (
                    <Chip tone="warn">
                      <AlertTriangle size={11} className="me-1 inline" />
                      {d.nationalIdFlag === 'SHORT' ? 'رقم قصير'
                        : d.nationalIdFlag === 'LONG' ? 'رقم طويل' : 'مكرّر'}
                    </Chip>
                  )}
                </span>
              ) : <span className="text-warn-700">بلا رقم هوية</span>}
            </Row>

            <Row label="جوال وليّه"
              edit={() => (
                <input className={cx(INPUT, 'num h-9 py-0')} dir="ltr" inputMode="numeric"
                  value={d.guardianPhone}
                  onChange={(e) => put({ guardianPhone: normalisePhone(e.target.value) })} />
              )}>
              {d.guardianPhone ? <Num>{d.guardianPhone}</Num> : <span className="text-ink-400">—</span>}
            </Row>

            <Row label="الصف">{d.grade || <span className="text-ink-400">—</span>}</Row>
            <Row label="الجنسية">{d.nationality || <span className="text-ink-400">—</span>}</Row>
          </dl>
        </Sheet>

        {/* ── خطته ونقاطه ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Sheet>
            <SheetHead title="مستواه وخطته" />
            {talqeen ? (
              <p className="text-base2 text-ink-600">
                مسار التلقين بلا مستوى وبلا خطة وبلا نقاط — §١٣٫١. يُتابَع حضوره وتسميعه واختباراته فقط.
              </p>
            ) : (
              <dl>
                <Row label="المستوى"
                  edit={() => (
                    <select className={cx(INPUT, 'h-9 py-0')} value={d.currentLevel ?? ''}
                      onChange={(e) => put({ currentLevel: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">—</option>
                      {levelsFor(d.track).map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  )}>
                  {d.currentLevel != null
                    ? <span className="flex items-baseline gap-2">
                        <Num className="font-medium">{d.currentLevel}</Num>
                        {ajza != null && (
                          <span className="text-panel text-ink-500"><Num>{ajza}</Num> أجزاء</span>
                        )}
                      </span>
                    : <span className="text-ink-400">لم يُحدَّد</span>}
                </Row>

                {plan ? (
                  <>
                    <Row label="ورقته">
                      المستوى <Num>{plan.level}</Num> — {TRACK_AR[plan.track as Track]}
                    </Row>
                    <Row label="سُلِّمت">
                      <Num>{formatDate(plan.issuedAt)}</Num>
                      {daysHeld != null && (
                        <span className={cx('ms-2 text-panel', late ? 'text-warn-700' : 'text-ink-500')}>
                          قبل <Num>{daysHeld}</Num> يومًا{late && ' — متأخر في مستواه'}
                        </span>
                      )}
                    </Row>
                    <Row label="المقدار اليومي">{plan.dailyAmount || '—'}</Row>
                    <Row label="الطباعة">
                      {plan.printedCount > 0
                        ? <>طُبعت <Num>{plan.printedCount}</Num> {plan.printedCount === 1 ? 'مرة' : 'مرات'}</>
                        : <span className="text-ink-400">لم تُطبع بعد</span>}
                    </Row>
                  </>
                ) : (
                  <Row label="ورقته"><span className="text-ink-400">لم تُصدَر له خطة بعد</span></Row>
                )}
              </dl>
            )}

            {!talqeen && (
              <div className="mt-4 flex flex-wrap gap-2">
                {plan && (
                  <Link href={`/print/plan/${plan.id}`}>
                    <Btn size="sm" icon={FileText}>ورقة المستوى</Btn>
                  </Link>
                )}
                <Link href={`/admin/plans?student=${d.id}`}>
                  <Btn size="sm" variant={plan ? undefined : 'primary'} icon={FileText}>
                    {plan ? 'الخطط وطباعتها' : 'إصدار خطة'}
                  </Btn>
                </Link>
              </div>
            )}

            {/* الجاهزية لاختبار الجمعية — §٤٫٨، وهي حكم النظام لا رأي الشاشة. */}
            <div className="mt-5 border-t border-ink-150 pt-4">
              <p className="mb-2 text-2xs font-medium uppercase tracking-[.12em] text-ink-500">
                الجاهزية لاختبار الجمعية
              </p>
              {ready.ready ? (
                <p className="text-base2 text-ink-800">
                  <Chip tone="ok">جاهز</Chip>
                  <span className="ms-2">
                    أتمّ جزء <Num>{ready.ajza}</Num> واجتاز وسامه الماسي — يظهر في كشف الجاهزين.
                  </span>
                </p>
              ) : (
                <p className="text-base2 text-ink-600">{ready.reason}</p>
              )}
            </div>
          </Sheet>

          {earnsPoints(d) && (
            <Sheet>
              <SheetHead title="نقاطه" />
              <p className="flex items-baseline gap-2">
                <Coins size={16} className="text-brand-700" />
                <Num className="font-display text-t1 text-brand-800">{balance}</Num>
                <span className="text-panel text-ink-500">{pointWord(balance)}</span>
              </p>
              <Link href={`/admin/points?student=${d.id}`}
                className="mt-3 inline-flex items-center gap-1 text-panel text-brand-800 hover:underline">
                حركاته ومنحه <ArrowLeft size={13} />
              </Link>
            </Sheet>
          )}
        </div>
      </div>

      {/* ── حضوره وتسميعه — من سجلّ معلمه ───────────────────────────────────── */}
      <StudentWeek studentId={d.id} />

      {/* ── اختباراته ───────────────────────────────────────────────────────── */}
      <Sheet pad={false}>
        <div className="p-6 pb-3">
          <SheetHead title="اختباراته"
            meta={exams.length
              ? `${exams.length} ${exams.length === 1 ? 'اختبار مسجَّل' : 'اختبارًا مسجَّلًا'}`
              : undefined} />
        </div>
        {exams.length === 0 ? (
          <p className="flex items-center gap-2 px-6 pb-6 text-base2 text-ink-500">
            <ClipboardCheck size={16} className="shrink-0" /> لا اختبارات مسجّلة.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-body">
              <thead>
                <tr className="border-y border-ink-150 bg-page/50 text-cap text-ink-500">
                  {['التاريخ', 'النوع', 'المستوى', 'الدرجة', 'النتيجة'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {exams.slice(0, 10).map((e) => (
                  <tr key={e.id} className="border-b border-ink-150 last:border-0">
                    <td className="px-4 py-2 text-ink-700"><Num>{formatDate(e.takenOn)}</Num></td>
                    <td className="px-4 py-2">
                      <Chip tone={e.type === 'ASSOCIATION' ? 'assoc' : 'ink'}>
                        {EXAM_TYPE_AR[e.type as ExamType] ?? e.type}
                      </Chip>
                    </td>
                    <td className="px-4 py-2 text-ink-700">
                      {e.level != null ? <Num>{e.level}</Num> : '—'}
                    </td>
                    <td className="px-4 py-2 text-ink-700">
                      {e.score != null ? <Num>{e.score}</Num> : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {e.passed === null ? <span className="text-ink-400">—</span>
                        : e.passed ? <Chip tone="ok">اجتاز</Chip> : <Chip tone="risk">لم يجتز</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-4 border-t border-ink-150 px-6 py-3.5">
          <Link href={`/admin/exams?student=${d.id}`}
            className="inline-flex items-center gap-1 text-panel text-brand-800 hover:underline">
            <Trophy size={13} /> سجلّ اختباراته
          </Link>
          <Link href={`/admin/follow-up?view=student&student=${d.id}`}
            className="inline-flex items-center gap-1 text-panel text-brand-800 hover:underline">
            <CalendarCheck size={13} /> متابعته وجاهزيته
          </Link>
        </div>
      </Sheet>
    </div>
  );
}
