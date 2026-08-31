/* Dates for the screen. Deliberately not `toLocaleDateString('ar-SA')`: that
   resolves to the Hijri calendar on some runtimes and the Gregorian one on
   others, so the same row would read differently on two machines. The client's
   own files are Gregorian; we format them ourselves and stay predictable.

   Everything here returns Latin digits — DESIGN.md §2.2 keeps Arabic-Indic
   numerals for printed surfaces, and every caller wraps the result in <Num>. */

const pad = (n: number) => String(n).padStart(2, '0');

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `2026/08/31` — a column of these aligns under tabular figures. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** `2026/08/31 · 17:20` — the ledger needs the hour to order a busy afternoon. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(iso)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «اليوم» · «أمس» · «قبل ٣ أيام» — how a supervisor actually reads recency. */
export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days === 2) return 'قبل يومين';
  if (days <= 10) return `قبل ${days} أيام`;
  if (days <= 30) return `قبل ${days} يومًا`;
  return formatDate(iso);
}
