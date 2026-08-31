'use client';
/* شحن النقاط يدويًا — the approved PDF §8 (إد-٤-أ).
   Three targets, because those are the three the client actually described:
   one student he searched for, the several he ticked in the table, and a whole
   halaqa at once. The reason is required on every one of them — «لأنه هو ما
   يجعل التقارير مفيدة لاحقًا» — and deducting is the same form with the sign
   flipped, never a different, quieter path. */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { Modal, Btn, Field, INPUT, Segmented } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { Num, studentWord, pointWord } from '@/components/Num';
import { store, useDB } from '@/lib/store';
import { earnsPoints } from '@/lib/points';
import { POINT_REASONS, TRACK_AR } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

type Target = 'ONE' | 'MANY' | 'HALAQA';
type Sign = 'ADD' | 'DEDUCT';

export function GrantDialog({ open, onClose, preselected = [], defaultHalaqa = null, onDone }: {
  open: boolean;
  onClose: () => void;
  /** Ticked in the balances table. Their presence chooses the default target. */
  preselected?: string[];
  defaultHalaqa?: string | null;
  onDone?: (written: number) => void;
}) {
  const db = useDB();
  const [target, setTarget] = useState<Target>('ONE');
  const [sign, setSign] = useState<Sign>('ADD');
  const [studentId, setStudentId] = useState('');
  const [halaqaId, setHalaqaId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<string>(POINT_REASONS[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setTarget(preselected.length > 1 ? 'MANY' : 'ONE');
    setSign('ADD');
    setStudentId(preselected.length === 1 ? preselected[0] : '');
    setHalaqaId(defaultHalaqa ?? '');
    setAmount('');
    setReason(POINT_REASONS[0]);
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Talqeen students never appear as a choice. They are still counted below
     when a halaqa is picked, so the supervisor is told what was left out
     rather than quietly given a smaller result than he asked for. */
  const studentOptions = useMemo(() =>
    db.students.filter(earnsPoints).map((s) => ({
      value: s.id,
      label: s.fullName,
      hint: [s.halaqaId ? shortName(db.halaqat.find((h) => h.id === s.halaqaId)?.teacher ?? '') : 'بلا حلقة',
             s.track ? TRACK_AR[s.track] : null].filter(Boolean).join(' · '),
    })), [db.students, db.halaqat]);

  const halaqaOptions = useMemo(() =>
    db.halaqat.map((h) => ({
      value: h.id,
      label: shortName(h.teacher),
      hint: ((n) => `${n} ${studentWord(n)}`)(db.students.filter((s) => s.halaqaId === h.id && earnsPoints(s)).length),
    })), [db.halaqat, db.students]);

  const ids = useMemo(() => {
    if (target === 'ONE') return studentId ? [studentId] : [];
    if (target === 'MANY') return preselected;
    return halaqaId ? db.students.filter((s) => s.halaqaId === halaqaId).map((s) => s.id) : [];
  }, [target, studentId, preselected, halaqaId, db.students]);

  const chosen = db.students.filter((s) => ids.includes(s.id));
  const eligible = chosen.filter(earnsPoints);
  const skipped = chosen.length - eligible.length;

  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0 && eligible.length > 0 && (reason !== 'أخرى' || note.trim().length > 0);
  const delta = sign === 'ADD' ? Math.round(n) : -Math.round(n);

  const save = () => {
    if (!valid) return;
    const res = store.grantPoints({
      studentIds: ids,
      delta,
      reason: reason === 'أخرى' ? note.trim() : (note.trim() ? `${reason} — ${note.trim()}` : reason),
    });
    onDone?.(res.written);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={sign === 'ADD' ? 'شحن نقاط' : 'خصم نقاط'}
      footer={
        <>
          <Btn onClick={onClose}>إلغاء</Btn>
          <Btn variant="primary" onClick={save} disabled={!valid}>
            {sign === 'ADD' ? 'شحن' : 'خصم'}
          </Btn>
        </>
      }>
      <div className="space-y-5">

        <div className="flex flex-wrap items-center gap-3">
          <Segmented<Target> value={target} onChange={setTarget}
            options={[
              { value: 'ONE', label: 'لطالب واحد' },
              { value: 'MANY', label: 'لعدة طلاب', count: preselected.length || undefined },
              { value: 'HALAQA', label: 'لحلقة كاملة' },
            ]} />
        </div>

        {target === 'ONE' && (
          <Field label="الطالب" hint="ابحث بالاسم">
            <Combobox value={studentId} onChange={setStudentId} options={studentOptions}
              placeholder="اختر الطالب" searchPlaceholder="ابحث بالاسم…"
              emptyText="لا طالب بهذا الاسم" />
          </Field>
        )}

        {target === 'MANY' && (
          <div className="rounded-lg border border-ink-150 bg-page/50 px-3.5 py-3 text-panel text-ink-700">
            {preselected.length === 0 ? (
              <span className="text-ink-500">لم تُحدَّد أسماء بعد. علّم على الطلاب في الجدول ثم افتح هذه النافذة.</span>
            ) : (
              <>
                <Num className="font-medium text-ink-900">{preselected.length}</Num> {studentWord(preselected.length)} مُحدَّدًا:{' '}
                <span className="text-ink-600">
                  {chosen.slice(0, 4).map((s) => shortName(s.fullName)).join(' · ')}
                  {chosen.length > 4 && ` … و${chosen.length - 4} غيرهم`}
                </span>
              </>
            )}
          </div>
        )}

        {target === 'HALAQA' && (
          <Field label="الحلقة" hint="يُضاف المبلغ لكل طالب فيها">
            <Combobox value={halaqaId} onChange={setHalaqaId} options={halaqaOptions}
              placeholder="اختر الحلقة" emptyText="لا توجد حلقات" />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
          <div>
            <span className="mb-1.5 block text-xs2 font-medium text-ink-600">الحركة</span>
            <div className="inline-flex rounded-md border border-ink-200 bg-paper p-0.5">
              {([['ADD', 'إضافة', Plus], ['DEDUCT', 'خصم', Minus]] as const).map(([v, label, Ico]) => (
                <button key={v} type="button" onClick={() => setSign(v)}
                  className={cx('inline-flex h-9 items-center gap-1.5 rounded px-3.5 text-body font-medium transition-colors',
                    sign === v
                      ? (v === 'ADD' ? 'bg-ok-100 text-ok-700' : 'bg-risk-100 text-risk-700')
                      : 'text-ink-600 hover:bg-ink-100')}>
                  <Ico size={15} strokeWidth={2.2} />{label}
                </button>
              ))}
            </div>
          </div>
          <Field label="عدد النقاط">
            <input className={INPUT} inputMode="numeric" value={amount} autoFocus
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="10" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="السبب" hint="حقل إلزامي — عليه تُبنى التقارير">
            <Combobox value={reason} onChange={setReason}
              options={POINT_REASONS.map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label={reason === 'أخرى' ? 'اكتب السبب' : 'تفصيل (اختياري)'}>
            <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={reason === 'أخرى' ? 'مثال: مساعدة في تنظيم الحلقة' : 'مثال: الوسام الذهبي — المستوى ٢٦'} />
          </Field>
        </div>

        {skipped > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warn-200 bg-warn-100 px-3.5 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn-700" />
            <p className="text-panel text-warn-700">
              <Num className="font-medium">{skipped}</Num> من المحدَّدين على مسار التلقين، وهم خارج نظام النقاط،
              فلن تُسجَّل لهم حركة.
            </p>
          </div>
        )}

        {eligible.length > 0 && n > 0 && (
          <p className={cx('rounded-lg px-3.5 py-3 text-base2',
            sign === 'ADD' ? 'bg-ok-100 text-ok-700' : 'bg-risk-100 text-risk-700')}>
            {sign === 'ADD' ? 'ستُضاف ' : 'ستُخصم '}
            <Num className="font-medium">{Math.round(n)}</Num> {pointWord(Math.round(n))}{' '}
            {sign === 'ADD' ? 'لـ' : 'من'} <Num className="font-medium">{eligible.length}</Num>
            {' '}{studentWord(eligible.length)} — بمجموع{' '}
            <Num className="font-medium">{Math.abs(delta) * eligible.length}</Num> {pointWord(Math.abs(delta) * eligible.length)}.
          </p>
        )}
      </div>
    </Modal>
  );
}
