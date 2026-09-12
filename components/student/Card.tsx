'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   بطاقة الطالب — the hero, and a real card object.

   طا-٢ opens with «رصيد النقاط بخطّ كبير في أعلى الشاشة», so the balance lives
   ON the card rather than below the fold.

   Redesigned from the Claude Design prototype (`Student Portal.dc.html`): the
   «بطاقة الطالب» label went, because a card does not need to announce that it
   is one, and the two large buttons under it went too — شحن كود and المتجر are
   both destinations in the tab bar, so the card was offering a second way to
   the same two places and spending a third of the screen to do it. What took
   their place is the thing the boy actually came to see beside his balance:
   where he stands.

   A talqeen student gets the same card with his identity and a calm sentence
   where the balance would be — not a disabled button and not a greyed-out
   teaser of something he is not allowed to want.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Num, pointWord } from '@/components/Num';
import { useCountUp } from '@/components/student/motion';
import { COPY } from '@/content/student';
import type { Me } from '@/components/student/Me';

export function StudentCard({ me, standing }: {
  me: Me;
  /** His place in his own halaqa, when the board has loaded. */
  standing?: { rank: number; total: number } | null;
}) {
  const balance = useCountUp(me.balance, 900);

  return (
    <div className="card-field rise relative rounded-[20px] px-6 pb-6 pt-5 shadow-pop">
      {/* the mark, watermarked — never redrawn, never recoloured */}
      <div aria-hidden className="pointer-events-none absolute bottom-4 end-5 opacity-[.07]">
        <LogoMark height={92} white />
      </div>

      <div className="relative">
        <LogoMark height={28} white />

        <p className="mt-5 text-panel text-brand-200">السلام عليكم</p>
        <h1 className="mt-0.5 font-display text-[27px] font-medium leading-[1.25] text-white">
          {me.fullName}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs2 text-brand-300">
          {me.halaqaName && <span>{me.halaqaName}</span>}
          {me.trackAr && <span>· المسار {me.trackAr}</span>}
        </p>
      </div>

      <div className="relative mt-6">
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
  );
}
