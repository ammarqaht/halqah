'use client';
/* بوابة المعلم — a work surface for a man standing between twenty-five boys.

   It shares the student portal's shell deliberately: no rail, five
   destinations, a bottom bar on a phone and a slim top bar on a desktop, and
   the `.portal` look. The supervisor is at 1440px with a mouse reading tables;
   a teacher and his students are both on phones in a mosque, and that is the
   thing these two surfaces have in common.

   Every screen under here reads from /api/teacher/*, which resolves WHICH
   HALAQA is asking from the cookie before it reads a row — «لكل معلم حلقة
   واحدة، ولا يرى غيرها». Nothing here imports lib/store. */
import { usePathname } from 'next/navigation';
import { MeProvider, useMe } from '@/components/teacher/Me';
import { TeacherNav } from '@/components/teacher/Nav';
import { LoadingMark } from '@/components/LoadingMark';
import { ScrollProgress } from '@/components/ScrollProgress';

function Shell({ children }: { children: React.ReactNode }) {
  const { me } = useMe();

  if (!me) return <LoadingMark show />;

  return (
    <div className="portal min-h-screen bg-page">
      {/* «من يمينها إلى يسارها» across the top — see components/ScrollProgress. */}
      <ScrollProgress />
      <TeacherNav />
      <main className="mx-auto max-w-column px-5 pb-28 pt-4 md:px-6 md:pb-16 md:pt-8">
        {children}
      </main>
    </div>
  );
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  /* Signing in cannot require being signed in. */
  if (path === '/teacher/login') return <div className="portal">{children}</div>;
  /* A printed sheet gets no shell: «ما على الشاشة هو ما يخرج من الطابعة»
     (DESIGN.md §8), and a tab bar across the bottom of an A4 page is a lie about
     the sheet. `app/teacher/print/layout.tsx` carries its own chrome. */
  if (path.startsWith('/teacher/print')) return <>{children}</>;
  return <MeProvider><Shell>{children}</Shell></MeProvider>;
}
