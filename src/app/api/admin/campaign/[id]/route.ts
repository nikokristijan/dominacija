import { handle } from '@/server/http';
import { adminCampaignDetail } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return handle('admin.campaign', async (u) => adminCampaignDetail(u!.id, id)); }
