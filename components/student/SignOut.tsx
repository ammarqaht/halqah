'use client';
/* The way out, and the sentence that guards it — in one place because there are
   now two doors to it.

   الرئيسية hides the phone's top bar so the sticky hero can own the top of the
   screen (DESIGN.md §11.1), and the hero carries خروج itself. Every other
   screen keeps the bar. Both must ask the same question and get the same
   answer, so neither owns the modal.

   Asked, not assumed: he stays signed in for months, so leaving is a deliberate
   act — usually to hand the phone to his brother. */
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
    await fetch('/api/student/auth', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/student/login';
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
          ستحتاج رقم دخولك ورقم هويتك للعودة. اخرج إن كان الجهاز مشتركًا مع غيرك.
        </p>
      </Modal>
    </>
  );
}
