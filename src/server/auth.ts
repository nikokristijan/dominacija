/**
 * Autentikacija. Lokalni razvojni način: korisničko ime + lozinka (scrypt), potpisani kolačić sesije.
 * Produkcija: Supabase Auth (JWT u kolačiću) — vidi docs; ključ servisne uloge nikad ne ide u frontend.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getStore } from './store';
import type { UserRecord, ProfileRecord, NotificationPrefs } from './records';

const COOKIE = 'dom_session';
const secret = () => process.env.SESSION_SECRET ?? 'dev-only-secret-change-me';
export const defaultPrefs = (): NotificationPrefs => ({ invitation: true, alliance_offer: true, trade_offer: true, attack: true, resolution: true, diplomatic: true, campaign_complete: true, phase: false, achievement: true, warning: true, push: false });

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32);
  return `${salt.toString('hex')}:${h.toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const h = scryptSync(pw, Buffer.from(salt, 'hex'), 32);
  const b = Buffer.from(hash, 'hex');
  return h.length === b.length && timingSafeEqual(h, b);
}
function sign(payload: string) { return createHmac('sha256', secret()).update(payload).digest('hex'); }
export function makeToken(userId: string): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const p = `${userId}.${exp}`;
  return `${p}.${sign(p)}`;
}
export function parseToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expect = sign(`${uid}.${exp}`);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  if (Number(exp) < Date.now()) return null;
  return uid;
}

export async function setSession(userId: string) {
  (await cookies()).set(COOKIE, makeToken(userId), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }

export async function currentUser(): Promise<UserRecord | null> {
  const uid = parseToken((await cookies()).get(COOKIE)?.value);
  if (!uid) return null;
  const u = await getStore().read((db) => db.users[uid] ?? null);
  return u && !u.disabled ? u : null;
}

const isAdminName = (name: string) => (process.env.ADMIN_USERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(name.toLowerCase());

export async function registerUser(username: string, password: string, displayName: string, email?: string): Promise<{ ok: true; user: UserRecord } | { ok: false; error: string }> {
  const uname = username.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(uname)) return { ok: false, error: 'Korisničko ime: 3–24 znaka (slova, brojke, _ . -).' };
  if (password.length < 8) return { ok: false, error: 'Lozinka mora imati barem 8 znakova.' };
  const name = displayName.trim().slice(0, 24) || username;
  return getStore().tx((db) => {
    if (Object.values(db.users).some((u) => u.username === uname)) return { ok: false as const, error: 'Korisničko ime je zauzeto.' };
    const id = `u${(++db.counter).toString(36)}${randomBytes(3).toString('hex')}`;
    const first = Object.keys(db.users).length === 0;
    const user: UserRecord = { id, username: uname, email, passwordHash: hashPassword(password), createdAt: new Date().toISOString(), isAdmin: isAdminName(uname) || (first && process.env.DEV_MODE === 'true') };
    db.users[id] = user;
    const profile: ProfileRecord = {
      userId: id, displayName: name, preferredFaction: null, createdAt: user.createdAt, achievements: [], totals: { campaigns: 0, wins: 0, battlesWon: 0, territoriesCaptured: 0 },
      history: [], prefs: defaultPrefs(), mood: 'happy',
    };
    db.profiles[id] = profile;
    return { ok: true as const, user };
  });
}

export async function loginUser(username: string, password: string): Promise<UserRecord | null> {
  const uname = username.trim().toLowerCase();
  const u = await getStore().read((db) => Object.values(db.users).find((x) => x.username === uname) ?? null);
  if (!u || u.disabled || !verifyPassword(password, u.passwordHash)) return null;
  return u;
}
