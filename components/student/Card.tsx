'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   بطاقة الطالب — the hero, and on a phone the top of the screen itself.

   طا-٢ opens with «رصيد النقاط بخطّ كبير في أعلى الشاشة», so the balance lives
   ON the card rather than below the fold.

   ONE PAGE, NOT TWO LAYERS. It used to STICK while the sheet of detail climbed
   over it, the card retreating a third of the scroll and fading as it went —
   Apple Wallet's move, and DESIGN.md §11.1's. The client asked for the two to be
   «صفحة وحدة» with the card's own detail staying put: «فالتفاصيل اللي موجودة في
   الهيرو ما تختفي ولا تتحرك مع السكرول» (18 Sep 2026).

   So it is a card at the top of an ordinary page now. It looks exactly as it
   did, and simply scrolls away with everything else. It still carries خروج,
   because الرئيسية still hides the phone's top bar for it.

   The label «بطاقة الطالب» went: a card need not announce that it is one. The
   two large buttons under it went too — شحن كود and المتجر are both already
   destinations in the tab bar, so the card was offering a second way to the
   same two places and spending a third of the screen to do it. The rank chip
   took the space, because where he stands is the other thing he opens this
   screen to see.

   A talqeen student gets the same card with his identity and a calm sentence
   where the balance would be — not a disabled button and not a greyed-out
   teaser of something he is not allowed to want.

   No entrance either, and no watermark: the mark on the roof of the card is the
   same mark, and a second one ghosted into the corner was decoration rather
   than identification.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { LogOut, Trophy } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Num, pointWord } from '@/components/Num';
import { useCountUp } from '@/components/student/motion';
import { SignOutButton } from '@/components/student/SignOut';
import { COPY } from '@/content/student';
import type { Me } from '@/components/student/Me';

export function StudentCard({ me, standing, bell }: {
  me: Me;
  /** His place in his own halaqa, when the board has loaded. */
  standing?: { rank: number; total: number } | null;
  /** الجرس — «أضف زرّ الجرس للطالب» (client, 18 Sep 2026). Passed in rather than
      read here, because the alerts are the home screen's own request and the
      card must not fetch anything to draw itself. */
  bell?: React.ReactNode;
}) {
  const balance = useCountUp(me.balance, 900);

  return (
    /* Curved at the foot even full-bleed, like the teacher's — «هيرو الطالب
       خلّه كيرف» (client, 18 Sep 2026). It reaches both edges and the top of
       the screen because it IS the top of the screen; its bottom is where
       the card ends and the page begins, and a card ends with a corner. */
    <header className="card-field -mx-5 -mt-4 rounded-b-[26px] px-5 pb-6 pt-[calc(22px+env(safe-area-inset-top))] shadow-pop md:mx-0 md:mt-0 md:rounded-[20px] md:px-6 md:pb-6 md:pt-5">
      <div className="relative">
        <div className="flex items-center gap-2">
          <LogoMark height={28} white />
          <span className="min-w-0 flex-1" />
          {bell}
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
