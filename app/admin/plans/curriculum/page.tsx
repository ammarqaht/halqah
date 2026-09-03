'use client';
/* رفع منهج الحفظ — SPEC.md §5.4, the reference data every plan is built from.

   Follows the importer contract in §5: parse is pure, **a preview is always
   shown before anything is written**, and the commit replaces one track at a
   time. Re-uploading is the normal case — a corrected file, not an addition —
   so a track's curriculum is REPLACED rather than merged. Student plans and
   their overrides survive untouched.

   The parser is loud on purpose (§5.4: «assert 24 days for every level, or fail
   loudly»). This file becomes the content of every sheet a child is handed. */
import { useState } from 'react';
import Link from 'next/link';
import { UploadCloud, FileSpreadsheet, AlertTriangle, Check, BookOpen } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Chip } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { coverage } from '@/lib/curriculum';
import { parseCurriculumWorkbook, type CurriculumParse } from '@/lib/importers/curriculum';
import { TRACK_AR } from '@/lib/types';
import { cx } from '@/lib/cx';

export default function CurriculumImport() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const [parsed, setParsed] = useState<CurriculumParse[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const loaded = coverage(db.curriculum);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setParsed(null); setDone(null);
    try {
      const sheets = parseCurriculumWorkbook(await file.arrayBuffer());
      if (!sheets.length) {
        setError('لم يُعثر على ورقة «فضي» ولا «ذهبي» في هذا الملف. تأكّد أنه ملف منهج الحفظ.');
      } else {
        setParsed(sheets);
        setFileName(file.name);
      }
    } catch {
      setError('تعذّرت قراءة هذا الملف. تأكّد أنه ملف إكسل صحيح.');
    }
    setBusy(false);
  };

  const commit = () => {
    if (!parsed) return;
    for (const p of parsed) store.replaceCurriculum(p.track, p.days, fileName);
    setDone(`اعتُمد المنهج من «${fileName}».`);
    setParsed(null);
  };

  return (
    <>
      <TopBar title="منهج الحفظ" crumbs={['الخطط']}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)}
        action={<Link href="/admin/plans"><Btn>الخطط</Btn></Link>} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {/* ── what is loaded now ─────────────────────────────────────────── */}
        <Sheet className="rise mb-4">
          <SheetHead title="المنهج المحمَّل"
            meta={db.sourceFile ? `آخر ملف: ${db.sourceFile}` : 'لم يُرفع منهج بعد'} />
          {loaded.length === 0 ? (
            <p className="text-base2 text-ink-500">
              لا منهج بعد، فلا يمكن طباعة خطة. ارفع «منهج الحفظ» — ورقتا «فضي» و«ذهبي».
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {loaded.map((c) => (
                <div key={c.track} className="rounded-xl border border-ink-150 bg-page/40 p-4">
                  <p className="text-xs2 text-ink-600">المسار {TRACK_AR[c.track]}</p>
                  <p className="mt-1 font-display text-d2 text-ink-900">
                    <Num>{c.count}</Num> <span className="text-lg2 text-ink-600">مستوى</span>
                  </p>
                  <p className="mt-1 text-panel text-ink-500">
                    من <Num>{c.max}</Num> إلى <Num>{c.min}</Num>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Sheet>

        {/* ── the upload ─────────────────────────────────────────────────── */}
        <Sheet className="rise mb-4">
          <SheetHead title="رفع الملف"
            meta="ثمانية أعمدة: المستوى · اليوم · المقرر · من سورة · آية · الى سورة · آية · ملاحظة" />
          <label className={cx('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            busy ? 'border-ink-200 bg-page' : 'border-ink-300 hover:border-brand-400 hover:bg-brand-50')}>
            <UploadCloud size={26} strokeWidth={1.7} className="text-ink-400" />
            <span className="text-base2 text-ink-700">
              {busy ? 'جارٍ القراءة…' : 'اختر ملف «منهج الحفظ.xlsx»'}
            </span>
            <span className="text-panel text-ink-500">لا يُكتب شيء قبل أن ترى المعاينة وتوافق</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={busy}
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-risk-100 px-3.5 py-3 text-base2 text-risk-700">{error}</p>
          )}
          {done && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-ok-100 px-3.5 py-3 text-base2 text-ok-700">
              <Check size={17} /> {done}
              <Link href="/admin/plans" className="ms-auto underline">اذهب إلى الخطط</Link>
            </p>
          )}
        </Sheet>

        {/* ── the preview, always, before the commit ─────────────────────── */}
        {parsed && (
          <>
            {parsed.map((p) => (
              <Sheet key={p.sheet} className="rise mb-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet size={18} className="text-ink-500" />
                    <h3 className="text-lg2 font-bold text-ink-900">ورقة «{p.sheet}»</h3>
                    <Chip tone="brand">{TRACK_AR[p.track]}</Chip>
                  </div>
                  {p.issues.length === 0
                    ? <Chip tone="ok"><Check size={10} />كل المستويات ٢٤ يومًا</Chip>
                    : <Chip tone="warn"><AlertTriangle size={10} />
                        <Num>{p.issues.length}</Num> مستوى يحتاج مراجعة</Chip>}
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { l: 'صفوف مقروءة', v: p.rowCount },
                    { l: 'مستويات', v: p.levels.length },
                    { l: 'أسطر منهج', v: p.days.length },
                    { l: 'أيام اختبار', v: p.examDays.length },
                  ].map((k) => (
                    <div key={k.l} className="rounded-xl border border-ink-150 bg-page/40 p-3.5">
                      <p className="text-xs2 text-ink-600">{k.l}</p>
                      <p className="mt-1 font-display text-t1 text-ink-900"><Num>{k.v}</Num></p>
                    </div>
                  ))}
                </div>

                {p.levels.length > 0 && (
                  <p className="mt-4 text-panel text-ink-600">
                    المستويات من <Num className="font-medium text-ink-900">{p.levels[0]}</Num> إلى{' '}
                    <Num className="font-medium text-ink-900">{p.levels[p.levels.length - 1]}</Num>.
                  </p>
                )}

                {/* §5.4 — report, never repair */}
                {p.issues.length > 0 && (
                  <div className="mt-4 rounded-lg border border-warn-200 bg-warn-100 p-3.5">
                    <p className="mb-2 text-panel font-medium text-warn-700">
                      مستويات لا تبلغ ٢٤ يومًا — تُرفع كما هي، ولا يطبع النظام ورقة ناقصة دون أن يقولها:
                    </p>
                    <ul className="space-y-1">
                      {p.issues.slice(0, 8).map((i) => (
                        <li key={i.level} className="text-panel text-warn-700">· {i.message}</li>
                      ))}
                      {p.issues.length > 8 && (
                        <li className="text-panel text-warn-700">
                          … و<Num>{p.issues.length - 8}</Num> غيرها
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* a real sample, so he can see the parse landed correctly */}
                {p.days.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-ink-150">
                    <table className="w-full min-w-[36rem] border-collapse text-panel">
                      <thead>
                        <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                          {['المستوى', 'اليوم', 'المقرر', 'من سورة', 'آية', 'إلى سورة', 'آية'].map((h) => (
                            <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {p.days.slice(0, 6).map((d, i) => (
                          <tr key={i} className="border-b border-ink-150 last:border-0">
                            <td className="px-3 py-2"><Num>{d.level}</Num></td>
                            <td className="px-3 py-2"><Num>{d.dayNo}</Num></td>
                            <td className="px-3 py-2 text-ink-600">{d.kind === 'DARS' ? 'درس' : d.kind === 'MURAJAA_SUGHRA' ? 'م.ص' : 'م.ك'}</td>
                            <td className="px-3 py-2">{d.fromSurah}</td>
                            <td className="px-3 py-2"><Num>{d.fromAyah}</Num></td>
                            <td className="px-3 py-2">{d.toSurah}</td>
                            <td className="px-3 py-2"><Num>{d.toAyah}</Num></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Sheet>
            ))}

            <div className="rise sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink-150 bg-page/90 px-6 py-3.5 backdrop-blur-md">
              <p className="text-panel text-ink-600">
                الاعتماد يستبدل منهج{' '}
                {parsed.map((p) => `المسار ${TRACK_AR[p.track]}`).join(' و')} بالكامل.
                الخطط المُصدَرة للطلاب وتعديلاتها لا تُمَسّ.
              </p>
              <div className="flex items-center gap-2">
                <Btn onClick={() => setParsed(null)}>إلغاء</Btn>
                <Btn variant="primary" icon={BookOpen} onClick={commit}>اعتماد المنهج</Btn>
              </div>
            </div>
          </>
        )}

        {!parsed && !db.curriculum.length && !error && (
          <Sheet className="rise">
            <Empty icon={BookOpen} title="لا خطط بلا منهج"
              body="ملف «منهج الحفظ» يحمل مستويات المسارين كاملة — ٢٤ يومًا لكل مستوى، بثلاثة أسطر لكل يوم. يُرفع مرة واحدة ويبقى." />
          </Sheet>
        )}
      </div>
    </>
  );
}
