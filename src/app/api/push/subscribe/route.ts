import { z } from 'zod';
import { handle, parse } from '@/server/http';
import { savePushSubscription } from '@/server/service';
export async function POST(req: Request) { return handle('push.subscribe', async (u) => savePushSubscription(u!.id, await parse(req, z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) })))); }
