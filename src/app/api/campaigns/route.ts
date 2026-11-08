import { createCampaignBody } from '@/server/schemas';
import { handle, parse } from '@/server/http';
import { createCampaign, listMyCampaigns } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function GET() { return handle('campaigns.list', async (u) => ({ campaigns: await listMyCampaigns(u!.id) })); }
export async function POST(req: Request) { return handle('campaigns.create', async (u) => ({ campaign: await createCampaign(u!.id, await parse(req, createCampaignBody)) })); }
