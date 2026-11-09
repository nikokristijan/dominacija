import { NextResponse } from 'next/server';
import { tickAll, flushPushOutbox } from '@/server/service';
export const dynamic = 'force-dynamic';
/** Vercel Cron: GET s Authorization: Bearer $CRON_SECRET. Razrješava sve kampanje kojima je rok istekao (idempotentno). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron šalje Authorization: Bearer; vanjski „pingeri” (cron-job.org, UptimeRobot) često ne mogu pa podržavamo i ?secret=
  const given = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? new URL(req.url).searchParams.get('secret');
  if (!secret || given !== secret) return NextResponse.json({ error: 'Zabranjeno.' }, { status: 401 });
  const resolved = await tickAll();
  await flushPushOutbox().catch(() => undefined);
  return NextResponse.json({ resolved });
}
