/* Every tunable string and setting on the teacher surface, in one file — the
   same arrangement as `content/student.ts`, and for the same reason: a
   supervisor who wants «تسجيل اليوم» renamed should not need a developer to go
   looking for it inside a component.

   Rules the client APPROVED — the daily point values, the four attendance
   states, the absence thresholds — stay in `lib/teacher.ts` and in settings,
   and are deliberately not duplicated here. */

export const MOSQUE = 'جامع محمد العبدالكريم';
export const NEIGHBOURHOOD = 'حي أُحد، الدمام';

/**
 * Five destinations, and five equal tabs.
 *
 * The student's bar raises «شحن كود» out of the middle as a disc because it is
 * the one thing a boy does far more than anything else. The teacher's shape is
 * different: the client asked for five equal tabs, so «التسجيل» earns its place
 * by sitting second — first after الرئيسية, which is itself a card whose one
 * large button opens التسجيل. He reaches his afternoon's work in one tap from
 * anywhere, without a control that looks unlike the four beside it.
 *
 * الاختبارات and الخطط have no tab of their own on purpose. Everything the
 * teacher can do with either is READ: «إشعار الاستحقاق، وموعد الحجز، والنتيجة
 * مفصّلة» and «عرضها وطباعتها وإرسالها — لا إصدارها». So they live where they
 * are actually read — تنبيهات الرئيسية, ملف الطالب, and كشف المستحقين in
 * التقارير — rather than as two tabs that would each hold one list.
 * Same rule that kept الحلقات out of the supervisor's rail.
 */
export const TABS = [
  { href: '/teacher',          label: 'الرئيسية' },
  { href: '/teacher/register', label: 'التسجيل' },
  { href: '/teacher/students', label: 'طلابي' },
  { href: '/teacher/points',   label: 'النقاط' },
  { href: '/teacher/reports',  label: 'التقارير' },
] as const;

/**
 * ثلاث حالات، بترتيب العميل: حاضر — متأخر — غائب.
 *
 * مع-٣-ب asks for four and names «غائب بعذر» among them. The client removed it
 * on 18 Sep 2026 — «احذفها من الموقع كامل» — and it is gone from the database
 * enum too, not hidden here: a state no report knows how to count must not be
 * writable. It took a rule with it (see `absence` in lib/teacher.ts).
 */
export const STATUSES = [
  { code: 'PRESENT', label: 'حاضر',  short: 'حاضر' },
  { code: 'LATE',    label: 'متأخر', short: 'متأخر' },
  { code: 'ABSENT',  label: 'غائب',  short: 'غائب' },
] as const;

export type StatusCode = (typeof STATUSES)[number]['code'];

/** The tone each state carries, and the SHAPE beside it — DESIGN.md §1.4, so the
    card survives a greyscale print and a colour-blind reader. */
export const STATUS_TONE: Record<StatusCode, 'ok' | 'warn' | 'risk'> = {
  PRESENT: 'ok', LATE: 'warn', ABSENT: 'risk',
};

export const STATUS_SHAPE: Record<StatusCode, string> = {
  PRESENT: '●', LATE: '◐', ABSENT: '✕',
};

/** «صفوف المقررات تكتب كاملة وليس اختصارات» (client, 18 Sep 2026).
    `PLAN_KIND_AR` stays abbreviated — م.ك · م.ص — because it labels COLUMNS in
    printed tables where there is room for three characters and no more. On the
    card there is a whole row, so the line says what it is. */
export const KIND_FULL_AR: Record<string, string> = {
  MURAJAA_KUBRA: 'المراجعة الكبرى',
  MURAJAA_SUGHRA: 'المراجعة الصغرى',
  DARS: 'الدرس — الحفظ الجديد',
};

/**
 * The same three, for a box a third of a phone wide.
 *
 * «اسم المقرّر بسطر واحد» (client, 18 Sep 2026) in a column that is ninety
 * pixels across, and «الدرس — الحفظ الجديد» does not fit in ninety pixels at any
 * size worth reading. So the gloss goes and the name stays: beside «المراجعة
 * الكبرى» and «المراجعة الصغرى», «الدرس» is the third of three and cannot be
 * read as anything else. The full name still stands wherever there is a row for
 * it — بطاقة التسجيل, نافذة الملاحظة, التقارير — and م.ك / م.ص stay for the
 * printed columns.
 */
export const KIND_TIGHT_AR: Record<string, string> = {
  MURAJAA_KUBRA: 'المراجعة الكبرى',
  MURAJAA_SUGHRA: 'المراجعة الصغرى',
  DARS: 'الدرس',
};

/** The three recording modes (مع-٣-و). «وهو الأصل» on the first. */
export const MODES = [
  { code: 'DAY',    label: 'اليوم',      hint: 'تحضير الحلقة وتسميعها' },
  { code: 'PAST',   label: 'يوم سابق',   hint: 'يومٌ مضى، لطلاب الحلقة' },
  { code: 'PERIOD', label: 'فترة لطالب', hint: 'من تاريخ إلى تاريخ، لطالب واحد' },
] as const;

export type ModeCode = (typeof MODES)[number]['code'];

/** How many ledger movements the points screen asks for at a time. */
export const LEDGER_PAGE = 40;

export const COPY = {
  portal: 'بوابة المعلم',

  signInTitle: 'ادخل إلى بوابتك',
  idLabel: 'رقم الدخول',
  idHint: 'أربعة أرقام — من المشرف',
  pwLabel: 'كلمة المرور',
  pwHint: 'التي عيّنها لك المشرف، وتغيّرها بعد أول دخول',
  signIn: 'دخول',
  signingIn: 'جارٍ التحقق…',
  forgot: 'نسيت كلمة مرورك؟ راجع مشرف الحلقات — يعيد تعيينها لك.',

  /* الرئيسية */
  notStarted: 'لم يبدأ التسجيل',
  startDay: 'ابدأ تسجيل اليوم',
  continueDay: 'أكمل تسجيل اليوم',
  reviewDay: 'راجع تسجيل اليوم',
  /* «حال اليوم تكتب لا يوجد حلقة اليوم فقط بدون نصوص أخرى» (client, 18 Sep
     2026). It used to be «ليس من أيام حلقتك» over a paragraph explaining that
     an exceptional day may still be opened and that any day with attendance
     counts as a halaqa day. The paragraph is gone: the button beneath it SAYS
     «افتح اليوم استثناءً», which is the same sentence in one tap. */
  notHalaqaDay: 'لا توجد حلقة اليوم',
  openExceptional: 'افتح اليوم استثناءً',
  noAlerts: 'لا تنبيهات الآن. ما يحسبه النظام وما يصلك من الإدارة يظهر هنا.',

  /* التسجيل */
  allPresent: 'الكل حاضر',
  save: 'حفظ',
  /** What «حفظ» becomes when the teacher has cleared a card that was saved. */
  clearDay: 'امسح تسجيله',
  saved: 'محفوظ',
  saving: 'يُحفظ…',
  queued: 'في الانتظار — يُرفع تلقائيًا',
  offline: 'لا اتصال — سيُرفع تلقائيًا',
  noRoster: 'لا طلاب في حلقتك بعد. راجع المشرف ليُسند إليك طلابك.',
  pastDayWarning: 'أنت تسجّل يومًا مضى — تأكّد من التاريخ قبل الحفظ.',
  exceptionalDay: 'يوم استثنائي — ليس من أيام حلقتك المعتادة.',
  /* «المعلم لا يمكن ان يحدد مقرر الطالب» (client, 18 Sep 2026). It was a control
     here; it is a sentence now, and the supervisor sets it from بوابة الإدارة. */
  noAssignment: 'لم يُسجَّل له مقرّر بعد',
  noAssignmentBody:
    'لم يُحدَّد بعد أين وقف هذا الطالب في خطته، وتحديده عند مشرف الحلقة. راجعه '
    + 'ليضبطه، ثم يتحرّك المقرّر وحده بإنجاز الدرس. وحتى ذلك سجّل حضوره وثوبه.',
  errorsLabel: 'الأخطاء',
  lineNote: 'ملاحظة على هذا المقرّر',
  lineNotePlaceholder: 'أين تعثّر، وما يحتاج مراجعته — اختيارية',
  noteLabel: 'ملاحظة على تسميع اليوم',
  notePlaceholder: 'ملاحظة تعليمية قصيرة — اختيارية',
  pickStatusFirst: 'حدِّد حضوره ليفتح تسميعه',
  searchInDay: 'ابحث عن طالب في الحلقة',
  presentOnly: 'الحاضرون فقط',
  everyone: 'الجميع',
  saveAll: 'احفظ الكل',
  savingAll: 'يُحفظ الكل…',
  nothingToSave: 'لا شيء لم يُحفظ',
  /* حارس المغادرة — «تسجيل لم يُحفظ» (client, 22 Sep 2026). البطاقة تُملأ ثم
     يُضغط لسان آخر أو رابط، فيذهب ما كُتب بلا أن يقول أحد شيئًا. */
  leaveTitle: 'تسجيل لم يُحفظ بعد',
  leaveBody: 'هؤلاء سجّلتَ لهم ولم تحفظ. إن غادرت الآن ذهب ما كتبته لهم.',
  leaveSave: 'احفظ ثم تابع',
  leaveDiscard: 'غادر دون حفظ',
  leaveStay: 'ابقَ هنا',
  leaveFailed: 'تعذّر حفظ بعض البطاقات — انظر الخطأ على بطاقة كلٍّ منها.',
  moreAlerts: 'عرض المزيد',
  allAlerts: 'تنبيهات حلقتي',
  recentExams: 'آخر اختبارات طلابي',
  recentMoves: 'آخر حركات النقاط',
  todayProgress: 'تسميع اليوم',
  attendanceBar: 'حضور اليوم',

  /* طلابي */
  searchStudents: 'ابحث باسم الطالب',
  noStudents: 'لا طلاب مطابقون.',
  viewOnly: 'هذا الملف للعرض. للتصحيح استعمل «فترة لطالب» في التسجيل.',
  fromRatel: 'من ملف سابق',
  fromRatelHint:
    'عدد أيام مجمل من برنامج الجمعية قبل البوابة، بلا تواريخ — لا يُجمع مع '
    + 'شبكة الحضور أدناه.',
  noRecitation: 'لم يُسجَّل تسميع بعد. أول يوم تسجّله يظهر هنا.',
  noExams: 'لم تُسجَّل له اختبارات بعد.',
  beforeTransfer: 'ما قبل انتقاله إلى حلقتك',

  /* النقاط */
  pointsFixed:
    'النقاط اليومية ثابتة يحسبها النظام من تسجيلك. والأكواد والمكافآت والخصم عند '
    + 'المشرف وحده.',
  noPoints: 'لم تتحرّك نقاط حلقتك بعد.',
  honourBoard: 'لوحة شرف الحلقة',
  talqeenOnly: 'طلاب حلقتك في مسار التلقين، وهو خارج نظام النقاط والمتجر.',
  ordersView: 'عرضًا فقط — التسليم عند المشرف.',

  /* التقارير */
  reportsHint: 'كل تقرير يُطبع في ورقة واحدة، ويُحفظ ملفًا، ويُرسل لولي الأمر.',
  guardianHidden:
    'رقم ولي الأمر لا يُعرض لك — زرّ الإرسال يفتح واتساب برقمه مباشرة.',
} as const;

/**
 * Mirrors `TEACHER_PASSWORD_MIN` in `lib/auth.ts`, which is the authority and
 * enforces it.
 *
 * Duplicated rather than imported because `lib/auth.ts` is `server-only` — it
 * pulls in Prisma — and the sign-in screen is a client component. The server
 * refuses a short password whatever this file says; this is only the sentence
 * under the field, and a screen that promised eight while the server wanted ten
 * would be a wrong sentence, not a wrong rule.
 */
export const PASSWORD_MIN = 8;
