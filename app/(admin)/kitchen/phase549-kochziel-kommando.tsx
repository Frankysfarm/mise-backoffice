'use client';

/**
 * Phase 549 — Kochziel-Kommando
 *
 * Ultra-fokussierter Command-Strip für die 3 dringendsten aktiven Bestellungen:
 * - Sekundengenauer Countdown bis Fertig-Ziel (rot/amber/grün)
 * - Ein-Tap: Kochen starten oder Fertig markieren
 * - Wird nur angezeigt, wenn ≥1 Bestellung aktiv in Zubereitung
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, CheckCircle2, Clock, Zap } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name?: string | null;
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
  onStartCooking?: (orderId: string) => Promise<void>;
  onMarkReady?: (orderId: string) => Promise<void>;
}

type Band = 'overdue' | 'critical' | 'ok' | 'waiting';

function computeBand(order: Order, timing: Timing | undefined, nowMs: number): { band: Band; remainSec: number | null; label: string } {
  if (order.status === 'fertig' || order.status === 'abgeholt') return { band: 'ok', remainSec: null, label: 'Fertig' };

  if (timing?.ready_target) {
    const remain = Math.floor((new Date(timing.ready_target).getTime() - nowMs) / 1000);
    if (remain < 0) return { band: 'overdue', remainSec: remain, label: `${Math.abs(remain)}s überfällig` };
    if (remain < 180) return { band: 'critical', remainSec: remain, label: `${Math.floor(remain / 60)}m ${remain % 60}s` };
    return { band: 'ok', remainSec: remain, label: `${Math.floor(remain / 60)}m ${remain % 60}s` };
  }

  if (order.status === 'neu' || order.status === 'bestätigt') {
    return { band: 'waiting', remainSec: null, label: 'Kochstart ausstehend' };
  }

  if (order.bestellt_am) {
    const elapsed = Math.floor((nowMs - new Date(order.bestellt_am).getTime()) / 1000);
    const target = (order.geschaetzte_zubereitung_min ?? 20) * 60;
    const remain = target - elapsed;
    if (remain < 0) return { band: 'overdue', remainSec: remain, label: `${Math.abs(Math.floor(remain / 60))}m überfällig` };
    if (remain < 180) return { band: 'critical', remainSec: remain, label: `${Math.floor(remain / 60)}m ${remain % 60}s` };
    return { band: 'ok', remainSec: remain, label: `${Math.floor(remain / 60)}m ${remain % 60}s` };
  }

  return { band: 'waiting', remainSec: null, label: '—' };
}

const BAND_STYLES: Record<Band, { bg: string; border: string; text: string; pulse: boolean }> = {
  overdue:  { bg: 'bg-red-500',    border: 'border-red-600',    text: 'text-white',        pulse: true  },
  critical: { bg: 'bg-amber-400',  border: 'border-amber-500',  text: 'text-amber-950',    pulse: false },
  ok:       { bg: 'bg-matcha-100', border: 'border-matcha-300', text: 'text-matcha-800',   pulse: false },
  waiting:  { bg: 'bg-muted/60',   border: 'border-border',     text: 'text-muted-foreground', pulse: false },
};

export function KitchenPhase549KochzielKommando({ orders, timings, onStartCooking, onMarkReady }: Props) {
  const [nowMs, setNowMs] = useState(Date.now);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders
    .filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
    .map(o => {
      const timing = timings.find(t => t.order_id === o.id);
      const { band, remainSec, label } = computeBand(o, timing, nowMs);
      return { order: o, timing, band, remainSec, label };
    })
    .sort((a, b) => {
      const priority: Record<Band, number> = { overdue: 0, critical: 1, ok: 2, waiting: 3 };
      if (priority[a.band] !== priority[b.band]) return priority[a.band] - priority[b.band];
      if (a.remainSec !== null && b.remainSec !== null) return a.remainSec - b.remainSec;
      return 0;
    })
    .slice(0, 4);

  if (active.length === 0) return null;

  async function handle(orderId: string, action: 'start' | 'ready') {
    setBusy(p => new Set([...p, orderId]));
    try {
      if (action === 'start') await onStartCooking?.(orderId);
      else await onMarkReady?.(orderId);
    } catch {}
    finally { setBusy(p => { const s = new Set(p); s.delete(orderId); return s; }); }
  }

  const overdueCount = active.filter(r => r.band === 'overdue').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Kochziel-Kommando
        </span>
        {overdueCount > 0 && (
          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
            {overdueCount} überfällig
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y">
        {active.map(({ order, timing, band, label }) => {
          const s = BAND_STYLES[band];
          const isBusy = busy.has(order.id);
          const canStart = band === 'waiting' && (order.status === 'neu' || order.status === 'bestätigt');
          const canReady = order.status === 'in_zubereitung';

          return (
            <div key={order.id} className={cn('flex items-center gap-3 px-4 py-3', s.bg, s.pulse && 'animate-pulse')}>
              {/* Countdown badge */}
              <div className={cn('shrink-0 rounded-lg px-2 py-1 text-center min-w-[72px] border', s.border, 'bg-white/30')}>
                <div className={cn('text-[11px] font-black tabular-nums leading-tight', s.text)}>
                  {label}
                </div>
              </div>

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-bold truncate', s.text)}>
                  #{order.bestellnummer}
                  {order.kunde_name && <span className="font-normal opacity-75"> · {order.kunde_name}</span>}
                </div>
                <div className={cn('text-[10px] opacity-70', s.text)}>
                  {order.status === 'in_zubereitung' ? 'In Zubereitung' : order.status === 'neu' ? 'Neu' : 'Bestätigt'}
                  {timing?.prep_min && ` · ${timing.prep_min} Min geplant`}
                </div>
              </div>

              {/* Action */}
              {!isBusy && canStart && onStartCooking && (
                <button
                  onClick={() => handle(order.id, 'start')}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-matcha-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-matcha-700 transition"
                >
                  <Flame className="h-3 w-3" /> Starten
                </button>
              )}
              {!isBusy && canReady && onMarkReady && (
                <button
                  onClick={() => handle(order.id, 'ready')}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-white/80 border border-current px-3 py-1.5 text-[11px] font-bold hover:bg-white transition"
                >
                  <CheckCircle2 className="h-3 w-3" /> Fertig
                </button>
              )}
              {isBusy && (
                <div className="shrink-0 h-7 w-16 rounded-lg bg-white/30 animate-pulse" />
              )}
              {!canStart && !canReady && (
                <Clock className={cn('shrink-0 h-4 w-4 opacity-40', s.text)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
