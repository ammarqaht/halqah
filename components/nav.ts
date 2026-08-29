/* Navigation map — DESIGN.md §6. Reconciled against the approved scope:
   attendance and recitation stay in Ratel; no guardian portal in phase 1. */
import { Home, Users, FileText, ClipboardCheck, Coins, LineChart, Settings, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = { id: string; label: string; href: string; icon: LucideIcon; badge?: number };

export const NAV: NavItem[] = [
  { id: 'home',      label: 'الرئيسية',           href: '/admin',           icon: Home },
  { id: 'students',  label: 'الطلاب والحلقات',    href: '/admin/students',  icon: Users },
  { id: 'plans',     label: 'الخطط',              href: '/admin/plans',     icon: FileText },
  { id: 'exams',     label: 'الاختبارات',          href: '/admin/exams',     icon: ClipboardCheck },
  { id: 'points',    label: 'النقاط والمتجر',      href: '/admin/points',    icon: Coins, badge: 4 },
  { id: 'follow',    label: 'المتابعة والتقارير',  href: '/admin/follow-up', icon: LineChart },
];

export const NAV_FOOT: NavItem[] = [
  { id: 'settings', label: 'الإعدادات', href: '/admin/settings', icon: Settings },
];

export const SIGN_OUT = { id: 'logout', label: 'تسجيل الخروج', href: '/login', icon: LogOut };
