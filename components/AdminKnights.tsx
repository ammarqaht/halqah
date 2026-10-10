'use client';
/* فرسان الأسبوع — on the supervisor's screen, once each Sunday.

   «… اشعار للمشرف وللطلاب وللمعلمين عن فرسان الأسبوع … من باب تكريمهم»
   (client, 10 Oct 2026). The same arrival card the teacher and the boys get
   (components/AlertStory), carrying last week's knights by halaqa, with a door
   to the printable sheet. Seen once per supervisor per week
   (api/admin/knights-week); remembered in this browser too, so a preview
   account — whose writes are refused — is not shown it on every load. */
import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { AlertStory, type StoryItem } from '@/components/AlertStory';

type Week = { to: string; count: number; seen: boolean; groups: { halaqa: string; names: string[] }[] };
const LOCAL = 'halqah_knights_seen';

export function AdminKnights() {
  const [items, setItems] = useState<StoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/admin/knights-week').then((r) => (r.ok ? r.json() : null)).then((w: Week | null) => {
      let local = '';
      try { local = localStorage.getItem(LOCAL) ?? ''; } catch { /* private mode */ }
      if (w && w.count > 0 && !w.seen && local !== w.to) {
        setItems([{
          key: w.to, icon: Crown, label: 'فرسان الأسبوع',
          title: `${w.count} ${w.count === 1 ? 'فارس' : w.count === 2 ? 'فارسان' : w.count <= 10 ? 'فرسان' : 'فارسًا'} هذا الأسبوع`,
          body: w.groups.map((g) => `${g.halaqa}: ${g.names.join('، ')}`).join('\n'),
          at: w.to,
          href: '/admin/reports?r=knights',
        }]);
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  return (
    <AlertStory items={items} ready={ready} onSeen={(keys) => {
      if (!keys.length) return;
      try { localStorage.setItem(LOCAL, keys[0]); } catch { /* private mode */ }
      fetch('/api/admin/knights-week', { method: 'POST' }).catch(() => {});
    }} />
  );
}
