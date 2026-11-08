import { z } from 'zod';
import { handle, parse } from '@/server/http';
import { adminAction, adminOverview } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function GET() { return handle('admin.overview', async (u) => adminOverview(u!.id)); }
export async function POST(req: Request) {
  return handle('admin.action', async (u) => adminAction(u!.id, await parse(req, z.object({ action: z.string().max(30), campaignId: z.string().max(40).optional(), round: z.number().int().optional(), type: z.string().max(30).optional(), reason: z.string().max(200).optional(), overrides: z.any().optional(), targetUserId: z.string().max(40).optional(), schedule: z.any().optional() }))));
}
