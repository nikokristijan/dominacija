'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { Icon, type IconName } from '@/components/art/Icons';
import { Penguin } from '@/components/art/Penguin';
import type { Mood } from '@/engine/types';

export function Sheet({ open, onClose, children, title, tall = false }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string; tall?: boolean }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-[#1a1040]/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={`relative w-full max-w-xl bg-white rounded-t-[2rem] lg:rounded-[2rem] border-2 border-line shadow-2xl flex flex-col ${tall ? 'h-[92dvh]' : 'max-h-[88dvh]'}`}
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag={reduce ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.4 }} onDragEnd={(_, i) => { if (i.offset.y > 120) onClose(); }}
          >
            <div className="pt-3 pb-1 shrink-0 cursor-grab"><div className="sheet-handle" /></div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+var(--safe-b))] pt-1 flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Toasts({ toasts }: { toasts: Array<{ id: number; text: string; kind: 'good' | 'bad' | 'info' }> }) {
  return (
    <div className="fixed left-0 right-0 top-[calc(0.75rem+var(--safe-t))] z-[60] flex flex-col items-center gap-2 pointer-events-none px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ y: -30, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }}
            className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-extrabold shadow-xl border-2 ${t.kind === 'good' ? 'bg-green-50 border-green-300 text-green-800' : t.kind === 'bad' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-white border-line text-ink'}`}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Progress({ value, max = 100, color = 'bg-primary', className = '' }: { value: number; max?: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-3 rounded-full bg-primary-100 overflow-hidden ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <motion.div className={`h-full rounded-full ${color}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', damping: 24, stiffness: 160 }} />
    </div>
  );
}

export function Empty({ title, text, mood = 'thinking', children }: { title: string; text?: string; mood?: Mood; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4 gap-2">
      <Penguin mood={mood} size={110} />
      <h3 className="text-xl text-secondary">{title}</h3>
      {text && <p className="text-muted max-w-sm">{text}</p>}
      {children}
    </div>
  );
}

export function SectionTitle({ icon, children, right }: { icon?: IconName; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 mt-1">
      <h2 className="text-lg text-secondary flex items-center gap-2">{icon && <Icon name={icon} size={20} />}{children}</h2>
      {right}
    </div>
  );
}

export function Expandable({ title, children, defaultOpen = false, badge }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  return (
    <details className="card-flat group" open={defaultOpen}>
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none min-h-10 font-extrabold text-secondary">
        <span className="flex items-center gap-2">{title}</span>
        <span className="flex items-center gap-2">{badge}<Icon name="down" size={18} className="transition-transform group-open:rotate-180" /></span>
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (<label className="block"><span className="label block mb-1">{label}</span>{children}{hint && <span className="text-xs text-muted mt-1 block">{hint}</span>}</label>);
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center justify-between gap-1" aria-label="Koraci">
      {steps.map((s, i) => (
        <li key={s} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className={`h-9 w-9 rounded-full grid place-items-center font-extrabold text-sm border-2 ${i === current ? 'bg-accent border-accent-600 text-ink scale-110' : i < current ? 'bg-primary border-primary text-white' : 'bg-white border-line text-muted'}`}>{i < current ? '✓' : i + 1}</span>
          <span className={`text-[11px] truncate max-w-full ${i === current ? 'text-secondary font-extrabold' : 'text-muted'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="flex rounded-2xl bg-primary-100 p-1 gap-1" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={`flex-1 min-h-10 rounded-xl px-2 text-sm font-extrabold ${value === o.value ? 'tab-active' : 'text-primary'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Counter({ value, onChange, min = 0, max = 99, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="inline-flex items-center rounded-2xl border-2 border-line bg-white overflow-hidden">
      <button type="button" className="h-11 w-11 grid place-items-center text-primary active:bg-primary-100 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label="Smanji"><Icon name="minus" /></button>
      <input aria-label="Količina" inputMode="numeric" className="w-14 text-center font-extrabold bg-transparent outline-none" value={value} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); onChange(Math.max(min, Math.min(max, n))); }} />
      <button type="button" className="h-11 w-11 grid place-items-center text-primary active:bg-primary-100 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label="Povećaj"><Icon name="plus" /></button>
    </div>
  );
}
