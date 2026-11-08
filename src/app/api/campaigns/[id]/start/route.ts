import { handle } from '@/server/http';
import { startCampaign } from '@/server/service';
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return handle('campaign.start', async (u) => ({ campaign: await startCampaign(u!.id, id) })); }
