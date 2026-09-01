'use client';
/* Tier 1 — the spine. 72px, brand-900, never collapses. Icon-only: the
   supervisor memorises the map in week one and labels become dead weight. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/Logo';
import { NAV, NAV_FOOT, SIGN_OUT, type NavItem } from '@/components/nav';
import { Num } from '@/components/Num';
import { useDB } from '@/lib/store';
import { cx } from '@/lib/cx';

function RailBtn({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <div className="group relative">
      <Link href={item.href} aria-label={item.label} aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
        className={cx('relative flex h-11 w-11 items-center justify-center rounded-lg',
          'transition-[background-color,color] duration-150 ease-brand',
          active ? 'bg-brand-700 text-white' : 'text-white/65 hover:bg-white/[.09] hover:text-white')}>
        <item.icon size={20} strokeWidth={1.85} />
        {item.badge ? (
          <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-2xs font-medium text-brand-900">
            <Num>{item.badge}</Num>
          </span>
        ) : null}
      </Link>
      {/* the rail carries no labels — the tooltip does */}
      <span role="tooltip"
        className="pointer-events-none absolute top-1/2 right-full z-[70] me-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-brand-900 px-2.5 py-1.5 text-micro text-white opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 md:block">
        {item.label}
      </span>
      {/* edge indicator */}
      {active && <span className="absolute inset-y-2 -right-3 w-[3px] rounded-s-full bg-brand-400" />}
    </div>
  );
}

export function Rail({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const path = usePathname();
  const db = useDB();

  const isActive = (item: NavItem) =>
    item.href === '/admin'
      ? path === '/admin'
      : path.startsWith(item.href) || !!item.also?.some((p) => path.startsWith(p));

  /* The one count worth interrupting the supervisor for: gifts a student has
     bought and is waiting to be handed. Read from the orders themselves —
     never a number typed into the navigation map. */
  const pendingOrders = db.orders.filter((o) => o.status === 'PENDING').length;
  const badgeFor = (item: NavItem) =>
    item.id === 'points' && pendingOrders > 0 ? pendingOrders : undefined;

  return (
    <nav aria-label="التنقل الرئيسي"
      className="relative z-50 flex w-14 shrink-0 flex-col items-center bg-brand-900 py-3.5 shadow-rail md:w-18">
      <Link href="/admin" aria-label="حلقة — الصفحة الرئيسية" className="mb-5 shrink-0"
        onClick={() => onNavigate?.('/admin')}>
        <LogoMark height={30} white />
      </Link>
      <div className="flex flex-1 flex-col items-center gap-1.5">
        {NAV.map((it) => (
          <RailBtn key={it.id} item={{ ...it, badge: badgeFor(it) }} active={isActive(it)}
            onNavigate={() => onNavigate?.(it.href)} />
        ))}
      </div>
      <div className="my-3 h-px w-7 bg-white/15" />
      <div className="flex flex-col items-center gap-1.5">
        {NAV_FOOT.map((it) => (
          <RailBtn key={it.id} item={it} active={isActive(it)} onNavigate={() => onNavigate?.(it.href)} />
        ))}
        <RailBtn item={SIGN_OUT} active={false} />
      </div>
    </nav>
  );
}
