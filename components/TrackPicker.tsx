'use client';
/* Pick the track, then the student.
   Seventy-two names in one list is a search box pretending to be a choice —
   and the supervisor almost always knows the track before the name, because
   he is working through one halaqa's silver boys or the eleven golden ones.
   Narrowing first turns a search into a short list. */
import { Chip } from '@/components/ui';
import { Num } from '@/components/Num';
import { TRACK_AR, type Student, type Track } from '@/lib/types';
import { cx } from '@/lib/cx';

export function TrackPicker({ value, onChange, students, tracks, className }: {
  value: Track | null;
  onChange: (t: Track | null) => void;
  students: Student[];
  /** Which tracks this screen offers — plans has no talqeen to offer. */
  tracks: Track[];
  className?: string;
}) {
  const n = (t: Track) => students.filter((s) => s.track === t).length;
  const all = students.filter((s) => tracks.includes(s.track as Track)).length;

  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      <button type="button" onClick={() => onChange(null)}
        className={cx('flex items-center gap-2 rounded-lg border px-3.5 py-2 text-body transition-colors',
          value === null
            ? 'border-brand-700 bg-brand-50 font-medium text-brand-900'
            : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
        كل المسارات
        <Chip tone="ink"><Num>{all}</Num></Chip>
      </button>
      {tracks.map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={cx('flex items-center gap-2 rounded-lg border px-3.5 py-2 text-body transition-colors',
            value === t
              ? 'border-brand-700 bg-brand-50 font-medium text-brand-900'
              : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
          {TRACK_AR[t]}
          <Chip tone="ink"><Num>{n(t)}</Num></Chip>
        </button>
      ))}
    </div>
  );
}
