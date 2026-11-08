import { handle } from '@/server/http';
import { getCampaignView, getLobby } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle('campaign.view', async (u) => {
    const r = await getCampaignView(u!.id, id);
    return r;
  });
}
void getLobby;
