/**
 * Web Push (priprema). Šalje se samo ako su postavljeni VAPID ključevi i instaliran paket `web-push`.
 * Bez toga se obavijesti prikazuju unutar aplikacije. NIJE testirano s pravim push poslužiteljem.
 */
import type { PushSub } from './records';

export async function sendPushTo(subs: PushSub[], payload: { title: string; body: string; url: string }): Promise<void> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || !subs.length) return;
  try {
    const modName = 'web-push';
    const webpush = (await import(/* webpackIgnore: true */ modName)).default;
    webpush.setVapidDetails('mailto:admin@dominacija.example', pub, priv);
    await Promise.allSettled(subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload))));
  } catch { /* paket nije instaliran — preskoči */ }
}
