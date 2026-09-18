'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مع-٢ الرئيسية — حلقتي اليوم.

   «الغرض: أن يعرف المعلم في خمس ثوانٍ ما المطلوب منه الآن، ويصل إلى عمله بنقرة
   واحدة.»

   Laid out on the client's own instruction (18 Sep 2026) to «تكون مقاربة لعرض
   البيانات عند الطالب» — so it is the student's home, one rank up: his ring is
   his own progress through a level, this one is the halaqa's progress through an
   afternoon. Four sections and no fifth:

     تقدّم اليوم   a ring of who has recited, and a bar of who came
     آخر الاختبارات a horizontal rail — the student's `ExamRail`, with names on it
     تنبيهات حلقتي  five, a dot on the unread, and the rest behind «عرض المزيد»
     آخر الحركات   the halaqa's point movements, the student's `Ledger` shape

   «والتنبيه الذي لا يستطيع النظام حسابه لا يُعرض أصلًا» — every alert here comes
   from a row, and an empty list says so rather than being filled.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Award, BellOff, ChevronLeft, ClipboardCheck, TrendingUp,
} from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty } from '@/components/ui';
import { Num, pointWord } from '@/components/Num';
import { Ring } from '@/components/student/motion';
import { useMe } from '@/components/teacher/Me';
import { AlertRow, AlertsModal } from '@/components/teacher/Alerts';
import { DayHero } from '@/components/teacher/DayHero';
import { COPY } from '@/content/teacher';
import { formatDate, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

const CARD = 'rounded-2xl border border-ink-150 bg-paper shadow-soft';

/** How many alerts sit on the screen before «عرض المزيد» takes the rest. */
const ALERTS_SHOWN = 5;

type Feed = {
  /** من يستحق اختبارًا الآن — قائمة قائمة، لا تنبيهًا يمرّ. */
  due: {
    id: string; fullName: string; badgeAr: string; level: number | null;
    assignmentNo: number | null; since: string;
    bookedOn: string | null; needsReview: boolean;
  }[];
  exams: {
    id: string; studentId: string; studentName: string; typeAr: string; type: string;
    takenOn: string; score: number | null; scoreMax: number; passed: boolean | null;
  }[];
  moves: {
    id: string; studentId: string; studentName: string; delta: number;
    kindAr: string; reason: string; on: string;
  }[];
};

/* The alert row, its icons and the window they all open in live in
   `components/teacher/Alerts.tsx`: the bell in the hero shows the same list on
   every screen, and one of the two would have drifted. The ORDER they are read
   in lives with them too, in `Me.tsx`, and it is now by DATE — «وتعرض من الأقرب
   إلى الأبعد» (client, 18 Sep 2026). */

export default function TeacherHome() {
  const { me, markRead } = useMe();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  useEffect(() => {
    fetch('/api/teacher/feed')
      .then((r) => (r.ok ? r.json() : { exams: [], moves: [], due: [] }))
      .then((d) => setFeed({ exams: d.exams ?? [], moves: d.moves ?? [], due: d.due ?? [] }))
      .catch(() => setFeed({ exams: [], moves: [], due: [] }));
  }, []);

  if (!me) return null;

  /* Already sorted newest-first and already merged with what has been ticked —
     both happen once, in `MeProvider`. */
  const alerts = me.alerts;
  const unread = me.unread;
  /* «تقدّم الطلاب الحاضرين في مقرر اليوم» — of those who CAME, how many have had
     their مقرّر recorded. A boy who is absent is not behind on his recitation;
     he was not there. */
  const pct = me.counts.present > 0
    ? Math.round((me.counts.recited / me.counts.present) * 100) : 0;
  const marked = me.counts.present + me.counts.absent;

  return (
    <div>
      {/* `home` is what carries the one large button through to التسجيل. It is
          stated rather than inferred: inferring it from `data` made the button
          flash on التسجيل before its day loaded, and sit permanently in وضع
          «فترة لطالب», which never loads one. */}
      <DayHero me={me} day={me.today} data={null} home />

      {/* One page: the hero is the card at the top of it, not a layer under it.

          The hero has no entrance — it is what is already there when the screen
          opens — but everything under it arrives the way every other screen's
          content does: «القسم الذي أسفل الهيرو أبي العناصر اللي فيه يكون لها
          دخولية سلسة كسائر الصفحات» (client, 18 Sep 2026). Four sections, four
          delays, and the ones that wait on the feed play when the feed lands
          rather than over an empty box. */}
      <div className="mt-3.5 space-y-3.5">

        {/* ── تقدّم اليوم — the student's Journey, one rank up ─────────────── */}
        <section className={cx(CARD, 'rise px-[18px] py-4')}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base2 font-bold text-ink-900">{COPY.todayProgress}</h2>
            <Link href="/teacher/register"
              className="press flex shrink-0 items-center gap-1 py-1.5 text-xs2 font-medium text-brand-800">
              افتح التسجيل<ChevronLeft size={14} strokeWidth={2} />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Ring size={96} stroke={8} pct={pct} tone="stroke-brand-700">
              <Num className="font-display text-[26px] leading-none text-ink-900">
                {me.counts.recited}
              </Num>
              <span className="mt-[3px] text-2xs text-ink-500">سمّعوا</span>
            </Ring>

            <div className="min-w-0 flex-1">
              <p className="font-display text-xl2 text-ink-900">
                {me.counts.present > 0
                  ? <><Num>{me.counts.recited}</Num> من <Num>{me.counts.present}</Num> حاضر</>
                  : 'لم يحضر أحد بعد'}
              </p>
              <p className="mt-0.5 text-xs2 text-ink-600">
                {me.counts.present > 0
                  ? 'سُجِّل لهم مقرّر اليوم'
                  : 'تظهر النسبة مع أول بطاقة تحفظها'}
              </p>

              {/* «شريط تقدّم حقّ حضور اليوم مقابل الغياب» — one bar, two shares,
                  and what has not been decided yet stays empty rather than
                  being counted as either. */}
              <div className="mt-3 flex items-center justify-between gap-2 text-micro text-ink-500">
                <span>{COPY.attendanceBar}</span>
                <span>
                  <Num className="font-bold text-ok-700">{me.counts.present}</Num> حاضر ·{' '}
                  <Num className="font-bold text-risk-700">{me.counts.absent}</Num> غائب
                </span>
              </div>
              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-ink-100">
                <span className="h-full bg-ok-500 transition-[width] duration-[900ms] ease-brand"
                  style={{ width: `${(me.counts.present / Math.max(1, me.counts.roster)) * 100}%` }} />
                <span className="h-full bg-risk-500 transition-[width] duration-[900ms] ease-brand"
                  style={{ width: `${(me.counts.absent / Math.max(1, me.counts.roster)) * 100}%` }} />
              </div>
              {marked < me.counts.roster && (
                <p className="mt-1 text-micro text-ink-400">
                  بقي <Num>{me.counts.roster - marked}</Num> بلا تحضير
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── آخر اختبارات طلابي ──────────────────────────────────────────── */}
        {feed === null ? (
          <div className="no-bar -mx-5 flex gap-2.5 overflow-hidden px-5 md:mx-0 md:px-0">
            {[0, 1, 2].map((i) => <div key={i} className="skel h-[150px] w-[164px] shrink-0 rounded-2xl" />)}
          </div>
        ) : feed.exams.length === 0 && feed.due.length === 0 ? (
          <Sheet className="rise">
            <Empty icon={ClipboardCheck} title="لا اختبارات بعد"
              body="لم تُسجَّل اختبارات لطلابك بعد، ولا أحد بلغ مقرّر اختباره. أول نتيجة يرصدها المشرف تظهر هنا." />
          </Sheet>
        ) : (
          <section className="rise">
            <div className="flex items-baseline justify-between gap-3 px-0.5 pb-2.5">
              <h2 className="text-base2 font-bold text-ink-900">{COPY.recentExams}</h2>
              <span className="shrink-0 text-cap text-ink-500">
                اجتاز <Num className="font-bold text-ink-900">
                  {feed.exams.filter((e) => e.passed === true).length}
                </Num>
              </span>
            </div>

            {/* ── من يستحق اختبارًا ──────────────────────────────────────────
                «آخر اختبارات طلابي تعرض كل من يستحق اختبارًا» (client, 18 Sep
                2026). The results are what HAPPENED; this is what is waiting,
                and it is the half he can act on — he is the one who tells the
                supervisor. A booked boy stays on the list and is marked: the
                appointment is not the exam, and a date set three weeks ago and
                never sat is exactly the one that disappears otherwise. */}
            {feed.due.length > 0 && (
              <ul className={cx(CARD, 'mb-2.5 overflow-hidden')}>
                {feed.due.map((s) => (
                  <li key={s.id} className="border-b border-ink-150 last:border-0">
                    <Link href={`/teacher/students/${s.id}`}
                      className="press flex items-center gap-3 px-[18px] py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warn-100 text-warn-700">
                        <Award size={17} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm2 font-medium text-ink-900">
                            {s.fullName}
                          </span>
                          {s.needsReview && (
                            <span className="rounded-full bg-risk-100 px-2 py-0.5 text-[11px] font-medium text-risk-700">
                              يحتاج مراجعة
                            </span>
                          )}
                          {s.bookedOn && (
                            <span className="rounded-full bg-info-100 px-2 py-0.5 text-[11px] font-medium text-info-700">
                              محجوز <Num>{formatDate(s.bookedOn)}</Num>
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-micro text-ink-500">
                          {s.badgeAr}
                          {s.level != null && <> · المستوى <Num>{s.level}</Num></>}
                          {' · '}{relativeDay(s.since)}
                        </span>
                      </span>
                      <ChevronLeft size={16} className="shrink-0 text-ink-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {feed.exams.length > 0 && (
            <ul className="no-bar -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
              {feed.exams.map((e) => {
                const ok = e.passed === true;
                const bad = e.passed === false;
                return (
                  <li key={e.id} className={cx(CARD, 'w-[164px] shrink-0 snap-start p-3.5')}>
                    <Link href={`/teacher/students/${e.studentId}`} className="press block">
                      <div className="flex items-center justify-between gap-2">
                        <Ring size={48} stroke={5}
                          pct={e.score != null && e.scoreMax ? (e.score / e.scoreMax) * 100 : 0}
                          tone={ok ? 'stroke-ok-700' : bad ? 'stroke-risk-700' : 'stroke-ink-300'}>
                          <Num className="text-xs2 font-bold text-ink-900">{e.score ?? '—'}</Num>
                        </Ring>
                        <span className={cx('inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-medium',
                          ok ? 'bg-ok-100 text-ok-700'
                            : bad ? 'bg-risk-100 text-risk-700' : 'bg-ink-100 text-ink-500')}>
                          {ok ? 'اجتاز' : bad ? 'لم يجتز' : '—'}
                        </span>
                      </div>

                      <p className="mt-3 truncate text-sm2 font-medium text-ink-900"
                        title={e.studentName}>
                        {e.studentName}
                      </p>
                      <p className={cx('mt-0.5 truncate text-micro',
                        e.type === 'ASSOCIATION' ? 'text-assoc-700' : 'text-ink-500')}>
                        {e.typeAr}
                      </p>
                      <p className="text-micro text-ink-400">
                        <Num>{formatDate(e.takenOn)}</Num>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        )}

        {/* ── تنبيهات حلقتي ───────────────────────────────────────────────── */}
        <section className="rise" style={{ animationDelay: '80ms' }}>
          <div className="flex items-baseline justify-between gap-3 px-0.5 pb-2.5">
            <h2 className="text-base2 font-bold text-ink-900">{COPY.allAlerts}</h2>
            {unread > 0 && (
              <span className="shrink-0 text-cap text-ink-500">
                <Num className="font-bold text-brand-800">{unread}</Num> غير مقروء
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <Sheet>
              <Empty icon={BellOff} title="لا تنبيهات" body={COPY.noAlerts} />
            </Sheet>
          ) : (
            <>
              <ul className={cx(CARD, 'overflow-hidden')}>
                {alerts.slice(0, ALERTS_SHOWN).map((a) => (
                  <AlertRow key={a.key} alert={a} onRead={() => markRead([a.key])} />
                ))}
              </ul>

              {alerts.length > ALERTS_SHOWN && (
                <Btn className="mt-2.5 w-full" onClick={() => setAllOpen(true)}>
                  {COPY.moreAlerts} (<Num>{alerts.length - ALERTS_SHOWN}</Num>)
                </Btn>
              )}
            </>
          )}
        </section>

        {/* ── آخر حركات النقاط ────────────────────────────────────────────── */}
        {feed === null ? (
          <div className={cx(CARD, 'space-y-2 p-5')}>
            {[0, 1, 2].map((i) => <div key={i} className="skel h-10 rounded-lg" />)}
          </div>
        ) : feed.moves.length === 0 ? (
          <Sheet className="rise">
            <Empty icon={TrendingUp} title="لا حركة بعد" body={COPY.noPoints} />
          </Sheet>
        ) : (
          <section className={cx(CARD, 'rise overflow-hidden')}>
            <div className="flex items-baseline justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
              <h2 className="text-base2 font-bold text-ink-900">{COPY.recentMoves}</h2>
              <Link href="/teacher/points"
                className="press flex shrink-0 items-center gap-1 text-xs2 font-medium text-brand-800">
                كل النقاط<ChevronLeft size={14} strokeWidth={2} />
              </Link>
            </div>
            <ul>
              {feed.moves.map((m) => (
                <li key={m.id} className="border-t border-ink-150">
                  <Link href={`/teacher/students/${m.studentId}`}
                    className="press flex items-center gap-3 px-[18px] py-2.5">
                    <Num className={cx('w-12 shrink-0 font-display text-lg2',
                      m.delta >= 0 ? 'text-ok-700' : 'text-risk-700')}>
                      {m.delta >= 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
                    </Num>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm2 text-ink-900">{m.studentName}</p>
                      <p className="mt-px truncate text-micro text-ink-500">
                        {m.reason || m.kindAr} · {relativeDay(m.on)}
                      </p>
                    </div>
                    <span className="sr-only">{pointWord(Math.abs(m.delta))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* ── باقي التنبيهات — نفس نافذة الجرس ────────────────────────────── */}
      <AlertsModal open={allOpen} onClose={() => setAllOpen(false)} />
    </div>
  );
}
