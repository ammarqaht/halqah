/* ─────────────────────────────────────────────────────────────────────────────
   ما الجديد — every update, announced once to everyone it touches.

   «من الان اي تحديث تضيفه ابيه يطلع كتنبيه للمشرف … لازم تطلع مرة لكل مشرف …
   ممكن المشرف مايشوف التحديثات لفترة او مايخش الموقع فتتجمع عليه كلها … ويصير
   في شرح للخاصية الجديدة خطوة بخطوة … هذي لاي تحديث عند المشرف او الطالب او
   المعلم» (client, 2 Oct 2026).

   THE RULE: a change anyone will notice ships WITH an entry here, in the same
   commit. Newest first. The id never changes once published — it is what
   `release_views` remembers a person has seen; renaming it shows it again.

   How it reaches people (components/whatsnew):
     · on arrival, every entry for that portal the person has not seen opens in
       «ما الجديد» — one after another, however many piled up while away;
     · an entry with a `tour` offers «ورّني كيف»: it opens `tour.href` and
       walks the page, lighting each `data-tour="…"` element in turn;
     · an account created after an entry's date is not shown it — a new
       supervisor is not handed a backlog of «new» things that predate him.
   ───────────────────────────────────────────────────────────────────────── */
import type { LucideIcon } from 'lucide-react';
import {
  Calculator, CalendarDays, ClipboardList, GraduationCap, Layers3, ListChecks,
  MessageSquareText, Printer, ShieldCheck, Users,
} from 'lucide-react';

export type Audience = 'admin' | 'teacher' | 'student';

export type TourStep = {
  /** The `data-tour` value to light. Missing on the page ⇒ the step centres. */
  target: string;
  title: string;
  body: string;
  /** Shown while the NEXT step's element is not on the page yet — what to do
      to make it appear («اختر طالبًا…»). The tour moves on by itself when it does. */
  waitHint?: string;
};

export type Release = {
  id: string;
  /** YYYY-MM-DD — when it went live. */
  date: string;
  audience: Audience[];
  title: string;
  summary: string;
  /** Up to three, each one line: what changed, in the reader's terms. */
  points: { icon: LucideIcon; title: string; body: string }[];
  /** A hero drawn for this entry (components/whatsnew/visuals). Absent ⇒ the
      generic medallion. */
  visual?: 'level';
  tour?: { href: string; steps: TourStep[] };
};

export const RELEASES: Release[] = [
  {
    id: '2026-10-10-report-parts',
    date: '2026-10-10',
    audience: ['admin'],
    title: 'اختر ما يُطبع من كل تقرير',
    summary:
      'في «التقارير» صار لكل تقرير أقسامه أو أعمدته، تختار منها ما تريد طباعته. وفي تقرير الطالب صار الحضور يومًا بيوم بما سمّعه، وكل التقارير تُطبع على A4 بلا صفحات فارغة.',
    points: [
      { icon: ListChecks, title: 'أنت تختار',
        body: 'علّم الأقسام أو الأعمدة التي تريدها، والمعاينة تتغيّر معك قبل الطباعة.' },
      { icon: CalendarDays, title: 'حضور الطالب يومًا بيوم',
        body: 'كل يوم سجّله معلّمه: حضوره وثوبه، وما سمّعه في الدرس والمراجعتين، وأخطاؤه.' },
      { icon: Printer, title: 'A4 مضبوط',
        body: 'لا صفحة فارغة بعد التقرير، وتاريخ الطباعة صار في رأس الورقة.' },
    ],
    tour: {
      href: '/admin/reports?r=student',
      steps: [
        { target: 'report-parts', title: 'أقسام التقرير',
          body: 'علّم ما تريد طباعته وأزل ما لا تريده. «الكل» يعلّم كل شيء، و«الافتراضي» يرجعه كما كان.' },
      ],
    },
  },
  {
    id: '2026-10-09-exam-detail-student',
    date: '2026-10-09',
    audience: ['student'],
    title: 'نتيجة اختبارك بالتفصيل',
    summary:
      'اضغط أي اختبار في «آخر اختباراتي» لترى درجتك، والأسئلة التي سُئلتها، وأخطاءك في كل سؤال، وملاحظات المختبِر.',
    points: [
      { icon: ClipboardList, title: 'كل سؤال وحده',
        body: 'السورة والآيات، وكم خطأً وتنبيهًا وخطأً تجويديًا فيه.' },
      { icon: Calculator, title: 'كيف جاءت الدرجة',
        body: 'كم نقص من درجتك بسبب الأخطاء والتنبيهات والتجويد.' },
      { icon: MessageSquareText, title: 'ملاحظات المختبِر',
        body: 'ما كُتب عنك في الاختبار، لتعرف ما تراجعه.' },
    ],
    tour: {
      href: '/student',
      steps: [
        { target: 'student-exams', title: 'آخر اختباراتي',
          body: 'اضغط أي بطاقة اختبار هنا، فتفتح لك نتيجته كاملة بأسئلتها وأخطائها.' },
      ],
    },
  },
  {
    id: '2026-10-09-exam-detail-teacher',
    date: '2026-10-09',
    audience: ['teacher'],
    title: 'اختبارات طلابك بالتفصيل',
    summary:
      'في صفحة أي طالب، اضغط اختبارًا من «اختباراته» فترى ما يراه المشرف: الدرجة، والأسئلة، وأخطاء كل سؤال، والملاحظات.',
    points: [
      { icon: ClipboardList, title: 'أين أخطأ بالضبط',
        body: 'كل سؤال بسورته وآياته، وأخطاؤه وتنبيهاته وتجويده.' },
      { icon: Calculator, title: 'كيف جاءت الدرجة',
        body: 'ما نقص من الدرجة بسبب كل نوع من الأخطاء.' },
      { icon: MessageSquareText, title: 'ملاحظات المختبِر',
        body: 'لتعرف ما يحتاج الطالب مراجعته في الحلقة.' },
    ],
  },
  {
    id: '2026-10-05-many-devices',
    date: '2026-10-05',
    audience: ['admin'],
    title: 'افتح النظام من أكثر من جهاز بأمان',
    summary:
      'كانت الصفحة المفتوحة من وقت طويل ترجّع البيانات القديمة إذا حفظت، فتمسح ما تغيّر من جهاز آخر. الحين كل صفحة تأخذ آخر نسخة من الخادم قبل ما تحفظ.',
    points: [
      { icon: ShieldCheck, title: 'لا شيء يرجع للخلف',
        body: 'المسار والمستوى والخطط اللي غيّرتها من جهاز ما ترجع لحالها القديمة لأن جهازًا آخر حفظ بعدك.' },
      { icon: Layers3, title: 'الطباعة تنتظر الحفظ',
        body: '«طباعة وحفظ التاريخ» تحفظ الخطة على الخادم أولًا ثم تفتح الورقة، فما تطلع «لا توجد خطة بهذا الرقم».' },
      { icon: Users, title: 'إذا عندك صفحة مفتوحة من قبل',
        body: 'حدّثها مرة واحدة (F5) عشان تشتغل بالطريقة الجديدة.' },
    ],
  },
  {
    id: '2026-10-02-one-level-everywhere',
    date: '2026-10-02',
    audience: ['admin'],
    title: 'مستوى الطالب واحد في كل الشاشات',
    summary:
      'صارت كل الشاشات تقرأ المستوى من مصدر واحد: الإعدادات، وبطاقة المعلم، والتقارير، وبوابة الطالب. ما عاد يتغيّر في مكان ويبقى قديمًا في مكان آخر.',
    points: [
      { icon: Layers3, title: 'المقرّر يتبع المستوى',
        body: 'إذا تغيّر المستوى، يبدأ الطالب من المقرّر ١ في المستوى الجديد، ولا يبقى على مقرّر المستوى السابق.' },
      { icon: Users, title: 'طباعة مستوى جديد تنقله',
        body: 'طباعة خطة مستوى جديد تنقله عند المعلم أيضًا، مثل «تعديل مستوى طالب» تمامًا.' },
      { icon: ShieldCheck, title: 'من تغيّر مستواه قبل هذا',
        body: 'يظهر في «الإعدادات» بزر «صدّر خطته». اضغطه واختر مستواه، فيثبت في كل مكان.' },
    ],
  },
  {
    id: '2026-10-02-student-level',
    date: '2026-10-02',
    audience: ['admin'],
    title: 'تعديل مستوى الطالب — من مكان واحد',
    summary:
      'غيّر مستوى أي طالب من شاشة واحدة في «الخطط»، فيتغيّر عنده وعند معلّمه وفي النظام كلّه معًا، وتصدر خطته الجديدة تلقائيًا.',
    visual: 'level',
    points: [
      { icon: Layers3, title: 'شاشة جديدة في الخطط',
        body: '«تعديل مستوى طالب» — تختار الطالب ثم مستواه الجديد.' },
      { icon: Users, title: 'يتغيّر في كل مكان',
        body: 'عند الطالب، وعند معلّمه من المقرّر ١، وتصدر خطة المستوى بتاريخ اليوم.' },
      { icon: ShieldCheck, title: 'مكان واحد فقط',
        body: 'رُفع تعديل المستوى من ملف الطالب، فلا يتغيّر في شاشة ويبقى في أخرى.' },
    ],
    tour: {
      href: '/admin/plans/level',
      steps: [
        { target: 'nav-level', title: 'من هنا تبدأ',
          body: 'في لوحة «الخطط» صار عندك «تعديل مستوى طالب» — المكان الوحيد لتغيير المستوى.' },
        { target: 'level-student', title: 'اختر الطالب',
          body: 'ابحث باسمه. يظهر لك مستواه الحالي ومساره وحلقته.',
          waitHint: 'اختر أي طالب لتظهر الخطوة التالية — لن يتغيّر شيء حتى تضغط «اعتماد».' },
        { target: 'level-grid', title: 'اختر المستوى الجديد',
          body: 'المستوى الحالي عليه «الآن». الرمادي لا منهج له بعد فلا يُختار.',
          waitHint: 'اضغط أي مستوى لترى ماذا سيحدث — ما زال لم يُحفظ شيء.' },
        { target: 'level-effect', title: 'ماذا سيحدث',
          body: 'قبل أن تعتمد، تقرأ بالضبط ما سيتغيّر عند الطالب وعند معلّمه وفي النظام.' },
        { target: 'level-save', title: 'اعتمد',
          body: 'ضغطة واحدة تنقله في كل مكان. بعدها يظهر لك زر «طباعة خطته».' },
      ],
    },
  },
];

/** Who each portal is, in words — the line under an entry's date. */
export const AUDIENCE_AR: Record<Audience, { label: string; icon: LucideIcon }> = {
  admin: { label: 'للمشرف', icon: ShieldCheck },
  teacher: { label: 'للمعلم', icon: Users },
  student: { label: 'للطالب', icon: GraduationCap },
};

export const releasesFor = (a: Audience) => RELEASES.filter((r) => r.audience.includes(a));
