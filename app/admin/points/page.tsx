'use client';
import { TopBar } from '@/components/TopBar';
import { usePanel } from '@/components/PanelState';
import { Sheet } from '@/components/Sheet';

export default function Page() {
  const { panelOpen, setPanelOpen } = usePanel();
  return (
    <>
      <TopBar title="النقاط والمتجر" panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />
      <div className="mx-auto max-w-column px-6 py-8">
        <Sheet className="flex min-h-[16rem] flex-col items-center justify-center text-center">
          <p className="font-display text-t1 text-ink-900">هذه الشاشة في الطريق</p>
          <p className="mt-2 max-w-sm text-base2 text-ink-600">
            بُنيت حتى الآن صفحة الدخول والصفحة الرئيسية. بقية الشاشات تأتي بالترتيب في BUILD_PLAN.md.
          </p>
        </Sheet>
      </div>
    </>
  );
}
