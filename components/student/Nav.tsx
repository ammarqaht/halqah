'use client';
/* Five destinations and nothing else — DESIGN.md §6.
   A frosted bar on a phone, a slim top bar on a desktop. No rail on this
   surface: a boy holding a phone in a mosque has one thumb and a handful of
   places to be. «مستواي وخطتي» is labelled «مستواي» in the bar since الترتيب
   joined it — five labels have to fit across a 360px phone. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, Store, BookOpen, Trophy, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { TABS, DESKTOP_TABS, REDEEM_TAB } from '@/content/student';
import { useMe } from '@/components/student/Me';
import { SignOutButton } from '@/components/student/SignOut';
import { cx } from '@/lib/cx';

const ICONS: Record<string, LucideIcon> = {
  '/student': Home, '/student/redeem': Ticket,
  '/student/store': Store, '/student/my-level': BookOpen,
  '/student/rank': Trophy,
};

export function StudentNav() {
  const path = usePathname();
  const { me } = useMe();
  const active = (href: string) => (href === '/student' ? path === href : path.startsWith(href));

  /* Talqeen sits outside the points system entirely (§13.1), so the screens
     that live on it are not offered. Every one of them already refuses him —
     the store answers `eligible:false`, the board 403s — and a tab whose only
     reply is «أنت خارج هذا» is a door drawn on a wall. */
  const points = me?.eligibleForPoints !== false;
  const allowed = (t: { href: string }) =>
    points || (t.href !== '/student/store' && t.href !== '/student/rank'
      && t.href !== REDEEM_TAB.href);
  const tabs = TABS.filter(allowed);

  /* الرئيسية hides this bar on the phone so the sticky hero can own the top of
     the screen — the hero carries the mark, the name and خروج itself, and two
     sticky layers saying the same three things is one too many. */
  const heroOwnsTop = path === '/student';

  return (
    <>
      {/* desktop */}
      <header className="sticky top-0 z-40 hidden border-b border-ink-150 bg-paper/85 backdrop-blur-md md:block">
        <div className="mx-auto flex max-w-column items-center gap-6 px-6 py-3">
          <Link href="/student" className="flex shrink-0 items-center gap-2.5">
            <LogoMark height={30} white={false} />
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {DESKTOP_TABS.filter(allowed).map((t) => {
              const I = ICONS[t.href];
              return (
                <Link key={t.href} href={t.href}
                  className={cx('flex items-center gap-2 rounded-lg px-3 py-2 text-body transition-colors',
                    active(t.href) ? 'bg-brand-50 font-medium text-brand-900'
                                   : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900')}>
                  <I size={16} strokeWidth={1.9} />{t.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <span className="max-w-[14rem] truncate text-panel text-ink-600">{me?.fullName ?? ''}</span>
            <SignOutButton className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
              <LogOut size={17} />
            </SignOutButton>
          </div>
        </div>
      </header>

      {/* phone — a slim bar carrying the mark, his name, and the way out.
          A shared phone is the whole reason this button exists: two brothers on
          one handset need one tap to swap, and a session that lasts half a year
          would otherwise trap the first one in it. */}
      {!heroOwnsTop && (
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-150 bg-paper/90 px-4 py-2.5 backdrop-blur-md md:hidden">
          <LogoMark height={24} white={false} />
          <span className="min-w-0 flex-1 truncate text-panel text-ink-700">{me?.fullName ?? ''}</span>
          <SignOutButton className="-me-1 flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-panel text-ink-500 transition-colors active:bg-risk-100 active:text-risk-700">
            <LogOut size={16} />خروج
          </SignOutButton>
        </header>
      )}

      {/* phone — four tabs with the disc between them. The middle column is a
          fixed 76px so the pairs either side keep an equal share and nothing
          shuffles when a label changes width. */}
      <nav aria-label="التنقّل"
        className={cx('fixed inset-x-0 bottom-0 z-40 grid items-start gap-1 border-t border-ink-150 bg-paper/90 px-3 pt-2 backdrop-blur-lg md:hidden',
          points ? 'grid-cols-[1fr_1fr_76px_1fr_1fr]' : 'grid-cols-2')}
        style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
        {(points ? tabs.slice(0, 2) : tabs).map(
          (t) => <Tab key={t.href} tab={t} on={active(t.href)} />)}

        {/* «شحن كود» — raised, ringed in the page colour so it reads as sitting
            above the bar rather than punched through it.
            A talqeen boy does not get it: §13.1 keeps him outside the points
            system, and a tab that answers «أنت خارج هذا» when tapped is a
            promise made only to be withdrawn. */}
        {points ? (
        <div className="-mt-6 flex flex-col items-center gap-[3px]">
          <Link href={REDEEM_TAB.href} aria-label={REDEEM_TAB.label}
            aria-current={active(REDEEM_TAB.href) ? 'page' : undefined}
            className={cx('press grid h-[58px] w-[58px] place-items-center rounded-full border-4 border-page text-white shadow-[0_10px_24px_-8px_rgba(10,64,60,.65)] transition-colors',
              active(REDEEM_TAB.href) ? 'bg-brand-900' : 'bg-brand-800 hover:bg-brand-900')}>
            <Ticket size={24} strokeWidth={2} />
          </Link>
          <span className="text-[10.5px] font-medium leading-none text-brand-800">
            {REDEEM_TAB.label}
          </span>
        </div>
        ) : <span aria-hidden />}

        {points && tabs.slice(2).map((t) => <Tab key={t.href} tab={t} on={active(t.href)} />)}
      </nav>
    </>
  );
}

function Tab({ tab, on }: { tab: { href: string; label: string }; on: boolean }) {
  const I = ICONS[tab.href];
  return (
    <Link href={tab.href} aria-current={on ? 'page' : undefined}
      className={cx('relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors',
        on ? 'bg-brand-50 text-brand-800' : 'text-ink-500')}>
      <I size={20} strokeWidth={on ? 2.1 : 1.8} />
      <span className="text-[10.5px] leading-none">{tab.label}</span>
    </Link>
  );
}
