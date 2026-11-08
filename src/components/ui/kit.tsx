'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { Icon, type IconName } from '@/components/art/Icons';
import { useIsDesktop } from '@/lib/useMediaQuery';

/**
 * Sheet: bijeli, minimalan skočni prozor.
 * - mobilno: donji list koji se povlači (draggable); `modeless` ostavlja kartu iznad dodirljivom
 * - desktop: `side` = plutajući desni panel bez zatamnjenja; inače centrirani modal
 */
export function Sheet({ open, onClose, children, title, tall = false, modeless = false, side = false }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string; tall?: boolean; modeless?: boolean; side?: boolean }) {
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  const floating = desktop && side;
  return (
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-50 flex ${floating ? 'items-start justify-end pointer-events-none pt-[88px] pr-4 pb-4' : 'items-end lg:items-center justify-center'} ${modeless && !desktop ? 'pointer-events-none' : ''}`} role="dialog" aria-modal={!modeless && !floating} aria-label={title}>
          {!modeless && !floating && <motion.div className="absolute inset-0 bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />}
          <motion.div
            className={`relative bg-white flex flex-col pointer-events-auto ${floating ? 'w-[400px] max-h-full rounded-[22px] float-shadow' : `w-full max-w-xl rounded-t-[24px] lg:rounded-[24px] float-shadow ${tall ? 'h-[92dvh] lg:h-auto lg:max-h-[88dvh]' : modeless ? 'max-h-[62dvh]' : 'max-h-[88dvh]'}`}`}
            initial={reduce ? { opacity: 0, x: 0, y: 0 } : floating ? { x: 40, y: 0, opacity: 0 } : { x: 0, y: '100%', opacity: 1 }} animate={{ x: 0, y: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : floating ? { x: 40, opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag={reduce || floating ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }} onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose(); }}
          >
            {floating ? (
              <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0"><span className="label">{title}</span><button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-50" aria-label="Zatvori"><Icon name="close" size={18} /></button></div>
            ) : <div className="pt-2.5 pb-1 shrink-0 cursor-grab touch-none"><div className="sheet-handle" /></div>}
            <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+var(--safe-b))] pt-2 flex-1 min-h-0">{children}</div>
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
          <motion.div key={t.id} initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, y: -16 }}
            className={`pointer-events-auto max-w-md rounded-full px-5 py-2.5 text-sm font-semibold float-shadow ${t.kind === 'good' ? 'bg-ink text-white' : t.kind === 'bad' ? 'bg-bad text-white' : 'bg-white text-ink'}`}>
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
    <div className={`h-1.5 rounded-full bg-neutral-100 overflow-hidden ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <motion.div className={`h-full rounded-full ${color}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', damping: 26, stiffness: 170 }} />
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; mood?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 gap-1.5">
      <div className="h-10 w-10 rounded-full bg-neutral-50 grid place-items-center text-neutral-400 mb-1"><Icon name="sparkle" size={20} /></div>
      <h3 className="text-lg">{title}</h3>
      {text && <p className="text-muted max-w-sm text-sm">{text}</p>}
      {children}
    </div>
  );
}

export function SectionTitle({ icon, children, right }: { icon?: IconName; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 mt-1">
      <h2 className="text-[15px] flex items-center gap-2 text-ink">{icon && <Icon name={icon} size={18} className="text-neutral-400" />}{children}</h2>
      {right}
    </div>
  );
}

export function Expandable({ title, children, defaultOpen = false, badge }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  return (
    <details className="card-flat group" open={defaultOpen}>
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none min-h-10 font-semibold">
        <span className="flex items-center gap-2">{title}</span>
        <span className="flex items-center gap-2">{badge}<Icon name="down" size={16} className="text-neutral-400 transition-transform group-open:rotate-180" /></span>
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (<label className="block"><span className="label block mb-1.5">{label}</span>{children}{hint && <span className="text-xs text-muted mt-1 block">{hint}</span>}</label>);
}

export function Stepper({ steps, current, onGo }: { steps: string[]; current: number; onGo?: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1" aria-label="Koraci">
      {steps.map((s, i) => (
        <li key={s} className="flex-1 min-w-0">
          <button type="button" onClick={() => onGo?.(i)} className="w-full text-left group">
            <div className={`h-1 rounded-full ${i <= current ? 'bg-primary' : 'bg-neutral-200'}`} />
            <span className={`block text-[11px] mt-1.5 truncate font-semibold ${i === current ? 'text-ink' : 'text-neutral-400'}`}>{s}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Seg<T extends string>({ value, onChange, options, small }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; small?: boolean }) {
  return (
    <div className="flex rounded-xl bg-neutral-100 p-0.5 gap-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={`flex-1 rounded-[10px] px-2 font-semibold transition-colors ${small ? 'min-h-8 text-[13px]' : 'min-h-9 text-sm'} ${value === o.value ? 'tab-active' : 'text-neutral-500'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Counter({ value, onChange, min = 0, max = 99, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-[#E4E4E4] bg-white overflow-hidden">
      <button type="button" className="h-10 w-10 grid place-items-center text-neutral-600 active:bg-neutral-50 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label="Smanji"><Icon name="minus" size={18} /></button>
      <input aria-label="Količina" inputMode="numeric" className="w-12 text-center font-semibold bg-transparent outline-none" value={value} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); onChange(Math.max(min, Math.min(max, n))); }} />
      <button type="button" className="h-10 w-10 grid place-items-center text-neutral-600 active:bg-neutral-50 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label="Povećaj"><Icon name="plus" size={18} /></button>
    </div>
  );
}

/** Red s akcijom (naslov + opis + strelica) — koristi se u popupima. */
export function ActionRow({ icon, title, sub, onClick, disabled, testId, tour }: { icon: IconName; title: string; sub?: string; onClick: () => void; disabled?: boolean; testId?: string; tour?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} data-tour={tour} className="w-full flex items-center gap-3.5 rounded-2xl border border-line px-4 py-3 text-left hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-40 transition-colors">
      <Icon name={icon} size={24} stroke={1.6} className="text-neutral-700 shrink-0" />
      <span className="flex-1 min-w-0"><span className="block font-semibold leading-tight">{title}</span>{sub && <span className="block text-[13px] text-muted leading-snug">{sub}</span>}</span>
      <Icon name="chevron" size={18} className="text-neutral-300 shrink-0" />
    </button>
  );
}
