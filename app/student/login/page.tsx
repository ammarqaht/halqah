'use client';
/* طا-١ — رقم الهوية and a five-digit PIN.
   The same lattice and brand panel as the supervisor's sign-in, laid out
   vertically for a phone. */
import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { LogoFull } from '@/components/Logo';
import { Lattice } from '@/components/Lattice';
import { Btn, Field, INPUT } from '@/components/ui';
import { COPY, MOSQUE, NEIGHBOURHOOD } from '@/content/student';
import { cx } from '@/lib/cx';

function LoginScreen() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/student';
  const expired = sp.get('reason') === 'expired';

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/student/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? 'تعذّر الدخول. حاول مرة أخرى.'); setBusy(false); return; }
      router.replace(data.mustChangePin ? '/student/pin' : next);
    } catch {
      setErr('تعذّر الاتصال. تأكّد من الشبكة ثم أعد المحاولة.');
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-page">
      <Lattice />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[26rem] flex-col justify-center px-6 py-12">
        <div className="rise-flat mb-8 text-center">
          <LogoFull height={54} className="mx-auto" />
          <p className="mt-5 text-micro uppercase tracking-[.16em] text-brand-800">{COPY.portal}</p>
          <h1 className="mt-2 font-display text-d2 text-ink-900">{COPY.signInTitle}</h1>
          <p className="mt-1.5 text-panel text-ink-500">{MOSQUE} — {NEIGHBOURHOOD}</p>
        </div>

        <form onSubmit={submit} className="rise space-y-4 rounded-2xl border border-ink-150 bg-paper p-6 shadow-soft">
          {expired && !err && (
            <p className="rounded-lg border border-warn-200 bg-warn-100 px-3.5 py-2.5 text-panel text-warn-700">
              انتهت الجلسة. ادخل مرة أخرى للمتابعة.
            </p>
          )}

          <Field label={COPY.idLabel}>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              inputMode="numeric" dir="ltr" autoComplete="username" autoFocus
              className={cx(INPUT, 'text-center tracking-[.08em]')} />
          </Field>

          <Field label={COPY.pinLabel} hint={COPY.pinHint}>
            <input ref={pinRef} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric" dir="ltr" autoComplete="current-password"
              aria-label={COPY.pinLabel}
              className={cx(INPUT, 'h-14 text-center font-display text-d2 tracking-[.5em]')} />
          </Field>

          {err && (
            <p role="alert" className="rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
              {err}
            </p>
          )}

          <Btn type="submit" variant="primary" size="xl" className="w-full"
            disabled={busy || !username.trim() || pin.length !== 5}>
            {busy ? <><Loader2 size={17} className="animate-spin" />{COPY.signingIn}</> : COPY.signIn}
          </Btn>

          <p className="pt-1 text-center text-panel leading-relaxed text-ink-500">{COPY.forgot}</p>
        </form>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><LoginScreen /></Suspense>; }
