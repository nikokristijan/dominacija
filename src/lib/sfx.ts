/** Sitni zvukovi sintetizirani WebAudio-m (bez datoteka). Isključivo nakon korisničke interakcije (pravilo preglednika); uvijek se može utišati. */
let ctx: AudioContext | null = null;
const key = 'dom_sound';
export const soundOn = () => { try { return localStorage.getItem(key) !== 'off'; } catch { return true; } };
export const setSound = (on: boolean) => { try { localStorage.setItem(key, on ? 'on' : 'off'); } catch { /* */ } };
function ac(): AudioContext | null {
  if (typeof window === 'undefined' || !soundOn()) return null;
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.state === 'running' ? ctx : null;
  } catch { return null; }
}
function tone(freq: number, at: number, dur: number, vol = 0.05, type: OscillatorType = 'sine') {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  /** Otvaranje izdanja: tihi uzlazni dvoton. */
  open: () => { tone(392, 0, 0.35, 0.04); tone(587, 0.12, 0.5, 0.04); },
  tick: () => tone(880, 0, 0.06, 0.02, 'triangle'),
  win: () => { tone(523, 0, 0.25, 0.05, 'triangle'); tone(659, 0.1, 0.25, 0.05, 'triangle'); tone(784, 0.2, 0.5, 0.05, 'triangle'); },
  loss: () => { tone(220, 0, 0.5, 0.06, 'sawtooth'); tone(165, 0.18, 0.7, 0.05, 'sawtooth'); },
  rankUp: () => { tone(659, 0, 0.15, 0.05); tone(880, 0.12, 0.4, 0.05); },
};
