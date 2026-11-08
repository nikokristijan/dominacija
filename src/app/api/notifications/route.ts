import { z } from 'zod';
import { handle, parse } from '@/server/http';
import { listNotifications, markNotificationsRead } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { const cid = new URL(req.url).searchParams.get('campaign') ?? undefined; return handle('notifications', async (u) => ({ notifications: await listNotifications(u!.id, cid) })); }
export async function POST(req: Request) { return handle('notifications.read', async (u) => markNotificationsRead(u!.id, (await parse(req, z.object({ ids: z.array(z.string()).optional() }))).ids)); }
