'use client';
/* Whole pages — «كل التقارير تكون على أبعاد A4 … صفحة وحدة، أو إذا المعلومات
   واجد تكون صفحتين كاملة أو ثلاث كاملة … لا تخلي صفحة ونص» (client, 11 Oct 2026).

   Every report sheet is measured once its rows are in. A sheet that spills a
   few rows onto one more page is scaled down — never below MIN_ZOOM, where the
   names stop being readable on paper — until it fits the pages before it. On
   screen the sheet is then drawn as exactly that many A4 pages, so what the
   supervisor sees is how many sheets come out of the tray.

   `zoom`, not `transform: scale`: zoom re-lays the content out at the smaller
   size, so the printer paginates the smaller sheet; a transform only paints it
   smaller over a layout that still takes the old number of pages. */
import { useEffect } from 'react';

const MM = 96 / 25.4;
/** The page's content box in CSS px — A4 less the `@page` margin in globals.css
    (12mm), or the landscape sheets' own (10mm). */
const PAGE_H = { portrait: (297 - 24) * MM, landscape: (210 - 20) * MM };
/** Below this the smallest text on a sheet (10px) prints under 8px. */
const MIN_ZOOM = 0.8;
/** Rows and cards are never split by a page break, so each page loses up to a
    row at its foot. Plan for it rather than discover it in the tray. */
const SLACK = 0.95;

function fit(sheet: HTMLElement) {
  const kind = sheet.classList.contains('landscape') ? 'landscape' : 'portrait';
  const page = PAGE_H[kind];

  /* Measured at full size: reset, read, set — synchronously, so nothing is
     painted in between and the observer sees one size, not two. */
  sheet.style.zoom = '';
  for (const v of ['--sheet-pages', '--sheet-z']) sheet.style.removeProperty(v);
  const top = sheet.getBoundingClientRect().top + parseFloat(getComputedStyle(sheet).paddingTop);
  let bottom = top;
  for (const c of Array.from(sheet.children)) {
    const r = c.getBoundingClientRect();
    if (r.height) bottom = Math.max(bottom, r.bottom + parseFloat(getComputedStyle(c).marginBottom));
  }
  const h = bottom - top;

  let pages = h <= page ? 1 : Math.ceil(h / (page * SLACK));
  let zoom = 1;
  if (pages > 1) {
    const z = ((pages - 1) * page * (pages - 1 === 1 ? 0.99 : SLACK)) / h;
    if (z >= MIN_ZOOM) { zoom = Math.floor(z * 1000) / 1000; pages -= 1; }
  }

  if (zoom < 1) sheet.style.zoom = String(zoom);
  sheet.style.setProperty('--sheet-pages', String(pages));
  sheet.style.setProperty('--sheet-z', String(zoom));
}

/** Mounted once by each print layout; it fits every sheet on the page. */
export function PageFit() {
  useEffect(() => {
    let frame = 0;
    const now = () => {
      const sheets = Array.from(document.querySelectorAll<HTMLElement>('.sheet-a4'));
      /* A document of several sheets (the boys' cards) is already cut into
         pages by its own code — one sheet, one page. */
      if (sheets.length === 1) fit(sheets[0]);
    };
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(now);
    };

    run();
    /* Rows arrive after the first paint — from the store or from an API — and
       the fonts change every line's height when they land. */
    const mo = new MutationObserver(run);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.fonts?.ready.then(run).catch(() => {});
    /* Synchronously: a frame later the print preview is already laid out. */
    window.addEventListener('beforeprint', now);
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      window.removeEventListener('beforeprint', now);
    };
  }, []);
  return null;
}
