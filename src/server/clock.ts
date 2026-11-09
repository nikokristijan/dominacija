/** Raspored dana: zaključavanje naredbi u zadanoj zoni, razvojni ubrzani način. */
import type { Schedule } from './records';

/** Pomak vremenske zone (ms) za dani trenutak. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - date.getTime();
}
/** Lokalno vrijeme zone → UTC Date. */
export function zonedToUtc(y: number, m: number, d: number, h: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m, d, h, 0, 0));
  const off = tzOffsetMs(guess, tz);
  const res = new Date(guess.getTime() - off);
  const off2 = tzOffsetMs(res, tz);
  return off2 === off ? res : new Date(guess.getTime() - off2);
}
function localParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month - 1, d: +p.day };
}
/** Prvi trenutak zadanog sata u zoni koji je nakon `after` (i barem `minGapMs` kasnije). */
export function nextHour(after: Date, hour: number, tz: string, minGapMs = 0): Date {
  const { y, m, d } = localParts(after, tz);
  for (let i = 0; i < 4; i++) {
    const c = zonedToUtc(y, m, d + i, hour, tz);
    if (c.getTime() - after.getTime() >= minGapMs) return c;
  }
  return new Date(after.getTime() + 24 * 3600_000);
}

export function nextClock(schedule: Schedule, from: Date): { roundOpensAt: string; roundDeadline: string; middayAt: string | null } {
  const mid = schedule.middayHour != null;
  if (schedule.mode === 'dev') {
    return { roundOpensAt: from.toISOString(), roundDeadline: new Date(from.getTime() + schedule.devPlanningSeconds * 1000).toISOString(), middayAt: mid ? new Date(from.getTime() + schedule.devPlanningSeconds * 500).toISOString() : null };
  }
  const deadline = nextHour(from, schedule.lockHour, schedule.timezone, 2 * 3600_000);
  const opens = nextHour(from, schedule.planningStartHour, schedule.timezone, 0);
  // Ako je trenutno unutar prozora planiranja, runda je već otvorena.
  const opensAt = opens.getTime() > deadline.getTime() ? from : opens.getTime() - from.getTime() > 20 * 3600_000 ? from : opens;
  const dl = deadline;
  const inWindow = from.getTime() >= dl.getTime() - (schedule.lockHour - schedule.planningStartHour) * 3600_000;
  const open = inWindow ? from : opensAt;
  // Podne: prvi nastup tog sata nakon otvaranja runde, ali samo ako je prije zaključavanja
  let middayAt: string | null = null;
  if (mid) { const m = nextHour(new Date(Math.max(open.getTime(), from.getTime()) - 1000), schedule.middayHour!, schedule.timezone, 0); if (m.getTime() > open.getTime() - 1 && m.getTime() < dl.getTime() - 30 * 60_000) middayAt = m.toISOString(); }
  return { roundOpensAt: open.toISOString(), roundDeadline: dl.toISOString(), middayAt };
}
