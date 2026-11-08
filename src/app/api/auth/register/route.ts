import { authBody } from '@/server/schemas';
import { registerUser, setSession } from '@/server/auth';
import { handle, json, parse } from '@/server/http';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  return handle('auth.register', async () => {
    const b = await parse(req, authBody);
    const r = await registerUser(b.username, b.password, b.displayName ?? b.username, b.email);
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    await setSession(r.user.id);
    return { ok: true, user: { id: r.user.id, username: r.user.username } };
  }, { auth: false });
}
void json;
