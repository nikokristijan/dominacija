import { clearSession } from '@/server/auth';
import { handle } from '@/server/http';
export async function POST() { return handle('auth.logout', async () => { await clearSession(); return { ok: true }; }, { auth: false }); }
