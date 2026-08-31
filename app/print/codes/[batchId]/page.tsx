'use client';
/* بطاقات الشحن — SPEC.md §6.5, approved PDF §8 (إد-٤-ب):
   «كل بطاقة تحمل: شعار الحلقة · قيمة النقاط · الرقم مكتوبًا بوضوح · باركود
   يُقرأ بالكاميرا» — and «تصميم البطاقة بألوان الجمعية، مختلف اللون باختلاف
   القيمة ليسهل الفرز باليد».

   The card itself lives in `components/CodeCard.tsx`: landscape, three across,
   value on the right and code on the left. Everything on this page except the
   print button is what comes out of the tray. */
import { use, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { LogoMark, LogoJamiyah } from '@/components/Logo';
import { Num, toArabicDigits, cardWord, pointWord } from '@/components/Num';
import { Btn } from '@/components/ui';
import { CodeCard, CARDS_PER_ROW } from '@/components/CodeCard';
import { useDB } from '@/lib/store';
import { cardColour, codeState } from '@/lib/points';
import { formatDate } from '@/lib/dates';

export default function CodeCards({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const db = useDB();
  const [qr, setQr] = useState<Record<string, string>>({});

  const batch = db.batches.find((b) => b.id === batchId) ?? null;

  /* Cards already redeemed are not reprinted — a second copy of a spent card is
     a card a child will try and be refused. Only what is still worth points
     goes on the sheet. */
  const codes = useMemo(
    () => db.codes.filter((c) => c.batchId === batchId && !c.redeemedBy),
    [db.codes, batchId]);

  /* The QR carries the bare code, not a URL: the portal's own camera scanner
     (طا-٣) drops what it reads straight into the redeem field, and a bare code
     needs no origin to be baked into paper that outlives a domain change. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const c of codes) {
        out[c.code] = await QRCode.toString(c.code, {
          type: 'svg', margin: 0, errorCorrectionLevel: 'M',
          color: { dark: '#191E1C', light: '#0000' },
        });
      }
      if (!cancelled) setQr(out);
    })();
    return () => { cancelled = true; };
  }, [codes]);

  if (!batch) {
    return (
      <div className="sheet-a4 font-sans" dir="rtl">
        <p className="text-lg2 text-ink-700">لا توجد دفعة بهذا الرقم.</p>
        <p className="mt-2 text-base2 text-ink-500">
          افتح الطباعة من شاشة أكواد الشحن، فالبطاقات تُبنى من الدفعة نفسها.
        </p>
      </div>
    );
  }

  const colour = cardColour(batch.value);
  const dead = codes.length > 0 && codeState(codes[0], batch) !== 'OK';

  return (
    <>
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between gap-4 px-2">
        <p className="text-panel text-ink-600">
          <Num>{codes.length}</Num> {cardWord(codes.length)} غير مستعملة من هذه الدفعة.
          {codes.length !== batch.quantity && <> البطاقات المشحونة لا تُطبع مرة أخرى.</>}
        </p>
        <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
      </div>

      <div className="sheet-a4 font-sans" dir="rtl">
        <header className="keep mb-5 flex items-center justify-between gap-4 border-b-2 pb-3"
          style={{ borderColor: colour.rule }}>
          <LogoMark height={34} white={false} />
          <div className="text-center">
            <h1 className="font-display text-h2 text-ink-900">
              بطاقات شحن — <Num>{toArabicDigits(batch.value)}</Num> {pointWord(batch.value)}
            </h1>
            <p className="mt-0.5 text-xs2 text-ink-600">
              {batch.purpose} · صدرت <Num>{toArabicDigits(formatDate(batch.createdAt))}</Num>
              {batch.expiresAt && <> · تنتهي <Num>{toArabicDigits(formatDate(batch.expiresAt))}</Num></>}
            </p>
          </div>
          <LogoJamiyah height={34} />
        </header>

        {dead && (
          <p className="keep mb-4 rounded border border-risk-200 bg-risk-100 px-3 py-2 text-xs2 text-risk-700">
            هذه الدفعة {batch.revokedAt ? 'ملغاة' : 'منتهية الصلاحية'} — بطاقاتها لن تُقبل عند الشحن.
          </p>
        )}

        {codes.length === 0 ? (
          <p className="py-16 text-center text-lg2 text-ink-500">
            كل بطاقات هذه الدفعة شُحنت. أصدر دفعة جديدة حين تحتاج المزيد.
          </p>
        ) : (
          <div className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${CARDS_PER_ROW}, minmax(0, 1fr))` }}>
            {codes.map((c) => (
              <CodeCard key={c.id} value={batch.value} purpose={batch.purpose}
                code={c.code} qr={qr[c.code] ?? ''} colour={colour} />
            ))}
          </div>
        )}

        <p className="keep mt-5 text-center text-[10px] text-ink-500">
          كل بطاقة تُشحن مرة واحدة فقط · حلقات جامع محمد العبدالكريم — الدمام، حي أُحد
        </p>
      </div>
    </>
  );
}
