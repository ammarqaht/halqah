'use client';
/* مع-١ — دخول المعلم.
   «الشكل نفسه الذي في بوابَتي الإدارة والطالب، حفاظًا على وحدة النظام» — and
   since 18 Sep 2026 that is literal: the three doors share `LoginFrame`, so the
   curtain, the form on the right, the ayah on the left and the two rectangles
   that lead to the other portals are one component rather than three copies
   that drift.

   The login number is four boxes rather than one field, exactly as the student's
   is: he is reading it off the slip the supervisor handed him, and one box per
   digit is the difference between keeping his place and starting over.

   But the second field is a real password, not his national id. A boy's id is
   something he cannot lose and that nobody but his own teacher knows; a teacher
   holds twenty-five boys' levels, attendance and results, and opens his screen
   in a room full of them. So the supervisor sets it and he replaces it on first
   use — and the field is `type="password"` for a reason that is not theoretical
   on that screen. */
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { LoginDoors, LoginFrame, useCurtain } from '@/components/LoginFrame';
import { Btn, Field, INPUT } from '@/components/ui';
import { PinInput } from '@/components/student/PinInput';
import { COPY, MOSQUE, NEIGHBOURHOOD, PASSWORD_MIN } from '@/content/teacher';
import { cx } from '@/lib/cx';

function LoginScreen() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/teacher';
  const expired = sp.get('reason') === 'expired';

  const [loginId, setLoginId] = useState(() =>
    (sp.get('u') ?? '').replace(/\D/g, '').slice(0, 4));
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const curtain = useCurtain();
  const ready = loginId.length === 4 && password.length > 0;

  const go = async () => {
    if (busy || !ready) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/teacher/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? 'تعذّر الدخول. حاول مرة أخرى.'); setBusy(false); return; }
      /* «ويغيّرها المعلم في أول دخول» — he lands on the change screen, not on a
         portal he would have to find it in. */
      router.replace(data.mustChangePassword ? '/teacher/password' : next);
    } catch {
      setErr('تعذّر الاتصال. تأكّد من الشبكة ثم أعد المحاولة.');
      setBusy(false);
    }
  };

  return (
    <LoginFrame curtain={curtain}
      foot={<>
        <p className="text-micro uppercase tracking-[.16em] text-brand-200">{COPY.portal}</p>
        <p className="mt-1.5 text-base2 text-white/90">{MOSQUE} — {NEIGHBOURHOOD}</p>
        <p className="mt-2 text-xs2 text-white/55">حلقتك بين يديك: تحضير، وتسميع، ومتابعة.</p>
      </>}>
      <p className="text-micro uppercase tracking-[.16em] text-brand-800">{COPY.portal}</p>
      <h1 className="mt-2 font-display text-d2 leading-tight text-ink-900">{COPY.signInTitle}</h1>
      <p className="mt-1.5 text-base2 text-ink-500">
        رقم دخولك من المشرف، وكلمة مرورك التي تغيّرها في أول دخول.
      </p>

      {expired && (
        <p className="mt-5 rounded-lg border border-warn-200 bg-warn-100 px-4 py-3 text-sm2 text-warn-700">
          انتهت جلستك. ادخل من جديد.
        </p>
      )}

      <form className="mt-7 space-y-5" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <div>
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <span className="text-xs2 font-medium text-ink-700">{COPY.idLabel}</span>
            <span className="text-micro text-ink-500">{COPY.idHint}</span>
          </div>
          <PinInput value={loginId} onChange={setLoginId} length={4} autoFocus
            label={COPY.idLabel} />
        </div>

        <Field label={COPY.pwLabel} hint={COPY.pwHint} htmlFor="pw">
          <input id="pw" type="password" value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            minLength={1}
            className={cx(INPUT, 'h-12 text-lg2')} />
        </Field>

        {err && (
          <p role="alert"
            className="rounded-lg border border-risk-200 bg-risk-100 px-4 py-3 text-sm2 text-risk-700">
            {err}
          </p>
        )}

        <Btn type="submit" variant="primary" size="xl" disabled={!ready || busy}
          className="w-full">
          {busy ? <><Loader2 size={17} className="animate-spin" />{COPY.signingIn}</>
                 : COPY.signIn}
        </Btn>

        <p className="flex items-start gap-2 text-panel leading-relaxed text-ink-500">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ink-400" />
          {COPY.forgot} وكلمة المرور {PASSWORD_MIN} أحرف على الأقل.
        </p>
      </form>

      <LoginDoors here="teacher" />
    </LoginFrame>
  );
}

export default function TeacherLogin() {
  return <Suspense><LoginScreen /></Suspense>;
}
