'use client';
/* بوابة الطالب — mobile first. The users are six to eighteen years old, on
   phones, in a mosque. Four destinations, large targets, nothing else. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, Store, BookOpen } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { cx } from '@/lib/cx';

const TABS = [
  { href: '/student', label: 'الرئيسية', icon: Home },
  { href: '/student/redeem', label: 'شحن كود', icon: Ticket },
  { href: '/student/store', label: 'المتجر', icon: Store },
  { href: '/student/my-level', label: 'مستواي', icon: BookOpen },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (h: string) => (h === '/student' ? path === h : path.startsWith(h));

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-150 bg-brand-900 px-4">
        <LogoMark height={26} white />
        <span className="text-body font-medium text-white/90">حلقات جامع محمد العبدالكريم</span>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      {/* bottom bar on the phone, where the thumb already is */}
      <nav aria-label="التنقل"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink-200 bg-paper pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={active(t.href) ? 'page' : undefined}
            className={cx('flex flex-col items-center gap-1 py-3 transition-colors',
              active(t.href) ? 'text-brand-800' : 'text-ink-500')}>
            <t.icon size={21} strokeWidth={active(t.href) ? 2.1 : 1.8} />
            <span className="text-2xs font-medium">{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
