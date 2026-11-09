import { afterEach, describe, expect, it } from 'vitest';
import * as wpNs from 'web-push';
const webpush = ((wpNs as unknown as { default?: typeof wpNs }).default ?? wpNs) as typeof wpNs;
import { sendPushTo, pushEnabled } from '../src/server/push';

const sub = (n: number) => ({ userId: 'u1', endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' }, createdAt: '' });
afterEach(() => { delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; });

describe('Web Push', () => {
  it('bez VAPID ključeva ne šalje ništa', async () => {
    const sent: string[] = [];
    expect(pushEnabled()).toBe(false);
    await sendPushTo([sub(1)], { title: 'T', body: 'B', url: '/x' }, (async (s: { endpoint: string }) => { sent.push(s.endpoint); }) as never);
    expect(sent).toEqual([]);
  });
  it('šalje JSON payload svim pretplatama, a istekle (410/404) vraća za uklanjanje', async () => {
    const k = webpush.generateVAPIDKeys();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = k.publicKey; process.env.VAPID_PRIVATE_KEY = k.privateKey;
    const got: Array<{ endpoint: string; body: string }> = [];
    const dead = await sendPushTo([sub(1), sub(2), sub(3)], { title: 'Napad!', body: 'Ana je napala Pepeljastimost', url: '/k/k1' }, (async (s: { endpoint: string }, body: string) => {
      if (s.endpoint.endsWith('/2')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      if (s.endpoint.endsWith('/3')) throw Object.assign(new Error('boom'), { statusCode: 500 });
      got.push({ endpoint: s.endpoint, body });
    }) as never);
    expect(got.length).toBe(1);
    expect(JSON.parse(got[0].body)).toEqual({ title: 'Napad!', body: 'Ana je napala Pepeljastimost', url: '/k/k1' });
    expect(dead).toEqual(['https://push.example/2']); // 500 se ne uklanja
  });
});
