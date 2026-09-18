'use client';
/* The teacher's printed sheets — DESIGN.md §8, same rules as `/print/*`.

   They live under `/teacher/print` rather than beside the supervisor's because
   the middleware guards by AUDIENCE: `/print/*` opens on a supervisor's token
   and its sheets carry a hundred and seventeen boys. A teacher's token opens
   `/teacher/*` and these sheets carry twenty-five — his own. Two doors, because
   they are two different people, not two permissions on one account. */
import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';

export default function TeacherPrintLayout({ children }: { children: React.ReactNode }) {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    try { setEmbedded(window.self !== window.top); } catch { setEmbedded(true); }
  }, []);

  return (
    <div className={cx('min-h-screen print:bg-white print:py-0',
      embedded ? 'embedded bg-white py-0' : 'bg-ink-100 py-8')}>
      {children}
    </div>
  );
}
