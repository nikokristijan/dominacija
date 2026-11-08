import { redirect } from 'next/navigation';
import { currentUser } from '@/server/auth';
import { CampaignShell } from '@/components/game/CampaignShell';

export const dynamic = 'force-dynamic';
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== 'tutorial' && !(await currentUser())) redirect('/prijava'); // vodič radi i bez računa
  return <CampaignShell id={id}>{children}</CampaignShell>;
}
