'use client';
/* Five destinations and nothing else — the student portal's shape, with the
   client's own answer on the bar: five EQUAL tabs, no raised disc.

   A phone bar at the bottom and a slim top bar on a desktop. No rail on this
   surface either: a teacher standing between twenty-five boys has one thumb and
   a handful of places to be, and «مصمّمة للجوال قبل الكمبيوتر» is §٧ verbatim.

   Labels are kept to one word each because five of them have to fit across a
   360px phone — «التسجيل», not «تسجيل التحضير والتسميع». */
import Link from 'next/link';
import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Users, Coins, Printer, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { TABS } from '@/content/teacher';
import { useMe } from '@/components/teacher/Me';
import { SignOutButton } from '@/components/teacher/SignOut';
import { TabPill, useTabPill } from '@/components/TabPill';
import { cx } from '@/lib/cx';

const ICONS: Record<string, LucideIcon> = {
  '/teacher': Home,
  '/teacher/register': ClipboardList,
  '/teacher/students': Users,
  '/teacher/points': Coins,
  '/teacher/reports': Printer,
};

export function TeacherNav() {
  const path = usePathname();
  const bar = useRef<HTMLElement>(null);
  const pill = useTabPill(bar, path);
  const { me } = useMe();
  const active = (href: string) => (href === '/teacher' ? path === href : path.startsWith(href));

  /* The screens whose HERO owns the top of the phone hide this bar: the card
     carries the mark, the halaqa's name and خروج itself, and two sticky layers
     saying the same three things is one too many. The student portal's move
     (DESIGN.md §11.1), for the same reason.

     التسجيل joined الرئيسية here on 18 Sep 2026, when its bar became the same
     card — «الهيرو يكون نفس الرئيسية». */
  const HERO_SCREENS = ['/teacher', '/teacher/register'];
  const heroOwnsTop = HERO_SCREENS.includes(path);

  return (
    <>
      {/* desktop */}
      <header className="sticky top-0 z-40 hidden border-b border-ink-150 bg-paper/85 backdrop-blur-md md:block">
        <div className="mx-auto flex max-w-column items-center gap-6 px-6 py-3">
          <Link href="/teacher" className="flex shrink-0 items-center gap-2.5">
            <LogoMark height={30} white={false} />
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {TABS.map((t) => {
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
          <div className="flex min-w-0 shrink items-center gap-3">
            <span className="max-w-[16rem] truncate text-panel text-ink-600">
              {me?.halaqa.name ?? ''}
            </span>
            <SignOutButton className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
              <LogOut size={17} />
            </SignOutButton>
          </div>
        </div>
      </header>

      {/* phone — a slim bar carrying the mark, his halaqa, and the way out. */}
      {!heroOwnsTop && (
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-150 bg-paper/90 px-4 py-2.5 backdrop-blur-md md:hidden">
          <LogoMark height={24} white={false} />
          <span className="min-w-0 flex-1 truncate text-panel text-ink-700">
            {me?.halaqa.name ?? ''}
          </span>
          <SignOutButton className="-me-1 flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-panel text-ink-500 transition-colors active:bg-risk-100 active:text-risk-700">
            <LogOut size={16} />خروج
          </SignOutButton>
        </header>
      )}

      {/* phone — five equal tabs. `grid-cols-5` rather than flex, so a label
          that grows by a letter cannot shove its neighbours sideways: the
          positions are fixed, and a teacher learns them by place. */}
      <nav ref={bar} aria-label="التنقّل"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-start gap-0.5 border-t border-ink-150 bg-paper/90 px-1.5 pt-2 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
        {/* The mark travels; the tabs do not. See components/TabPill.tsx. */}
        <TabPill pill={pill} className="top-2 h-[52px] rounded-xl bg-brand-50" />
        {TABS.map((t) => <Tab key={t.href} tab={t} on={active(t.href)} />)}
      </nav>
    </>
  );
}

function Tab({ tab, on }: { tab: { href: string; label: string }; on: boolean }) {
  const I = ICONS[tab.href];
  return (
    <Link href={tab.href} data-tab aria-current={on ? 'page' : undefined}
      /* No background of its own any more: the one behind it is the mark, and
         two of them would cross-fade against each other as it travelled. */
      className={cx('relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 transition-colors',
        on ? 'text-brand-800' : 'text-ink-500')}>
      <I size={20} strokeWidth={on ? 2.1 : 1.8} />
      <span className="text-[10.5px] leading-none">{tab.label}</span>
    </Link>
  );
}
