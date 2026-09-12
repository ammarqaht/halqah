'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   بطاقة الطالب — the hero, and on a phone the top of the screen itself.

   طا-٢ opens with «رصيد النقاط بخطّ كبير في أعلى الشاشة», so the balance lives
   ON the card rather than below the fold.

   It STICKS (DESIGN.md §11.1). The prototype's move, and Apple Wallet's before
   it: the card fills the top and stays there while the sheet of detail climbs
   over it, the card retreating a third of the scroll distance and fading as it
   goes. That only works if the card owns the top of the screen, so الرئيسية
   hides the phone's top bar — which is why خروج is here. Above `md` the portal
   has its own sticky bar and the card goes back to being a card.

   The label «بطاقة الطالب» went: a card need not announce that it is one. The
   two large buttons under it went too — شحن كود and المتجر are both already
   destinations in the tab bar, so the card was offering a second way to the
   same two places and spending a third of the screen to do it. The rank chip
   took the space, because where he stands is the other thing he opens this
   screen to see.

   A talqeen student gets the same card with his identity and a calm sentence
   where the balance would be — not a disabled button and not a greyed-out
   teaser of something he is not allowed to want.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { LogOut, Trophy } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Num, pointWord } from '@/components/Num';
import { useCountUp, usePhone, useScrollY } from '@/components/student/motion';
import { SignOutButton } from '@/components/student/SignOut';
import { COPY } from '@/content/student';
import type { Me } from '@/components/student/Me';

/* Retreat a third of the distance travelled, to a stop; gone by 300px. Both are
   transform and opacity, so the whole thing rides the compositor and never
   competes with the scroll driving it. */
const SHIFT_CAP = 320;
const SHIFT_RATE = 0.32;
const FADE_OVER = 300;

export function StudentCard({ me, standing }: {
  me: Me;
  /** His place in his own halaqa, when the board has loaded. */
  standing?: { rank: number; total: number } | null;
}) {
  const balance = useCountUp(me.balance, 900);
  const phone = usePhone();
  const y = useScrollY(phone);

  const shift = Math.min(y, SHIFT_CAP) * SHIFT_RATE;
  const fade = Math.max(0, 1 - y / FADE_OVER);

  return (
    <header className="card-field rise sticky top-0 z-0 -mx-5 -mt-4 px-5 pb-12 pt-[calc(22px+env(safe-area-inset-top))] shadow-pop md:static md:mx-0 md:mt-0 md:rounded-[20px] md:px-6 md:pb-6 md:pt-5">
      {/* the mark, watermarked — never redrawn, never recoloured */}
      <div aria-hidden className="pointer-events-none absolute bottom-4 end-5 opacity-[.07]">
        <LogoMark height={92} white />
      </div>

      <div className="relative will-change-transform"
        style={phone ? { transform: `translateY(${shift}px)`, opacity: fade } : undefined}>
        <div className="flex items-center gap-3">
          <LogoMark height={28} white />
          <span className="min-w-0 flex-1" />
          {/* On a phone this is the only way out, because the bar that used to
              carry it is hidden on this screen. */}
          <SignOutButton label="تسجيل الخروج"
            className="-me-1 flex h-[34px] items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs2 text-brand-100 transition-colors hover:bg-white/20 hover:text-white md:hidden">
            <LogOut size={15} strokeWidth={1.9} />خروج
          </SignOutButton>
        </div>

        <p className="mt-5 text-panel text-brand-200">السلام عليكم</p>
        <h1 className="mt-0.5 font-display text-[27px] font-medium leading-[1.25] text-white">
          {me.fullName}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs2 text-brand-300">
          {me.halaqaName && <span>{me.halaqaName}</span>}
          {me.trackAr && <span>· المسار {me.trackAr}</span>}
        </p>

        <div className="mt-6">
          {me.eligibleForPoints ? (
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="block text-micro tracking-[.12em] text-brand-200">
                  رصيدي من النقاط
                </span>
                <span className="mt-1 flex items-baseline gap-2">
                  <Num className="font-display text-[clamp(48px,14vw,64px)] leading-none text-white">
                    {balance}
                  </Num>
                  <span className="text-lg2 text-brand-100">{pointWord(me.balance)}</span>
                </span>
              </div>

              {/* Only once the board has answered — a chip that appears saying
                  «— من —» is worse than one that appears a moment later. */}
              {standing && (
                <Link href="/student/rank"
                  aria-label={`ترتيبي في حلقتي: ${standing.rank} من ${standing.total} — اعرض الترتيب`}
                  className="press flex h-[86px] w-[86px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-white/20 bg-white/10 px-2 py-2.5 transition-colors hover:bg-white/20">
                  <Trophy size={15} strokeWidth={1.9} className="text-brand-200" />
                  <span className="mt-px flex items-baseline gap-[3px]">
                    <Num className="font-display text-[28px] leading-none text-white">{standing.rank}</Num>
                    <span className="text-[11px] text-brand-100">من <Num>{standing.total}</Num></span>
                  </span>
                  <span className="text-[10px] text-brand-100">ترتيبي في حلقتي</span>
                </Link>
              )}
            </div>
          ) : (
            <p className="max-w-[26rem] text-base2 leading-relaxed text-brand-100">
              {COPY.talqeenPoints}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
