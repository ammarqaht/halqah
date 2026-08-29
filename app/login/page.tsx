'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   تسجيل الدخول  —  DESIGN.md §5
   Structure from mockup A. Palette + type from mockup C. Opening animation §5.2.

   The animation is ONE continuous motion, ~1.6s, and runs once per browser
   session. The form is in the DOM and focusable from t=0 — motion never gates
   input. Only transform/opacity animate.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, Loader2 } from 'lucide-react';
import { LogoFull, LogoJamiyah } from '@/components/Logo';
import { Lattice } from '@/components/Lattice';
import { Btn, Field, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';
import { INTRO, prefersReducedMotion } from '@/lib/motion';
import { useDB } from '@/lib/store';

type Phase = 'hold' | 'travel' | 'settled';

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('settled');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const idRef = useRef<HTMLInputElement>(null);
  const db = useDB();

  /* Runs on every visit, including a reload — this is the brand moment.
     Rendering 'settled' on the server keeps hydration identical on both sides,
     and the timeline only starts once the mark has actually decoded, so a cold
     load never spends the hold phase staring at an empty ground. */
  useEffect(() => {
    if (prefersReducedMotion()) { setReady(true); return; }

    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const start = () => {
      setPhase('hold');
      t1 = setTimeout(() => setPhase('travel'), INTRO.hold);
      t2 = setTimeout(() => { setPhase('settled'); setReady(true); }, INTRO.hold + INTRO.travel);
    };
    const img = new Image();
    const cap = setTimeout(start, 900);          // never wait on a slow network
    img.onload = img.onerror = () => { clearTimeout(cap); start(); };
    img.src = '/assets/masjid.png';

    return () => { clearTimeout(cap); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => { if (ready) idRef.current?.focus(); }, [ready]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => router.push('/admin'), 520);
  };

  const intro = phase !== 'settled';

  return (
    <div className="relative min-h-screen overflow-hidden bg-page">
      {/* ── intro overlay: the mark alone on an empty ground ───────────────── */}
      {intro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-page"
             style={{ transition: `opacity ${INTRO.travel}ms cubic-bezier(.22,.61,.36,1)`,
                      opacity: phase === 'travel' ? 0 : 1 }}>
          <div className="relative">
            <span className="absolute -inset-10 rounded-full border border-brand-300"
                  style={{ animation: `ringPulse ${INTRO.hold}ms cubic-bezier(.22,.61,.36,1) ${INTRO.fadeIn}ms both` }} />
            <div style={{
              transition: `transform ${INTRO.travel}ms cubic-bezier(.22,.61,.36,1)`,
              transform: phase === 'travel' ? 'translateY(-14vh) scale(.52)' : 'none',
            }}>
              <div className="mark-in" style={{ animationDuration: `${INTRO.fadeIn}ms` }}>
                <LogoFull height={96} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── settled layout ─────────────────────────────────────────────────── */}
      <div className={cx('grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_500px]',
        intro && 'pointer-events-none opacity-0')}>

        {/* brand panel — the only deep field in the product (DESIGN.md §1.3) */}
        <aside className={cx('relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex',
          !intro && 'wipe')}>
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

        {/* form column */}
        <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
          <div className={cx('mx-auto w-full max-w-[23rem]', !intro && 'rise')}
               style={{ animationDelay: `${INTRO.formDelay}ms` }}>
            <div className="lg:hidden"><LogoFull height={46} /></div>

            <h1 className="mt-8 font-display text-d1 text-ink-900 lg:mt-0">تسجيل الدخول</h1>
            <p className="mt-2 text-base2 text-ink-600">
              ادخل ببيانات الحساب الذي زوّدك به المشرف.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="رقم الهوية" htmlFor="nid">
                <input id="nid" ref={idRef} dir="ltr" inputMode="numeric" autoComplete="username"
                  value={id} onChange={(e) => setId(e.target.value)} placeholder="1XXXXXXXXX"
                  className={cx(INPUT, 'num text-right')} />
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
      </div>
    </div>
  );
}
