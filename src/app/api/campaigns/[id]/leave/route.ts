import { handle } from '@/server/http';
import { leaveCampaign } from '@/server/service';
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return handle('campaign.leave', async (u) => leaveCampaign(u!.id, id)); }
