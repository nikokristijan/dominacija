import { joinBody } from '@/server/schemas';
import { handle, parse } from '@/server/http';
import { joinCampaign } from '@/server/service';
export async function POST(req: Request) { return handle('campaigns.join', async (u) => { const b = await parse(req, joinBody); return { campaign: await joinCampaign(u!.id, b.code, b.faction) }; }); }
