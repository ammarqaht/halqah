'use client';
/* بطاقة الشحن — approved PDF §8 (إد-٤-ب), landscape, to the client's brief:
   the point value on the RIGHT with its purpose beneath it, the barcode and its
   code on the LEFT, the mark in the top-left corner, and the single-line caveat
   along the bottom.

   «كعب التذكرة» is the shape he chose out of four: a coupon stub, with the
   value on a **pale** field rather than a deep one — the ink stays dark and
   legible, the sheet costs less toner, and the colour still sorts a pile by
   value the way §8 asks («مختلف اللون باختلاف القيمة ليسهل الفرز باليد»).

   Rules that hold (DESIGN.md §1.3, §2.2):
   - The value prints in Arabic-Indic numerals; the CODE stays Latin, because
     Latin is what the student types back into the portal.
   - The counted noun agrees with the figure: ١٠ نقاط · ٥٠ نقطة · نقطتان.
   - The code is bidi-isolated, or RTL reorders it on the page. */
import { Num, toArabicDigits, pointWord } from '@/components/Num';
import { formatCode } from '@/lib/points';
import { LogoMark } from '@/components/Logo';

/** Three across the sheet, at the client's request. */
export const CARDS_PER_ROW = 3;
export const CARD_HEIGHT = 130;

/** What one A4 sheet holds under the print header — stated, not guessed. */
export const CARDS_PER_SHEET =
  CARDS_PER_ROW * Math.floor((1123 - 106 /* page margins */ - 76 /* header */) / (CARD_HEIGHT + 8));

export function CodeCard({ value, purpose, code, qr, colour }: {
  value: number;
  purpose: string;
  code: string;
  /** Pre-rendered QR markup. Empty until the generator resolves. */
  qr: string;
  colour: { ink: string; wash: string; rule: string };
}) {
  return (
    <article className="keep flex overflow-hidden rounded-lg border" dir="rtl"
      style={{ height: CARD_HEIGHT, borderColor: colour.rule, background: '#fff' }}>

      {/* ── the stub: value, and the reason it was earned ───────────────── */}
      <div className="flex w-[34%] shrink-0 flex-col items-center justify-center"
        style={{ background: colour.wash, color: colour.ink }}>
        <span className="font-display leading-none" style={{ fontSize: 30 }}>
          <Num>{toArabicDigits(value)}</Num>
        </span>
        <span style={{ fontSize: 9.5, marginTop: 2 }}>{pointWord(value)}</span>
        <span className="mt-1.5 rounded-full border px-2 py-px"
          style={{ fontSize: 8.5, borderColor: colour.rule, background: '#fff' }}>{purpose}</span>
      </div>

      {/* the perforation — scissors get a line, and the eye reads a ticket */}
      <div className="shrink-0" style={{
        width: 1,
        background: `repeating-linear-gradient(to bottom, ${colour.rule} 0 5px, transparent 5px 10px)`,
      }} />

      {/* ── the code half, on paper white so any scanner reads it ────────── */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-1">
        {/* The positioning lives on a wrapper, NOT on `LogoMark`'s className.
            `LogoMark` already carries `relative`, and passing `absolute` in
            would put two position utilities of equal specificity on one
            element — where the winner is decided by Tailwind's stylesheet
            order, not by the order they were written. Tailwind emits
            `.absolute` before `.relative`, so `relative` won and the mark sat
            in normal flow above the QR instead of in its corner.

            A physical corner is genuinely meant here, so a physical property is
            correct — DESIGN.md §9.1 allows exactly this exception. */}
        <span className="absolute left-2 top-2">
          <LogoMark height={13} white={false} />
        </span>

        <div className="h-[52px] w-[52px] [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }} />

        <bdi dir="ltr" style={{
          color: colour.ink, fontSize: 10, fontWeight: 500,
          letterSpacing: '.14em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>{formatCode(code)}</bdi>

        {/* one line, along the bottom — never wrapped */}
        <span className="absolute inset-x-0 bottom-1.5 text-center"
          style={{ fontSize: 7.5, color: '#8D9894', whiteSpace: 'nowrap' }}>
          تُشحن مرة واحدة فقط
        </span>
      </div>
    </article>
  );
}
