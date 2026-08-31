/* Print routes — DESIGN.md §8. No rail, no panel, no TopBar: what is on the
   screen is what comes out of the printer, and anything else would be a lie
   about the sheet. The only on-screen chrome is a print button that carries
   `no-print` and removes itself from the output. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-ink-100 py-8 print:bg-white print:py-0">{children}</div>;
}
