import { profileBody } from '@/server/schemas';
import { handle, parse } from '@/server/http';
import { getProfile, updateProfile } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function GET() { return handle('profile.get', async (u) => getProfile(u!.id)); }
export async function POST(req: Request) { return handle('profile.update', async (u) => ({ profile: await updateProfile(u!.id, await parse(req, profileBody) as any) })); }
