'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Trash2, AlertTriangle, FlaskConical } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Modal, Chip } from '@/components/ui';
import { Num } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB } from '@/lib/store';
import { derive } from '@/lib/derive';

export default function SettingsPage() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  const d = derive(db);
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  const reset = () => {
    store.reset();
    setConfirm(false);
    router.push('/admin');
  };

  return (
    <>
      <TopBar title="الإعدادات" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">
        <header className="rise mb-8">
          <h2 className="font-display text-d1 text-ink-900">الإعدادات</h2>
        </header>

        <Sheet className="rise mb-4">
          <SheetHead title="البيانات المحفوظة"
            meta={db.sourceFile ? `آخر ملف مرفوع: ${db.sourceFile}` : 'لم يُرفع ملف بعد'} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { l: 'الطلاب', v: d.students },
              { l: 'الحلقات', v: d.halaqat },
              { l: 'بلا حلقة', v: d.orphans },
              { l: 'تحتاج مراجعة', v: d.flagged },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-ink-150 bg-page/40 p-4">
                <p className="text-xs2 text-ink-600">{k.l}</p>
                <p className="mt-1.5 font-display text-d2 text-ink-900"><Num>{k.v}</Num></p>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 text-panel text-ink-500">
            <Database size={15} className="mt-0.5 shrink-0" />
            في هذه المرحلة تُحفظ البيانات في متصفّحك وحده — لم تُوصل قاعدة البيانات بعد.
            فهي لا تُشارَك بين الأجهزة، ومسح بيانات المتصفّح يمسحها.
          </p>
        </Sheet>

        {/* ── testing tools ────────────────────────────────────────────── */}
        <Sheet className="rise border-warn-200">
          <SheetHead title="أدوات التجربة"
            meta="مرحلة التجريب — تختفي هذه الأدوات حين يصير النظام في يد الطلاب" />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-warn-100/60 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-body font-medium text-ink-900">
                <FlaskConical size={16} className="text-warn-700" />
                تصفير البيانات
              </p>
              <p className="mt-1 max-w-[38rem] text-panel text-ink-600">
                يمسح كل الطلاب والحلقات لتبدأ من ملف نظيف وتجرّب الاستيراد من جديد.
                لا يمسّ المنهج ولا الإعدادات.
              </p>
            </div>
            <Btn variant="default" icon={Trash2} className="text-risk-700"
              disabled={d.isEmpty} onClick={() => setConfirm(true)}>
              تصفير الآن
            </Btn>
          </div>
        </Sheet>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="تصفير البيانات"
        footer={<>
          <Btn onClick={() => setConfirm(false)}>إلغاء</Btn>
          <Btn variant="primary" className="!bg-risk-700 hover:!bg-risk-700/90" onClick={reset}>
            نعم، صفّر
          </Btn>
        </>}>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-risk-100 p-2 text-risk-700"><AlertTriangle size={18} /></span>
          <div>
            <p className="text-base2 text-ink-900">
              سيُمسح <Num className="font-medium">{d.students}</Num> طالبًا
              و<Num className="font-medium">{d.halaqat}</Num> حلقات.
            </p>
            <p className="mt-2 text-panel text-ink-600">
              لا يمكن التراجع. لكن ملفات الإكسل عندك سليمة، فتستطيع رفعها مرة أخرى في أي وقت.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
