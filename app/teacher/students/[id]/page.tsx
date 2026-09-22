'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مع-٤-ب ملف الطالب من عين معلمه.

   «فائدة عملية: هذه الصفحة هي ما يفتحه المعلم حين يسأله ولي الأمر عن ابنه — وهي
   نفسها ما يُطبع في تقرير الطالب الشامل.»

   «والملف كله للعرض لا للتعديل» — so there is not one input on it. The banner at
   the top says where editing lives instead, and it is a link, because telling a
   teacher a thing exists elsewhere and making him find it are different.

   Two things are missing on purpose and both are §١٧: no behavioural or medical
   note — the column does not exist in the database either — and no guardian
   phone number. The send button opens WhatsApp at it without ever showing it.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, BookOpen, CalendarClock, ChevronRight, ClipboardCheck,
  Info, MessageSquare, Pencil, Printer,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty } from '@/components/ui';
import { HijriText, Num, juzPhrase } from '@/components/Num';
import { Ring } from '@/components/student/motion';
import { AssignmentRequest } from '@/components/teacher/AssignmentRequest';
import {
  COPY, KIND_FULL_AR, KIND_TIGHT_AR, STATUS_SHAPE, type StatusCode,
} from '@/content/teacher';
import { formatDate, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Payload = {
  student: {
    id: string; fullName: string;
    track: string | null; trackAr: string | null;
    grade: string | null; stage: string | null;
    level: number | null; ajza: number | null;
    assignmentNo: number | null; assignmentOf: number;
    awaitingExam: string | null;
    examHold: { at: string; by: string; note: string } | null;
    balance: number | null; eligibleForPoints: boolean;
    planIssuedAt: string | null; planDaysHeld: number | null; lateOnLevel: boolean;
    arrivedOn: string | null;
    ratelAttendedDays: number | null;
  };
  grid: { day: string; status: StatusCode; thobe: boolean; incomplete: boolean }[];
  absence: { streak: number; inWindow: number; flagged: boolean; days: string[] };
  recitation: {
    day: string; hijri: string; assignmentNo: number | null; level: number | null;
    incomplete: boolean; note: string; savedByName: string; savedByRole: string;
    lines: { kind: string; kindAr: string; recited: boolean; errors: number; note: string }[];
  }[];
  levels: { level: number; track: string; issuedAt: string; daysHeld: number | null; dayCount: number }[];
  exams: {
    id: string; type: string; typeAr: string; takenOn: string; level: number | null;
    ajza: number | null; errors: number | null; warnings: number | null;
    tajweedErrors: number | null; score: number | null; passed: boolean | null;
    pointsAwarded: number; examiner: string; note: string;
  }[];
  bookings: { id: string; scheduledOn: string; badge: string; level: number | null; daysAway: number }[];
  errorSpots: { surah: string; errors: number }[];
  ledger: { id: string; delta: number; kind: string; reason: string; on: string }[];
};

const CARD = 'rounded-2xl border border-ink-150 bg-paper shadow-soft';

/**
 * How much of each history sits on the screen.
 *
 * «بلوكات النقاط والاختبارات وسجل التسميع يعرضون آخر ٥ تسجيلات فقط، باقي
 * الاختبارات تعرض في طباعة التقرير» (client, 18 Sep 2026). A file that scrolls
 * for a term is a file nobody reads to the bottom; what a teacher opens this
 * page for is the last week, and the whole record is one tap away in the report.
 */
const SHOWN = 5;
/** «وسجل حركات النقاط … يعرض آخر ١٠ تحركات». */
const LEDGER_SHOWN = 10;
/**
 * وسجل التسميع أسبوعٌ واحد.
 *
 * «سجل التسميع يعرض سجل أسبوع واحد فقط» (client, 18 Sep 2026) — a WINDOW and
 * not a count, which is the right shape for this one: five entries could be
 * five days or five weeks depending on how often the boy came, and a teacher
 * opening this page is asking «كيف كان أسبوعه» rather than «ما آخر خمسة أيام
 * سجّلتها له». The rest of it is in the printed report, as before.
 */
const RECITATION_DAYS = 7;

const weekAgo = () => {
  const d = new Date(Date.now() - (RECITATION_DAYS - 1) * 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ── الجاهزية للاختبار ──────────────────────────────────────────────────────
   «عند المعلم في صفحة الاختبارات أبي يظهر زر أن الطالب مب جاهز للاختبار ويحتاج
   مراجعة، ويظهر عند المشرف والطالب ذلك» (client, 18 Sep 2026).

   The system already knew when a boy had REACHED his exam مقرّر. Whether he is
   ready to sit it is a different question, and the only person who can answer
   it hears him five afternoons a week — until now that answer travelled by
   telephone, if it travelled at all.

   A note comes with it, because «يحتاج مراجعة» on its own tells the boy nothing
   he can act on. It is optional, and it is typed on the spot rather than behind
   a dialog: one thumb, one screen.

   It gates NOTHING. The supervisor still books, still examines; he is simply
   told first — «المعلم لا يمكن أن يحدد مقرر الطالب» cuts both ways, and a
   teacher who could block a sitting would be deciding the curriculum. */
function ExamReadiness({ id, hold, onChange }: {
  id: string;
  hold: { at: string; by: string; note: string } | null;
  onChange: (next: { at: string; by: string; note: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async (on: boolean) => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/teacher/students/${id}/hold`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? 'تعذّر الحفظ.'); return; }
      onChange(j.examHold ?? null);
      setOpen(false); setNote('');
    } catch { setErr('تعذّر الاتصال. أعد المحاولة.'); }
    finally { setBusy(false); }
  };

  return (
    <section className={cx(CARD, 'rise px-[18px] py-3.5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base2 font-bold text-ink-900">الجاهزية للاختبار</h2>
          <p className="mt-1 text-xs2 leading-relaxed text-ink-500">
            {hold
              ? 'مرفوعة الآن — تظهر للمشرف وفي صفحة الطالب.'
              : 'إن رأيت أنه لا يُختبر الآن، ارفعها فيراها المشرف والطالب.'}
          </p>
        </div>
        {/* أصفر — «بلوك الجاهزية الزر اللي فيه يكون باللون الأصفر» (client,
            18 Sep 2026). It is the colour of the thing it raises: a caution,
            not a refusal, and not an ordinary grey action either. */}
        {hold ? (
          <Btn size="sm" disabled={busy} onClick={() => send(false)}>جاهز للاختبار</Btn>
        ) : (
          <Btn size="sm" icon={AlertTriangle} disabled={busy}
            className="!border-warn-200 !bg-warn-100 !text-warn-700 hover:!bg-warn-200"
            onClick={() => setOpen((o) => !o)}>يحتاج مراجعة</Btn>
        )}
      </div>

      {hold && (
        <div className="mt-2.5 rounded-xl border border-warn-200 bg-warn-100 px-3.5 py-2.5">
          <p className="text-sm2 font-medium text-warn-700">يحتاج مراجعة قبل الاختبار</p>
          {hold.note && <p className="mt-1 text-xs2 leading-relaxed text-warn-700/90">{hold.note}</p>}
          <p className="mt-1 text-micro text-ink-500">
            {hold.by} · {relativeDay(hold.at.slice(0, 10))}
          </p>
        </div>
      )}

      {open && !hold && (
        <div className="mt-2.5 space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
            placeholder="ما الذي يحتاج مراجعته؟ (اختياري)" aria-label="سبب المراجعة"
            className="h-11 w-full rounded-lg border border-ink-200 bg-paper px-3 text-sm2 text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="primary" disabled={busy} onClick={() => send(true)}>ارفعها</Btn>
            <Btn size="sm" disabled={busy} onClick={() => { setOpen(false); setNote(''); }}>إلغاء</Btn>
          </div>
        </div>
      )}

      {err && <p role="alert" className="mt-2 text-xs2 text-risk-700">{err}</p>}
    </section>
  );
}

const GRID_TONE: Record<StatusCode, string> = {
  PRESENT: 'bg-ok-200 text-ok-700',
  LATE:    'bg-warn-200 text-warn-700',
  ABSENT:  'bg-risk-200 text-risk-700',
};

export default function StudentFile() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/teacher/students/${id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.error ?? 'تعذّر تحميل الملف.'); return; }
        setD(j);
      })
      .catch(() => setErr('تعذّر الاتصال. أعد المحاولة.'));
  }, [id]);

  if (err) {
    return (
      <Sheet>
        <Empty icon={AlertTriangle} title="تعذّر التحميل" body={err}
          action={<Link href="/teacher/students"><Btn>عد إلى طلابي</Btn></Link>} />
      </Sheet>
    );
  }
  if (!d) {
    return (
      <div className="space-y-3.5">
        <div className="skel h-[150px] rounded-2xl" />
        <div className="skel h-[220px] rounded-2xl" />
      </div>
    );
  }

  const s = d.student;
  const since = weekAgo();
  const week = d.recitation.filter((r) => r.day >= since);
  const pct = s.assignmentNo != null && s.assignmentOf > 0
    ? Math.round((s.assignmentNo / s.assignmentOf) * 100) : 0;

  return (
    <div className="space-y-3.5">
      {/* «شل بلوك طباعة وإرسال، وخلّ فيه طباعة التقرير فقط أعلى الصفحة» — the
          block at the foot held two links and three chips that repeated what the
          page already said. The report is one button, where the eye starts. */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/teacher/students"
          className="press inline-flex items-center gap-1 text-panel text-ink-600">
          <ChevronRight size={15} strokeWidth={2} />طلابي
        </Link>
        <Link href={`/teacher/print/student/${id}`} target="_blank">
          <Btn size="sm" icon={Printer}>اطبع التقرير</Btn>
        </Link>
      </div>

      {/* ── البطاقة العلوية ─────────────────────────────────────────────────
          Three tiers, because it was one paragraph of six unrelated facts:
          WHO he is, WHERE he stands (the ring and the level beside it), and
          then the rest as a labelled grid — a date, a duration, a balance and a
          class are four different kinds of thing and a stack of sentences made
          the eye hunt for each one. */}
      <section className={cx(CARD, 'overflow-hidden')}>
        <div className="flex items-start justify-between gap-3 px-[18px] pt-4">
          <div className="min-w-0">
            <h1 className="font-display text-t1 leading-tight text-ink-900">{s.fullName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs2 text-ink-500">
              {s.trackAr && <span>المسار {s.trackAr}</span>}
              {s.stage && <span>· {s.stage}</span>}
              {s.grade && <span>· {s.grade}</span>}
            </p>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-1.5">
            {s.awaitingExam && <Chip tone="warn">يستحق الاختبار</Chip>}
            {s.examHold && <Chip tone="risk">يحتاج مراجعة</Chip>}
            {s.lateOnLevel && <Chip tone="ink">تأخّر على مستواه</Chip>}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 px-[18px]">
          <Ring size={92} stroke={8} pct={pct} tone="stroke-brand-700">
            <Num className="font-display text-[26px] leading-none text-ink-900">
              {s.assignmentNo ?? '—'}
            </Num>
            <span className="mt-[3px] text-2xs text-ink-500">المقرّر</span>
          </Ring>

          <div className="min-w-0 flex-1">
            <p className="font-display text-xl2 leading-snug text-ink-900">
              المستوى <Num>{s.level ?? '—'}</Num>
            </p>
            {s.ajza != null && (
              <p className="mt-0.5 text-base2 text-ink-600">{juzPhrase(s.ajza)} محفوظة</p>
            )}
            <p className="mt-1 text-xs2 text-ink-500">
              {s.assignmentNo != null && s.assignmentOf > 0
                ? <>المقرّر <Num>{s.assignmentNo}</Num> من <Num>{s.assignmentOf}</Num> في هذا المستوى</>
                : 'لم يُسجَّل له مقرّر بعد'}
            </p>
          </div>

          {/* القلم على سطر المقرّر: «الملف كله للعرض لا للتعديل» ما زالت
              قائمة — هذا لا يعدّل شيئًا، بل يكتب طلبًا إلى المشرف ويوصله. */}
          <AssignmentRequest studentId={s.id} level={s.level}
            assignmentNo={s.assignmentNo} assignmentOf={s.assignmentOf}
            eligible={s.track !== 'TALQEEN' && s.assignmentOf > 0} />
        </div>

        <dl className="mt-4 grid grid-cols-2 border-t border-ink-150 sm:grid-cols-4">
          <Fact label="سُلِّمت خطته"
            value={s.planIssuedAt ? <Num>{formatDate(s.planIssuedAt)}</Num> : '—'} />
          <Fact label="مضى عليها"
            tone={s.lateOnLevel ? 'warn' : undefined}
            value={s.planDaysHeld != null ? <><Num>{s.planDaysHeld}</Num> يومًا</> : '—'} />
          <Fact label="رصيد النقاط"
            value={s.balance != null ? <Num>{s.balance}</Num> : '—'} />
          <Fact label="أيام حلقة مسجَّلة" value={<Num>{d.grid.length}</Num>} />
        </dl>

        {s.arrivedOn && (
          <p className="border-t border-ink-150 bg-info-100/60 px-[18px] py-2.5 text-xs2 text-info-700">
            انتقل إلى حلقتك في <Num>{formatDate(s.arrivedOn)}</Num> — وما قبل ذلك
            من تاريخه معروض هنا أيضًا، مفصولًا بخطّ.
          </p>
        )}
      </section>

      {/* ── الجاهزية للاختبار ─────────────────────────────────────────────
          مسار التلقين خارج الاختبارات المستوياتية أصلًا، فلا جاهزية تُرفع. */}
      {s.track !== 'TALQEEN' && (
        <ExamReadiness id={id} hold={s.examHold}
          onChange={(next) => setD((p) => (p ? { ...p, student: { ...p.student, examHold: next } } : p))} />
      )}

      {/* ── المحجوز، إن كان ──────────────────────────────────────────────── */}
      {d.bookings.length > 0 && (
        <section className={cx(CARD, 'rise px-[18px] py-3.5')}>
          <h2 className="text-base2 font-bold text-ink-900">اختباره المحجوز</h2>
          <ul className="mt-2 space-y-1.5">
            {d.bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5 text-sm2 text-ink-800">
                <CalendarClock size={15} className="shrink-0 text-info-700" strokeWidth={1.9} />
                <span><Num>{formatDate(b.scheduledOn)}</Num></span>
                <span className="text-ink-500">
                  {b.daysAway === 0 ? '— اليوم'
                    : b.daysAway === 1 ? '— بقي عليه يوم'
                    : <>— بقي عليه <Num>{b.daysAway}</Num> يومًا</>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── شبكة الحضور ──────────────────────────────────────────────────── */}
      <section className={cx(CARD, 'rise px-[18px] py-4')}>
        <SheetHead title="شبكة الحضور"
          meta="مربّع لكل يوم حلقة سُجِّل — واليوم الذي لا حلقة فيه لا مربّع له" />

        {d.grid.length === 0 ? (
          <p className="text-sm2 text-ink-500">لم يُسجَّل له يوم بعد.</p>
        ) : (
          <>
            <div dir="ltr" className="flex flex-wrap gap-1">
              {[...d.grid].reverse().map((g) => (
                <span key={g.day} title={`${g.day}${g.thobe ? ' · ثوب' : ''}`}
                  className={cx('grid h-7 w-7 place-items-center rounded-md text-[10px] font-medium tabular-nums',
                    GRID_TONE[g.status])}>
                  {g.day.slice(8)}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-micro text-ink-500">
              {(['PRESENT', 'LATE', 'ABSENT'] as StatusCode[]).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={cx('grid h-4 w-4 place-items-center rounded text-[8px]', GRID_TONE[k])}>
                    {STATUS_SHAPE[k]}
                  </span>
                  {k === 'PRESENT' ? 'حاضر' : k === 'LATE' ? 'متأخر' : 'غائب'}
                </span>
              ))}
            </div>
          </>
        )}

        {d.absence.flagged && (
          <p className="mt-3 rounded-lg border border-risk-200 bg-risk-100 px-3 py-2 text-xs2 text-risk-700">
            غياب متكرر: <Num>{d.absence.streak}</Num> أيام حلقة متتالية،
            و<Num>{d.absence.inWindow}</Num> في آخر ثلاثين يومًا.
          </p>
        )}

        {/* رتل — labelled, and kept apart from the grid above it, because it is a
            COUNT with no dates behind it and adding the two would be arithmetic
            on two different things. */}
        {s.ratelAttendedDays != null && (
          <p className="mt-3 flex items-start gap-2 text-micro leading-relaxed text-ink-500">
            <Info size={13} className="mt-0.5 shrink-0 text-ink-400" />
            <span>
              <span className="font-medium text-ink-700">{COPY.fromRatel}:</span>{' '}
              <Num>{s.ratelAttendedDays}</Num> يومًا — {COPY.fromRatelHint}
            </span>
          </p>
        )}
      </section>

      {/* ── سجل التسميع ──────────────────────────────────────────────────── */}
      <section className={cx(CARD, 'rise overflow-hidden')}>
        <div className="px-[18px] pb-2 pt-4">
          {/* The note that used to sit under the header card said this page is
              read-only and pointed at التسجيل. It is gone: a sentence explaining
              where to go is weaker than a button that goes there. The button
              lands on وضع «فترة لطالب» with THIS boy already chosen, which is
              «المكان الوحيد للتعديل» (مع-٤-ب). */}
          {/* No subtitle — «شل النص الفرعي» (client, 18 Sep 2026): it described
              the columns that are right underneath it. And the button says
              «صحّح السجل» on ONE line, because a two-line button beside a
              one-line heading drags the whole head out of square. */}
          {/* The subtitle stays gone — it described the columns right under it.
              The window does NOT: a reader seeing two entries for a boy with a
              term behind him must be told he is looking at one week, so that is
              a chip on the title rather than a sentence under it. */}
          <SheetHead
            title={<>سجل التسميع <Chip tone="ink">أسبوعه الأخير</Chip></>}
            action={
              <Link href={`/teacher/register?mode=PERIOD&student=${id}`}>
                <Btn size="sm" icon={Pencil} className="whitespace-nowrap">
                  صحّح السجل
                </Btn>
              </Link>
            } />
        </div>

        {week.length === 0 ? (
          <div className="px-[18px] pb-4">
            <Empty icon={BookOpen}
              title={d.recitation.length === 0 ? 'لا تسميع بعد' : 'لا تسميع هذا الأسبوع'}
              body={d.recitation.length === 0 ? COPY.noRecitation
                : 'لم يُسجَّل له تسميع في الأيام السبعة الماضية. وسجلّه كاملًا في تقرير الطالب.'} />
          </div>
        ) : (
          <ul>
            {week.map((r) => (
              <li key={r.day} className="border-t border-ink-150 px-[18px] py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm2 font-medium text-ink-900">
                    <HijriText day={r.day} />
                    <span className="ms-2 text-xs2 font-normal text-ink-500">
                      <Num>{formatDate(r.day)}</Num>
                    </span>
                  </p>
                  <p className="flex items-center gap-2 text-micro text-ink-500">
                    {r.assignmentNo != null && <span>المقرّر <Num>{r.assignmentNo}</Num></span>}
                    {r.incomplete && <Chip tone="warn">ناقص</Chip>}
                    {r.savedByRole === 'SUPERVISOR' && <span>· سجّله {r.savedByName}</span>}
                  </p>
                </div>

                {/* الأسطر الثلاثة — ثلاثة مربّعات جنب بعض، كلٌّ بسطوره.
                    They were three pills on a wrapping row, so «المراجعة الكبرى
                    — لم يسمّع» wrapped to its own line on a phone and the three
                    stopped lining up with each other between one day and the
                    next. Three equal columns always answer in the same order and
                    in the same place: ما هو · سمّع أو لا · كم أخطأ. */}
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {r.lines.map((l) => (
                    <div key={l.kind}
                      className={cx('min-w-0 overflow-hidden rounded-lg border px-1.5 py-1.5 text-center',
                        l.recited ? 'border-ok-200 bg-ok-100' : 'border-ink-150 bg-ink-100')}>
                      <p className={cx('whitespace-nowrap text-[10.5px] font-medium leading-tight',
                        l.recited ? 'text-ok-700' : 'text-ink-700')}>
                        {KIND_TIGHT_AR[l.kind] ?? l.kindAr}
                      </p>
                      <p className={cx('mt-1 text-[10.5px] leading-tight',
                        l.recited ? 'text-ok-700' : 'text-ink-500')}>
                        {l.recited ? 'سمّع' : 'لم يسمّع'}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-tight text-ink-500">
                        {!l.recited ? '—'
                          : l.errors > 0
                            ? <><Num>{l.errors}</Num> خطأ</>
                            : 'بلا أخطاء'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ملاحظات المقرّرات، كلٌّ بجانب سطره — ثم ملاحظة اليوم تحتها. */}
                {r.lines.filter((l) => l.note?.trim()).map((l) => (
                  <p key={`${l.kind}-note`}
                    className="mt-1.5 flex gap-1.5 text-xs2 leading-relaxed text-ink-600">
                    <MessageSquare size={13} className="mt-0.5 shrink-0 text-ink-400" />
                    <span>
                      <span className="font-medium text-ink-700">
                        {KIND_FULL_AR[l.kind] ?? l.kindAr}:
                      </span>{' '}
                      {l.note}
                    </span>
                  </p>
                ))}

                {r.note && (
                  <p className="mt-1.5 text-xs2 leading-relaxed text-ink-600">{r.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── مواضع تكرار الخطأ ────────────────────────────────────────────── */}
      {d.errorSpots.length > 0 && (
        <section className={cx(CARD, 'rise px-[18px] py-4')}>
          <SheetHead title="مواضع تكرار الخطأ"
            meta="السور التي كثرت فيها أخطاؤه — تُجمع من خانة الأخطاء ومن سور مقرّره" />
          <ul className="space-y-1.5">
            {d.errorSpots.map((e) => (
              <li key={e.surah} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm2 text-ink-900">{e.surah}</span>
                <span className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-ink-100">
                  <span className="block h-full rounded-full bg-risk-500"
                    style={{ width: `${Math.min(100, (e.errors / d.errorSpots[0].errors) * 100)}%` }} />
                </span>
                <Num className="w-8 shrink-0 text-end text-panel font-bold tabular-nums text-ink-800">
                  {e.errors}
                </Num>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── مساره بين المستويات ──────────────────────────────────────────── */}
      {d.levels.length > 0 && (
        <section className={cx(CARD, 'rise px-[18px] py-4')}>
          <SheetHead title="مساره بين المستويات"
            meta="بتواريخها — فيُرى بالعين من أسرع ومن تعثّر" />
          <ul className="no-bar flex gap-2 overflow-x-auto pb-1">
            {d.levels.map((l) => (
              <li key={`${l.track}-${l.level}`}
                className="w-[104px] shrink-0 rounded-xl border border-ink-150 bg-page px-3 py-2.5">
                <Num className="font-display text-[22px] leading-none text-ink-900">{l.level}</Num>
                <p className="mt-1 text-micro text-ink-500"><Num>{formatDate(l.issuedAt)}</Num></p>
                {l.daysHeld != null && (
                  <p className="text-micro text-ink-400"><Num>{l.daysHeld}</Num> يومًا</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── اختباراته ────────────────────────────────────────────────────── */}
      <section className={cx(CARD, 'rise overflow-hidden')}>
        <div className="px-[18px] pb-2 pt-4">
          <SheetHead title="اختباراته"
            meta="عرضًا لا تعديلًا — الاختبار عند المشرف، وتصلك نتيجته بتفاصيلها" />
        </div>

        {d.exams.length === 0 ? (
          <div className="px-[18px] pb-4">
            <Empty icon={ClipboardCheck} title="لا اختبارات" body={COPY.noExams} />
          </div>
        ) : (
          <ul>
            {d.exams.slice(0, SHOWN).map((e) => (
              <li key={e.id} className="border-t border-ink-150 px-[18px] py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm2 font-medium text-ink-900">
                    {e.typeAr}
                    {e.level != null && <span className="ms-1.5 text-ink-500">· المستوى <Num>{e.level}</Num></span>}
                  </p>
                  <span className="flex items-center gap-2">
                    {e.score != null && (
                      <Num className="text-base2 font-bold tabular-nums text-ink-900">
                        {e.score}
                      </Num>
                    )}
                    {e.passed === true ? <Chip tone="ok">اجتاز</Chip>
                      : e.passed === false ? <Chip tone="risk">لم يجتز</Chip> : null}
                  </span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-micro text-ink-500">
                  <span><Num>{formatDate(e.takenOn)}</Num></span>
                  {e.errors != null && <span>· أخطاء <Num>{e.errors}</Num></span>}
                  {e.warnings != null && <span>· تنبيهات <Num>{e.warnings}</Num></span>}
                  {e.tajweedErrors != null && <span>· تجويد <Num>{e.tajweedErrors}</Num></span>}
                  {e.pointsAwarded > 0 && <span>· <Num>{e.pointsAwarded}</Num> نقطة</span>}
                  {e.examiner && <span>· المختبِر {e.examiner}</span>}
                </p>
                {e.note && <p className="mt-1 text-xs2 text-ink-600">{e.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── حركة نقاطه ───────────────────────────────────────────────────── */}
      {s.eligibleForPoints && d.ledger.length > 0 && (
        <section className={cx(CARD, 'rise overflow-hidden')}>
          <h2 className="px-[18px] pb-2.5 pt-4 text-base2 font-bold text-ink-900">حركة نقاطه</h2>
          <ul>
            {d.ledger.slice(0, LEDGER_SHOWN).map((m) => (
              <li key={m.id}
                className="flex items-center gap-3 border-t border-ink-150 px-[18px] py-2.5">
                <Num className={cx('w-12 shrink-0 font-display text-lg2',
                  m.delta >= 0 ? 'text-ok-700' : 'text-risk-700')}>
                  {m.delta >= 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
                </Num>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm2 text-ink-900">{m.reason || m.kind}</p>
                  <p className="mt-px text-micro text-ink-500">{relativeDay(m.on)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

/** One labelled figure in the header grid — a date, a duration, a count. */
function Fact({ label, value, tone }: {
  label: string; value: React.ReactNode; tone?: 'warn';
}) {
  return (
    <div className="border-s border-ink-150 px-3.5 py-2.5 first:border-s-0 sm:[&:nth-child(3)]:border-s">
      <dt className="text-micro text-ink-500">{label}</dt>
      <dd className={cx('mt-0.5 text-base2 font-medium',
        tone === 'warn' ? 'text-warn-700' : 'text-ink-900')}>
        {value}
      </dd>
    </div>
  );
}
