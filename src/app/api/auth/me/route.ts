import { handle } from '@/server/http';
import { getProfile } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function GET() { return handle('me', async (u) => getProfile(u!.id)); }
