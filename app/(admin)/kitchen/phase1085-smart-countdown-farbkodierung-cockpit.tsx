'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Flame, Timer, Zap } from 'lucide-react';

/**
 * Phase 1085 — Smart-Countdown & Farbkodierung Cockpit (Kitchen)
 *
 * Konsolidiert Echtzeit-Countdown + intelligente Farbkodierung für alle
 * aktiven Bestellungen. Erkennt automatisch kritische Zustände und eskaliert
 * die visuelle Warnung stufenweise: Grün → Gelb → Orange → Rot → Kritisch.
 */

interface OrderItem {
  name?: string;
  title?: string;
  menge?: number;
  gang?: string;
}

interface KitchenTiming {
  order_id: string;
  cook_start_at?: string | null;
  ready_target?: string | null;
  prep_min?: number | null;
  status?: string;
}

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  bestellt_am?: string | null;
  created_at?: string | null;
  promised_at?: string | null;
  items?: OrderItem[] | null;
  artikel?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  timings?: KitchenTiming[];
}

type UrgencyLevel = 'kritisch' | 'rot' | 'orange' | 'gelb' | 'gruen' | 'fertig';

interface OrderState {
  id: string;
  bnr: string;
  urgency: UrgencyLevel;
  remainMs: number;
  label: string;
  itemsLabel: string;
  phase: string;
  cookStartMs: number | null;
  prepMin: number | null;
}

const ACTIVE_STATUSES = ['neu', 'bestätigt', 'accepted', 'confirmed', 'eingegangen',
                          'in_zubereitung', 'zubereitung', 'preparing', 'in_preparation'];
const READY_STATUSES  = ['fertig', 'ready', 'done'];

const URGENCY_STYLES: Record<UrgencyLevel, { bg: string; border: string; text: string; badge: string; ring: string }> = {
  kritisch: { bg: 'bg-red-50',    border: 'border-red-500',   text: 'text-red-700',    badge: 'bg-red-600 text-white',    ring: 'ring-2 ring-red-500 ring-offset-1 animate-pulse' },
  rot:      { bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-600',    badge: 'bg-red-500 text-white',    ring: '' },
  orange:   { bg: 'bg-orange-50', border: 'border-orange-400',text: 'text-orange-700', badge: 'bg-orange-500 text-white', ring: '' },
  gelb:     { bg: 'bg-yellow-50', border: 'border-yellow-400',text: 'text-yellow-700', badge: 'bg-yellow-400 text-black', ring: '' },
  gruen:    { bg: 'bg-emerald-50',border: 'border-emerald-400',text: 'text-emerald-700',badge: 'bg-emerald-500 text-white',ring: '' },
  fertig:   { bg: 'bg-slate-50',  border: 'border-slate-300', text: 'text-slate-500',  badge: 'bg-slate-400 text-white', ring: '' },
};

function getDeadlineMs(order: Order, timing?: KitchenTiming): number {
  if (timing?.ready_target) return new Date(timing.ready_target).getTime();
  if (order.promised_at)    return new Date(order.promised_at).getTime();
  const base = order.bestellt_am ?? order.created_at;
  return base ? new Date(base).getTime() + 28 * 60_000 : Date.now() + 15 * 60_000;
}

function classify(remainMs: number, isReady: boolean): UrgencyLevel {
  if (isReady) return 'fertig';
  if (remainMs < -5 * 60_000)  return 'kritisch';
  if (remainMs < 0)             return 'rot';
  if (remainMs < 5  * 60_000)  return 'orange';
  if (remainMs < 12 * 60_000)  return 'gelb';
  return 'gruen';
}

function formatTime(ms: number): string {
  const abs  = Math.abs(ms);
  const mins = Math.floor(abs / 60_000);
  const secs = Math.floor((abs % 60_000) / 1_000);
  const sign = ms < 0 ? '+' : '';
  return `${sign}${mins}:${String(secs).padStart(2, '0')}`;
}

function getItemsLabel(order: Order): string {
  const arr = order.items ?? order.artikel ?? [];
  if (!arr.length) return '—';
  return arr.slice(0, 2).map((i) => `${i.menge ?? 1}× ${i.name ?? i.title ?? '—'}`).join(' · ');
}

function getPhaseLabel(status: string): string {
  const map: Record<string, string> = {
    neu: 'Eingang', bestätigt: 'Bestätigt', accepted: 'Angenommen', confirmed: 'Bestätigt',
    eingegangen: 'Eingang', in_zubereitung: 'In Zubereitung', zubereitung: 'In Zubereitung',
    preparing: 'In Zubereitung', in_preparation: 'In Zubereitung',
    fertig: 'Fertig', ready: 'Fertig', done: 'Fertig',
  };
  return map[status] ?? status;
}

function buildState(order: Order, timing: KitchenTiming | undefined, nowMs: number): OrderState {
  const isReady     = READY_STATUSES.includes(order.status);
  const deadlineMs  = getDeadlineMs(order, timing);
  const remainMs    = isReady ? 0 : deadlineMs - nowMs;
  const urgency     = classify(remainMs, isReady);
  const cookStartMs = timing?.cook_start_at ? new Date(timing.cook_start_at).getTime() : null;
  return {
    id: order.id,
    bnr: order.bestellnummer ?? order.id.slice(-4).toUpperCase(),
    urgency,
    remainMs,
    label: isReady ? 'Fertig' : (remainMs < 0 ? `+${formatTime(remainMs)} über` : `noch ${formatTime(remainMs)}`),
    itemsLabel: getItemsLabel(order),
    phase: getPhaseLabel(order.status),
    cookStartMs,
    prepMin: timing?.prep_min ?? null,
  };
}

/* ── Summary counters ────────────────────────────────────────────── */
function Summary({ states }: { states: OrderState[] }) {
  const counts = {
    kritisch: states.filter((s) => s.urgency === 'kritisch').length,
    rot:      states.filter((s) => s.urgency === 'rot').length,
    orange:   states.filter((s) => s.urgency === 'orange').length,
    gruen:    states.filter((s) => ['gruen', 'gelb'].includes(s.urgency)).length,
    fertig:   states.filter((s) => s.urgency === 'fertig').length,
  };
  return (
    <div className="flex flex-wrap gap-2 text-xs font-semibold">
      {counts.kritisch > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-white animate-pulse">
          <Flame size={11} /> {counts.kritisch} Kritisch
        </span>
      )}
      {counts.rot > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-white">
          <AlertTriangle size={11} /> {counts.rot} Überzogen
        </span>
      )}
      {counts.orange > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-white">
          <Timer size={11} /> {counts.orange} Dringend
        </span>
      )}
      {counts.gruen > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-white">
          <Zap size={11} /> {counts.gruen} Im Plan
        </span>
      )}
      {counts.fertig > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-slate-500 px-2.5 py-0.5 text-white">
          <CheckCircle2 size={11} /> {counts.fertig} Fertig
        </span>
      )}
    </div>
  );
}

/* ── Single order card ───────────────────────────────────────────── */
function OrderCard({ state }: { state: OrderState }) {
  const s = URGENCY_STYLES[state.urgency];
  return (
    <div className={cn('rounded-lg border p-3 transition-all', s.bg, s.border, s.ring)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold shrink-0', s.badge)}>
            #{state.bnr}
          </span>
          <span className="truncate text-xs text-slate-600">{state.itemsLabel}</span>
        </div>
        <div className={cn('text-sm font-mono font-bold shrink-0', s.text)}>
          {state.label}
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span>{state.phase}</span>
        {state.prepMin && <span>{state.prepMin} Min Rüstzeit</span>}
        {state.cookStartMs && (
          <span>Start {new Date(state.cookStartMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
    </div>
  );
}

export function KitchenPhase1085SmartCountdownFarbkodierungCockpit({ orders, timings = [] }: Props) {
  const [now, setNow]   = useState(() => Date.now());
  const [open, setOpen] = useState(true);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setNow(Date.now()), 1_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const relevant = orders.filter(
    (o) => ACTIVE_STATUSES.includes(o.status) || READY_STATUSES.includes(o.status),
  );
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const states = relevant
    .map((o) => buildState(o, timingMap.get(o.id), now))
    .sort((a, b) => {
      const urgencyOrder: UrgencyLevel[] = ['kritisch', 'rot', 'orange', 'gelb', 'gruen', 'fertig'];
      const diff = urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency);
      return diff !== 0 ? diff : a.remainMs - b.remainMs;
    });

  const criticalCount = states.filter((s) => ['kritisch', 'rot'].includes(s.urgency)).length;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden',
      criticalCount > 0 ? 'border-red-400' : 'border-slate-200')}>
      <button
        className={cn('w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold',
          criticalCount > 0 ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-700')}
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <ChefHat size={15} />
          Smart-Countdown Cockpit
          {states.length > 0 && (
            <span className="rounded-full bg-slate-200 px-1.5 text-xs font-normal text-slate-600">
              {states.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-slate-400" />
          <span className="text-xs font-mono text-slate-400">
            {new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-3 bg-white">
          {states.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">Keine aktiven Bestellungen</p>
          ) : (
            <>
              <Summary states={states} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {states.map((s) => <OrderCard key={s.id} state={s} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
