'use client';
/* بوابة الطالب — a reading surface for a boy on a phone in a mosque.
   No rail, four destinations, and not one byte of anyone else's data: every
   screen under here reads from /api/student/*, which resolves who is asking
   from the cookie before it reads a row. */
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MeProvider, useMe } from '@/components/student/Me';
import { StudentNav } from '@/components/student/Nav';
import { LoadingMark } from '@/components/LoadingMark';

function Shell({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const path = usePathname();
  const router = useRouter();

  /* A PIN he was handed on a printed sheet is a PIN his teacher knows. He
     changes it before he reaches anything else. */
  useEffect(() => {
    if (me?.mustChangePin && path !== '/student/pin') router.replace('/student/pin');
  }, [me?.mustChangePin, path, router]);

  if (!me) return <LoadingMark show />;

  return (
    <div className="student-body min-h-screen bg-page">
      <StudentNav />
      <main className="mx-auto max-w-column px-5 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8">
        {children}
      </main>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  /* Signing in cannot require being signed in. */
  if (path === '/student/login') return <div className="student-body">{children}</div>;
  return <MeProvider><Shell>{children}</Shell></MeProvider>;
}
