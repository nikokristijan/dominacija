export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0 min';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${sec.toString().padStart(2, '0')} s`;
  return `${sec} s`;
}
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'upravo sada';
  if (m < 60) return `prije ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `prije ${h} h`;
  return `prije ${Math.floor(h / 24)} d`;
}
export const num = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.floor(n)}`);
export const signed = (n: number, d = 0) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}`;
export const RES_NAMES = { gold: 'Zlato', food: 'Hrana', iron: 'Željezo', wood: 'Drvo', influence: 'Utjecaj' } as const;
export const RES_LOWER = { gold: 'zlato', food: 'hrana', iron: 'željezo', wood: 'drvo', influence: 'utjecaj' } as const;
