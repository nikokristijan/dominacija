import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { currentUser } from './auth';
import { ApiError, logError } from './service';
import { getStore } from './store';
import type { UserRecord } from './records';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handle(where: string, fn: (user: UserRecord | null) => Promise<unknown>, opts: { auth?: boolean } = { auth: true }) {
  try {
    const user = await currentUser();
    if (opts.auth !== false && !user) return json({ error: 'Nisi prijavljen.' }, 401);
    return json(await fn(user));
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message, details: e.details }, e.status);
    if (e instanceof ZodError) return json({ error: 'Neispravni podaci.', details: e.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
    await getStore().tx((db) => logError(db, where, e)).catch(() => undefined);
    return json({ error: 'Greška na serveru.' }, 500);
  }
}
export async function parse<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new ApiError(400, 'Neispravan JSON.'); }
  return schema.parse(body);
}
