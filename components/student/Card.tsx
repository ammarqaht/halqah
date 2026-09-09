'use client';
/* بطاقة الطالب — the hero, and a real card object.
   طا-٢ opens with «رصيد النقاط بخطّ كبير في أعلى الشاشة، وزر شحن كود بجانبه»,
   so the balance lives ON the card rather than below the fold.

   A talqeen student gets the same card with his identity and a calm sentence
   where the balance would be — not a disabled button and not a greyed-out
   teaser of something he is not allowed to want. */
import Link from 'next/link';
import { Ticket, Store } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Num, pointWord } from '@/components/Num';
import { Btn } from '@/components/ui';
import { COPY } from '@/content/student';
import type { Me } from '@/components/student/Me';

export function StudentCard({ me }: { me: Me }) {
  return (
    <>
      <div className="card-field rise relative rounded-[20px] p-6 shadow-pop">
        {/* the mark, watermarked — never redrawn, never recoloured */}
        <div aria-hidden className="pointer-events-none absolute inset-inline-start-auto bottom-4 end-5 opacity-[.07]">
          <LogoMark height={92} white />
        </div>

        <p className="text-micro uppercase tracking-[.18em] text-brand-200">بطاقة الطالب</p>
        <h1 className="mt-2 font-display text-d2 leading-tight text-white">{me.fullName}</h1>

        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-panel text-brand-100">
          {me.halaqaName && <span>{me.halaqaName}</span>}
          {me.teacher && me.halaqaName !== me.teacher && <span className="text-brand-200">· {me.teacher}</span>}
          {me.trackAr && (
            <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-micro text-white">
              {me.trackAr}
            </span>
          )}
        </p>

        <div className="relative mt-7">
          {me.eligibleForPoints ? (
            <>
              <p className="text-micro uppercase tracking-[.14em] text-brand-200">رصيدي</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-d0 leading-none text-white">
                  <Num>{me.balance}</Num>
                </span>
                <span className="text-lg2 text-brand-100">{pointWord(me.balance)}</span>
              </p>
            </>
          ) : (
            <p className="max-w-[26rem] text-base2 leading-relaxed text-brand-100">
              {COPY.talqeenPoints}
            </p>
          )}
        </div>
      </div>

      {me.eligibleForPoints && (
        <div className="rise mt-4 grid grid-cols-2 gap-3">
          <Link href="/student/redeem" className="press">
            <Btn variant="primary" size="xl" icon={Ticket} className="w-full">شحن كود</Btn>
          </Link>
          <Link href="/student/store" className="press">
            <Btn size="xl" icon={Store} className="w-full">المتجر</Btn>
          </Link>
        </div>
      )}
    </>
  );
}
