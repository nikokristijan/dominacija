import { conditionalAction } from '@/server/schemas';
import { handle, parse } from '@/server/http';
import { conditionalActionSvc } from '@/server/service';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return handle('conditional', async (u) => conditionalActionSvc(u!.id, id, await parse(req, conditionalAction))); }
