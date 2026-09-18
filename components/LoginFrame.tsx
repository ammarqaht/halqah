'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   الباب — إطار واحد لبوابات الدخول الثلاث.

   «عندنا ٣ صفحات، أولاً كلها تكون بيانات التسجيل في الجهة اليمنى والقسم الذي فيه
   الآية في الجهة اليسرى، والستارة تظهر لهم الثلاثة» (client, 18 Sep 2026).

   Three doors into one building, and they had drifted: the supervisor's form sat
   on the right and the other two on the left, and only his had the curtain. A
   man who signs in as a supervisor in the morning and as a teacher in the
   afternoon should not have to find the fields twice — so the frame is one
   component and the three pages are three forms inside it.

   The form is FIRST in the DOM, which in RTL puts it on the right, where the eye
   starts reading. The brand field is the only deep ground in the product
   (DESIGN.md §1.3) and it carries the ayah; below `lg` it steps aside entirely
   and the lockup moves above the form, because a phone has room for one column
   and the fields are what a boy came for.
   ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState, type ReactNode } from 'react';
import { GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { LogoFull, LogoJamiyah } from '@/components/Logo';
import { Curtain } from '@/components/Curtain';
import { Lattice } from '@/components/Lattice';
import { INTRO, prefersReducedMotion } from '@/lib/motion';
import { cx } from '@/lib/cx';

/* ── الستارة ─────────────────────────────────────────────────────────────────
   Plays on every visit, reloads included. The page underneath is fully rendered
   the whole time, so the curtain REVEALS it rather than the page fading in — and
   the form is in the DOM and focusable from t=0: motion never gates input.
   The timeline waits for the mark to decode, or a cold load spends the hold
   staring at an empty ground. */
export function useCurtain(onDone?: () => void) {
  const [markVisible, setMarkVisible] = useState(false);
  const [up, setUp] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) { setDone(true); onDone?.(); return; }

    let tHold: ReturnType<typeof setTimeout>, tDone: ReturnType<typeof setTimeout>;
    const start = () => {
      setMarkVisible(true);
      tHold = setTimeout(() => setUp(true), INTRO.hold);
      tDone = setTimeout(() => { setDone(true); onDone?.(); }, INTRO.hold + INTRO.lift);
    };
    const img = new Image();
    const cap = setTimeout(start, 900);          // never wait on a slow network
    img.onload = img.onerror = () => { clearTimeout(cap); start(); };
    img.src = '/assets/masjid.png';

    return () => { clearTimeout(cap); clearTimeout(tHold); clearTimeout(tDone); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { done, up, markVisible };
}

export function LoginFrame({ children, foot, curtain }: {
  children: ReactNode;
  /** the line under the ayah — each portal says who it is for */
  foot?: ReactNode;
  curtain: { done: boolean; up: boolean; markVisible: boolean };
}) {
  return (
    <div className="relative min-h-screen bg-page">
      {!curtain.done && (
        <Curtain up={curtain.up} markVisible={curtain.markVisible}
          fadeIn={INTRO.fadeIn} lift={INTRO.lift} height={104} />
      )}

      {/* form first ⇒ in RTL it sits on the RIGHT, where the eye starts reading */}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(26rem,32rem)_1fr]">
        <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
          <div className="mx-auto w-full max-w-[24rem]">
            <div className="mb-8 lg:hidden"><LogoFull height={44} /></div>
            {children}
          </div>
        </main>

        {/* brand panel — the only deep field in the product (DESIGN.md §1.3) */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
          <Lattice className="pointer-events-none absolute inset-0 h-full w-full text-white" opacity={0.07} />
          <div className="pointer-events-none absolute -start-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-white/[.035]" />
          <div className="pointer-events-none absolute -bottom-40 -start-16 h-[30rem] w-[30rem] rounded-full bg-white/[.025]" />

          <div className="relative flex items-center justify-between gap-8">
            <LogoFull height={62} white />
            <span className="h-10 w-px bg-white/15" />
            <LogoJamiyah height={40} white className="opacity-70" />
          </div>

          {/* The ayah carries this panel on its own — the mosque is already named
              by the lockup above it, so repeating it only crowds. */}
          <div className="relative my-auto max-w-[34rem] py-10">
            <p className="font-display text-d2 leading-[1.95] text-white lg:text-d1 lg:leading-[1.85]">
              وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ
            </p>
            <cite className="mt-5 block text-sm2 not-italic text-white/55">سورة القمر — الآية ١٧</cite>
          </div>

          <div className="relative border-t border-white/12 pt-7">{foot}</div>
        </aside>
      </div>
    </div>
  );
}

/* ── الأبواب الأخرى ──────────────────────────────────────────────────────────
   «وأزرار الانتقال من صفحة إلى صفحة تكون مستطيلان بجانب بعض: دخول معلم — دخول
   طالب — أو دخول مشرف» (client, 18 Sep 2026).

   Three portals on one domain, and the wrong door answers «البيانات غير صحيحة»
   — which reads as a broken password rather than as a wrong door. Two plain
   rectangles say it before it happens, and they are the same two rectangles on
   all three screens. */
const DOOR = {
  admin:   { href: '/login',         label: 'دخول مشرف',  icon: ShieldCheck },
  teacher: { href: '/teacher/login', label: 'دخول معلم',  icon: Users },
  student: { href: '/student/login', label: 'دخول طالب',  icon: GraduationCap },
} as const;

export function LoginDoors({ here, className }: { here: keyof typeof DOOR; className?: string }) {
  const others = (Object.keys(DOOR) as (keyof typeof DOOR)[]).filter((k) => k !== here);
  return (
    <div className={cx('mt-7', className)}>
      {/* No label above them. «كلمة لست هنا في صفحة التسجيل احذفها» (client,
          18 Sep 2026): two doors named «دخول معلم» and «دخول طالب» say what
          they are, and a question over them only asks the reader to read
          twice. */}
      <div className="grid grid-cols-2 gap-2">
        {others.map((k) => {
          const d = DOOR[k];
          return (
            <a key={k} href={d.href}
              className="press flex h-11 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-paper text-panel font-medium text-ink-700 transition-colors hover:border-brand-700 hover:text-brand-800">
              <d.icon size={15} strokeWidth={1.9} className="text-ink-400" />
              {d.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
