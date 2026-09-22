'use client';
/* طلبات تعديل المقرّر — في صفحة المشرف الأولى.
 *
 * الطلب يُكتب عند المعلّم، ويُقضى فيه في «مقرّرات الطلاب». وبينهما هذه: الطلب
 * الذي لا أحد يعلم أنه وصل هو الورقة في الجيب نفسها، فقط في قاعدة بيانات.
 *
 * وتغيب حين لا طلب — «تنبيه يعرض صفرًا يعلّم قارئه ألّا يقرأه».
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn } from '@/components/ui';
import { Num } from '@/components/Num';

type Req = { id: string; studentName: string; askedByName: string };

export function AssignmentRequestsAlert() {
  const [rows, setRows] = useState<Req[]>([]);

  useEffect(() => {
    fetch('/api/admin/assignment-requests')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setRows(j.requests ?? []); })
      .catch(() => { /* التنبيه يغيب، والصفحة تبقى */ });
  }, []);

  if (!rows.length) return null;

  return (
    <Sheet className="rise mb-4 border-warn-200 bg-warn-100/40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warn-100 text-warn-700">
            <Pencil size={16} />
          </span>
          <div>
            <p className="text-lg2 font-medium text-ink-900">
              <Num>{rows.length}</Num>{' '}
              {rows.length === 1 ? 'طلب تعديل مقرّر'
                : rows.length === 2 ? 'طلبا تعديل مقرّر' : 'طلبات تعديل مقرّر'}
            </p>
            {/* بالأسماء: «ثلاثة طلبات» تجعله يفتح ليعرف على من. */}
            <p className="mt-1 max-w-[42rem] text-panel text-ink-600">
              {rows.slice(0, 4).map((r) => r.studentName).join(' · ')}
              {rows.length > 4 && <> وآخرون</>}
            </p>
          </div>
        </div>
        <Link href="/admin/settings?s=teachers&requests=1">
          <Btn variant="primary">اعرضها</Btn>
        </Link>
      </div>
    </Sheet>
  );
}
