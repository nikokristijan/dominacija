import { redirect } from 'next/navigation';
import { currentUser } from '@/server/auth';
import { AdminPanel } from '@/components/screens/AdminPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administracija' };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect('/prijava');
  if (!u.isAdmin) redirect('/igra'); // normalni igrači ne vide administraciju
  return <AdminPanel />;
}
