'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   بطاقة اليوم — the hero, and on a phone the top of the screen itself.

   ONE component for both الرئيسية and التسجيل, because the client asked for the
   same object on both: «في صفحة التسجيل: الهيرو يكون نفس الرئيسية، بطاقة كبيرة
   تملأ أعلى الشاشة فيها اليوم والتاريخ وتفاصيل الحضور والحفظ» (18 Sep 2026). A
   teacher moving between the two screens should not have to re-find where he
   is and when.

   ONE PAGE, NOT TWO LAYERS. It used to stick while a sheet of detail climbed
   over it, the card retreating a third of the scroll and fading out — Apple
   Wallet's move, carried over from بطاقة الطالب. The client asked for the two to
   be «صفحة وحدة» with the hero's own detail staying put: «فالتفاصيل اللي موجودة
   في الهيرو ما تختفي ولا تتحرك مع السكرول» (client, 18 Sep 2026).

   So it is a card at the top of an ordinary page. It looks exactly as it did —
   the field, the dates, the state, the button — and it simply scrolls away with
   everything else instead of performing on the way out. It still carries خروج,
   because the screens it sits on hide the phone's top bar.

   No entrance either, and no watermark behind it: the mark on the roof of the
   card is the same mark, and a second one ghosted into the corner was decoration
   rather than identification.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, LogOut } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { HijriText, Num } from '@/components/Num';
import { AlertsBell } from '@/components/teacher/Alerts';
import { SignOutButton } from '@/components/teacher/SignOut';
import { COPY, MODES, type ModeCode } from '@/content/teacher';
import { dayHeading } from '@/lib/teacher';
import type { TeacherMe } from '@/components/teacher/Me';
import type { DayPayload } from '@/app/teacher/register/page';
import { cx } from '@/lib/cx';

export function DayHero({ me, day, data, home, mode, onMode, children }: {
  me: TeacherMe;
  day: string;
  /** Present on التسجيل, where the figures are the day's own. Null on الرئيسية,
      which uses `me.counts` and is looking at today by definition. */
  data: DayPayload | null;
  /**
   * الرئيسية only — the one screen that carries the big button through to
   * التسجيل.
   *
   * It used to be inferred as `!data`, which was wrong twice: on التسجيل the
   * button FLASHED for the moment before the day loaded and `data` was still
   * null, and in وضع «فترة لطالب» — which never loads a day — it sat there
   * permanently, offering to take a teacher to the screen he was already on.
   * Stated rather than guessed.
   */
  home?: boolean;
  /** Given on التسجيل: the three recording modes live INSIDE the card. */
  mode?: ModeCode;
  onMode?: (m: ModeCode) => void;
  children?: React.ReactNode;
}) {
  const h = dayHeading(day);
  const counts = data?.counts ?? {
    roster: me.counts.roster, saved: me.counts.saved, present: me.counts.present,
    absent: me.counts.absent, recited: me.counts.recited, points: 0,
  };
  const isToday = data ? data.isToday : true;
  const opensItself = data ? data.opensItself : me.opensItself;

  return (
    /* The bottom corners are CURVED even full-bleed — «الهيرو أبي زواياه
       السفلية تكون كيرف» (client, 18 Sep 2026). It reaches the two edges
       and the top of the screen because it IS the top of the screen; its
       bottom is where the card ends and the page begins, and a card ends
       with a corner. */
    <header className="card-field -mx-5 -mt-4 rounded-b-[26px] px-5 pb-6 pt-[calc(22px+env(safe-area-inset-top))] shadow-pop md:mx-0 md:mt-0 md:rounded-[20px] md:px-6 md:pb-6 md:pt-5">
      <div className="relative">
        <div className="flex items-center gap-2">
          <LogoMark height={28} white />
          <span className="min-w-0 flex-1" />
          {/* الجرس — «يكون في الأعلى بجانب زر الخروج أيقونة جرس لعرض نافذة فيها
              التنبيهات كلها» (client, 18 Sep 2026). It rides on every screen the
              hero is on, so the alerts are one tap from التسجيل too and not only
              from الرئيسية. It stays at every width; it is خروج that is a phone
              control, because the desktop bar carries its own. */}
          <AlertsBell />
          <SignOutButton label="تسجيل الخروج"
            className="-me-1 flex h-[34px] items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs2 text-brand-100 transition-colors hover:bg-white/20 hover:text-white md:hidden">
            <LogOut size={15} strokeWidth={1.9} />خروج
          </SignOutButton>
        </div>

        {/* التاريخ باليومين — the Hijri leads, because it is the calendar the
            mosque speaks in; the Gregorian sits beside it for the record. */}
        <p className="mt-5 flex flex-wrap items-baseline gap-x-2 text-panel text-brand-200">
          <span>{h.weekday}</span>
          <span className="text-brand-100"><HijriText day={day} /></span>
          <span className="text-brand-300">· <Num>{h.gregorian}</Num></span>
        </p>

        <h1 className="mt-1 font-display text-[26px] font-medium leading-[1.25] text-white">
          {me.halaqa.name}
        </h1>
        {/* «في الهيرو يعرض عدد الطلاب الإجمالي» — the roster is the denominator
            every figure under it is a share of, so it is stated here once. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs2 text-brand-300">
          <span>{me.halaqa.timeSlot}</span>
          <span>· <Num className="font-medium text-brand-100">{me.counts.roster}</Num> طالبًا في حلقتي</span>
          {me.who.role === 'SUPERVISOR' && <span>· تسجّل بصفة المشرف</span>}
        </p>

        {children ?? (
          <DayState counts={counts} isToday={isToday} opensItself={opensItself}
            standalone={!!home} />
        )}

        {/* ── أوضاع التسجيل — inside the card, on التسجيل only.
            The past-day picker used to live here too; it moved above the search
            box, where the thing it filters is. */}
        {mode && onMode && (
          <div className="mt-5" role="tablist" aria-label="أوضاع التسجيل">
            <div className="flex gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-sm">
              {MODES.map((m) => (
                <button key={m.code} role="tab" aria-selected={mode === m.code}
                  onClick={() => onMode(m.code)} title={m.hint}
                  className={cx('press min-h-[38px] flex-1 rounded-lg px-2 text-panel font-medium transition-colors',
                    mode === m.code ? 'bg-white text-brand-900' : 'text-brand-100 hover:bg-white/10')}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/** حال اليوم, and the one large button — «وزرّ واحد كبير: ابدأ تسجيل اليوم». */
function DayState({ counts, isToday, opensItself, standalone }: {
  counts: { roster: number; saved: number; present: number; absent: number; recited: number };
  isToday: boolean;
  opensItself: boolean;
  /** True on الرئيسية, where the card carries the button through to التسجيل. */
  standalone: boolean;
}) {
  const started = counts.saved > 0;

  /* «وفي اليوم الذي لا تنعقد فيه الحلقة تقول البطاقة ذلك ولا تعرض زرًّا» — with
     the door left open, because «أيّ يوم فيه تحضير يُعتبر يوم حلقة». */
  if (standalone && isToday && !opensItself && !started) {
    return (
      <div className="mt-6">
        <span className="block text-micro tracking-[.12em] text-brand-200">حال اليوم</span>
        {/* The headline and nothing else — «بدون نصوص أخرى». The paragraph that
            stood here explained the exceptional day; the button says it. */}
        <p className="mt-1 font-display text-[26px] leading-tight text-white">
          {COPY.notHalaqaDay}
        </p>
        <Link href="/teacher/register"
          className="press mt-4 flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 text-base2 font-medium text-white transition-colors hover:bg-white/20">
          <CalendarPlus size={17} strokeWidth={1.9} />{COPY.openExceptional}
        </Link>
      </div>
    );
  }

  const label = counts.saved === 0 ? COPY.startDay
    : counts.saved >= counts.roster ? COPY.reviewDay : COPY.continueDay;

  return (
    <div className="mt-6">
      <span className="block text-micro tracking-[.12em] text-brand-200">حال اليوم</span>

      {started ? (
        <>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
            <Num className="font-display text-[clamp(40px,12vw,54px)] leading-none text-white">
              {counts.saved}
            </Num>
            <span className="text-lg2 text-brand-100">
              من <Num>{counts.roster}</Num>
              {counts.saved >= counts.roster ? ' — اكتمل' : ''}
            </span>
          </span>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs2 text-brand-200">
            <span>حاضر <Num className="font-bold text-white">{counts.present}</Num></span>
            <span>· غائب <Num className="font-bold text-white">{counts.absent}</Num></span>
            <span>· سمّع <Num className="font-bold text-white">{counts.recited}</Num></span>
          </p>
        </>
      ) : (
        <p className="mt-1 font-display text-[34px] leading-none text-white">
          {COPY.notStarted}
        </p>
      )}

      {standalone && (
        <Link href="/teacher/register"
          className="press mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-white text-lg2 font-medium text-brand-900 shadow-[0_10px_24px_-12px_rgba(0,0,0,.45)] transition-colors hover:bg-brand-50">
          {label}<ArrowLeft size={18} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
