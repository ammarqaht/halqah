'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   تسجيل الدخول  —  DESIGN.md §5
   Structure from mockup A. Palette + type from mockup C. Opening animation §5.2.

   The animation is ONE continuous motion, ~1.6s, and runs once per browser
   session. The form is in the DOM and focusable from t=0 — motion never gates
   input. Only transform/opacity animate.
   ───────────────────────────────────────────────────────────────────────── */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, GraduationCap, Loader2 } from 'lucide-react';
import { LogoFull, LogoJamiyah } from '@/components/Logo';
import { Curtain } from '@/components/Curtain';
import { Lattice } from '@/components/Lattice';
import { Btn, Field, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';
import { INTRO, prefersReducedMotion } from '@/lib/motion';
import { useDB } from '@/lib/store';

function LoginScreen() {
  const router = useRouter();
  const [markVisible, setMarkVisible] = useState(false);
  const [up, setUp] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const idRef = useRef<HTMLInputElement>(null);
  const db = useDB();
  const [err, setErr] = useState('');
  const search = useSearchParams();
  const next = search.get('next') || '/admin';

  /* Plays on every visit, reloads included. The page underneath is fully
     rendered the whole time, so the curtain reveals it rather than the page
     fading in — and the form is usable the moment the curtain clears.
     The timeline waits for the mark to decode: otherwise a cold load spends
     the hold staring at an empty ground. */
  useEffect(() => {
    if (prefersReducedMotion()) { setDone(true); idRef.current?.focus(); return; }

    let tHold: ReturnType<typeof setTimeout>, tDone: ReturnType<typeof setTimeout>;
    const start = () => {
      setMarkVisible(true);
      tHold = setTimeout(() => setUp(true), INTRO.hold);
      tDone = setTimeout(() => { setDone(true); idRef.current?.focus(); },
                         INTRO.hold + INTRO.lift);
    };
    const img = new Image();
    const cap = setTimeout(start, 900);          // never wait on a slow network
    img.onload = img.onerror = () => { clearTimeout(cap); start(); };
    img.src = '/assets/masjid.png';

    return () => { clearTimeout(cap); clearTimeout(tHold); clearTimeout(tDone); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: id.trim(), password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? 'تعذّر الدخول. حاول مرة أخرى.'); setBusy(false); return; }
      router.replace(next);
      router.refresh();
    } catch {
      setErr('تعذّر الاتصال بالخادم.');
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-page">
      {!done && (
        <Curtain up={up} markVisible={markVisible}
                 fadeIn={INTRO.fadeIn} lift={INTRO.lift} height={104} />
      )}

      {/* form first ⇒ in RTL it sits on the RIGHT, where the eye starts reading */}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[500px_1fr]">

        {/* form column */}
        <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
          <div className="mx-auto w-full max-w-[23rem]">
            <div className="lg:hidden"><LogoFull height={46} /></div>

            <h1 className="mt-8 font-display text-d1 text-ink-900 lg:mt-0">تسجيل الدخول</h1>
            <p className="mt-2 text-base2 text-ink-600">
              ادخل ببيانات الحساب الذي زوّدك به المشرف.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="اسم المستخدم" htmlFor="nid">
                <input id="nid" ref={idRef} autoComplete="username"
                  value={id} onChange={(e) => setId(e.target.value)} placeholder="admin"
                  className={INPUT} />
              </Field>
              <Field label="كلمة المرور" htmlFor="pw">
                <input id="pw" type="password" autoComplete="current-password"
                  value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••"
                  className={INPUT} />
              </Field>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs2 text-ink-600">
                  <input type="checkbox" defaultChecked
                    className="h-4 w-4 rounded-sm border-ink-300 accent-brand-800" />
                  تذكّرني على هذا الجهاز
                </label>
                <button type="button" className="text-xs2 text-brand-800 hover:underline">
                  نسيت كلمة المرور؟
                </button>
              </div>

              {err && (
                <p role="alert" className="rounded-md border border-risk-200 bg-risk-100 px-3 py-2.5 text-panel text-risk-700">
                  {err}
                </p>
              )}

              <Btn type="submit" variant="primary" size="xl" className="w-full" disabled={busy}>
                {busy ? <><Loader2 size={17} className="animate-spin" />جارٍ الدخول…</> : 'دخول'}
              </Btn>
            </form>

            <div className="my-7 flex items-center gap-3 text-xs2 text-ink-400">
              <span className="h-px flex-1 bg-ink-200" />أو<span className="h-px flex-1 bg-ink-200" />
            </div>

            <Btn size="lg" className="w-full justify-between"
                 onClick={() => router.push('/student')}>
              <span className="flex items-center gap-2"><GraduationCap size={17} strokeWidth={1.9} />دخول الطلاب</span>
              <ArrowLeft size={16} strokeWidth={1.9} className="text-ink-400" />
            </Btn>

            <p className="mt-10 text-micro leading-relaxed text-ink-500">
              للاستفسار عن الحساب: مكتب الإشراف — حلقات جامع محمد العبدالكريم.
            </p>
          </div>
        </main>

        {/* brand panel — the only deep field in the product (DESIGN.md §1.3) */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
          <Lattice className="pointer-events-none absolute inset-0 h-full w-full text-white" opacity={0.07} />
          <div className="pointer-events-none absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-white/[.035]" />
          <div className="pointer-events-none absolute -bottom-40 -left-16 h-[30rem] w-[30rem] rounded-full bg-white/[.025]" />

          <div className="relative flex items-center justify-between gap-8">
            <LogoFull height={62} white />
            <span className="h-10 w-px bg-white/15" />
            <LogoJamiyah height={40} white className="opacity-70" />
          </div>

          <div className="relative my-auto max-w-[27rem] py-10">
            <p className="text-micro uppercase tracking-[.18em] text-white/55">
              حلقات جامع محمد العبدالكريم — الدمام، حي أُحد
            </p>
            <p className="mt-6 font-display text-t1 leading-[2.05] text-white/95">
              وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ
            </p>
            <cite className="mt-3 block text-xs2 not-italic text-white/55">سورة القمر — الآية ١٧</cite>
          </div>

          {/* Real figures, read from what this installation actually holds —
              never hard-coded, and never a student's name on a public screen. */}
          <div className="relative flex items-end gap-10 border-t border-white/12 pt-7">
            {db.students.length > 0 ? (
              [[db.halaqat.length, 'حلقات'], [db.students.length, 'طالبًا']].map(([n, l]) => (
                <div key={String(l)}>
                  <div className="font-display text-t1 text-white"><Num>{n}</Num></div>
                  <div className="mt-0.5 text-xs2 text-white/55">{l}</div>
                </div>
              ))
            ) : (
              <p className="text-xs2 text-white/55">منصة إدارة الحلقات — الطلاب والمستويات والنقاط والاختبارات</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginScreen /></Suspense>;
}
