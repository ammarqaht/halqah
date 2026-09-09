'use client';
/* Change my PIN. Forced once, after the printed one.
   The PIN he was handed is written on a sheet his teacher holds; until he
   replaces it, it is not private. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Field, INPUT } from '@/components/ui';
import { useMe } from '@/components/student/Me';
import { COPY } from '@/content/student';
import { cx } from '@/lib/cx';

const PinField = ({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) => (
  <Field label={label} hint={hint}>
    <input value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
      inputMode="numeric" dir="ltr" aria-label={label}
      className={cx(INPUT, 'h-14 text-center font-display text-d2 tracking-[.5em]')} />
  </Field>
);

export default function ChangePin() {
  const { me, reload } = useMe();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ready = current.length === 5 && next.length === 5 && next === again;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setErr('');
    const res = await fetch('/api/student/pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, next }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) { setErr(data?.error ?? 'تعذّر الحفظ. أعد المحاولة.'); setBusy(false); return; }
    reload();
    router.replace('/student');
  };

  return (
    <div className="mx-auto max-w-md">
      <Sheet className="rise">
        <SheetHead title={COPY.mustChange}
          meta={me?.mustChangePin ? COPY.mustChangeWhy : 'اختر رمزًا جديدًا من خمسة أرقام'} />

        <form onSubmit={submit} className="space-y-4">
          <PinField label="الرمز الحالي" value={current} onChange={setCurrent} />
          <PinField label="الرمز الجديد" value={next} onChange={setNext}
            hint="خمسة أرقام — لا متتابعة ولا متشابهة" />
          <PinField label="أعد كتابته" value={again} onChange={setAgain}
            hint={again && next !== again ? 'الرمزان غير متطابقين' : undefined} />

          {err && (
            <p role="alert" className="rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
              {err}
            </p>
          )}

          <Btn type="submit" variant="primary" size="xl" className="w-full"
            icon={busy ? undefined : ShieldCheck} disabled={!ready || busy}>
            {busy ? <><Loader2 size={17} className="animate-spin" /> جارٍ الحفظ…</> : 'احفظ الرمز'}
          </Btn>
        </form>
      </Sheet>
    </div>
  );
}
