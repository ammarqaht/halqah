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
  { href: '/student/my-level', label: 'مستواي وخطتي' },
] as const;

/** Which weekdays the halaqa runs — 0 is Sunday. Used to estimate today's day
    in the plan, and nothing else. Sunday to Thursday. */
export const HALAQA_WEEKDAYS = [0, 1, 2, 3, 4];

/** How many ledger movements the home screen and the API return by default. */
export const LEDGER_PAGE = 30;
export const LEDGER_ON_HOME = 8;

export const COPY = {
  portal: 'بوابة الطالب',
  signInTitle: 'ادخل إلى بوابتك',
  idLabel: 'رقم الهوية',
  pinLabel: 'الرمز السرّي',
  pinHint: 'خمسة أرقام',
  signIn: 'دخول',
  signingIn: 'جارٍ التحقق…',
  forgot: 'نسيت رمزك؟ راجع معلّمك — هو من يعيد تعيينه.',

  mustChange: 'غيّر رمزك',
  mustChangeWhy: 'هذا الرمز أُعطي لك على ورقة. اختر رمزًا تحفظه وحدك.',

  talqeenPoints: 'أنت في مسار التلقين، وطلابه خارج نظام النقاط والمتجر.',
  talqeenPlan: 'مسار التلقين بلا مستوى ولا خطة — تُتابَع اختباراتك وحضورك مع معلّمك.',

  noExams: 'لم تُسجَّل لك اختبارات بعد. أول اختبار يظهر هنا فور رصده.',
  noMoves: 'لم تتحرّك نقاطك بعد. أول كود تشحنه يظهر هنا.',
  noOrders: 'لم تطلب شيئًا بعد. ما تشتريه من المتجر يظهر هنا برقم تعرضه عند الاستلام.',
  noGifts: 'لا هدايا معروضة الآن. اسأل معلّمك متى تُفتح.',
  noPlan: 'لم تُسلَّم لك خطة بعد. اسأل معلّمك عنها.',

  redeemTitle: 'اشحن كودك',
  redeemHint: 'اكتب الكود المطبوع على البطاقة، أو امسحه بالكاميرا.',
  scan: 'مسح بالكاميرا',
  scanNoCamera: 'لا كاميرا متاحة على هذا الجهاز — اكتب الكود بيدك.',
  scanRefused: 'لم يُسمح باستخدام الكاميرا. اكتب الكود بيدك، أو اسمح بالوصول من إعدادات المتصفّح.',
  scanInsecure: 'الكاميرا تحتاج اتصالًا آمنًا. اكتب الكود بيدك.',

  buyConfirm: (n: number, gift: string) => `ستُخصم ${n} نقطة مقابل «${gift}». متأكد؟`,
  orderDone: 'اعرض هذا الرقم عند الاستلام.',

  todayEstimate: 'يومك اليوم — تقديريًا',
  todayWhy: 'محسوب من تاريخ تسليم الورقة، لا من حضورك — اضغط أي يوم آخر لتراه.',
  levelDown: 'المستوى ينزل — كلما نقص الرقم اقتربت من الختم.',
} as const;
