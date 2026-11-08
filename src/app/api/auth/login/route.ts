import { loginBody } from '@/server/schemas';
import { loginUser, setSession } from '@/server/auth';
import { handle, parse } from '@/server/http';
import { ApiError } from '@/server/service';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  return handle('auth.login', async () => {
    const b = await parse(req, loginBody);
    const u = await loginUser(b.username, b.password);
    if (!u) throw new ApiError(401, 'Pogrešno korisničko ime ili lozinka.');
    await setSession(u.id);
    return { ok: true, user: { id: u.id, username: u.username } };
  }, { auth: false });
}
