import { NextResponse } from 'next/server';
import { tickAll, flushPushOutbox } from '@/server/service';
export const dynamic = 'force-dynamic';
/** Vercel Cron: GET s Authorization: Bearer $CRON_SECRET. Razrješava sve kampanje kojima je rok istekao (idempotentno). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Zabranjeno.' }, { status: 401 });
  const resolved = await tickAll();
  await flushPushOutbox().catch(() => undefined);
  return NextResponse.json({ resolved });
}
