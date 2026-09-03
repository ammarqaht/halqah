'use client';
/* قائمة التسليم — approved PDF §8 (إد-٤-ج):
   «قائمة تسليم قابلة للطباعة: كل الطلبات المعلّقة مرتّبة بالحلقة».

   Grouped by halaqa because that is how the gifts are physically handed out —
   the supervisor walks to one circle with its pile, not to one student with one
   parcel. Each row carries a tick box: the sheet is worked on with a pen in the
   mosque and entered afterwards. */
import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits, orderWord } from '@/components/Num';
import { Btn } from '@/components/ui';
import { useDB } from '@/lib/store';

import { formatDate } from '@/lib/dates';

export default function PickList() {
  const db = useDB();

  const groups = useMemo(() => {
    const pending = db.orders.filter((o) => o.status === 'PENDING');
    const byHalaqa = new Map<string, { title: string; teacher: string; orders: typeof pending }>();

    for (const o of pending) {
      const s = db.students.find((x) => x.id === o.studentId);
      const h = s?.halaqaId ? db.halaqat.find((x) => x.id === s.halaqaId) ?? null : null;
      const key = h?.id ?? 'none';
      if (!byHalaqa.has(key)) {
        byHalaqa.set(key, {
          title: h ? `حلقة ${h.teacher}` : 'طلاب بلا حلقة',
          teacher: h?.teacher ?? '',
          orders: [],
        });
      }
      byHalaqa.get(key)!.orders.push(o);
    }

    /* «بلا حلقة» sinks to the bottom: it is the exception, and the supervisor
       walks the circles in order before he goes looking for the strays. */
    return [...byHalaqa.entries()]
      .sort((a, b) => (a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : b[1].orders.length - a[1].orders.length))
      .map(([, g]) => ({
        ...g,
        orders: [...g.orders].sort((x, y) => x.number - y.number),
      }));
  }, [db.orders, db.students, db.halaqat]);

  const total = groups.reduce((n, g) => n + g.orders.length, 0);
  const nameOf = (id: string) => db.students.find((s) => s.id === id)?.fullName ?? '—';

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-4 px-2">
        <p className="text-panel text-ink-600">
          <Num>{total}</Num> {orderWord(total)} بانتظار التسليم.
        </p>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <header className="mb-6 flex items-center justify-between gap-4 border-b-2 border-brand-700 pb-4">
          <LogoMark height={38} white={false} />
          <div className="text-center">
            <h1 className="font-display text-t1 text-ink-900">قائمة تسليم الهدايا</h1>
            <p className="mt-0.5 text-xs2 text-ink-600">
              الطلبات المعلّقة · <Num>{toArabicDigits(formatDate(new Date().toISOString()))}</Num>
            </p>
          </div>
          <LogoJamiyah height={38} />
        </header>

        {total === 0 ? (
          <p className="py-16 text-center text-lg2 text-ink-500">لا توجد طلبات بانتظار التسليم.</p>
        ) : (
          groups.map((g) => (
            <section key={g.title} className="mb-7 last:mb-0">
              <h2 className="keep mb-2 flex items-baseline justify-between border-b border-ink-200 pb-1.5">
                <span className="font-display text-lg2 text-ink-900">{g.title}</span>
                <span className="text-xs2 text-ink-500">
                  <Num>{toArabicDigits(g.orders.length)}</Num> {orderWord(g.orders.length)}
                </span>
              </h2>
              <table className="w-full border-collapse text-sm2">
                <thead>
                  <tr className="text-cap text-ink-500">
                    <th className="w-8 py-1.5 text-start font-medium">سُلِّم</th>
                    <th className="w-16 py-1.5 text-start font-medium">رقم</th>
                    <th className="py-1.5 text-start font-medium">الطالب</th>
                    <th className="py-1.5 text-start font-medium">الهدية</th>
                    <th className="w-20 py-1.5 text-start font-medium">النقاط</th>
                  </tr>
                </thead>
                <tbody>
                  {g.orders.map((o) => (
                    <tr key={o.id} className="keep border-t border-ink-150">
                      {/* a real box, because this sheet is filled in with a pen */}
                      <td className="py-2">
                        <span className="block h-4 w-4 rounded-sm border border-ink-400" />
                      </td>
                      <td className="py-2"><Num>{toArabicDigits(o.number)}</Num></td>
                      <td className="py-2 text-ink-900">{nameOf(o.studentId)}</td>
                      <td className="py-2 text-ink-700">{o.giftNameSnapshot}</td>
                      <td className="py-2"><Num>{toArabicDigits(o.pointsSpent)}</Num></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}

        <footer className="mt-8 flex items-center justify-between border-t border-ink-150 pt-3 text-micro text-ink-500">
          <span>يُعلَّم على المسلَّم، ثم يُدخل في شاشة المتجر</span>
          <span>حلقات جامع محمد العبدالكريم — الدمام، حي أُحد</span>
        </footer>
      </div>
    </>
  );
}
