'use client';
/* «وكلمة مرور يعيّنها المشرف ويغيّرها المعلم في أول دخول» (§٦).

   He lands here from sign-in when his password is still the one he was handed,
   rather than being dropped into the portal to find this screen on his own —
   a first-use change nobody is sent to is a first-use change nobody makes.

   It is reachable afterwards too, from the same address, because «تغيير كلمة
   مروره» is on his own list of things he may do. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Field, INPUT } from '@/components/ui';
import { PASSWORD_MIN } from '@/content/teacher';
import { cx } from '@/lib/cx';

export default function TeacherPassword() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < PASSWORD_MIN;
  const mismatch = again.length > 0 && again !== next;
  const ready = current.length > 0 && next.length >= PASSWORD_MIN && again === next;

  const go = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/teacher/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? 'تعذّر التغيير.'); setBusy(false); return; }
      setDone(true);
      setTimeout(() => router.replace('/teacher'), 900);
    } catch {
      setErr('تعذّر الاتصال. أعد المحاولة.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[30rem]">
      <Sheet>
        <SheetHead title="كلمة المرور"
          meta="تغيّرها أنت، ولا يعرفها أحد بعدها — والمشرف يعيد تعيينها إن نسيتها" />

        {done ? (
          <p className="mt-5 flex items-center gap-2 rounded-lg border border-ok-200 bg-ok-100 px-4 py-3 text-base2 text-ok-700">
            <Check size={17} strokeWidth={2.2} />تغيّرت كلمة مرورك.
          </p>
        ) : (
          <form className="mt-5 space-y-5"
            onSubmit={(e) => { e.preventDefault(); void go(); }}>
            <Field label="كلمة المرور الحالية"
              hint="التي عيّنها لك المشرف، أو التي تستعملها الآن" htmlFor="cur">
              <input id="cur" type="password" value={current} autoComplete="current-password"
                onChange={(e) => setCurrent(e.target.value)} className={INPUT} />
            </Field>

            <Field label="كلمة المرور الجديدة"
              hint={`${PASSWORD_MIN} أحرف على الأقل`} htmlFor="new">
              <input id="new" type="password" value={next} autoComplete="new-password"
                onChange={(e) => setNext(e.target.value)}
                className={cx(INPUT, tooShort && 'border-risk-500')} />
            </Field>

            <Field label="أعدها مرة أخرى" htmlFor="again">
              <input id="again" type="password" value={again} autoComplete="new-password"
                onChange={(e) => setAgain(e.target.value)}
                className={cx(INPUT, mismatch && 'border-risk-500')} />
            </Field>

            {(tooShort || mismatch || err) && (
              <p role="alert"
                className="rounded-lg border border-risk-200 bg-risk-100 px-4 py-3 text-sm2 text-risk-700">
                {err || (mismatch ? 'الكلمتان غير متطابقتين.'
                  : `كلمة المرور ${PASSWORD_MIN} أحرف على الأقل.`)}
              </p>
            )}

            <Btn type="submit" variant="primary" size="lg" icon={KeyRound}
              disabled={!ready || busy} className="w-full">
              {busy ? <><Loader2 size={17} className="animate-spin" />يُحفظ…</> : 'غيّر كلمة المرور'}
            </Btn>

            <p className="flex items-start gap-2 text-xs2 leading-relaxed text-ink-500">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ink-400" />
              بوابتك تحمل سجّل حلقتك كلها — مستويات طلابك وحضورهم ونتائجهم. فاختر
              كلمة لا تُخمَّن، ولا تكتبها على جهاز مشترك.
            </p>
          </form>
        )}
      </Sheet>
    </div>
  );
}
