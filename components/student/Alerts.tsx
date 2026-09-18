'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   تنبيهاتي — الجرس في البطاقة، والبلوك أسفل الاختبارات، والنافذة.

   «أضف زرّ الجرس للطالب، وبلوك التنبيهات كذلك أسفل بلوك الاختبارات» (client,
   18 Sep 2026). The teacher's bell and block shipped first; this is the same
   shape on the other side of the same afternoon, which is the point — a note his
   teacher wrote while he recited reaches him looking like what it is.

   Every alert here is a ROW: a note beside a مقرّر, a result, a booking, a gift,
   a message from the administration. «والتنبيه الذي لا يستطيع النظام حسابه لا
   يُعرض أصلًا» holds harder for a child than for his teacher.

   The read-marker lives in this file's own hook rather than in `Me`, because
   unlike the teacher's `me` payload the student's alerts are their own request:
   his home screen already asks for four things and this is the fifth, not a
   sixth field on one of them.
   ───────────────────────────────────────────────────────────────────────── */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Award, Bell, BellOff, CalendarClock, ChevronLeft, Gift, Megaphone, MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Btn, Empty, Modal } from '@/components/ui';
import { Num } from '@/components/Num';
import { relativeDay, formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

export type StudentAlert = {
  kind: 'NOTE' | 'EXAM' | 'BOOKED' | 'GIFT' | 'MESSAGE';
  key: string; read: boolean; href?: string;
  title: string; body: string; at: string;
};

const KIND: Record<StudentAlert['kind'], { icon: LucideIcon; tone: string }> = {
  NOTE:    { icon: MessageSquare, tone: 'text-brand-800 bg-brand-100' },
  EXAM:    { icon: Award,         tone: 'text-ok-700 bg-ok-100' },
  BOOKED:  { icon: CalendarClock, tone: 'text-info-700 bg-info-100' },
  GIFT:    { icon: Gift,          tone: 'text-warn-700 bg-warn-100' },
  MESSAGE: { icon: Megaphone,     tone: 'text-ink-700 bg-ink-100' },
};

/** How many sit on الرئيسية before «عرض المزيد» takes the rest. */
const SHOWN = 5;

/** One read of his alerts, and one way to tick them off. */
export function useStudentAlerts() {
  const [alerts, setAlerts] = useState<StudentAlert[] | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    fetch('/api/student/alerts')
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => setAlerts([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const markRead = useCallback((keys: string[]) => {
    const fresh = keys.filter((k) => k && !read.has(k));
    if (!fresh.length) return;
    setRead((s) => new Set([...s, ...fresh]));
    fetch('/api/student/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: fresh }),
    }).then(() => load()).catch(() => { /* the dot is back on the next load */ });
  }, [read, load]);

  const merged = (alerts ?? []).map(
    (a) => (a.read || read.has(a.key) ? { ...a, read: true } : a));

  return { alerts: merged, loading: alerts === null, unread: merged.filter((a) => !a.read).length, markRead };
}

function Row({ alert: a, onRead }: { alert: StudentAlert; onRead: () => void }) {
  const k = KIND[a.kind];
  const I = k.icon;
  const day = a.at.slice(0, 10);

  const body = (
    <>
      <span className={cx('relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', k.tone)}>
        <I size={17} strokeWidth={1.9} />
        {!a.read && (
          <span aria-label="غير مقروء"
            className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-700 ring-2 ring-paper" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={cx('text-sm2', a.read ? 'font-medium text-ink-700' : 'font-bold text-ink-900')}>
            {a.title}
          </span>
          <span className="text-micro text-ink-400">
            {relativeDay(day)} · <Num>{formatDate(day)}</Num>
          </span>
        </span>
        <span className={cx('mt-0.5 block text-xs2 leading-relaxed',
          a.read ? 'text-ink-500' : 'text-ink-700')}>
          {a.body}
        </span>
      </span>
    </>
  );

  return (
    <li className="border-t border-ink-150 first:border-t-0">
      {a.href ? (
        <Link href={a.href} onClick={onRead}
          className="press flex items-start gap-3 px-[18px] py-3 transition-colors hover:bg-brand-50">
          {body}
          <ChevronLeft size={16} className="mt-2 shrink-0 text-ink-300" strokeWidth={2} />
        </Link>
      ) : (
        <button type="button" onClick={onRead}
          className="press flex w-full items-start gap-3 px-[18px] py-3 text-start transition-colors hover:bg-brand-50">
          {body}
        </button>
      )}
    </li>
  );
}

export function StudentAlertsModal({ open, onClose, alerts, unread, markRead }: {
  open: boolean; onClose: () => void;
  alerts: StudentAlert[]; unread: number; markRead: (keys: string[]) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="تنبيهاتي" wide
      footer={<>
        {unread > 0 && (
          <Btn onClick={() => markRead(alerts.filter((a) => !a.read).map((a) => a.key))}>
            علّم الكل مقروءًا
          </Btn>
        )}
        <Btn variant="primary" onClick={onClose}>تم</Btn>
      </>}>
      {alerts.length === 0 ? (
        <Empty icon={BellOff} title="لا تنبيهات"
          body="ما يكتبه لك معلمك، ونتائج اختباراتك، وهداياك، ورسائل الإدارة — كلها تظهر هنا." />
      ) : (
        <ul className="-mx-1 max-h-[60vh] overflow-y-auto rounded-xl border border-ink-150">
          {alerts.map((a) => (
            <Row key={a.key} alert={a} onRead={() => markRead([a.key])} />
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** الجرس — on the card, beside خروج. The count is what is UNREAD, and nothing
    at all when nothing is: a bell with no number is a door, not a summons. */
export function StudentAlertsBell({ unread, onOpen }: {
  unread: number; onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen}
      aria-label={unread > 0 ? `تنبيهاتي — ${unread} غير مقروء` : 'تنبيهاتي'}
      className="press relative flex h-[34px] items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs2 text-brand-100 transition-colors hover:bg-white/20 hover:text-white">
      <Bell size={15} strokeWidth={1.9} />
      {unread > 0 && <Num className="font-bold text-white">{unread}</Num>}
      {unread > 0 && (
        <span aria-hidden
          className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-ok-500 ring-2 ring-brand-900" />
      )}
    </button>
  );
}

/** البلوك — five of them, under his exams. */
export function StudentAlertsBlock({ alerts, loading, unread, markRead, onAll }: {
  alerts: StudentAlert[]; loading: boolean; unread: number;
  markRead: (keys: string[]) => void; onAll: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-ink-150 bg-paper p-5 shadow-soft">
        {[0, 1, 2].map((i) => <div key={i} className="skel h-12 rounded-lg" />)}
      </div>
    );
  }

  return (
    <section className="rise">
      <div className="flex items-baseline justify-between gap-3 px-0.5 pb-2.5">
        <h2 className="text-base2 font-bold text-ink-900">تنبيهاتي</h2>
        {unread > 0 && (
          <span className="shrink-0 text-cap text-ink-500">
            <Num className="font-bold text-brand-800">{unread}</Num> غير مقروء
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-ink-150 bg-paper shadow-soft">
          <Empty icon={BellOff} title="لا تنبيهات"
            body="ما يكتبه لك معلمك، ونتائج اختباراتك، وهداياك، ورسائل الإدارة — كلها تظهر هنا." />
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-2xl border border-ink-150 bg-paper shadow-soft">
            {alerts.slice(0, SHOWN).map((a) => (
              <Row key={a.key} alert={a} onRead={() => markRead([a.key])} />
            ))}
          </ul>
          {alerts.length > SHOWN && (
            <Btn className="mt-2.5 w-full" onClick={onAll}>
              عرض المزيد (<Num>{alerts.length - SHOWN}</Num>)
            </Btn>
          )}
        </>
      )}
    </section>
  );
}
