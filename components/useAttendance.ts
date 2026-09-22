'use client';
import { useEffect, useState } from 'react';
import type { Attendance } from '@/lib/attendance';

export type AttendancePayload = {
  ever: number;
  from: string | null;
  to: string | null;
  students: Record<string, Attendance>;
  total: Attendance;
  lastDay: string | null;
  /** Only when asked for a halaqa or a student. */
  lastLesson?: Record<string, { day: string; surah: string; ayah: string }>;
};

/* حصيلة الحضور من سجلّ المعلم — للتقارير المطبوعة.
   They read the browser's store, and the store carries nothing the teachers
   write, so a report that wants «كم حضر» has to ask the server. Returns null
   while loading and on failure: a sheet must print with a dash rather than not
   print at all. */
export function useAttendance(opts: {
  halaqa?: string | null; student?: string | null;
  from?: string | null; to?: string | null;
} = {}): AttendancePayload | null {
  const { halaqa, student, from, to } = opts;
  const [d, setD] = useState<AttendancePayload | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (halaqa) q.set('halaqa', halaqa);
    if (student) q.set('student', student);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    fetch(`/api/admin/attendance?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setD(j))
      .catch(() => { /* the sheet prints without it */ });
  }, [halaqa, student, from, to]);

  return d;
}
