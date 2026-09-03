'use client';
/* طا-٥ مستواي وخطتي — «ماذا عليّ أن أحفظ اليوم؟», answered without asking. */
import { useMemo } from 'react';
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Chip, Empty } from '@/components/ui';
import { Num, juzWord } from '@/components/Num';
import { useDB } from '@/lib/store';
import { useStudentId, StudentPicker } from '@/components/StudentGate';
import { resolvePlan, dailyAmountFor } from '@/lib/curriculum';
import { ajzaForLevel, nextLevel } from '@/lib/exams';
import { PLAN_KIND_AR, TRACK_AR } from '@/lib/types';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

export default function MyLevel() {
  const db = useDB();
  const [id, setId] = useStudentId();
  const me = db.students.find((s) => s.id === id) ?? null;

  const plan = useMemo(() => [...db.plans]
    .filter((p) => p.studentId === id)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0] ?? null, [db.plans, id]);

  const days = useMemo(
    () => (plan ? resolvePlan(plan, db.curriculum, db.planOverrides) : []),
    [plan, db.curriculum, db.planOverrides]);

  /* Which day of the sheet he is on: counted from the day it was printed. */
  const todayNo = useMemo(() => {
    if (!plan) return null;
    const n = Math.floor((Date.now() - new Date(plan.issuedAt).getTime()) / 86_400_000) + 1;
    return n >= 1 && n <= (plan.dayCount || 24) ? n : null;
  }, [plan]);

  const exams = useMemo(() => db.exams
    .filter((e) => e.studentId === id)
    .sort((a, b) => b.takenOn.localeCompare(a.takenOn)), [db.exams, id]);

  if (!me) return <StudentPicker onPick={setId} />;

  if (!plan) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10">
        <Empty icon={BookOpen} title="لا توجد خطة بعد"
          body={me.track === 'TALQEEN'
            ? 'مسار التلقين بلا خطة مطبوعة — اسأل معلّمك عن مقرّرك.'
            : 'اطلب من المشرف أن يطبع لك ورقة مستواك.'} />
      </div>
    );
  }

  const ajza = ajzaForLevel(me.track, plan.level);
  const nextAjza = ajzaForLevel(me.track, nextLevel(plan.level));

  return (
    <div className="mx-auto max-w-lg px-5 py-6">
      <h1 className="font-display text-d2 text-ink-900">مستواي وخطتي</h1>

      <Sheet className="mt-5 border-brand-200 bg-brand-50">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-d1 text-brand-900"><Num>{plan.level}</Num></span>
          <div>
            <p className="text-body font-medium text-ink-900">
              {me.track ? `المسار ${TRACK_AR[me.track]}` : ''}
              {ajza !== null && ` · ${juzWord(ajza)}`}
            </p>
            <p className="mt-0.5 text-panel text-ink-600">
              المقرّر اليومي: {plan.dailyAmount || (me.track ? dailyAmountFor(me.track) : '—')}
            </p>
          </div>
        </div>
        <p className="mt-4 text-panel text-ink-600">
          استلمت الورقة في <Num className="font-medium text-ink-900">{formatDate(plan.issuedAt)}</Num>
          {todayNo && <> · أنت في اليوم <Num className="font-medium text-brand-800">{todayNo}</Num> من <Num>{plan.dayCount}</Num></>}
        </p>
      </Sheet>

      <Sheet className="mt-4" pad={false}>
        <div className="border-b border-ink-150 px-5 py-4">
          <h2 className="text-lg2 font-bold text-ink-900">خطتي</h2>
          <p className="mt-1 text-xs2 text-ink-500">
            يوما <Num>{plan.examDays.BADGE_GOLDEN}</Num> و<Num>{plan.examDays.BADGE_DIAMOND}</Num> للاختبار
          </p>
        </div>
        <ul className="divide-y divide-ink-150">
          {days.map((d) => {
            const isToday = d.dayNo === todayNo;
            return (
              <li key={d.dayNo}
                className={cx('px-5 py-3', isToday && 'bg-brand-50', d.examBadge && 'bg-warn-100/40')}>
                <div className="flex items-center gap-2">
                  <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-medium',
                    isToday ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600')}>
                    <Num>{d.dayNo}</Num>
                  </span>
                  {isToday && <Chip tone="brand">اليوم</Chip>}
                  {d.examBadge && (
                    <Chip tone="warn">{EXAM_TYPE_AR[d.examBadge as ExamType]}</Chip>
                  )}
                </div>
                {!d.examBadge && (
                  <ul className="mt-2 space-y-1">
                    {d.rows.map((r) => (
                      <li key={r.kind} className="flex gap-2 text-panel">
                        <span className="w-12 shrink-0 text-ink-500">{PLAN_KIND_AR[r.kind]}</span>
                        <span className="text-ink-800">
                          {r.fromSurah
                            ? <>{r.fromSurah} <Num>{r.fromAyah}</Num> ← {r.toSurah} <Num>{r.toAyah}</Num></>
                            : <span className="text-ink-400">—</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>

      {nextAjza !== null && (
        <Sheet className="mt-4">
          <SheetHead title="ما بعدي"
            meta={`المستوى ${nextLevel(plan.level)} — ${juzWord(nextAjza)}`} />
          <p className="text-panel text-ink-600">
            باجتياز الوسام الماسي في اليوم <Num>{plan.examDays.BADGE_DIAMOND}</Num> تنتقل إلى الجزء التالي.
          </p>
        </Sheet>
      )}

      {exams.length > 0 && (
        <Sheet className="mt-4">
          <SheetHead title="اختباراتي" />
          <ul className="divide-y divide-ink-150">
            {exams.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                {e.passed
                  ? <CheckCircle2 size={16} className="shrink-0 text-ok-500" />
                  : <XCircle size={16} className="shrink-0 text-risk-500" />}
                <span className="min-w-0 flex-1 truncate text-body text-ink-900">
                  {EXAM_TYPE_AR[e.type as ExamType] ?? e.type}
                  {e.level !== null && <span className="text-ink-500"> · المستوى <Num>{e.level}</Num></span>}
                </span>
                <Num className="shrink-0 text-micro text-ink-500">{formatDate(e.takenOn)}</Num>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
