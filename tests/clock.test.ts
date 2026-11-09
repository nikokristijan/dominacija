import { describe, expect, it } from 'vitest';
import { nextClock } from '../src/server/clock';
import type { Schedule } from '../src/server/records';

const daily = (mid: number | null): Schedule => ({ mode: 'daily', timezone: 'Europe/Zagreb', planningStartHour: 8, lockHour: 20, devPlanningSeconds: 90, resolveWhenAllReady: false, middayHour: mid });

describe('Raspored dana s podnevnim razrješenjem', () => {
  it('prije podneva: podne u 13:00 lokalno, zaključavanje u 20:00', () => {
    const c = nextClock(daily(13), new Date('2026-01-05T07:00:00Z')); // 08:00 u Zagrebu (zima, UTC+1)
    expect(c.middayAt).toBe('2026-01-05T12:00:00.000Z');
    expect(c.roundDeadline).toBe('2026-01-05T19:00:00.000Z');
  });
  it('nakon podneva (runda otvorena poslijepodne): podne se preskače, večer ostaje', () => {
    const c = nextClock(daily(13), new Date('2026-01-05T14:30:00Z')); // 15:30 lokalno
    expect(c.middayAt).toBeNull();
    expect(Date.parse(c.roundDeadline)).toBeGreaterThan(Date.parse('2026-01-05T14:30:00Z'));
  });
  it('isključeno podne → null', () => { expect(nextClock(daily(null), new Date('2026-01-05T07:00:00Z')).middayAt).toBeNull(); });
  it('brzi/razvojni način: podne na pola trajanja dana', () => {
    const s: Schedule = { mode: 'dev', timezone: 'Europe/Zagreb', planningStartHour: 8, lockHour: 20, devPlanningSeconds: 600, resolveWhenAllReady: true, middayHour: 12 };
    const from = new Date('2026-01-05T10:00:00Z');
    const c = nextClock(s, from);
    expect(Date.parse(c.middayAt!) - from.getTime()).toBe(300_000);
    expect(Date.parse(c.roundDeadline) - from.getTime()).toBe(600_000);
    expect(nextClock({ ...s, middayHour: null }, from).middayAt).toBeNull();
  });
});
