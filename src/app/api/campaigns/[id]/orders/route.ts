import { orderAction } from '@/server/schemas';
import { handle, parse } from '@/server/http';
import { orderActionSvc } from '@/server/service';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return handle('orders', async (u) => orderActionSvc(u!.id, id, await parse(req, orderAction))); }
