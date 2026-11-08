'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Order, OrderInput, OrderType } from '@/engine/types';
import { Icon } from '@/components/art/Icons';
import { Progress, SectionTitle, Sheet, Empty } from '@/components/ui/kit';
import { useGame } from '@/components/game/GameProvider';
import { OrderComposer, ORDER_LABELS } from '@/components/game/OrderComposer';
import { ConditionalComposer, ACTION_LABEL, TRIGGER_LABEL } from '@/components/game/ConditionalComposer';
import { CostLine } from '@/components/game/common';
import { describeOrder } from '@/components/game/orderText';
import { ResourceIcon } from '@/components/art/Resources';

const TYPES: OrderType[] = ['recruit', 'build', 'trade', 'defend', 'espionage', 'diplomacy', 'sabotage', 'research'];

export function OrdersScreen() {
  const g = useGame();
  const v = g.view!;
  const [composer, setComposer] = useState<{ type: OrderType; order?: Order } | null>(null);
  const [cond, setCond] = useState(false);
  const [busy, setBusy] = useState(false);
  const planning = v.phase === 'planning';
  const editable = planning && !v.me.ready;
  const orders = v.orders.filter((o) => o.round === v.round && o.status !== 'cancelled').sort((a, b) => a.priority - b.priority);
  const active = orders.filter((o) => o.status === 'submitted' || o.status === 'locked');
  const drafts = orders.filter((o) => o.status === 'draft');
  const conds = v.conditionalOrders.filter((c) => c.status === 'active' && c.expiresRound >= v.round);
  const post = async (body: unknown, msg?: string) => { setBusy(true); try { await g.act(`/api/campaigns/${g.id}/orders`, body, { successMsg: msg }); } catch { /* toast */ } finally { setBusy(false); } };
  const move = (o: Order, dir: -1 | 1) => {
    const ids = active.map((x) => x.id);
    const i = ids.indexOf(o.id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void post({ action: 'reorder', orderIds: ids });
  };
  const lastResolved = v.orders.filter((o) => o.round === v.round - 1 && o.result);

  return (
    <div className="flex-1 overflow-y-auto" data-testid="orders-screen">
      <div className="max-w-3xl mx-auto p-3 lg:p-5 space-y-4">
        <section className="card space-y-3">
          <div className="flex items-center justify-between"><h1 className="text-2xl">Operacije · dan {v.round}</h1><span className={`chip ${v.me.ready ? 'chip-good' : 'chip-yellow'}`} data-testid="ready-chip">{v.me.ready ? 'Spremno' : planning ? 'Planiranje' : 'Zaključano'}</span></div>
          <div className="flex items-center gap-3"><ResourceIcon name="command" size={30} className="text-neutral-500" /><div className="flex-1"><div className="flex justify-between font-semibold text-sm"><span>Zapovjedni bodovi</span><span data-testid="cp-used">{v.cp.used} / {v.cp.available}</span></div><Progress value={v.cp.used} max={v.cp.available} color="bg-primary" /></div></div>
          <p className="text-xs font-semibold text-muted">Naredbe su privatne do razrješenja. Resursi se rezerviraju pri predaji, a nacrti ne troše ništa. Predane naredbe možeš mijenjati do roka ili dok ne označiš „spremno”.</p>
        </section>

        {editable && (<section>
          <SectionTitle icon="plus">Nova naredba</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            <Link href={`/k/${g.id}/karta?op=`} className="col-span-4 btn btn-ghost" data-testid="new-attack"><Icon name="sword" size={20} />Vojni napad — planiraj na karti</Link>
            {TYPES.map((t) => (
              <button key={t} onClick={() => setComposer({ type: t })} className="rounded-xl bg-white border border-line min-h-20 flex flex-col items-center justify-center gap-1 text-neutral-700 hover:bg-neutral-50" data-testid={`new-${t}`}>
                <Icon name={ORDER_LABELS[t].icon} size={26} /><span className="text-[11px] font-semibold text-ink text-center leading-tight px-0.5">{ORDER_LABELS[t].name.replace('Trgovačka ekspedicija', 'Trgovina').replace('Obrambena operacija', 'Obrana').replace('Diplomatska misija', 'Diplomacija')}</span><span className="chip !py-0">{v.config.orderCosts[t]} ZB</span>
              </button>))}
            {v.me.status === 'resistance' && <button onClick={() => setComposer({ type: 'resistance' })} className="col-span-4 btn btn-purple" data-testid="new-resistance"><Icon name="flag" size={20} />Misija Otpora</button>}
          </div>
        </section>)}

        <section className="space-y-2">
          <SectionTitle icon="orders">Predane naredbe ({active.length})</SectionTitle>
          {active.length === 0 && <Empty title="Nema predanih naredbi" text="Dodaj naredbe ili ostavi kraljevstvo na automatskoj obrani." mood="thinking" />}
          {active.map((o, i) => <OrderRow key={o.id} o={o} i={i} n={active.length} editable={editable} busy={busy} onEdit={() => o.type !== 'attack' && setComposer({ type: o.type, order: o })} onRemove={() => post({ action: 'remove', orderId: o.id }, 'Naredba uklonjena.')} onMove={(d) => move(o, d)} />)}
        </section>

        {drafts.length > 0 && (<section className="space-y-2">
          <SectionTitle icon="scroll">Nacrti ({drafts.length})</SectionTitle>
          <p className="text-xs text-muted font-medium">Nacrti se NE izvršavaju. Predaj ih prije isteka roka.</p>
          {drafts.map((o) => <OrderRow key={o.id} o={o} i={0} n={1} draft editable={editable} busy={busy} onEdit={() => o.type !== 'attack' && setComposer({ type: o.type, order: o })} onRemove={() => post({ action: 'remove', orderId: o.id }, 'Nacrt uklonjen.')} onSubmit={() => post({ action: 'submit', orderId: o.id }, 'Naredba predana.')} />)}
        </section>)}

        <section className="space-y-2">
          <SectionTitle icon="target" right={editable && conds.length < v.config.campaign.maxConditionalOrdersPerRound ? <button className="chip" onClick={() => setCond(true)} data-testid="new-conditional">+ Uvjetna</button> : <span className="chip">{conds.length}/{v.config.campaign.maxConditionalOrdersPerRound}</span>}>Uvjetne naredbe</SectionTitle>
          {conds.length === 0 && <div className="card-flat text-sm text-muted font-medium">AKO se dogodi okidač, TADA se automatski izvršava radnja. Npr. „AKO mi napadnu glavni grad, TADA premjesti rezerve”.</div>}
          {conds.map((c) => (
            <div key={c.id} className="card-flat flex items-center gap-3" data-testid="cond-row">
              <Icon name="target" size={22} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0 text-sm"><div className="font-semibold">AKO: {TRIGGER_LABEL[c.trigger.type]}{c.trigger.territoryId ? ` (${v.territories[c.trigger.territoryId]?.name})` : ''}{c.trigger.playerId ? ` (${v.players[c.trigger.playerId]?.name})` : ''}</div><div className="text-muted font-medium">TADA: {ACTION_LABEL[c.action.type]} · prioritet {c.priority} · do runde {c.expiresRound}</div></div>
              {editable && <button className="h-10 w-10 grid place-items-center rounded-xl text-bad active:bg-red-50" aria-label="Ukloni" onClick={async () => { try { await g.act(`/api/campaigns/${g.id}/conditional`, { action: 'remove', id: c.id }); } catch { /* toast */ } }}><Icon name="close" /></button>}
            </div>))}
        </section>

        {lastResolved.length > 0 && (
          <section className="space-y-2"><SectionTitle icon="report">Ishod prošle runde</SectionTitle>
            {lastResolved.map((o) => <div key={o.id} className={`rounded-xl border p-2.5 text-sm font-medium ${o.result!.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>{describeOrder(v, o).title}: {o.result!.summary}</div>)}
          </section>)}

        {planning && (
          <section className="card space-y-2 sticky bottom-2">
            <div className="flex items-center gap-3"><Icon name={v.me.ready ? 'lock' : 'unlock'} size={26} className="text-primary" /><div className="flex-1 text-sm font-medium">{v.me.ready ? 'Konačni popis je zaključan. Možeš ga otključati do isteka roka.' : 'Označi popis kao konačan kad završiš. Nacrti se ne izvršavaju.'}</div></div>
            <button className={`btn w-full ${v.me.ready ? 'btn-ghost' : 'btn-yellow'}`} disabled={busy} onClick={() => post({ action: 'ready', ready: !v.me.ready }, v.me.ready ? 'Naredbe otključane.' : 'Naredbe zaključane — čekaj razrješenje.')} data-testid="lock-orders"><Icon name={v.me.ready ? 'unlock' : 'lock'} size={18} />{v.me.ready ? 'Otključaj naredbe' : 'Zaključaj konačni popis'}</button>
          </section>)}
      </div>

      <Sheet open={!!composer} onClose={() => setComposer(null)} title="Naredba" tall>
        {composer && <><h2 className="text-2xl  mb-1 flex items-center gap-2"><Icon name={ORDER_LABELS[composer.type].icon} />{ORDER_LABELS[composer.type].name}</h2><p className="text-sm text-muted mb-3">{ORDER_LABELS[composer.type].desc}</p>
          <OrderComposer key={composer.order?.id ?? composer.type} type={composer.type} editingId={composer.order?.id} initial={composer.order ? ({ type: composer.order.type, params: composer.order.params } as OrderInput) : undefined} onDone={() => setComposer(null)} /></>}
      </Sheet>
      <Sheet open={cond} onClose={() => setCond(false)} title="Uvjetna naredba" tall>
        <h2 className="text-2xl  mb-3">Nova uvjetna naredba</h2>
        {cond && <ConditionalComposer onDone={() => setCond(false)} />}
      </Sheet>
    </div>
  );
}

function OrderRow({ o, i, n, draft, editable, busy, onEdit, onRemove, onSubmit, onMove }: { o: Order; i: number; n: number; draft?: boolean; editable: boolean; busy: boolean; onEdit: () => void; onRemove: () => void; onSubmit?: () => void; onMove?: (d: -1 | 1) => void }) {
  const g = useGame();
  const v = g.view!;
  const d = describeOrder(v, o);
  return (
    <div className={`rounded-2xl border p-3 flex items-start gap-3 ${draft ? 'border-dashed border-line bg-white' : 'border-primary/40 bg-primary-100/50'}`} data-testid="order-row">
      {!draft && onMove && editable && <div className="flex flex-col -my-1"><button className="h-7 w-7 grid place-items-center rounded-lg text-primary disabled:opacity-25" disabled={i === 0 || busy} onClick={() => onMove(-1)} aria-label="Gore"><Icon name="down" size={16} className="rotate-180" /></button><span className="text-center text-xs font-semibold text-muted">{i + 1}</span><button className="h-7 w-7 grid place-items-center rounded-lg text-primary disabled:opacity-25" disabled={i === n - 1 || busy} onClick={() => onMove(1)} aria-label="Dolje"><Icon name="down" size={16} /></button></div>}
      <div className="h-11 w-11 shrink-0 rounded-xl bg-white border border-line grid place-items-center text-primary"><Icon name={ORDER_LABELS[o.type].icon} size={24} /></div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold leading-tight">{d.title}</div>
        <div className="text-sm text-muted font-medium">{d.detail}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2"><span className="chip chip-yellow">{o.cpCost} ZB</span>{draft ? <span className="chip">Nacrt</span> : o.status === 'locked' ? <span className="chip chip-warn">Zaključano</span> : <span className="chip chip-good">Predano</span>}</div>
        {editable && <div className="mt-2 flex flex-wrap gap-2">
          {draft && onSubmit && <button className="btn btn-yellow btn-sm" disabled={busy} onClick={onSubmit} data-testid="submit-draft">Predaj</button>}
          {o.type !== 'attack' && <button className="btn btn-ghost btn-sm" onClick={onEdit} data-testid="edit-order"><Icon name="settings" size={16} />Uredi</button>}
          <button className="btn btn-ghost btn-sm !text-bad" disabled={busy} onClick={onRemove} data-testid="remove-order"><Icon name="close" size={16} />Ukloni</button>
        </div>}
      </div>
    </div>
  );
}
void CostLine;
