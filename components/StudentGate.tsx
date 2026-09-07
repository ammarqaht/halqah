'use client';
/* Until student accounts exist (BUILD_PLAN phase 7 finishes the auth half),
   the portal is opened by picking who you are. It is honest about that rather
   than pretending to be signed in. */
import { useEffect, useState } from 'react';
import { Combobox } from '@/components/Combobox';
import { Btn, Empty } from '@/components/ui';
import { useDB } from '@/lib/store';
import { earnsPoints } from '@/lib/points';
import { UserRound } from 'lucide-react';

const KEY = 'halqah.student.id';

export function useStudentId(): [string, (v: string) => void] {
  const [id, setId] = useState('');
  useEffect(() => {
    try { setId(localStorage.getItem(KEY) ?? ''); } catch {}
  }, []);
  const set = (v: string) => {
    setId(v);
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {}
  };
  return [id, set];
}

export function StudentPicker({ onPick }: { onPick: (id: string) => void }) {
  const db = useDB();
  const [choice, setChoice] = useState('');

  if (!db.students.length) {
    return <Empty icon={UserRound} title="لا يوجد طلاب بعد"
      body="يضيف المشرف الطلاب من بوابة الإدارة أولًا." />;
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-12">
      <h1 className="font-display text-d2 text-ink-900">من أنت؟</h1>
      <p className="mt-2 text-base2 text-ink-600">اختر اسمك للدخول إلى صفحتك.</p>
      <div className="mt-6 space-y-3">
        <Combobox value={choice} onChange={setChoice}
          options={db.students.map((s) => ({
            value: s.id, label: s.fullName,
            hint: earnsPoints(s) ? undefined : 'تلقين',
          }))}
          placeholder="اختر اسمك" searchPlaceholder="ابحث باسمك…" />
        <Btn variant="primary" size="xl" className="w-full"
          disabled={!choice} onClick={() => onPick(choice)}>دخول</Btn>
      </div>
    </div>
  );
}
