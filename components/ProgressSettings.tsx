'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مقرّرات الطلاب — أين وقف كل طالب في خطته.

   «المعلم لا يمكن أن يحدد مقرر الطالب … عليه التوجه إلى مشرف الحلقة» (client,
   18 Sep 2026). This is the supervisor's end of that sentence, and without it
   the teacher's «راجع المشرف» is a door with nothing behind it: not one of the
   students already halfway through a level could ever be placed, and the whole
   recitation screen would stay shut.

   REBUILT 18 Sep 2026 — «أعد تنسيقه وتصميمه من جديد، واحرص أن يطابق الهوية بكل
   تفاصيله». It was a six-column table whose مقرّر field stretched across five
   hundred pixels, because `cx(INPUT, 'w-20')` puts two utilities of equal
   specificity on one element and the winner is decided by Tailwind's emission
   order rather than by the order they were written (see `INPUT_BARE`). So the
   field was the width of a paragraph and the row read as a form, not a list.

   It is a LIST now, the shape this product uses everywhere a person is a row:
   who he is on one line, where he stands under it, and the one number that is
   being set held in a box the size of the number. The work is «ضع رقمًا لمن ليس
   له رقم», so the ones without one are gathered at the top by their own filter
   and marked in the row itself.

   Server-backed on purpose: `student_progress` never travels through the bulk
   save (see prisma/schema.prisma), so this writes straight to it rather than
   through the browser store.
   ───────────────────────────────────────────────────────────────────────── */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Award, Check, FileText, Info, Loader2, Pencil, Search, X } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty, INPUT_BARE } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num } from '@/components/Num';
import { foldArabic } from '@/lib/normalise';
import { cx } from '@/lib/cx';

type Row = {
  id: string; fullName: string; halaqaId: string | null;
  trackAr: string | null; eligible: boolean;
  level: number | null; assignmentNo: number | null; assignmentOf: number;
  awaitingExam: string | null; awaitingExamAr: string;
  setByName: string; updatedAt: string | null;
};

type Halaqa = { id: string; name: string; teacher: string };

/** طلبُ معلّمٍ على مقرّر طالب — يُقضى فيه من هنا، على الصفّ نفسه. */
type Request = {
  id: string; studentId: string; studentName: string; halaqaId: string | null;
  level: number | null; from: number | null; to: number;
  badge: string | null; badgeAr: string; note: string;
  askedByName: string; at: string;
};

export function ProgressSettingsCard() {
  return <Suspense><ProgressCard /></Suspense>;
}

function ProgressCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [halaqat, setHalaqat] = useState<Halaqa[]>([]);
  const [halaqa, setHalaqa] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [onlyUnset, setOnlyUnset] = useState(false);

  /* طلبات المعلمين. تنبيه الصفحة الأولى يصل بـ`?requests=1`، فتُفتح الشاشة
     على المصفاة نفسها — رابطٌ يقول «اعرضها» ثم يعرض كل شيء ليس رابطًا. */
  const sp = useSearchParams();
  const [requests, setRequests] = useState<Request[]>([]);
  const [onlyRequests, setOnlyRequests] = useState(() => sp.get('requests') === '1');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/progress');
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر القراءة.'); return; }
      setRows(d.students ?? []);
      setHalaqat(d.halaqat ?? []);
      setDrafts({});
      const rq = await fetch('/api/admin/assignment-requests');
      if (rq.ok) setRequests((await rq.json()).requests ?? []);
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (id: string, value: string | null) => {
    setBusy(id); setErr('');
    try {
      const r = await fetch('/api/admin/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: id, assignmentNo: value }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر الحفظ.'); return; }
      await load();
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
    finally { setBusy(''); }
  };

  /* القضاء في طلب: القبول يحرّك المؤشّر — من مسار المشرف لا من مسار المعلّم —
     والرفض يتركه كما هو. وكلاهما يُعيد القراءة، فالصفّ يقول الجديد. */
  const decide = async (id: string, approve: boolean) => {
    setBusy(id); setErr('');
    try {
      const r = await fetch('/api/admin/assignment-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, approve }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر تنفيذ الطلب.'); return; }
      await load();
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
    finally { setBusy(''); }
  };

  const requestOf = useMemo(
    () => new Map(requests.map((r) => [r.studentId, r])), [requests]);

  const shown = useMemo(() => {
    const needle = foldArabic(q.trim());
    return (rows ?? []).filter((r) => {
      if (halaqa && r.halaqaId !== halaqa) return false;
      if (needle && !foldArabic(r.fullName).includes(needle)) return false;
      if (onlyUnset && (r.assignmentNo != null || !r.eligible)) return false;
      if (onlyRequests && !requestOf.has(r.id)) return false;
      return true;
    });
  }, [rows, halaqa, q, onlyUnset, onlyRequests, requestOf]);

  const unset = (rows ?? []).filter((r) => r.eligible && r.assignmentNo == null).length;

  return (
    <Sheet className="rise mb-4">
      <SheetHead title="مقرّرات الطلاب"
        meta="أين وقف كل طالب في خطته — يحدّده المشرف وحده، ثم يتحرّك بإنجاز الدرس"
        action={<span className="flex flex-wrap items-center gap-2">
          {requests.length > 0 && (
            <Chip tone="warn">
              <Pencil size={12} strokeWidth={2.2} /><Num>{requests.length}</Num> طلب تعديل
            </Chip>
          )}
          {unset > 0
            ? <Chip tone="warn"><Num>{unset}</Num> بلا مقرّر</Chip>
            : rows ? <Chip tone="ok">الكل محدَّد</Chip> : null}
        </span>} />

      {err && (
        <p role="alert"
          className="mb-4 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
          {err}
        </p>
      )}

      {/* ── ما يُبحث فيه ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="relative min-w-[13rem] flex-1">
          <Search size={15}
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم الطالب" aria-label="ابحث باسم الطالب"
            className={cx(INPUT_BARE, 'h-10 w-full pe-9')} />
        </span>

        {/* The site's own list, not the operating system's — «قائمة تحديد
            الحلقة خلّها بتصميم الموقع وليس تصميم النظام» (client, 18 Sep 2026).
            A native `<select>` opens a Windows flyout in Windows greys with a
            Latin-first scrollbar, which is the same complaint the date field
            answered in §12.5a. `Combobox` is the control this product already
            uses everywhere else a halaqa is chosen. */}
        <div className="min-w-[11rem]">
          <Combobox value={halaqa} onChange={setHalaqa}
            placeholder="كل الحلقات" searchPlaceholder="ابحث عن حلقة"
            options={[{ value: '', label: 'كل الحلقات' },
              ...halaqat.map((h) => ({ value: h.id, label: h.name }))]} />
        </div>

        {/* A chip, not a checkbox: it is a FILTER like the two beside it, and a
            tick box among two fields reads as a setting being saved. */}
        <button type="button" onClick={() => setOnlyUnset((v) => !v)}
          aria-pressed={onlyUnset}
          className={cx('press h-10 shrink-0 rounded-md border px-3.5 text-panel font-medium transition-colors',
            onlyUnset ? 'border-warn-500 bg-warn-100 text-warn-700'
              : 'border-ink-200 bg-paper text-ink-600 hover:border-ink-300')}>
          بلا مقرّر{unset > 0 && <> · <Num>{unset}</Num></>}
        </button>

        {/* ومصفاة الطلبات بجانبها — سبعون اسمًا وثلاثة طلبات، وهذه تُظهر
            الثلاثة. */}
        {requests.length > 0 && (
          <button type="button" onClick={() => setOnlyRequests((v) => !v)}
            aria-pressed={onlyRequests}
            className={cx('press flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3.5 text-panel font-medium transition-colors',
              onlyRequests ? 'border-brand-700 bg-brand-50 text-brand-800'
                : 'border-ink-200 bg-paper text-ink-600 hover:border-ink-300')}>
            <Pencil size={14} strokeWidth={2} />
            طلبات التعديل · <Num>{requests.length}</Num>
          </button>
        )}
      </div>

      {/* ── الصفوف ───────────────────────────────────────────────────────── */}
      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-16 rounded-xl" />)}
        </div>
      ) : shown.length === 0 ? (
        <Empty icon={Search} title="لا نتائج"
          body={onlyRequests
            ? 'لا طلبات تعديل معلّقة في هذا النطاق.'
            : onlyUnset
              ? 'كل طالب في هذا النطاق له مقرّر محدَّد.'
              : 'لا طلاب مطابقون لما اخترت.'} />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-ink-150">
          {shown.map((r) => {
            const current = r.assignmentNo != null ? String(r.assignmentNo) : '';
            const draft = drafts[r.id] ?? current;
            const dirty = draft !== current;
            const missing = r.eligible && r.assignmentNo == null;
            const req = requestOf.get(r.id) ?? null;
            return (
              <li key={r.id}
                className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-150 px-4 py-3 last:border-0',
                  req ? 'bg-brand-50/60' : missing ? 'bg-warn-100/40' : 'bg-paper')}>
                {/* من هو، وأين هو */}
                <div className="min-w-[11rem] flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-body font-medium text-ink-900">
                    {r.fullName}
                    {r.awaitingExam && (
                      <Chip tone="warn">
                        <Award size={12} strokeWidth={2.2} />{r.awaitingExamAr}
                      </Chip>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-micro text-ink-500">
                    <span>{r.trackAr ?? '—'}</span>
                    {r.level != null && <span>· المستوى <Num>{r.level}</Num></span>}
                    {r.setByName && <span>· ضبطه {r.setByName}</span>}
                  </p>

                  {/* الطلب على الصفّ نفسه: ما طُلب، ومن طلبه، ولماذا — ثم
                      يُقبل أو يُرفض بلا مغادرة الشاشة. */}
                  {req && (
                    <div className="mt-2 rounded-lg border border-brand-200 bg-paper px-3 py-2.5">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-panel text-ink-800">
                        <Pencil size={13} strokeWidth={2} className="shrink-0 text-brand-700" />
                        طلب معلّمه نقله من المقرّر
                        <Num className="font-medium">{req.from ?? '—'}</Num> إلى
                        <Num className="font-medium text-brand-800">{req.to}</Num>
                        {req.badge && (
                          <Chip tone="warn"><Award size={12} strokeWidth={2.2} />{req.badgeAr}</Chip>
                        )}
                      </p>
                      {req.note && (
                        <p className="mt-1 text-micro leading-relaxed text-ink-600">«{req.note}»</p>
                      )}
                      <p className="mt-1 text-micro text-ink-500">{req.askedByName}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Btn size="sm" variant="primary" icon={Check} disabled={busy === r.id}
                          onClick={() => decide(req.id, true)}>
                          {busy === r.id ? <Loader2 size={15} className="animate-spin" /> : 'اقبله وانقله'}
                        </Btn>
                        <Btn size="sm" icon={X} disabled={busy === r.id}
                          onClick={() => decide(req.id, false)}>ارفضه</Btn>
                      </div>
                    </div>
                  )}
                </div>

                {/* الرقم، في صندوق بحجم الرقم */}
                {!r.eligible ? (
                  /* «الطالب الذي لا يملك خطة يظهر عنده زرّ صدّر خطته، وينقله إلى
                     صفحة التصدير مباشرة بتحديد اسمه» (client, 18 Sep 2026).
                     Saying «لم تُصدر خطته» and leaving him to find the plans
                     screen and the name again is a signpost; this is the door.
                     A talqeen boy has no plan to issue at all — «لا مستوى له ولا
                     منهج» — so he keeps the sentence. */
                  r.trackAr === 'تلقين' ? (
                    <span className="text-panel text-ink-400">التلقين بلا خطة</span>
                  ) : (
                    <Link href={`/admin/plans?student=${r.id}`} className="shrink-0">
                      <Btn size="sm" icon={FileText}>صدّر خطته</Btn>
                    </Link>
                  )
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="flex items-center gap-1.5">
                      <input inputMode="numeric" value={draft}
                        aria-label={`مقرّر ${r.fullName}`}
                        placeholder="—"
                        onChange={(e) => setDrafts((d) => ({
                          ...d, [r.id]: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                        className={cx(INPUT_BARE, 'h-10 w-16 px-0 text-center text-body tabular-nums',
                          dirty && 'border-brand-700 bg-brand-50')} />
                      <span className="whitespace-nowrap text-micro text-ink-500">
                        {r.assignmentOf > 0 ? <>من <Num>{r.assignmentOf}</Num></> : 'المقرّر'}
                      </span>
                    </span>

                    <span className="flex gap-1.5">
                      <Btn size="sm" variant={dirty ? 'primary' : 'default'}
                        icon={busy === r.id ? undefined : Check}
                        disabled={!dirty || busy === r.id}
                        onClick={() => save(r.id, draft || null)}>
                        {busy === r.id ? <Loader2 size={15} className="animate-spin" /> : 'احفظ'}
                      </Btn>
                      {r.assignmentNo != null && (
                        <Btn size="sm" icon={X} disabled={busy === r.id}
                          aria-label={`امسح مقرّر ${r.fullName}`}
                          onClick={() => save(r.id, null)}>
                          امسحه
                        </Btn>
                      )}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-info-100 px-3.5 py-3 text-panel leading-relaxed text-info-700">
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>
          الرقم هو المقرّر المطلوب من الطالب <strong>اليوم</strong>، لا آخر ما سمّعه.
          ومَن وضعتَه على مقرّر اختبار (١٢ أو ٢٤ في الخطة المعتادة) يقف عنده حتى
          تُسجَّل نتيجته، تمامًا كما لو بلغه بتسميعه. وبطاقته عند معلمه تبقى مغلقة على
          الحضور والثوب حتى يُحدَّد رقمه من هنا.
        </span>
      </p>
    </Sheet>
  );
}
