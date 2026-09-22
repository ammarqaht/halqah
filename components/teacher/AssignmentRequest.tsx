'use client';
/* طلب تعديل مقرّر — من بطاقة الطالب عند معلّمه.
 *
 * «المعلم لا يمكن أن يحدد مقرر الطالب … عليه التوجه إلى مشرف الحلقة» (العميل،
 * ١٨ سبتمبر ٢٠٢٦). والقاعدة باقية: لا شيء هنا يحرّك المؤشّر. ما يفعله القلم
 * أنه يكتب الطلب ويوصله — وكان قبله مكالمةً أو ورقةً في جيب.
 *
 * والنافذة تعرض الثلاثة معًا: مستواه، ومقرّره الآن، والمقرّر المطلوب — لأن
 * «انقله إلى ١٤» جملةٌ لا تُفهم وحدها، ولا تُراجَع وحدها.
 *
 * ومقرّرا الوسام (١٢ و٢٤ في الخطة المعتادة) يُسمّيان في القائمة بأسمائهما، فمن
 * أراد أن يقول «عنده وسام» يقوله باختيار يومه لا بخانة ثانية يملؤها.
 */
import { useEffect, useState } from 'react';
import { Award, Loader2, Pencil, Send, X } from 'lucide-react';
import { Btn, Chip, Modal } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num } from '@/components/Num';
import { relativeDay } from '@/lib/dates';

export type Pending = {
  id: string; from: number | null; to: number; badge: string | null;
  note: string; askedByName: string; level: number | null; at: string;
};

const BADGE_AR: Record<string, string> = {
  BADGE_GOLDEN: 'الوسام الذهبي', BADGE_DIAMOND: 'الوسام الماسي',
};

/** مقرّرا الوسام في الخطة المعتادة — ٢٤ يومًا، والاختباران في نصفها وآخرها. */
const BADGE_AT: Record<number, string> = { 12: 'BADGE_GOLDEN', 24: 'BADGE_DIAMOND' };

export function AssignmentRequest({
  studentId, level, assignmentNo, assignmentOf, eligible,
}: {
  studentId: string;
  level: number | null;
  assignmentNo: number | null;
  assignmentOf: number;
  /** التلقين بلا مقرّر، ومن لا خطة له لا رقم يُطلب له. */
  eligible: boolean;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!eligible) return;
    fetch(`/api/teacher/students/${studentId}/assignment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setPending(j.pending ?? null); })
      .catch(() => { /* القلم يبقى، والطلب يُعاد */ });
  }, [studentId, eligible]);

  if (!eligible) return null;

  const count = assignmentOf > 0 ? assignmentOf : 24;
  const options = Array.from({ length: count }, (_, i) => i + 1).map((n) => ({
    value: String(n),
    label: `المقرّر ${n}`,
    hint: BADGE_AT[n] ? BADGE_AR[BADGE_AT[n]] : (n === assignmentNo ? 'مقرّره الآن' : undefined),
  }));

  const send = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/teacher/students/${studentId}/assignment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toAssignmentNo: Number(to), note }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? 'تعذّر إرسال الطلب.'); return; }
      setPending(j.pending ?? null);
      setOpen(false); setTo(''); setNote('');
    } catch { setErr('تعذّر الاتصال. أعد المحاولة.'); }
    finally { setBusy(false); }
  };

  const withdraw = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/teacher/students/${studentId}/assignment`, { method: 'DELETE' });
      if (!r.ok) { setErr('تعذّر سحب الطلب.'); return; }
      setPending(null);
      setOpen(false);
    } catch { setErr('تعذّر الاتصال. أعد المحاولة.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      {/* القلم على سطر المقرّر نفسه — حيث يقرأ الرقم يطلب تغييره. */}
      <button type="button" onClick={() => { setOpen(true); setErr(''); }}
        aria-label="اطلب تعديل مقرّره"
        title={pending ? 'طلبك قيد المراجعة' : 'اطلب تعديل مقرّره'}
        className="press grid h-9 w-9 shrink-0 place-items-center self-start rounded-lg border border-ink-150 text-ink-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
        <Pencil size={15} strokeWidth={1.9} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="طلب تعديل مقرّر طالب"
        footer={pending ? <>
          <Btn onClick={() => setOpen(false)}>إغلاق</Btn>
          <Btn variant="danger" icon={X} disabled={busy} onClick={withdraw}>اسحب الطلب</Btn>
        </> : <>
          <Btn onClick={() => setOpen(false)}>تراجع</Btn>
          <Btn variant="primary" icon={busy ? undefined : Send} disabled={busy || !to}
            onClick={send}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'أرسل الطلب للمشرف'}
          </Btn>
        </>}>

        {pending ? (
          /* طلبٌ قائم: لا يُفتح طلبان على اسم واحد، فيُعرض ما طُلب ويُسحب إن شاء. */
          <div className="space-y-3">
            <p className="text-base2 text-ink-700">طلبك مرفوع إلى المشرف، ولم يُقضَ فيه بعد.</p>
            <div className="rounded-xl border border-warn-200 bg-warn-100/60 px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 text-base2 font-medium text-warn-700">
                من المقرّر <Num>{pending.from ?? '—'}</Num> إلى <Num>{pending.to}</Num>
                {pending.badge && (
                  <Chip tone="warn"><Award size={12} strokeWidth={2.2} />{BADGE_AR[pending.badge]}</Chip>
                )}
              </p>
              {pending.note && (
                <p className="mt-1 text-xs2 leading-relaxed text-warn-700/90">«{pending.note}»</p>
              )}
              <p className="mt-1 text-micro text-ink-500">
                {pending.askedByName} · {relativeDay(pending.at.slice(0, 10))}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base2 leading-relaxed text-ink-700">
              المقرّر يحدّده المشرف وحده. اكتب ما تراه هنا فيصله، ويتحرّك المؤشّر
              متى قبِله.
            </p>

            <p className="rounded-lg bg-page px-3.5 py-2.5 text-base2 text-ink-700">
              المستوى <span className="font-medium text-ink-900"><Num>{level ?? '—'}</Num></span>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs2 font-medium text-ink-600">المقرّر الحالي</span>
                <p className="flex h-11 items-center rounded-md border border-ink-200 bg-page px-3.5 text-base2 text-ink-700">
                  {assignmentNo != null
                    ? <>المقرّر <Num className="mx-1 font-medium text-ink-900">{assignmentNo}</Num>
                        {assignmentOf > 0 && <span className="text-ink-500">من <Num>{assignmentOf}</Num></span>}</>
                    : <span className="text-ink-400">لم يُسجَّل له مقرّر</span>}
                </p>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs2 font-medium text-ink-600">المقرّر المطلوب</span>
                <Combobox value={to} onChange={setTo} options={options}
                  placeholder="اختر المقرّر" searchPlaceholder="اكتب رقم المقرّر…" />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs2 font-medium text-ink-600">سببه (اختياري)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
                placeholder="مثال: أتمّ مراجعة ما قبله، أو اجتاز وسامه"
                className="h-11 w-full rounded-md border border-ink-200 bg-paper px-3.5 text-base2 text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
            </label>
          </div>
        )}

        {err && <p role="alert" className="mt-3 text-xs2 text-risk-700">{err}</p>}
      </Modal>
    </>
  );
}
