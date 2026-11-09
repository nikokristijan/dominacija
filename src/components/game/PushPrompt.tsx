'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/art/Icons';
import { enablePush, PUSH_MESSAGES, pushConfigured, pushSupported } from '@/lib/pushClient';
import { useGame } from './GameProvider';

/** Jednokratni prijedlog na početnoj: „javi mi kad me netko napadne”. Pojavljuje se samo kad push zaista može raditi. */
export function PushPrompt() {
  const g = useGame();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(g.id !== 'tutorial' && pushConfigured() && pushSupported() && Notification.permission === 'default' && !localStorage.getItem('dom_push_dismissed')); } catch { setShow(false); }
  }, [g.id]);
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem('dom_push_dismissed', '1'); } catch { /* */ } setShow(false); };
  return (
    <section className="card flex items-center gap-3" data-testid="push-prompt">
      <span className="h-10 w-10 rounded-xl bg-primary-100 text-primary grid place-items-center shrink-0"><Icon name="bell" size={20} /></span>
      <div className="flex-1 min-w-0"><div className="font-semibold">Javimo ti kad te netko napadne</div><div className="text-xs text-muted">Obavijest na mobitelu čim se dan razriješi ili ti stigne ponuda.</div></div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button className="btn btn-yellow btn-sm" onClick={async () => { const r = await enablePush(); g.toast(PUSH_MESSAGES[r], r === 'ok' ? 'good' : 'info'); if (r !== 'error') dismiss(); }}>Uključi</button>
        <button className="text-xs font-semibold text-muted" onClick={dismiss}>Ne sada</button>
      </div>
    </section>
  );
}
