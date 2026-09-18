'use client';
/* The way out, and the sentence that guards it — the student portal's component
   with its own endpoint and its own warning.

   His session lasts thirty days and does not lapse on idleness, so leaving is a
   deliberate act. And the warning is not the student's: what is behind a
   teacher's sign-in is twenty-five boys' levels, attendance and results, so a
   phone he is about to hand to someone is the case this button exists for. */
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Btn, Modal } from '@/components/ui';
import { cx } from '@/lib/cx';

export function SignOutButton({ className, children, label = 'تسجيل الخروج' }: {
  className?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const [confirm, setConfirm] = useState(false);

  const signOut = async () => {
    await fetch('/api/teacher/auth', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/teacher/login';
  };

  return (
    <>
      <button type="button" onClick={() => setConfirm(true)} aria-label={label}
        className={cx('press', className)}>
        {children ?? <LogOut size={17} />}
      </button>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="تسجيل الخروج"
        footer={<>
          <Btn onClick={() => setConfirm(false)}>ابقَ</Btn>
          <Btn variant="danger" icon={LogOut} onClick={signOut}>اخرج</Btn>
        </>}>
        <p className="text-base2 leading-relaxed text-ink-700">
          ستحتاج رقم دخولك وكلمة مرورك للعودة. واخرج قبل أن تُعطي جهازك لأحد —
          فبوابتك تحمل سجّل حلقتك كلها.
        </p>
      </Modal>
    </>
  );
}
