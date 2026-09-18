'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   تنبيهات حلقتي — الجرس، والصفّ، والنافذة.

   «والتنبيه الذي لا يستطيع النظام حسابه لا يُعرض أصلًا» (مع-٢): every alert here
   comes from a row — a pointer that stopped, a booking, a result, a plan, a run
   of absences, or a message from the administration.

   Three parts, in one file because they are one thing seen at three sizes:

     · `AlertRow`    — a tap goes where the alert is about. «وكل تنبيه ينقل
                       بنقرة إلى مكانه.»
     · `AlertsModal` — all of them, however many.
     · `AlertsBell`  — the bell in the hero beside خروج, with the unread count
                       on it. «يكون في الأعلى بجانب زر الخروج أيقونة جرس لعرض
                       نافذة فيها التنبيهات كلها» (client, 18 Sep 2026).

   الرئيسية still shows the newest five with «عرض المزيد» under them, and that
   button opens this same window: two doors, one room.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { useState } from 'react';
import {
  Award, Bell, BellOff, CalendarClock, ChevronLeft, FileText, Megaphone, UserX,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Btn, Empty, Modal } from '@/components/ui';
import { Num } from '@/components/Num';
import { useMe, type Alert } from '@/components/teacher/Me';
import { COPY } from '@/content/teacher';
import { formatDate, relativeDay } from '@/lib/dates';
import { cx } from '@/lib/cx';

export const KIND: Record<Alert['kind'], { icon: LucideIcon; tone: string; label: string }> = {
  EXAM_DUE: { icon: Award,         tone: 'text-warn-700 bg-warn-100',   label: 'يستحق الاختبار' },
  BOOKED:   { icon: CalendarClock, tone: 'text-info-700 bg-info-100',   label: 'اختبار محجوز' },
  RESULT:   { icon: Award,         tone: 'text-ok-700 bg-ok-100',       label: 'نتيجة' },
  PLAN:     { icon: FileText,      tone: 'text-brand-800 bg-brand-100', label: 'خطة' },
  ABSENCE:  { icon: UserX,         tone: 'text-risk-700 bg-risk-100',   label: 'غياب متكرر' },
  MESSAGE:  { icon: Megaphone,     tone: 'text-ink-700 bg-ink-100',     label: 'من الإدارة' },
};

/**
 * One alert.
 *
 * It carries its own date — «تنبيهات حلقتي يكون معها تاريخ التنبيه» (client,
 * 18 Sep 2026) — as «أمس» or «قبل ٣ أيام» while that still means something, and
 * as the date itself once it does not. A teacher deciding whether to act on
 * «غاب ثلاثة أيام متتالية» is deciding about WHEN as much as about who.
 */
export function AlertRow({ alert: a, onRead }: { alert: Alert; onRead: () => void }) {
  const k = KIND[a.kind];
  const I = k.icon;
  const day = a.at ? a.at.slice(0, 10) : '';

  const body = (
    <>
      <span className={cx('relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', k.tone)}>
        <I size={16} strokeWidth={1.9} />
        {/* «التنبيه غير المقروء فيه دائرة خضراء صغيرة في أيقونة التنبيه». */}
        {!a.read && (
          <span aria-label="غير مقروء"
            className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-700 ring-2 ring-paper" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-micro text-ink-500">
          <span>{k.label}</span>
          {day && (
            <span className="text-ink-400">
              · {relativeDay(day)}
              <span className="ms-1.5"><Num>{formatDate(day)}</Num></span>
            </span>
          )}
        </p>
        <p className={cx('mt-px text-sm2 leading-relaxed',
          a.read ? 'text-ink-700' : 'font-medium text-ink-900')}>
          {a.body}
        </p>
      </div>
    </>
  );

  /* «وكل تنبيه ينقل بنقرة إلى مكانه» — a message has nowhere to go, so it is a
     button that only marks itself read rather than a link that pretends. */
  return (
    <li className="border-t border-ink-150 first:border-t-0">
      {a.kind === 'MESSAGE' ? (
        <button type="button" onClick={onRead}
          className="press flex w-full items-start gap-3 px-[18px] py-3 text-start transition-colors hover:bg-brand-50">
          {body}
        </button>
      ) : (
        <Link href={a.href} onClick={onRead}
          className="press flex items-start gap-3 px-[18px] py-3 transition-colors hover:bg-brand-50">
          {body}
          <ChevronLeft size={16} className="mt-1.5 shrink-0 text-ink-300" strokeWidth={2} />
        </Link>
      )}
    </li>
  );
}

/** كل التنبيهات — the window both doors open on. */
export function AlertsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, markRead } = useMe();
  const alerts = me?.alerts ?? [];
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <Modal open={open} onClose={onClose} title={COPY.allAlerts} wide
      footer={<>
        {unread > 0 && (
          <Btn onClick={() => markRead(alerts.filter((a) => !a.read).map((a) => a.key))}>
            علّم الكل مقروءًا
          </Btn>
        )}
        <Btn variant="primary" onClick={onClose}>تم</Btn>
      </>}>
      {alerts.length === 0 ? (
        <Empty icon={BellOff} title="لا تنبيهات" body={COPY.noAlerts} />
      ) : (
        <ul className="-mx-1 max-h-[60vh] overflow-y-auto rounded-xl border border-ink-150">
          {alerts.map((a) => (
            <AlertRow key={a.key} alert={a} onRead={() => markRead([a.key])} />
          ))}
        </ul>
      )}
    </Modal>
  );
}

/**
 * الجرس — in the hero, beside خروج.
 *
 * On the brand field, so it wears the field's own white-on-teal rather than the
 * page's chrome. The unread count rides on it: a bell that says «٣» is read
 * across the room, and a bell with nothing on it is not asking for anything.
 */
export function AlertsBell({ className }: { className?: string }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  /* «الرقم اللي عند أيقونة الجرس يحسب أرقام التنبيهات غير المقروءة» (client,
     18 Sep 2026). It used to fall back to the TOTAL when nothing was unread,
     which made a bell reading «٣» mean two different things on two afternoons —
     and the one that matters, «ثلاثة تنتظرك», is the one it stopped meaning.
     Nothing unread, no number: the bell is then a door and not a summons. */
  const unread = me?.unread ?? 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `التنبيهات — ${unread} غير مقروء` : 'التنبيهات'}
        className={cx('press relative flex h-[34px] items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs2 text-brand-100 transition-colors hover:bg-white/20 hover:text-white',
          className)}>
        <Bell size={15} strokeWidth={1.9} />
        {unread > 0 && <Num className="font-bold text-white">{unread}</Num>}
        {unread > 0 && (
          <span aria-hidden
            className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-ok-500 ring-2 ring-brand-900" />
        )}
      </button>
      <AlertsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
