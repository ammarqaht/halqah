/* Navigation map — DESIGN.md §6. Reconciled against the approved scope:
   attendance and recitation stay in Ratel; no guardian portal in phase 1. */
import { Home, Users, FileText, ClipboardCheck, Coins, LineChart, Settings, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** `badge` is supplied by the rail from live data, never written into this map:
    a hard-coded count is an invented figure, and this product does not print
    those. The store's «طلبات بانتظار التسليم» fills it when orders exist. */
export type NavItem = {
  id: string; label: string; href: string; icon: LucideIcon; badge?: number;
  /** Extra route prefixes this destination owns. النقاط والمتجر is one rail
      entry over three routes, and the icon must stay lit across all of them. */
  also?: string[];
};

export const NAV: NavItem[] = [
  { id: 'home',      label: 'الرئيسية',           href: '/admin',           icon: Home },
  { id: 'students',  label: 'الطلاب والحلقات',    href: '/admin/students',  icon: Users },
  { id: 'plans',     label: 'الخطط',              href: '/admin/plans',     icon: FileText },
  { id: 'exams',     label: 'الاختبارات',          href: '/admin/exams',     icon: ClipboardCheck },
  { id: 'points',    label: 'النقاط والمتجر',      href: '/admin/points',    icon: Coins, also: ['/admin/store'] },
  { id: 'follow',    label: 'المتابعة والتقارير',  href: '/admin/follow-up', icon: LineChart },
];

export const NAV_FOOT: NavItem[] = [
  { id: 'settings', label: 'الإعدادات', href: '/admin/settings', icon: Settings },
];

export const SIGN_OUT = { id: 'logout', label: 'تسجيل الخروج', href: '/login', icon: LogOut };
