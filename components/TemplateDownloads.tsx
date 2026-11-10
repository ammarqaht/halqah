'use client';
/* «قوالب جاهزة» — a file to fill for every kind of upload the system reads.
   The lists inside each one (students, halaqat, tajweed topics) are taken from
   the store at the moment of the click, so the dropdowns are today's. */
import { forwardRef, useState } from 'react';
import { Download, Loader2, Users2, ClipboardList, Mic2, CalendarRange, BookMarked } from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { useDB, ensureCurriculum, store } from '@/lib/store';
import { Btn } from '@/components/ui';

type Key = 'ROSTER' | 'EXAMS' | 'TAJWEED' | 'PLAN_LOG' | 'CURRICULUM' | 'CURRICULUM_CURRENT';

async function build(key: Key) {
  const t = await import('@/lib/templates/xlsx');
  if (key === 'CURRICULUM') return t.saveFile(await t.buildCurriculumTemplate());
  if (key === 'CURRICULUM_CURRENT') {
    await ensureCurriculum();
    return t.saveFile(await t.buildCurriculumTemplate(store.get().curriculum));
  }
  const db = store.get();
  return t.saveFile(await t.buildTableTemplate(key, {
    students: db.students.filter((s) => s.status === 'ACTIVE').map((s) => s.fullName),
    halaqat: db.halaqat.map((h) => h.name),
    tajweedTopics: db.tajweedTopics.filter((x) => x.active).map((x) => x.name),
  }));
}

/** One button that builds a template and downloads it. */
export function TemplateButton({ k, label, icon: Ico = Download, variant = 'quiet', tour }:
  { k: Key; label: string; icon?: LucideIcon; variant?: 'quiet' | 'default'; tour?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async () => {
    setBusy(true); setFailed(false);
    try { await build(k); } catch (e) { console.error('template build failed', e); setFailed(true); }
    setBusy(false);
  };
  return (
    <Btn type="button" variant={variant} icon={busy ? Spinner : Ico} onClick={go}
      disabled={busy} data-tour={tour}>
      {failed ? 'تعذّر — أعد المحاولة' : label}
    </Btn>
  );
}

/** `Btn` takes an icon component; the loading state is one that spins. */
const Spinner = forwardRef<SVGSVGElement, LucideProps>(function Spinner(props, ref) {
  return <Loader2 ref={ref} {...props} className="animate-spin" />;
}) as LucideIcon;

const CARDS: { k: Key; title: string; body: string; icon: LucideIcon }[] = [
  { k: 'ROSTER',     title: 'الطلاب والحلقات',  body: 'طالب في كل صف: الاسم والهوية والمسار والحلقة.', icon: Users2 },
  { k: 'EXAMS',      title: 'سجل الاختبارات',   body: 'الأوسمة واختبارات الجمعية، بأسماء طلابك في قائمة.', icon: ClipboardList },
  { k: 'TAJWEED',    title: 'اختبارات التجويد', body: 'الحكم والدرجة من ١٠ لكل طالب.', icon: Mic2 },
  { k: 'PLAN_LOG',   title: 'متابعة الخطط',     body: 'متى استلم كل طالب مستواه.', icon: CalendarRange },
  { k: 'CURRICULUM', title: 'منهج الحفظ',       body: 'المستويات كلها، ٢٤ يومًا لكل مستوى، والاختبارات معلّمة.', icon: BookMarked },
];

/** The full set, as cards — for the upload page. */
export function TemplateGallery() {
  useDB();   // re-render when the store loads, so the lists are not empty
  return (
    <section data-tour="templates" className="rise mb-6 rounded-xl border border-ink-150 bg-paper p-6 shadow-card">
      <div className="mb-4">
        <h3 className="text-lg2 font-bold text-ink-900">قوالب جاهزة</h3>
        <p className="mt-1 text-panel text-ink-500">
          نزّل القالب، عبّئه، ثم ارفعه هنا. فيه قوائم منسدلة وقواعد تمنع الخطأ قبل أن يصل.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ k, title, body, icon: Ico }) => (
          <div key={k} className="flex flex-col rounded-lg border border-ink-150 bg-page p-3.5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-brand-100 p-1.5 text-brand-800"><Ico size={15} strokeWidth={1.9} /></span>
              <p className="text-body font-medium text-ink-900">{title}</p>
            </div>
            <p className="mt-1.5 flex-1 text-panel text-ink-500">{body}</p>
            <div className="mt-3"><TemplateButton k={k} label="تنزيل القالب" /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
