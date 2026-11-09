/**
 * Web Push: šalje se samo ako su postavljeni VAPID ključevi (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY).
 * Bez njih obavijesti rade unutar aplikacije. Slanje je odvojeno od transakcije (outbox): poruke se šalju tek nakon
 * što je zapis stvarno spremljen, a istekle pretplate (HTTP 404/410) se vraćaju pozivatelju da ih ukloni.
 */
import * as wpNs from 'web-push';
import type { PushSub } from './records';

// CJS paket: ovisno o bundleru funkcije su na `default` ili izravno na modulu
const webpush = ((wpNs as unknown as { default?: typeof wpNs }).default ?? wpNs) as typeof wpNs;

export interface PushPayload { title: string; body: string; url: string }
export const pushEnabled = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** Vraća endpointe pretplata koje više ne vrijede. */
export async function sendPushTo(subs: PushSub[], payload: PushPayload, send: typeof webpush.sendNotification = webpush.sendNotification.bind(webpush)): Promise<string[]> {
  if (!pushEnabled() || !subs.length) return [];
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@dominacija.example', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const dead: string[] = [];
  await Promise.allSettled(subs.map(async (s) => {
    try { await send({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'high', timeout: 5000 }); }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) dead.push(s.endpoint); }
  }));
  return dead;
}
