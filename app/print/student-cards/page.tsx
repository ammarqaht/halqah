'use client';
/* بطاقات الطلاب — one slip per boy, cut from the sheet and handed over.

   Eighteen to an A4 page: three across, six down, at 234 × 167px. Bigger
   cards would be kinder to read and would double the paper, and a supervisor
   printing a hundred and seventeen of these cares about the stack.

   Dashed rules run the full width and height of the grid rather than being
   drawn per card, so a guillotine cuts straight through six at once.

   The QR carries the portal's sign-in with his number already in it, so a boy
   points his own camera at his own card and only has to type his id. */
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Printer, AlertTriangle } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Num } from '@/components/Num';
import { Btn } from '@/components/ui';
import { MOSQUE } from '@/content/student';

type Card = {
  id: string; fullName: string; halaqa: string | null;
  username: string | null; password: string | null;
};

const PER_PAGE = 18;   // 3 × 6

function Sheet() {
  const sp = useSearchParams();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = new URLSearchParams();
    if (sp.get('student')) q.set('student', sp.get('student')!);
    if (sp.get('halaqa')) q.set('halaqa', sp.get('halaqa')!);
    fetch(`/api/admin/cards?${q}`)
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => setCards(d.cards ?? []))
      .catch(() => setCards([]));
  }, [sp]);

  useEffect(() => {
    if (!cards?.length) return;
    let cancelled = false;
    const origin = window.location.origin;
    (async () => {
      const out: Record<string, string> = {};
      for (const c of cards) {
        /* His own number in the link: he lands on the sign-in with it filled
           and types only his id. A card with no account gets the bare portal. */
        const url = c.username
          ? `${origin}/student/login?u=${encodeURIComponent(c.username)}`
          : `${origin}/student/login`;
        out[c.id] = await QRCode.toString(url, {
          type: 'svg', margin: 0, errorCorrectionLevel: 'M',
          color: { dark: '#0A403C', light: '#0000' },
        });
      }
      if (!cancelled) setQr(out);
    })();
    return () => { cancelled = true; };
  }, [cards]);

  if (!cards) {
    return <div className="sheet-a4 font-sans" dir="rtl">
      <p className="py-16 text-center text-lg2 text-ink-500">جارٍ التحضير…</p>
    </div>;
  }

  if (!cards.length) {
    return <div className="sheet-a4 font-sans" dir="rtl">
      <p className="py-16 text-center text-lg2 text-ink-500">لا طلاب في هذا الاختيار.</p>
    </div>;
  }

  const pages: Card[][] = [];
  for (let i = 0; i < cards.length; i += PER_PAGE) pages.push(cards.slice(i, i + PER_PAGE));
  const missing = cards.filter((c) => !c.username || !c.password).length;

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full flex-wrap items-center justify-between gap-3 px-2">
        <p className="text-panel text-ink-600">
          <Num className="font-medium text-ink-900">{cards.length}</Num> بطاقة على{' '}
          <Num className="font-medium text-ink-900">{pages.length}</Num>{' '}
          {pages.length === 1 ? 'ورقة' : 'أوراق'} — ورقة سرّية، تُقصّ وتُسلَّم لكل طالب بطاقته.
        </p>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      {missing > 0 && (
        <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-start gap-2.5 rounded-xl border border-warn-200 bg-warn-100 p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn-700" />
          <p className="text-panel text-warn-700">
            <Num className="font-medium">{missing}</Num> بطاقة بلا رقم دخول أو بلا رقم هوية —
            تُطبع مُعلَّمة، فأنشئ حسابهم من «الإعدادات ← حسابات الطلاب» ثم أعد الطباعة.
          </p>
        </div>
      )}

      {pages.map((page, pi) => (
        <div key={pi} className="sheet-a4 font-sans" dir="rtl"
          style={{ breakAfter: pi < pages.length - 1 ? 'page' : 'auto' }}>
          {/* One border on the grid, not eighteen on the cards: a guillotine
              follows a line that runs the whole width. */}
          <div className="grid grid-cols-3 border-s border-t border-dashed border-ink-300">
            {page.map((c) => (
              <article key={c.id}
                className="keep relative flex h-[167px] flex-col justify-between border-b border-e border-dashed border-ink-300 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium leading-tight text-ink-900"
                      title={c.fullName}>{c.fullName}</p>
                    <p className="mt-0.5 truncate text-[8px] text-ink-500">
                      {c.halaqa ?? MOSQUE}
                    </p>
                  </div>
                  <LogoMark height={16} white={false} className="shrink-0" />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    {([
                      ['رقم الدخول', c.username],
                      ['كلمة المرور', c.password],
                    ] as const).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[7.5px] leading-none text-ink-500">{label}</p>
                        {value ? (
                          <bdi dir="ltr" className="block font-display text-[13px] leading-tight tracking-[.06em] text-brand-900">
                            {value}
                          </bdi>
                        ) : (
                          <p className="text-[9px] leading-tight text-risk-700">— يحتاج إنشاء —</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="h-[54px] w-[54px] shrink-0 [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qr[c.id] ?? '' }} />
                </div>

                <p className="text-center text-[7px] leading-none text-ink-400">
                  وجّه كاميرا جوّالك إلى المربّع لتدخل بوابتك
                </p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function Page() { return <Suspense><Sheet /></Suspense>; }
