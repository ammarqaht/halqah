'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   نتيجة اختبار، كاملة — one sitting as the supervisor sees it, for the boy and
   for his teacher too.

   «اذا الطالب اختبر ودي درجاته تطلع له مع الأسئلة والأخطاء مثل الي تطلع
   للمشرف وكذلك لمعلمه» (client, 9 Oct 2026).

   The supervisor's detail (app/admin/exams, ExamDetail) is the reference: the
   headline and the mark, how the mark was arrived at (the three counters and
   what each cost), the tajweed topics, every question in the order it was
   asked with its own counters, and what was written down. Here it is laid out
   for a phone — the questions as rows that wrap, not a table that scrolls
   sideways — because that is where the boy and his teacher read it.

   Data only: each portal's API hands over the same `ExamView`, scoped as it
   always was (a boy his own sittings, a teacher his halaqa's).
   ───────────────────────────────────────────────────────────────────────── */
import { Coins } from 'lucide-react';
import { Modal } from '@/components/ui';
import { Num } from '@/components/Num';
import { formatDate } from '@/lib/dates';
import { SCORE_DEDUCTIONS } from '@/lib/exams';
import { cx } from '@/lib/cx';

export type ExamQuestionView = {
  id: string; seq: number; surah: string; ayahFrom: string; ayahTo: string;
  errors: number; warnings: number; tajweedErrors: number; note: string;
};

export type ExamView = {
  id: string; type: string; typeAr: string; takenOn: string;
  level: number | null; ajza: number | null; examiner: string;
  score: number | null; scoreMax: number; passed: boolean | null;
  errors: number | null; warnings: number | null; tajweedErrors: number | null;
  tajweedTopics: string[]; note: string;
  pointsAwarded: number; pointsPaid: boolean;
  questions: ExamQuestionView[];
};

const COUNTERS = [
  ['الأخطاء', 'errors', SCORE_DEDUCTIONS.error, 'text-risk-700'],
  ['التنبيهات', 'warnings', SCORE_DEDUCTIONS.warning, 'text-warn-700'],
  ['التجويد', 'tajweedErrors', SCORE_DEDUCTIONS.tajweedError, 'text-info-700'],
] as const;

/** «درجة / درجتان / درجات» by the number — Arabic counts its nouns. */
const marks = (n: number) =>
  !Number.isInteger(n) || n === 1 || n > 10 ? 'درجة' : n === 2 ? 'درجتان' : 'درجات';

export function ExamSheet({ exam, onClose, self = false }: {
  exam: ExamView | null; onClose: () => void;
  /** The boy reading his own — «اجتزت» rather than «اجتاز». */
  self?: boolean;
}) {
  if (!exam) return null;
  const counted = exam.errors != null || exam.warnings != null || exam.tajweedErrors != null;
  const ok = exam.passed === true, bad = exam.passed === false;

  return (
    <Modal open wide onClose={onClose} title={exam.typeAr}>
      <div className="space-y-4">
        {/* the headline: what it was, and how it went */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3.5">
          <div className="min-w-0">
            <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium',
              ok ? 'bg-ok-100 text-ok-700' : bad ? 'bg-risk-100 text-risk-700' : 'bg-ink-100 text-ink-500')}>
              {ok ? (self ? 'اجتزت' : 'اجتاز') : bad ? (self ? 'لم أجتز' : 'لم يجتز') : 'بلا حكم'}
            </span>
            <p className="mt-1.5 text-panel leading-relaxed text-ink-600">
              <Num>{formatDate(exam.takenOn)}</Num>
              {exam.level != null && <> · المستوى <Num>{exam.level}</Num></>}
              {exam.ajza != null && <> · <Num>{exam.ajza}</Num> أجزاء</>}
              {exam.examiner && <> · المختبِر {exam.examiner}</>}
            </p>
          </div>
          <div className="shrink-0 text-center">
            <p className="font-display text-d2 leading-none text-brand-800"><Num>{exam.score ?? '—'}</Num></p>
            <p className="mt-1 text-micro text-ink-500">من <Num>{exam.scoreMax}</Num></p>
          </div>
        </div>

        {/* how the mark was arrived at */}
        {counted && (
          <div className="grid grid-cols-3 gap-2">
            {COUNTERS.map(([label, key, each, tone]) => {
              const n = exam[key] ?? 0;
              return (
                <div key={key} className="rounded-lg border border-ink-150 bg-page/50 px-3 py-2.5">
                  <p className="text-micro text-ink-500">{label}</p>
                  <p className="mt-0.5 font-display text-t1 leading-none text-ink-900"><Num>{n}</Num></p>
                  {n > 0 && (
                    <p className={cx('mt-1 text-micro', tone)}>
                      خُصم <Num>{n * each}</Num> {marks(n * each)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {exam.tajweedTopics.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs2 font-medium text-ink-600">مواضيع التجويد</p>
            <div className="flex flex-wrap gap-1.5">
              {exam.tajweedTopics.map((t) => (
                <span key={t} className="rounded-full bg-info-100 px-2.5 py-0.5 text-panel text-info-700">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* the questions, as they were asked */}
        <div>
          <p className="mb-1.5 text-xs2 font-medium text-ink-600">
            أسئلة الاختبار
            {exam.questions.length > 0 && (
              <span className="ms-2 font-normal text-ink-500"><Num>{exam.questions.length}</Num></span>
            )}
          </p>
          {exam.questions.length === 0 ? (
            <p className="rounded-lg bg-page px-3.5 py-3 text-panel text-ink-500">
              لم تُسجَّل أسئلة لهذا الاختبار — سُجِّل بإجماليّاته وحدها.
            </p>
          ) : (
            <ol className="divide-y divide-ink-150 overflow-hidden rounded-xl border border-ink-200">
              {exam.questions.map((q) => {
                const clean = q.errors + q.warnings + q.tajweedErrors === 0;
                return (
                  <li key={q.id} className="flex items-start gap-3 px-3.5 py-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-page text-micro text-ink-500">
                      <Num>{q.seq}</Num>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base2 text-ink-900">
                        {q.surah || '—'}
                        {q.ayahFrom && (
                          <span className="ms-1.5 text-panel text-ink-500">
                            من آية <Num>{q.ayahFrom}</Num>
                            {q.ayahTo && <> إلى <Num>{q.ayahTo}</Num></>}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-panel">
                        {clean ? (
                          <span className="text-ok-700">بلا أخطاء</span>
                        ) : COUNTERS.map(([label, key, , tone]) => (
                          <span key={key} className={q[key] > 0 ? tone : 'text-ink-400'}>
                            {label} <Num className="font-medium">{q[key]}</Num>
                          </span>
                        ))}
                      </p>
                      {q.note.trim() && (
                        <p className="mt-1.5 rounded-md bg-page px-2.5 py-1.5 text-panel leading-relaxed text-ink-700">
                          {q.note}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* what was written on the sitting itself */}
        {exam.note && (
          <div>
            <p className="mb-1.5 text-xs2 font-medium text-ink-600">ملاحظة المختبِر</p>
            <p className="rounded-lg bg-page px-3.5 py-2.5 text-panel leading-relaxed text-ink-700">{exam.note}</p>
          </div>
        )}

        {exam.pointsAwarded > 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-brand-50 px-3.5 py-3 text-base2 text-ink-800">
            <Coins size={16} className="shrink-0 text-brand-800" />
            <Num className="font-medium text-brand-800">{exam.pointsAwarded}</Num> نقطة{' '}
            {exam.pointsPaid
              ? <span className="text-ok-700">أُضيفت إلى الرصيد.</span>
              : <span className="text-warn-700">لم تُصرف بعد.</span>}
          </p>
        )}
      </div>
    </Modal>
  );
}
