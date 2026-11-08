import { z } from 'zod';
import { orderInput } from '@/server/schemas';
import { handle, parse } from '@/server/http';
import { previewOrderSvc } from '@/server/service';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle('preview', async (u) => { const b = await parse(req, z.object({ order: orderInput, excludeId: z.string().max(40).optional() })); return { preview: await previewOrderSvc(u!.id, id, b.order, b.excludeId) }; });
}
