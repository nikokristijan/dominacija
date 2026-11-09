import { z } from 'zod';
import { handle, parse } from '@/server/http';
import { devAction } from '@/server/service';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return handle('dev', async (u) => devAction(u!.id, id, (await parse(req, z.object({ action: z.enum(['resolve', 'resolve_all', 'midday']) }))).action)); }
