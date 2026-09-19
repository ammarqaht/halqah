/* حصيلة الحضور والتسميع — من سجلّ المعلم وحده.
 *
 * Every report that prints an attendance figure reads it from here, so the
 * halaqa sheet, the student's report and the register can never disagree about
 * how many afternoons a boy was present.
 *
 * WHAT THIS REPLACES. The printed reports carried «أيام الحضور» from the
 * imported roster file — a single number per student, a term's total, correct
 * only until the next upload and unable to say WHICH day. It was the only
 * attendance figure in the system until the teachers' portal shipped, and it
 * has been wrong about the present tense ever since: a boy marked absent this
 * afternoon still printed last month's total.
 *
 * The rule the whole system is built on holds here too: a day with no row is
 * NOT an absence. It is counted in neither direction, and `recorded` says how
 * many afternoons the figures actually rest on — a percentage over three days
 * is not the same claim as one over thirty, and a report that hides the
 * denominator invites the reader to forget that.
 */

export type DayRow = {
  studentId: string;
  day: string;
  status: string;
  thobe?: boolean;
  incomplete?: boolean;
  lines?: { kind: string; recited: boolean; errors: number }[];
};

export type Attendance = {
  /** كم يومًا سُجِّل له أصلًا — مقام كل نسبة تحته. */
  recorded: number;
  present: number;
  late: number;
  absent: number;
  /** الحاضرون والمتأخرون معًا: «متأخر» حضور تأخّر، لا غياب. */
  attended: number;
  /** نسبة الحضور من المسجَّل — null حين لا سجلّ، لا صفرًا. */
  rate: number | null;
  /** أيام سمّع فيها شيئًا — وهي غير أيام الحضور. */
  recitedDays: number;
  /** أسطر سمّعها، ومجموع أخطائها. */
  lines: number;
  errors: number;
  /** أيام انتقل فيها بدرسه دون تمام مراجعته. */
  incomplete: number;
  /** آخر يوم سُجِّل له، و آخر يوم حضره. */
  lastRecorded: string | null;
  lastAttended: string | null;
  /** أطول سلسلة غياب متصلة في آخر ما سُجِّل — بأيام الحلقة لا بأيام التقويم. */
  absentStreak: number;
};

export const EMPTY_ATTENDANCE: Attendance = {
  recorded: 0, present: 0, late: 0, absent: 0, attended: 0, rate: null,
  recitedDays: 0, lines: 0, errors: 0, incomplete: 0,
  lastRecorded: null, lastAttended: null, absentStreak: 0,
};

/** «متأخر» is attendance that arrived late, not absence — §١٥. */
export const counts = (status: string) => status === 'PRESENT' || status === 'LATE';

/** One student's rows → his summary. Rows in any order; sorted here. */
export function summarise(rows: DayRow[]): Attendance {
  if (!rows.length) return EMPTY_ATTENDANCE;

  const sorted = [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  let present = 0, late = 0, absent = 0, recitedDays = 0, lines = 0, errors = 0, incomplete = 0;
  let lastAttended: string | null = null;

  for (const r of sorted) {
    if (r.status === 'PRESENT') present++;
    else if (r.status === 'LATE') late++;
    else if (r.status === 'ABSENT') absent++;
    if (counts(r.status)) lastAttended = r.day;
    if (r.incomplete) incomplete++;

    const recited = (r.lines ?? []).filter((l) => l.recited);
    if (recited.length) recitedDays++;
    lines += recited.length;
    errors += recited.reduce((n, l) => n + l.errors, 0);
  }

  /* Counted backwards from the newest RECORDED day, so a streak that is still
     running is what the report shows — which is the one worth acting on. */
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status !== 'ABSENT') break;
    streak++;
  }

  const recorded = present + late + absent;
  return {
    recorded, present, late, absent,
    attended: present + late,
    rate: recorded ? Math.round(((present + late) / recorded) * 100) : null,
    recitedDays, lines, errors, incomplete,
    lastRecorded: sorted[sorted.length - 1].day,
    lastAttended,
    absentStreak: streak,
  };
}

/** Many students' rows → a summary each, keyed by student id. */
export function summariseAll(rows: DayRow[]): Map<string, Attendance> {
  const byStudent = new Map<string, DayRow[]>();
  for (const r of rows) {
    const list = byStudent.get(r.studentId);
    if (list) list.push(r); else byStudent.set(r.studentId, [r]);
  }
  const out = new Map<string, Attendance>();
  for (const [id, list] of byStudent) out.set(id, summarise(list));
  return out;
}

/** A halaqa's total, from its students' rows. Not an average of averages: the
    rate is recomputed over every afternoon, so a boy with three records does
    not weigh the same as one with thirty. */
export function totalFor(rows: DayRow[]): Attendance {
  return summarise(rows.map((r) => ({ ...r, studentId: 'ALL' })));
}
