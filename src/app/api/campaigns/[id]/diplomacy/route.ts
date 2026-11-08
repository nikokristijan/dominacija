import { diplomacyAction } from '@/server/schemas';
import { handle, parse } from '@/server/http';
import { diplomacyActionSvc } from '@/server/service';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return handle('diplomacy', async (u) => diplomacyActionSvc(u!.id, id, await parse(req, diplomacyAction))); }
