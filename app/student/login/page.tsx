'use client';
/* طا-١ — بوابة الطالب.
   Built for a phone first, because that is what a boy has in a mosque: the
   brand panel is a band across the top on a small screen and the whole start
   half on a laptop, and the form never moves from under his thumb.

   Sign-in is a four-digit LOGIN NUMBER and his own national id. Nothing to
   memorise and nothing to lose: the number is on the sheet his teacher holds,
   and the id is a thing he already knows.

   The number is four boxes rather than one field. He is reading it off paper,
   and one box per digit is the difference between keeping his place and
   starting over. */
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { LogoFull, LogoJamiyah } from '@/components/Logo';
import { Lattice } from '@/components/Lattice';
import { Btn, Field, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { PinInput } from '@/components/student/PinInput';
import { COPY, MOSQUE, NEIGHBOURHOOD } from '@/content/student';
import { cx } from '@/lib/cx';

function LoginScreen() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/student';
  const expired = sp.get('reason') === 'expired';

  const [loginId, setLoginId] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ready = loginId.length === 4 && nationalId.replace(/\D/g, '').length >= 4;

  const go = async () => {
    if (busy || !ready) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/student/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginId, pin: nationalId.replace(/\D/g, '') }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? 'تعذّر الدخول. حاول مرة أخرى.'); setBusy(false); return; }
      router.replace(next);
    } catch {
      setErr('تعذّر الاتصال. تأكّد من الشبكة ثم أعد المحاولة.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-page md:grid md:min-h-screen md:grid-cols-[1fr_minmax(26rem,34rem)]">
      {/* the brand field — a band on a phone, the whole start half on a laptop */}
      <aside className="relative overflow-hidden bg-brand-900 px-6 py-9 md:flex md:flex-col md:justify-between md:px-12 md:py-14">
        <Lattice />
        <div className="relative flex items-center justify-between gap-4">
          <LogoFull height={40} white className="md:h-[52px]" />
          <LogoJamiyah height={34} className="opacity-90 md:h-[44px]" />
        </div>

        <div className="relative mt-8 md:mt-0">
          <p
            className="font-display text-xl2 leading-[1.9] text-white/95 md:text-d2"
            style={{ fontFeatureSettings: '"ss01"' }}>
            وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ
          </p>
          <p className="mt-3 text-panel text-brand-200">سورة القمر — الآية <Num>١٧</Num></p>
        </div>

        <div className="relative mt-8 hidden border-t border-white/12 pt-6 md:block">
          <p className="text-micro uppercase tracking-[.16em] text-brand-200">{COPY.portal}</p>
          <p className="mt-1.5 text-base2 text-white/90">{MOSQUE} — {NEIGHBOURHOOD}</p>
        </div>
      </aside>

      {/* the form */}
      <main className="flex items-center px-5 py-10 md:px-10">
        <div className="mx-auto w-full max-w-[24rem]">
          <p className="text-micro uppercase tracking-[.16em] text-brand-800">{COPY.portal}</p>
          <h1 className="mt-2 font-display text-d2 text-ink-900">{COPY.signInTitle}</h1>
          <p className="mt-1.5 text-base2 text-ink-500">
            رقم دخولك من معلّمك، وكلمة المرور رقم هويتك.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); go(); }} className="mt-7 space-y-5">
            <div>
              <span className="mb-2 block text-xs2 font-medium text-ink-700">{COPY.idLabel}</span>
              <PinInput value={loginId} onChange={setLoginId} length={4} autoFocus
                label={COPY.idLabel} />
              <span className="mt-2 block text-center text-micro text-ink-500">{COPY.idHint}</span>
            </div>

            <Field label={COPY.pinLabel} hint={COPY.pinHint}>
              <input value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                inputMode="numeric" dir="ltr" autoComplete="current-password"
                aria-label={COPY.pinLabel}
                className={cx(INPUT, 'h-14 text-center text-lg2 tracking-[.10em]')} />
            </Field>

            {expired && !err && (
              <p className="rounded-lg border border-warn-200 bg-warn-100 px-3.5 py-2.5 text-panel text-warn-700">
                انتهت الجلسة. ادخل مرة أخرى للمتابعة.
              </p>
            )}
            {err && (
              <p role="alert" className="rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
                {err}
              </p>
            )}

            <Btn type="submit" variant="primary" size="xl" className="w-full"
              icon={busy ? undefined : ShieldCheck}
              disabled={busy || !ready}>
              {busy ? <><Loader2 size={17} className="animate-spin" />{COPY.signingIn}</> : COPY.signIn}
            </Btn>

            <p className="text-center text-panel leading-relaxed text-ink-500">{COPY.forgot}</p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function Page() { return <Suspense><LoginScreen /></Suspense>; }
