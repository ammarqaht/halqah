'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   التقرير المصفوح — real A4 pages, not one long sheet the printer cuts.

   «إذا الملف بينطبع في أكثر من صفحة … ينعرضون ورقة وحدة طويلة وذا خطأ»
   (client, 11 Oct 2026). So the document is laid out into pages HERE, before
   the printer sees it: every block is measured, pages are filled one block at a
   time, a table is split between rows with its header repeated, and a section
   that asks for it starts on a fresh page. What is on screen is page 1, page 2,
   page 3 — each with the running head and the page number it prints with.

   The look is the client's reference report (التحليل الاستراتيجي, Oct 2026):
   a cream page, a hairline running head with the mark and the report's name,
   a gold kicker over a serif title, cards with a coloured cap, and a footer
   rule that fades into the page number. The styles are `.pd-*` in globals.css.
   ───────────────────────────────────────────────────────────────────────── */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Btn } from '@/components/ui';
import { Num, toArabicDigits } from '@/components/Num';
import { cx } from '@/lib/cx';

const MM = 96 / 25.4;
const DIMS = {
  portrait:  { w: 210, h: 297 },
  landscape: { w: 297, h: 210 },
};
/* The body box inside a page — under the running head, above the foot. Kept
   in step with `.pd-body` in globals.css. */
const BODY = { top: 21, bottom: 15, side: 14 };

export type Block = {
  key: string;
  /** The running head's right-hand label from this block on. */
  section?: string;
  /** Start a fresh page here — a halaqa's own section. */
  newPage?: boolean;
} & (
  | { node: React.ReactNode }
  | {
      /** A table that may run over pages: split between rows, header repeated. */
      table: {
        head: React.ReactNode;
        rows: React.ReactNode[];
        /** Column widths, so every page's slice lines up with the others. */
        cols?: string[];
        className?: string;
        /** Drawn above the first slice only — the table's own title. */
        title?: React.ReactNode;
      };
    }
);

/* By index, not by node: the page plan is measured once, and the nodes are
   always read from the current blocks, so a re-render never shows stale text. */
type Placed = { i: number; from: number; to: number; first: boolean };

type Page = { section: string; items: Placed[] };

function Table({ t, rows, first }: {
  t: Extract<Block, { table: unknown }>['table']; rows: React.ReactNode[]; first: boolean;
}) {
  return (
    <div className="pd-block">
      {first && t.title}
      <table className={cx('pd-table', t.className)}>
        {t.cols && <colgroup>{t.cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>}
        <thead>{t.head}</thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

export function PagedDoc({ title, blocks, cover, landscape, deps, toolbar = true }: {
  /** The report's name — in the running head of every page. */
  title: string;
  blocks: Block[];
  /** A full-bleed first page, unnumbered. Only the period report has one. */
  cover?: React.ReactNode;
  landscape?: boolean;
  /** Anything whose change means the blocks must be measured again. */
  deps: unknown[];
  toolbar?: boolean;
}) {
  const dims = landscape ? DIMS.landscape : DIMS.portrait;
  const bodyW = (dims.w - BODY.side * 2) * MM;
  /* Under the box by the millimetre the printed page is short of the sheet
     (globals.css), and a hair more for sub-pixel rounding. */
  const bodyH = (dims.h - 1 - BODY.top - BODY.bottom) * MM - 2;

  const probe = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Page[] | null>(null);
  const [fontsTick, setFontsTick] = useState(0);
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const signature = useMemo(() => ({}), [...deps, fontsTick, landscape]);

  useLayoutEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) setFontsTick((n) => n + 1); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  /* Measure every block at the body's width, then fill pages greedily. */
  useLayoutEffect(() => {
    const root = probe.current;
    if (!root) return;
    const kids = Array.from(root.children) as HTMLElement[];
    const out: Page[] = [];
    let cur: Page = { section: blocks[0]?.section ?? '', items: [] };
    let used = 0;
    let section = cur.section;
    const GAP = 4 * MM; // .pd-block margin-bottom
    const push = () => { if (cur.items.length) out.push(cur); cur = { section, items: [] }; used = 0; };

    blocks.forEach((b, i) => {
      const el = kids[i];
      if (b.section) section = b.section;
      if (b.newPage && cur.items.length) push();
      if (!cur.items.length) cur.section = section;

      if ('node' in b) {
        const h = el.getBoundingClientRect().height + GAP;
        if (used + h > bodyH && cur.items.length) push();
        cur.items.push({ i, from: 0, to: 0, first: true });
        used += h;
        return;
      }

      /* A table: its title, its head, and each row's own height. */
      const titleEl = el.querySelector('[data-pd-title]') as HTMLElement | null;
      const titleH = titleEl ? titleEl.getBoundingClientRect().height : 0;
      const headH = (el.querySelector('thead') as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
      const rowHs = Array.from(el.querySelectorAll('tbody > tr')).map((r) => r.getBoundingClientRect().height);
      let from = 0;
      let first = true;
      while (from < rowHs.length || (first && rowHs.length === 0)) {
        let h = headH + (first ? titleH : 0) + GAP;
        /* Never strand a title and a head with fewer than three rows under them. */
        const minRows = Math.min(3, rowHs.length - from);
        const need = h + rowHs.slice(from, from + minRows).reduce((a, x) => a + x, 0);
        if (used + need > bodyH && cur.items.length) push();
        let to = from;
        while (to < rowHs.length && used + h + rowHs[to] <= bodyH) { h += rowHs[to]; to++; }
        if (to === from && to < rowHs.length) { h += rowHs[to]; to++; } // a row taller than a page
        cur.items.push({ i, from, to, first });
        used += h;
        first = false;
        from = to;
        if (from < rowHs.length) push();
        if (rowHs.length === 0) break;
      }
    });
    push();
    setPages(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, bodyH]);

  const numbered = pages?.length ?? 0;

  return (
    <>
      {/* The page box is the document's: margins live inside each page. */}
      <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }`}</style>

      {toolbar && (
        <div className="no-print mx-auto mb-4 flex max-w-full items-center justify-between gap-3 px-2"
          style={{ width: dims.w * MM }}>
          <span className="text-cap text-ink-500">
            {pages ? <><Num>{toArabicDigits(numbered + (cover ? 1 : 0))}</Num> {numbered + (cover ? 1 : 0) === 1 ? 'صفحة' : 'صفحات'} · A4 {landscape ? 'بالعرض' : 'بالطول'}</> : 'يُرتَّب…'}
          </span>
          <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
        </div>
      )}

      {/* The probe: every block once, at the body's width, out of sight —
          inside `.pd-doc` so it reads the same tokens the pages do. */}
      <div className="pd-doc">
      <div ref={probe} aria-hidden className="pd-probe" dir="rtl" style={{ width: bodyW }}>
        {blocks.map((b) => 'node' in b
          ? <div key={b.key} className="pd-block">{b.node}</div>
          : (
            <div key={b.key} className="pd-block">
              {b.table.title && <div data-pd-title>{b.table.title}</div>}
              <table className={cx('pd-table', b.table.className)}>
                {b.table.cols && <colgroup>{b.table.cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>}
                <thead>{b.table.head}</thead>
                <tbody>{b.table.rows}</tbody>
              </table>
            </div>
          ))}
      </div>
      </div>

      <div className={cx('pd-doc', landscape && 'pd-land')} dir="rtl">
        {cover && <section className="pd-page pd-cover">{cover}</section>}
        {pages?.map((p, n) => (
          <section key={n} className="pd-page">
            <header className="pd-head">
              <LogoMark height={26} white={false} />
              <span className="pd-head-t">{title}</span>
              <span className="pd-head-s">{p.section}</span>
            </header>
            <div className="pd-body">
              {p.items.map((it) => {
                const b = blocks[it.i];
                if (!b) return null;
                return 'node' in b
                  ? <div key={b.key} className="pd-block">{b.node}</div>
                  : <Table key={`${b.key}:${it.from}`} t={b.table} first={it.first}
                      rows={b.table.rows.slice(it.from, it.to)} />;
              })}
            </div>
            <footer className="pd-foot">
              <span>حلقات جامع محمد العبدالكريم — حي أُحد</span>
              <span className="pd-foot-l" />
              <span className="pd-foot-n"><Num>{toArabicDigits(String(n + 1).padStart(2, '0'))}</Num></span>
            </footer>
          </section>
        ))}
      </div>
    </>
  );
}

/* ── the pieces a page is built from ───────────────────────────────────── */

/** «النظرة العامة» over «الفترة في أرقام», with a line under it. */
export function SecHead({ kicker, title, lead, num }: {
  kicker: string; title: string; lead?: React.ReactNode;
  /** A halaqa's number in the document — «٠١» set large beside its name. */
  num?: number;
}) {
  return (
    <div className="pd-sec">
      <div className="flex items-end gap-4">
        {num != null && <span className="pd-sec-num"><Num>{toArabicDigits(String(num).padStart(2, '0'))}</Num></span>}
        <div className="min-w-0">
          <p className="pd-kicker">{kicker}</p>
          <h2 className="pd-h1">{title}</h2>
        </div>
      </div>
      {lead && <p className="pd-lead">{lead}</p>}
    </div>
  );
}

export type Tone = 'teal' | 'deep' | 'gold' | 'sand' | 'risk';

/** A figure card with a coloured cap — «٩٠٪ متوسط التقدم». */
export function Kpi({ value, of, label, note, tone = 'teal' }: {
  value: React.ReactNode; of?: React.ReactNode; label: string; note?: React.ReactNode; tone?: Tone;
}) {
  return (
    <div className={cx('pd-kpi', `pd-cap-${tone}`)}>
      <p className="pd-kpi-v">
        {value}
        {of != null && <span className="pd-kpi-of">/{of}</span>}
      </p>
      <p className="pd-kpi-l">{label}</p>
      {note && <p className="pd-kpi-n">{note}</p>}
    </div>
  );
}

export function Kpis({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  return <div className="pd-kpis" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children}</div>;
}

/** A white card with a gold-ticked title. */
export function Card({ title, meta, children, className }: {
  title?: string; meta?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cx('pd-card', className)}>
      {title && <p className="pd-card-t">{title}</p>}
      {meta && <p className="pd-card-m">{meta}</p>}
      {children}
    </div>
  );
}

/** One ranked bar: label · bar · figure. `value` is 0–100. */
export function Bar({ label, value, figure, tone = 'teal', sub }: {
  label: React.ReactNode; value: number | null; figure: React.ReactNode; tone?: Tone; sub?: React.ReactNode;
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="pd-bar">
      <span className="pd-bar-l">{label}{sub && <span className="pd-bar-sub">{sub}</span>}</span>
      <span className="pd-bar-track"><span className={cx('pd-bar-fill', `pd-fill-${tone}`)} style={{ width: `${v}%` }} /></span>
      <span className="pd-bar-f">{figure}</span>
    </div>
  );
}

/** A table's own title, drawn above its first slice. */
export function TableTitle({ children, meta }: { children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="pd-card-t">{children}</p>
      {meta && <p className="pd-card-m">{meta}</p>}
    </div>
  );
}

/* ── AutoPaged — the same pages for a sheet written as ordinary markup ──────
   «اعتمد هذا الشكل في كل التقارير» (client, 11 Oct 2026). Most sheets are a
   heading, a few figures and a table or three, written long before Paged
   existed. Rather than restate each as blocks, this lays out whatever it is
   given: the children are rendered once out of sight, and their top-level
   elements are dealt onto A4 pages in order — a table that will not fit is cut
   between rows and its header repeated on the next page, and a heading is never
   left alone at the foot of a page. The pages are built from clones of the
   rendered elements, so they carry no handlers: a printed sheet has none to
   lose. Any change to the content re-deals the pages. */

/** True inside a paged document — PrintHead draws itself as a section head. */
export const PagedCtx = createContext(false);
export const usePaged = () => useContext(PagedCtx);

const isHeading = (el: Element) => /^H[1-6]$/.test(el.tagName) || el.hasAttribute('data-pd-keep-next');

export function AutoPaged({ title, landscape, children, toolbar = true }: {
  title: string; landscape?: boolean; children: React.ReactNode; toolbar?: boolean;
}) {
  const dims = landscape ? DIMS.landscape : DIMS.portrait;
  const bodyW = (dims.w - BODY.side * 2) * MM;
  const bodyH = (dims.h - 1 - BODY.top - BODY.bottom) * MM - 2;
  const probe = useRef<HTMLDivElement>(null);
  const out = useRef<HTMLDivElement>(null);
  const tpl = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    const deal = () => {
      const src = probe.current, dst = out.current, t = tpl.current;
      if (!src || !dst || !t) return;
      const head = t.querySelector('.pd-head')!, foot = t.querySelector('.pd-foot')!;
      dst.replaceChildren();
      let body: HTMLElement;
      let used = 0;
      let pages = 0;
      const page = () => {
        const sec = document.createElement('section');
        sec.className = 'pd-page';
        body = document.createElement('div');
        body.className = 'pd-body pd-auto';
        sec.append(head.cloneNode(true), body, foot.cloneNode(true));
        dst.append(sec);
        used = 0; pages++;
      };
      page();

      const kids = Array.from(src.children) as HTMLElement[];
      /* Each element's share of the page: from its top to the next one's top,
         so margins are counted once, as the flow counts them. */
      const tops = kids.map((k) => k.offsetTop);
      const heightOf = (i: number) => (i + 1 < kids.length
        ? tops[i + 1] - tops[i]
        : kids[i].offsetHeight + parseFloat(getComputedStyle(kids[i]).marginBottom || '0'));

      const tableIn = (el: HTMLElement): HTMLTableElement | null => {
        if (el.tagName === 'TABLE') return el as HTMLTableElement;
        const last = el.lastElementChild;
        return last && last.tagName === 'TABLE' ? last as HTMLTableElement : null;
      };
      const rowsOf = (tb: HTMLTableElement) => Array.from(tb.tBodies[0]?.rows ?? []);

      kids.forEach((el, i) => {
        if (el.hasAttribute('data-pd-newpage') && used > 0) page();
        const h = heightOf(i);
        const next = kids[i + 1];
        /* A heading takes its follower's first lines with it. */
        let need = h;
        if (isHeading(el) && next) {
          const nt = tableIn(next);
          need += nt
            ? (nt.tHead?.offsetHeight ?? 0) + rowsOf(nt).slice(0, 3).reduce((a, r) => a + r.offsetHeight, 0)
            : Math.min(heightOf(i + 1), bodyH / 3);
        }
        if (used + need <= bodyH) { body.append(el.cloneNode(true)); used += h; return; }

        const tb = tableIn(el);
        const rows = tb ? rowsOf(tb) : [];
        if (!tb || rows.length < 4) {
          if (used > 0) page();
          body.append(el.cloneNode(true)); used += h;
          return;
        }

        /* Cut the table between rows. Whatever sits above it inside its
           wrapper (a title) goes with the first slice only. */
        const headH = tb.tHead?.offsetHeight ?? 0;
        const above = el === tb ? 0 : tb.offsetTop - el.offsetTop;
        const gap = h - el.offsetHeight;
        let r = 0;
        let first = true;
        while (r < rows.length) {
          let take = first ? above + headH + gap : headH + gap;
          const minNeed = take + rows.slice(r, r + 3).reduce((a, x) => a + x.offsetHeight, 0);
          if (used + minNeed > bodyH && used > 0) page();
          let end = r;
          while (end < rows.length && used + take + rows[end].offsetHeight <= bodyH) { take += rows[end].offsetHeight; end++; }
          if (end === r) { take += rows[r].offsetHeight; end = r + 1; }
          const slice = tb.cloneNode(false) as HTMLTableElement;
          for (const c of Array.from(tb.children)) if (c.tagName !== 'TBODY') slice.append(c.cloneNode(true));
          const tbody = (tb.tBodies[0].cloneNode(false)) as HTMLElement;
          rows.slice(r, end).forEach((x) => tbody.append(x.cloneNode(true)));
          slice.append(tbody);
          if (el === tb) body.append(slice);
          else {
            const wrap = el.cloneNode(false) as HTMLElement;
            if (first) for (const c of Array.from(el.children)) if (c !== tb) wrap.append(c.cloneNode(true));
            wrap.append(slice);
            body.append(wrap);
          }
          used += take;
          first = false;
          r = end;
          if (r < rows.length) page();
        }
      });

      dst.querySelectorAll('.pd-foot-n').forEach((n, k) => {
        n.textContent = toArabicDigits(String(k + 1).padStart(2, '0'));
      });
      setCount(pages);
    };
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(deal); };
    run();
    const mo = new MutationObserver(run);
    if (probe.current) mo.observe(probe.current, { childList: true, subtree: true, characterData: true, attributes: true });
    document.fonts?.ready.then(run).catch(() => {});
    /* Images change heights when they arrive — including ones that come with
       the data, after mount. `load` does not bubble, so listen in capture. */
    const p = probe.current;
    p?.addEventListener('load', run, true);
    return () => { cancelAnimationFrame(frame); mo.disconnect(); p?.removeEventListener('load', run, true); };
  }, [bodyH]);

  return (
    <PagedCtx.Provider value>
      <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }`}</style>
      {toolbar && (
        <div className="no-print mx-auto mb-4 flex max-w-full items-center justify-between gap-3 px-2"
          style={{ width: dims.w * MM }}>
          <span className="text-cap text-ink-500">
            {count ? <><Num>{toArabicDigits(count)}</Num> {count === 1 ? 'صفحة' : 'صفحات'} · A4 {landscape ? 'بالعرض' : 'بالطول'}</> : 'يُرتَّب…'}
          </span>
          <Btn variant="primary" icon={Printer} onClick={() => window.print()}>طباعة</Btn>
        </div>
      )}
      <div className={cx('pd-doc', landscape && 'pd-land')} dir="rtl">
        <div ref={tpl} hidden>
          <header className="pd-head">
            <LogoMark height={26} white={false} />
            <span className="pd-head-t">{title}</span>
            <span className="pd-head-s">حلقات جامع محمد العبدالكريم</span>
          </header>
          <footer className="pd-foot">
            <span>حلقات جامع محمد العبدالكريم — حي أُحد</span>
            <span className="pd-foot-l" />
            <span className="pd-foot-n" />
          </footer>
        </div>
        <div ref={probe} aria-hidden className="pd-probe pd-auto" style={{ width: bodyW }}>{children}</div>
        <div ref={out} />
      </div>
    </PagedCtx.Provider>
  );
}
