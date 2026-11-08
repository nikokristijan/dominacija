'use client';
export class ApiFail extends Error { constructor(message: string, public status: number, public details?: any) { super(message); } }
export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  let data: any = null;
  try { data = await res.json(); } catch { /* prazno */ }
  if (!res.ok) throw new ApiFail(data?.error ?? 'Došlo je do greške.', res.status, data?.details);
  return data as T;
}
