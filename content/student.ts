/* Every tunable string and setting on the student surface, in one file.
   A supervisor who wants «شحن كود» renamed should not need a developer to find
   it inside a component. Rules the client APPROVED — the points values, the
   80% pass mark, the 24-day plan — stay in lib/ and in settings, and are
   deliberately not duplicated here. */

export const MOSQUE = 'جامع محمد العبدالكريم';
export const NEIGHBOURHOOD = 'حي أُحد، الدمام';

export const TABS = [
  { href: '/student',          label: 'الرئيسية' },
  { href: '/student/redeem',   label: 'شحن كود' },
  { href: '/student/store',    label: 'المتجر' },
  { href: '/student/my-level', label: 'مستواي' },
  { href: '/student/rank',     label: 'الترتيب' },
] as const;

/** How many boys stand on the podium before the list takes over. */
export const PODIUM = 3;

/**
 * Which weekdays the halaqa runs — 0 is Sunday, so Sunday to Thursday.
 *
 * Not used yet. The student's plan deliberately points at no «today»: nothing
 * records which day a boy actually reached, and a guess there sends a child to
 * the wrong passage. This waits for the teacher's screen, where attendance is
 * recorded and the same working-day counting becomes exact rather than
 * plausible.
 */
export const HALAQA_WEEKDAYS = [0, 1, 2, 3, 4];

/** How many ledger movements the home screen and the API return by default. */
export const LEDGER_PAGE = 30;
export const LEDGER_ON_HOME = 8;

export const COPY = {
  portal: 'بوابة الطالب',
  signInTitle: 'ادخل إلى بوابتك',
  idLabel: 'رقم الدخول',
  idHint: 'أربعة أرقام — من معلّمك',
  pinLabel: 'كلمة المرور',
  pinHint: 'رقم هويتك',
  signIn: 'دخول',
  signingIn: 'جارٍ التحقق…',
  forgot: 'نسيت رقم دخولك؟ اسأل معلّمك — كلمة المرور هي رقم هويتك.',

  talqeenPoints: 'أنت في مسار التلقين، وطلابه خارج نظام النقاط والمتجر.',
  talqeenPlan: 'مسار التلقين بلا مستوى ولا خطة — تُتابَع اختباراتك وحضورك مع معلّمك.',

  noExams: 'لم تُسجَّل لك اختبارات بعد. أول اختبار يظهر هنا فور رصده.',
  noMoves: 'لم تتحرّك نقاطك بعد. أول كود تشحنه يظهر هنا.',
  noOrders: 'لم تطلب شيئًا بعد. ما تشتريه من المتجر يظهر هنا برقم تعرضه عند الاستلام.',
  noGifts: 'لا هدايا معروضة الآن. اسأل معلّمك متى تُفتح.',
  noPlan: 'لم تُسلَّم لك خطة بعد. اسأل معلّمك عنها.',

  redeemTitle: 'اشحن كودك',
  redeemHint: 'وجّه كاميرا جوّالك إلى مربّع البطاقة، أو اكتب الكود بيدك.',
  fromCard: 'قُرئ الكود من بطاقتك — راجعه ثم اضغط «اشحن».',
  scan: 'مسح بالكاميرا',
  scanNoCamera: 'لا كاميرا متاحة على هذا الجهاز — اكتب الكود بيدك.',
  scanRefused: 'لم يُسمح باستخدام الكاميرا. اكتب الكود بيدك، أو اسمح بالوصول من إعدادات المتصفّح.',
  scanInsecure: 'الكاميرا تحتاج اتصالًا آمنًا. اكتب الكود بيدك.',

  buyConfirm: (n: number, gift: string) => `ستُخصم ${n} نقطة مقابل «${gift}». متأكد؟`,
  orderDone: 'اعرض هذا الرقم عند الاستلام.',

  levelDown: 'المستوى ينزل — كلما نقص الرقم اقتربت من الختم.',

  rankMine: 'حلقتي',
  rankAll: 'كل الحلقات',
  rankYou: 'أنت',
  rankBasis: 'يُحسب برصيد النقاط',
  rankTalqeen: 'طلاب التلقين خارج نظام النقاط، فلا ترتيب لهم فيه.',
  noRankHalaqa: 'لم تُسجَّل نقاط في حلقتك بعد. أول كود يُشحن يفتح اللوحة.',
  noRankAll: 'لم تُسجَّل نقاط في أي حلقة بعد.',
  rankFailed: 'تعذّر تحميل الترتيب.',
} as const;
