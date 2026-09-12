import { redirect } from 'next/navigation';
import { readSession, readStudentSession } from '@/lib/auth';

/* Two portals, one address.

   This sent everyone to /login — the SUPERVISOR's door — so a boy opening the
   bare link was asked for a username and a password he does not have, and told
   «غير صحيحة» when he tried his own. There is one supervisor and a hundred and
   seventeen students; the default belongs to them.

   Whoever is already signed in goes straight to his own side. */
export default async function Index() {
  if (await readStudentSession()) redirect('/student');
  if (await readSession()) redirect('/admin');
  redirect('/student/login');
}
