'use client';
/* الترحيب — الباب الأول.

   The bare address used to send everyone straight to بوابة الطالب, so a
   supervisor or a teacher opening it landed on the wrong door and had to find
   his own. Now it asks first: three plain doors, supervisor → teacher → student
   from the right, inside the same frame and curtain as the three sign-in pages.

   It shows every time, signed in or not — the client asked for the choice to
   be the front door, not a detour around it. */
import { LoginFrame, useCurtain, DOOR } from '@/components/LoginFrame';
import { MOSQUE, NEIGHBOURHOOD } from '@/content/student';

const ORDER = ['admin', 'teacher', 'student'] as const;

export default function Welcome() {
  const curtain = useCurtain();

  return (
    <LoginFrame curtain={curtain}
      foot={<>
        <p className="text-micro uppercase tracking-[.16em] text-brand-200">منصة الحلقة</p>
        <p className="mt-1.5 text-base2 text-white/90">{MOSQUE} — {NEIGHBOURHOOD}</p>
      </>}>
      <p className="text-micro uppercase tracking-[.16em] text-brand-800">{MOSQUE}</p>
      <h1 className="mt-2 font-display text-d1 text-ink-900">أهلًا بك</h1>
      <p className="mt-2 text-base2 text-ink-600">اختر بوابتك للدخول.</p>

      <nav aria-label="بوابات الدخول" className="mt-8 grid grid-cols-3 gap-3">
        {ORDER.map((k) => {
          const d = DOOR[k];
          return (
            <a key={k} href={d.href}
              className="press flex h-28 flex-col items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-paper text-base2 font-medium text-ink-800 transition-colors hover:border-brand-700 hover:text-brand-800">
              <d.icon size={24} strokeWidth={1.8} className="text-brand-700" />
              {d.label}
            </a>
          );
        })}
      </nav>
    </LoginFrame>
  );
}
