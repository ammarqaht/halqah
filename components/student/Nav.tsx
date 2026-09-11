'use client';
/* Five destinations and nothing else — DESIGN.md §6.
   A frosted bar on a phone, a slim top bar on a desktop. No rail on this
   surface: a boy holding a phone in a mosque has one thumb and a handful of
   places to be. «مستواي وخطتي» is labelled «مستواي» in the bar since الترتيب
   joined it — five labels have to fit across a 360px phone. */
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Home, Ticket, Store, BookOpen, Trophy, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { TABS } from '@/content/student';
import { useMe } from '@/components/student/Me';
import { Btn, Modal } from '@/components/ui';
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

  const [confirm, setConfirm] = useState(false);

  const signOut = async () => {
    await fetch('/api/student/auth', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/student/login';
  };

  return (
    <>
      {/* desktop */}
      <header className="sticky top-0 z-40 hidden border-b border-ink-150 bg-paper/85 backdrop-blur-md md:block">
        <div className="mx-auto flex max-w-column items-center gap-6 px-6 py-3">
          <Link href="/student" className="flex shrink-0 items-center gap-2.5">
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
          <div className="flex shrink-0 items-center gap-3">
            <span className="max-w-[14rem] truncate text-panel text-ink-600">{me?.fullName ?? ''}</span>
            <button onClick={() => setConfirm(true)} aria-label="تسجيل الخروج"
              className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* phone — a slim bar carrying the mark, his name, and the way out.
          A shared phone is the whole reason this button exists: two brothers on
          one handset need one tap to swap, and a session that lasts half a year
          would otherwise trap the first one in it. */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-150 bg-paper/90 px-4 py-2.5 backdrop-blur-md md:hidden">
        <LogoMark height={24} white={false} />
        <span className="min-w-0 flex-1 truncate text-panel text-ink-700">{me?.fullName ?? ''}</span>
        <button onClick={() => setConfirm(true)} aria-label="تسجيل الخروج"
          className="press -me-1 flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-panel text-ink-500 transition-colors active:bg-risk-100 active:text-risk-700">
          <LogOut size={16} />خروج
        </button>
      </header>

      {/* phone */}
      <nav aria-label="التنقّل"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-150 bg-paper/90 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="mx-auto flex max-w-column">
          {TABS.map((t) => {
            const I = ICONS[t.href];
            const on = active(t.href);
            return (
              <li key={t.href} className="flex-1">
                <Link href={t.href}
                  className={cx('relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 transition-colors',
                    on ? 'text-brand-800' : 'text-ink-500')}>
                  {on && <span aria-hidden
                    className="absolute top-0 h-[3px] w-8 rounded-full bg-brand-700" />}
                  <I size={20} strokeWidth={on ? 2.1 : 1.8} />
                  <span className="text-[10.5px] leading-none">{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Asked, not assumed: he stays signed in for months, so leaving is a
          deliberate act — usually to hand the phone to his brother. */}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="تسجيل الخروج"
        footer={<>
          <Btn onClick={() => setConfirm(false)}>ابقَ</Btn>
          <Btn variant="danger" icon={LogOut} onClick={signOut}>اخرج</Btn>
        </>}>
        <p className="text-base2 leading-relaxed text-ink-700">
          ستحتاج رقم دخولك ورقم هويتك للعودة. اخرج إن كان الجهاز مشتركًا مع غيرك.
        </p>
      </Modal>
    </>
  );
}
