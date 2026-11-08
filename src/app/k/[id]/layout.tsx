import { redirect } from 'next/navigation';
import { currentUser } from '@/server/auth';
import { CampaignShell } from '@/components/game/CampaignShell';

export const dynamic = 'force-dynamic';
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUser())) redirect('/prijava');
  return <CampaignShell id={id}>{children}</CampaignShell>;
}
