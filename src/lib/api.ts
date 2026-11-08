'use client';
export class ApiFail extends Error { constructor(message: string, public status: number, public details?: any) { super(message); } }
type LocalFn = (path: string, body: unknown, method: string) => Promise<unknown> | undefined;
let local: LocalFn | null = null;
/** Vodič (tutorial) preusmjerava pozive na lokalni engine u pregledniku; null = normalni rad preko servera. */
export function setLocalApi(fn: LocalFn | null) { local = fn; }

export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  if (local) { const r = local(path, body, method ?? (body === undefined ? 'GET' : 'POST')); if (r !== undefined) return r as Promise<T>; }
  const res = await fetch(path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  let data: any = null;
  try { data = await res.json(); } catch { /* prazno */ }
  if (!res.ok) throw new ApiFail(data?.error ?? 'Došlo je do greške.', res.status, data?.details);
  return data as T;
}
