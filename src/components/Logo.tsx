import { Icon } from '@/components/art/Icons';

/** Minimalni znak: linijska kruna + riječ „Dominacija”. */
export function Logo({ size = 1 }: { size?: number }) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none" aria-label="Dominacija" style={{ fontSize: 22 * size }}>
      <Icon name="crown" size={Math.round(30 * size)} stroke={1.8} />
      <span className="font-semibold tracking-tight" style={{ letterSpacing: '-0.03em' }}>Dominacija</span>
    </div>
  );
}
