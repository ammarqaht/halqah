'use client';
/* تقرير الفترة — what happened between two dates, mosque-wide and then halaqa
   by halaqa. `?from=YYYY-MM-DD&to=YYYY-MM-DD`, either bound optional.

   «كل حلقة بلحالها بس مجمّعة في ملف واحد حتى لو أكثر من صفحة … ولحق الفترة
   غلاف» (client, 11 Oct 2026). So: a cover; one overview page for the whole
   mosque; then every halaqa on pages of its own, numbered like the chapters of
   the reference report — its figures, its boys one per row, and its exams.

   Laid out by components/print/Paged: real A4 pages on screen, each with its
   running head and page number, so the preview IS the print.

   Attendance and recitation come from the teachers' register
   (/api/admin/attendance), never from an imported file. Exams, levels and
   points come from the store. */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { LogoFull, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits } from '@/components/Num';
import { useDB } from '@/lib/store';
import { EXAM_TYPE_AR, type ExamType } from '@/lib/points';
import { shortName } from '@/lib/normalise';
import { formatDate } from '@/lib/dates';
import { TRACK_AR } from '@/lib/types';
import { EMPTY_ATTENDANCE, type Attendance } from '@/lib/attendance';
import { useAttendance } from '@/components/useAttendance';
import { useParts } from '@/lib/reportParts';
import {
  PagedDoc, SecHead, Kpi, Kpis, Card, Bar, TableTitle, type Block,
} from '@/components/print/Paged';

const EXAM_ORDER: ExamType[] = ['BADGE_GOLDEN', 'BADGE_DIAMOND', 'ASSOCIATION', 'TAJWEED', 'MOCK'];
const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** «١١ أكتوبر ٢٠٢٦» — how a date is said on a cover. */
const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toArabicDigits(`${d} ${MONTH_AR[m - 1] ?? ''} ${y}`);
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const n = (v: number) => <Num>{toArabicDigits(v)}</Num>;
const pc = (v: number | null) => (v == null ? <span className="pd-mut">—</span> : <Num>{toArabicDigits(v)}٪</Num>);

/** Several boys' register summaries added up — every afternoon counts once. */
function addUp(list: Attendance[]) {
  const t = { recorded: 0, attended: 0, late: 0, absent: 0, recitedDays: 0, lines: 0, errors: 0 };
  for (const a of list) {
    t.recorded += a.recorded; t.attended += a.attended; t.late += a.late; t.absent += a.absent;
    t.recitedDays += a.recitedDays; t.lines += a.lines; t.errors += a.errors;
  }
  return t;
}

function PeriodReport() {
  const show = useParts('period');
  const db = useDB();
  const sp = useSearchParams();
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  const att = useAttendance({ from: from || null, to: to || null });
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);

  const exams = useMemo(() => db.exams.filter((e) => inRange(e.takenOn))
    .sort((a, b) => (a.takenOn < b.takenOn ? 1 : -1)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [db.exams, from, to]);
  const txns = useMemo(() => db.txns.filter((t) => inRange(t.createdAt.slice(0, 10))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [db.txns, from, to]);

  const granted = txns.filter((t) => t.delta > 0).reduce((s, t) => s + t.delta, 0);
  const spent = txns.filter((t) => t.delta < 0).reduce((s, t) => s - t.delta, 0);
  const passed = exams.filter((e) => e.passed === true).length;

  /* Each halaqa with its boys, their register, their exams and their points. */
  const halaqat = useMemo(() => {
    const grantedBy = new Map<string, number>();
    for (const t of txns) if (t.delta > 0) grantedBy.set(t.studentId, (grantedBy.get(t.studentId) ?? 0) + t.delta);
    return [...db.halaqat]
      .sort((a, b) => a.teacher.localeCompare(b.teacher, 'ar'))
      .map((h) => {
        const boys = db.students
          .filter((s) => s.halaqaId === h.id && s.status === 'ACTIVE')
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
        const sum = addUp(boys.map((s) => att?.students[s.id] ?? EMPTY_ATTENDANCE));
        const hx = exams.filter((e) => e.halaqaId === h.id);
        return {
          h, boys, sum, exams: hx,
          passed: hx.filter((e) => e.passed === true).length,
          points: boys.reduce((s, b) => s + (grantedBy.get(b.id) ?? 0), 0),
          grantedBy,
        };
      })
      .filter((x) => x.boys.length > 0 || x.exams.length > 0);
  }, [db.halaqat, db.students, att, exams, txns]);

  const total = att?.total;
  const recitedRate = total ? pct(total.recitedDays, total.attended) : null;
  const boysCount = halaqat.reduce((s, x) => s + x.boys.length, 0);

  const span = from && to ? `${longDate(from)} — ${longDate(to)}`
    : from ? `منذ ${longDate(from)}` : to ? `حتى ${longDate(to)}` : 'المدة كاملة';

  /* ── the cover ───────────────────────────────────────────────────────── */
  const cover = (
    <>
      <div className="mt-[22mm] rounded-[3mm] border-[1.2mm] border-[color:var(--pd-gold)] bg-[var(--pd-paper)] px-[9mm] py-[6mm]">
        <LogoFull height={92} />
      </div>
      <p className="mt-[30mm] text-[10pt] font-bold text-[var(--pd-gold-l)]">تقرير الإدارة</p>
      <h1 className="mt-[3mm] font-display text-[40pt] font-bold leading-[1.15]">تقرير الفترة</h1>
      <p className="mt-[6mm] font-display text-[19pt] font-bold text-[var(--pd-gold-l)]"><Num>{span}</Num></p>
      <p className="mt-[5mm] max-w-[140mm] text-[10.5pt] text-white/80">
        الحضور والتسميع والاختبارات والنقاط — لمجموع الحلقات، ثم لكل حلقة على حدة.
      </p>
      <div className="mt-[18mm] grid w-[170mm] grid-cols-4 border-y border-white/15">
        {([
          [n(halaqat.length), 'حلقات'],
          [n(boysCount), 'طالبًا'],
          [pc(total && total.recorded ? total.rate : null), 'نسبة الحضور'],
          [<>{n(passed)}<span className="text-[13pt] text-white/60">/{toArabicDigits(exams.length)}</span></>, 'اختبارًا مجتازًا'],
        ] as const).map(([v, l], i) => (
          <div key={i} className="border-white/15 py-[5mm] [&:not(:last-child)]:border-e">
            <p className="font-display text-[22pt] font-bold leading-none">{v}</p>
            <p className="mt-[2mm] text-[8.5pt] text-white/70">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto mb-[16mm] flex flex-col items-center gap-[3mm]">
        <div className="rounded-[2.5mm] border border-[color:var(--pd-gold)] px-[9mm] py-[3.5mm]">
          <p className="text-[8pt] font-bold text-[var(--pd-gold-l)]">حلقات جامع محمد العبدالكريم — حي أُحد</p>
          <div className="mt-[2mm] flex justify-center"><LogoJamiyah height={30} white /></div>
        </div>
        <p className="text-[7.5pt] text-white/55">طُبع في <Num>{longDate(new Date().toISOString().slice(0, 10))}</Num></p>
      </div>
    </>
  );

  /* ── the overview ────────────────────────────────────────────────────── */
  const blocks: Block[] = [];
  const S0 = 'النظرة العامة';

  if (show('summary') || show('attendance') || show('exams') || show('points')) {
    blocks.push({
      key: 'ov-head', section: S0,
      node: <SecHead kicker={S0} title="الفترة في أرقام"
        lead={<>
          {total && total.recorded > 0
            ? <>سجّل المعلمون {n(total.recorded)} حضورًا في الفترة، حضر منها الطلاب {pc(total.rate)}، وسمّعوا في {pc(recitedRate)} من أيام حضورهم. </>
            : <>لم يُسجَّل حضور في هذه الفترة بعد. </>}
          {exams.length > 0 && <>وأُجري {n(exams.length)} اختبارًا اجتاز منها {n(passed)}.</>}
        </>} />,
    });
  }

  if (show('summary')) {
    blocks.push({
      key: 'ov-kpis',
      node: (
        <Kpis>
          <Kpi tone="teal" value={pc(total && total.recorded ? total.rate : null)} label="نسبة الحضور"
            note={total ? <>{n(total.attended)} من {n(total.recorded)} تسجيلًا</> : undefined} />
          <Kpi tone="deep" value={pc(recitedRate)} label="أيام التسميع"
            note={total ? <>{n(total.lines)} سطرًا · {n(total.errors)} خطأ</> : undefined} />
          <Kpi tone="gold" value={n(passed)} of={toArabicDigits(exams.length)} label="اختبارات مجتازة"
            note="من كل ما أُجري في الفترة" />
          <Kpi tone="sand" value={n(granted)} label="نقاط مُنحت"
            note={<>صُرف منها {n(spent)} نقطة</>} />
        </Kpis>
      ),
    });
  }

  if (show('attendance') && halaqat.length > 0) {
    const byAtt = [...halaqat].sort((a, b) =>
      (pct(b.sum.attended, b.sum.recorded) ?? -1) - (pct(a.sum.attended, a.sum.recorded) ?? -1));
    const byRec = [...halaqat].sort((a, b) =>
      (pct(b.sum.recitedDays, b.sum.attended) ?? -1) - (pct(a.sum.recitedDays, a.sum.attended) ?? -1));
    blocks.push({
      key: 'ov-rank',
      node: (
        <div className="pd-grid2">
          <Card title="ترتيب الحلقات حسب الحضور" meta="نسبة الحضور من كل ما سجّله المعلم في الفترة">
            {byAtt.map((x) => {
              const v = pct(x.sum.attended, x.sum.recorded);
              return <Bar key={x.h.id} label={shortName(x.h.teacher)} value={v} figure={pc(v)} tone="teal" />;
            })}
          </Card>
          <Card title="ترتيب الحلقات حسب التسميع" meta="أيام سمّع فيها الطالب من أيام حضوره">
            {byRec.map((x) => {
              const v = pct(x.sum.recitedDays, x.sum.attended);
              return <Bar key={x.h.id} label={shortName(x.h.teacher)} value={v} figure={pc(v)} tone="deep" />;
            })}
          </Card>
        </div>
      ),
    });
  }

  if (show('exams') && exams.length > 0) {
    blocks.push({
      key: 'ov-exams',
      node: (
        <Card title="الاختبارات حسب النوع" meta="المجتاز من كل ما أُجري — في الفترة كلها">
          {EXAM_ORDER.map((t) => {
            const all = exams.filter((e) => e.type === t);
            if (!all.length) return null;
            const ok = all.filter((e) => e.passed === true).length;
            return <Bar key={t} label={EXAM_TYPE_AR[t]} value={pct(ok, all.length)} tone="gold"
              figure={<>{n(ok)} <span className="pd-mut">من {toArabicDigits(all.length)}</span></>} />;
          })}
        </Card>
      ),
    });
  }

  /* ── halaqa by halaqa ────────────────────────────────────────────────── */
  if (show('halaqat')) {
    halaqat.forEach((x, i) => {
      const label = `حلقة ${shortName(x.h.teacher)}`;
      const attR = pct(x.sum.attended, x.sum.recorded);
      const recR = pct(x.sum.recitedDays, x.sum.attended);
      blocks.push({
        key: `h${x.h.id}-head`, section: label, newPage: true,
        node: <SecHead num={i + 1} kicker="الحلقات" title={label}
          lead={<>{x.h.timeSlot ? `${x.h.timeSlot} · ` : ''}{n(x.boys.length)} طالبًا · {n(x.sum.recorded)} تسجيلًا في الفترة</>} />,
      });
      blocks.push({
        key: `h${x.h.id}-kpis`,
        node: (
          <Kpis>
            <Kpi tone="teal" value={pc(attR)} label="الحضور"
              note={<>{n(x.sum.attended)} من {n(x.sum.recorded)} · تأخر {n(x.sum.late)}</>} />
            <Kpi tone="deep" value={pc(recR)} label="التسميع"
              note={<>{n(x.sum.lines)} سطرًا · {n(x.sum.errors)} خطأ</>} />
            <Kpi tone="gold" value={n(x.passed)} of={toArabicDigits(x.exams.length)} label="اختبارات مجتازة" />
            <Kpi tone="sand" value={n(x.points)} label="نقاط مُنحت" note="لطلاب الحلقة في الفترة" />
          </Kpis>
        ),
      });

      if (x.boys.length) {
        blocks.push({
          key: `h${x.h.id}-boys`,
          table: {
            title: <TableTitle meta="الحضور والتسميع من سجلّ المعلم · الاختبارات في الفترة · ▲ غاب أكثر من يومين">الطلاب</TableTitle>,
            cols: ['6%', '30%', '11%', '11%', '7%', '7%', '9%', '7%', '12%'],
            head: (
              <tr>
                {['#', 'الطالب', 'المستوى', 'الحضور', 'تأخر', 'غياب', 'التسميع', 'أخطاء', 'الاختبارات']
                  .map((c) => <th key={c}>{c}</th>)}
              </tr>
            ),
            rows: x.boys.map((s, k) => {
              const a = att?.students[s.id] ?? EMPTY_ATTENDANCE;
              const se = x.exams.filter((e) => e.studentId === s.id);
              const sp = se.filter((e) => e.passed === true).length;
              return (
                <tr key={s.id}>
                  <td>{n(k + 1)}</td>
                  <td className="s">{s.fullName}</td>
                  <td>{s.track ? <>{TRACK_AR[s.track]}{s.track !== 'TALQEEN' && s.currentLevel != null && <> {n(s.currentLevel)}</>}</> : '—'}</td>
                  <td>{a.recorded ? <>{n(a.attended)}<span className="pd-mut">/{toArabicDigits(a.recorded)}</span></> : <span className="pd-mut">—</span>}</td>
                  <td>{a.recorded ? n(a.late) : ''}</td>
                  {/* Shape as well as colour: «▲» survives a greyscale copier. */}
                  <td className={a.absent > 2 ? 'pd-neg' : undefined}>{a.recorded ? <>{a.absent > 2 && '▲ '}{n(a.absent)}</> : ''}</td>
                  <td>{a.recorded ? n(a.recitedDays) : ''}</td>
                  <td>{a.recorded ? n(a.errors) : ''}</td>
                  <td>{se.length ? <><span className={sp ? 'pd-pos' : undefined}>{n(sp)}</span><span className="pd-mut">/{toArabicDigits(se.length)}</span></> : ''}</td>
                </tr>
              );
            }),
          },
        });
      }

      if (show('list') && x.exams.length) {
        blocks.push({
          key: `h${x.h.id}-exams`,
          table: {
            title: <TableTitle meta="الأحدث أولًا">اختبارات الحلقة في الفترة</TableTitle>,
            cols: ['14%', '36%', '18%', '10%', '10%', '12%'],
            head: <tr>{['التاريخ', 'الطالب', 'النوع', 'المستوى', 'الدرجة', 'النتيجة'].map((c) => <th key={c}>{c}</th>)}</tr>,
            rows: x.exams.map((e) => (
              <tr key={e.id}>
                <td><Num>{toArabicDigits(formatDate(e.takenOn))}</Num></td>
                <td className="s">{db.students.find((s) => s.id === e.studentId)?.fullName ?? '—'}</td>
                <td>{EXAM_TYPE_AR[e.type as ExamType] ?? e.type}</td>
                <td>{e.level == null ? '—' : n(e.level)}</td>
                <td>{e.score == null ? '—' : n(e.score)}</td>
                <td className={e.passed === true ? 'pd-pos' : e.passed === false ? 'pd-neg' : undefined}>
                  {e.passed == null ? '—' : e.passed ? 'اجتاز' : 'لم يجتز'}
                </td>
              </tr>
            )),
          },
        });
      }
    });
  }

  if (!blocks.length) {
    blocks.push({ key: 'empty', section: S0,
      node: <p className="py-16 text-center text-[11pt] text-[var(--pd-mut)]">لم يُختر شيء للطباعة.</p> });
  }

  return (
    <PagedDoc title="تقرير الفترة" cover={cover} blocks={blocks}
      deps={[att, exams, txns, halaqat, sp.toString()]} />
  );
}

export default function Page() { return <Suspense><PeriodReport /></Suspense>; }
