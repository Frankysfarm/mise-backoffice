'use client';

/**
 * Phase 500 — Kochstart-Cockpit
 *
 * Priorisierte Echtzeit-Übersicht aller Bestellungen mit:
 * - Ampel-Farbkodierung (grün / gelb / rot) nach verbleibender Zeit
 * - Sekundengenauer Countdown bis zum Fertigstellungsziel
 * - Smart-Empfehlung: "Jetzt starten", "In X Min", "Überfällig"
 * - One-Tap Kochstart-Aktion
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock, Flame, Timer, Zap } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name?: string | null;
  items?: { name: string; menge: number }[];
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: Timing[];
  onStartCooking?: (orderId: string) => void;
}

type Band = 'urgent' | 'warning' | 'ok' | 'done' | 'waiting';

interface Row {
  order: Order;
  timing?: Timing;
  band: Band;
  remainSec: number | null;
  recommendation: string;
  urgencyPriority: number;
}

function classifyBand(order: Order, timing: Timing | undefined, nowMs: number): Omit<Row, 'order' | 'timing'> {
  const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;

  if (order.status === 'fertig' || order.status === 'abgeholt') {
    return { band: 'done', remainSec: null, recommendation: 'Fertig', urgencyPriority: 9000 };
  }

  if (timing?.ready_target) {
    const remainSec = Math.floor((new Date(timing.ready_target).getTime() - nowMs) / 1000);
    if (remainSec < -120) return { band: 'urgent', remainSec, recommendation: 'Überfällig!', urgencyPriority: 0 };
    if (remainSec < 0)   return { band: 'urgent', remainSec, recommendation: `${Math.abs(Math.floor(remainSec / 60))} Min über Zeit`, urgencyPriority: 1 };
    if (remainSec < 180) return { band: 'urgent', remainSec, recommendation: `In ${Math.ceil(remainSec / 60)} Min fertig`, urgencyPriority: 2 };
    if (remainSec < 420) return { band: 'warning', remainSec, recommendation: `In ${Math.ceil(remainSec / 60)} Min fertig`, urgencyPriority: remainSec };
    return { band: 'ok', remainSec, recommendation: `In ${Math.ceil(remainSec / 60)} Min fertig`, urgencyPriority: remainSec };
  }

  if (timing?.cook_start_at) {
    const cookingSec = Math.floor((nowMs - new Date(timing.cook_start_at).getTime()) / 1000);
    const remainSec = prepMin * 60 - cookingSec;
    if (remainSec < 60)  return { band: 'urgent', remainSec, recommendation: 'Gleich fertig!', urgencyPriority: 10 };
    if (remainSec < 240) return { band: 'warning', remainSec, recommendation: `~${Math.ceil(remainSec / 60)} Min`, urgencyPriority: remainSec };
    return { band: 'ok', remainSec, recommendation: `~${Math.ceil(remainSec / 60)} Min`, urgencyPriority: remainSec };
  }

  if (order.status === 'in_zubereitung') {
    const startedMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : nowMs;
    const elapsed = Math.floor((nowMs - startedMs) / 60_000);
    const remain = Math.max(0, prepMin - elapsed);
    return { band: remain <= 3 ? 'urgent' : remain <= 7 ? 'warning' : 'ok', remainSec: remain * 60, recommendation: `~${remain} Min`, urgencyPriority: remain * 60 };
  }

  // Noch nicht gestartet
  const waitSec = order.bestellt_am ? Math.floor((nowMs - new Date(order.bestellt_am).getTime()) / 1000) : 0;
  if (waitSec > prepMin * 60) return { band: 'urgent', remainSec: null, recommendation: 'Jetzt starten!', urgencyPriority: 5 };
  return { band: 'waiting', remainSec: null, recommendation: 'Bereit zum Starten', urgencyPriority: 5000 + waitSec };
}

function CountdownDigits({ sec }: { sec: number }) {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return (
    <span className="tabular-nums font-mono font-black">
      {sec < 0 ? '-' : ''}{m}:{String(s).padStart(2, '0')}
    </span>
  );
}

const BAND_STYLES: Record<Band, { card: string; badge: string; icon: string; label: string }> = {
  urgent:  { card: 'border-red-300 bg-red-50',   badge: 'bg-red-500 text-white',     icon: 'text-red-500 animate-pulse', label: 'Dringend' },
  warning: { card: 'border-amber-300 bg-amber-50', badge: 'bg-amber-400 text-white', icon: 'text-amber-500',             label: 'Bald fertig' },
  ok:      { card: 'border-matcha-200 bg-matcha-50/60', badge: 'bg-matcha-500 text-white', icon: 'text-matcha-500',      label: 'In Arbeit' },
  done:    { card: 'border-stone-200 bg-stone-50 opacity-60', badge: 'bg-stone-400 text-white', icon: 'text-stone-400', label: 'Fertig' },
  waiting: { card: 'border-blue-200 bg-blue-50/60', badge: 'bg-blue-500 text-white', icon: 'text-blue-500',             label: 'Warten' },
};

export function KitchenPhase500KochstartCockpit({ orders, timings, onStartCooking }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const timingMap = useMemo(() => {
    const m = new Map<string, Timing>();
    for (const t of timings) m.set(t.order_id, t);
    return m;
  }, [timings]);

  const rows: Row[] = useMemo(() => {
    const active = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));
    return active.map(order => {
      const timing = timingMap.get(order.id);
      const classified = classifyBand(order, timing, nowMs);
      return { order, timing, ...classified };
    }).sort((a, b) => a.urgencyPriority - b.urgencyPriority);
  }, [orders, timingMap, nowMs]);

  const urgent  = rows.filter(r => r.band === 'urgent').length;
  const warning = rows.filter(r => r.band === 'warning').length;
  const active  = rows.filter(r => ['urgent', 'warning', 'ok'].includes(r.band)).length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-stone-500" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-600">Phase 500 · Kochstart-Cockpit</span>
        </div>
        <div className="flex items-center gap-1.5">
          {urgent > 0 && (
            <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
              <AlertCircle className="w-3 h-3" />{urgent} dringend
            </span>
          )}
          {warning > 0 && (
            <span className="flex items-center gap-1 bg-amber-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              <Flame className="w-3 h-3" />{warning} bald
            </span>
          )}
          <span className="text-[10px] font-bold text-stone-400">{active} aktiv</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-3">
        {rows.map(({ order, timing, band, remainSec, recommendation }) => {
          const styles = BAND_STYLES[band];
          const canStart = order.status !== 'in_zubereitung' && band !== 'done' && band !== 'waiting';
          return (
            <div
              key={order.id}
              className={cn('rounded-lg border p-2.5 flex flex-col gap-1.5 relative transition-all', styles.card)}
            >
              {/* Order number */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-stone-700 truncate">{order.bestellnummer}</span>
                <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', styles.badge)}>
                  {styles.label}
                </span>
              </div>

              {/* Countdown */}
              <div className={cn('text-sm leading-none', styles.icon)}>
                {remainSec !== null
                  ? <CountdownDigits sec={remainSec} />
                  : <span className="text-sm font-black">—</span>
                }
              </div>

              {/* Recommendation */}
              <div className="text-[10px] text-stone-600 font-semibold leading-tight">{recommendation}</div>

              {/* Customer */}
              {order.kunde_name && (
                <div className="text-[9px] text-stone-400 truncate">{order.kunde_name}</div>
              )}

              {/* Items preview */}
              {order.items && order.items.length > 0 && (
                <div className="text-[9px] text-stone-500 truncate">
                  {order.items.slice(0, 2).map(i => `${i.menge}× ${i.name}`).join(', ')}
                  {order.items.length > 2 && ` +${order.items.length - 2}`}
                </div>
              )}

              {/* Start-Action */}
              {(band === 'waiting' || (band === 'urgent' && !timing?.cook_start_at)) && onStartCooking && (
                <button
                  onClick={() => onStartCooking(order.id)}
                  className="mt-1 w-full flex items-center justify-center gap-1 rounded-md bg-matcha-600 text-white text-[10px] font-black py-1 hover:bg-matcha-700 transition active:scale-95"
                >
                  <Zap className="w-3 h-3" /> Jetzt kochen
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-stone-100 bg-stone-50/50">
        {(['urgent', 'warning', 'ok', 'waiting', 'done'] as Band[]).map(band => {
          const count = rows.filter(r => r.band === band).length;
          if (count === 0) return null;
          const s = BAND_STYLES[band];
          return (
            <div key={band} className="flex items-center gap-1">
              <span className={cn('w-2 h-2 rounded-full', s.badge.split(' ')[0])} />
              <span className="text-[10px] text-stone-500 font-semibold">{count} {s.label}</span>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-stone-400">
          <Clock className="w-3 h-3" />
          <span className="tabular-nums">{new Date(nowMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
