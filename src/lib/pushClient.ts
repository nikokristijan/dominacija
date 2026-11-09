import { api } from '@/lib/api';

export type PushResult = 'ok' | 'unsupported' | 'no-keys' | 'denied' | 'error';
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushConfigured = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Traži dopuštenje i pretplaćuje preglednik na push obavijesti (Android/desktop; na iPhoneu tek kad je aplikacija dodana na početni zaslon). */
export async function enablePush(): Promise<PushResult> {
  try {
    if (!pushSupported()) return 'unsupported';
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return 'no-keys';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await api('/api/push/subscribe', sub.toJSON());
    return 'ok';
  } catch { return 'error'; }
}
export const PUSH_MESSAGES: Record<PushResult, string> = {
  ok: 'Push obavijesti uključene.', unsupported: 'Ovaj preglednik ne podržava push (na iPhoneu prvo dodaj igru na početni zaslon).',
  'no-keys': 'Push poslužitelj još nije podešen (VAPID ključevi). Obavijesti rade unutar aplikacije.', denied: 'Dozvola je odbijena — možeš je uključiti u postavkama preglednika.', error: 'Nešto je pošlo po zlu. Pokušaj ponovno.',
};
