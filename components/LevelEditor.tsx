'use client';
/* Setting a student's level without issuing a sheet. The supervisor often
   knows where a student stands before the system does — a student joins
   mid-year, or was on a level long before the system existed. */
import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Combobox } from '@/components/Combobox';
import { Btn } from '@/components/ui';
import { Num } from '@/components/Num';
import { store } from '@/lib/store';
import { levelsFor, TRACK_AR, type Track } from '@/lib/types';
import { ajzaForLevel, isMidJuz } from '@/lib/exams';
import { juzWord } from '@/components/Num';

export function LevelEditor({ studentId, track, level }:
  { studentId: string; track: Track | null; level: number | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(level != null ? String(level) : '');

  if (!track || track === 'TALQEEN') {
    return <span className="text-panel text-ink-500">مسار التلقين بلا مستويات</span>;
  }

  const options = [
    { value: '', label: '— بلا مستوى —' },
    ...levelsFor(track).map((n) => {
      const a = ajzaForLevel(track, n);
      return { value: String(n), label: `المستوى ${n}`, hint: a !== null ? juzWord(a) : 'منتصف الجزء' };
    }),
  ];

  if (editing) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="min-w-[13rem] flex-1">
          <Combobox value={draft} onChange={setDraft} options={options}
            placeholder="اختر المستوى" searchPlaceholder="اكتب رقم المستوى…" />
        </span>
        <Btn size="sm" variant="primary" icon={Check}
          onClick={() => { store.setLevel(studentId, draft ? Number(draft) : null); setEditing(false); }}>
          حفظ
        </Btn>
        <Btn size="sm" icon={X} onClick={() => { setDraft(level != null ? String(level) : ''); setEditing(false); }}>
          إلغاء
        </Btn>
      </span>
    );
  }

  const ajza = ajzaForLevel(track, level);

  return (
    <span className="flex flex-wrap items-center gap-2">
      {level != null ? (
        <>
          <Num className="text-lg2 font-medium text-ink-900">{level}</Num>
          {ajza !== null
            ? <span className="text-panel text-ink-600">{juzWord(ajza)}</span>
            : isMidJuz(track, level) && <span className="text-micro text-ink-500">منتصف الجزء</span>}
        </>
      ) : (
        <span className="text-panel text-ink-500">لم يُحدَّد بعد</span>
      )}
      <button onClick={() => setEditing(true)}
        title="تعديل المستوى" aria-label="تعديل المستوى"
        className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900">
        <Pencil size={13} strokeWidth={1.9} />
      </button>
    </span>
  );
}
