'use client';

import { useEffect, useState } from 'react';
import { Timer, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  order_id: string;
  ready_target: string | null;
  cook_start_at: string | null;
  prep_min: number | null;
  status: string;
};

type BatchItem = {
  id: string;
  driver_id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

type SyncRow = {
  orderId: string;
  nr: string;
  status: string;
  cookReadyMs: number | null;
  driverEtaMs: number | null;
  gapMin: number | null;
  urgency: 'perfect' | 'short-wait' | 'long-wait' | 'early-driver' | 'unknown';
};

const ACTIVE_STATUSES = new Set(['bestätigt', 'in_zubereitung', 'fertig']);
const ACTIVE_BATCH_STATUSES = new Set(['pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route', 'pending_acceptance']);

export function KitchenFahrerKochSyncPanel({
  orders,
  timings,
  batches,
  stops,
}: {
  orders: Order[];
  timings: KitchenTiming[];
  batches: BatchItem[];
  stops: Stop[];
}) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  // Build order → batch mapping via stops
  const orderToBatch = new Map<string, BatchItem>();
  for (const stop of stops) {
    if (stop.geliefert_am) continue;
    const batch = batches.find((b) => b.id === stop.batch_id && ACTIVE_BATCH_STATUSES.has(b.status));
    if (batch) orderToBatch.set(stop.order_id, batch);
  }

  const rows: SyncRow[] = orders
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .map((o): SyncRow => {
      const timing = timings.find((t) => t.order_id === o.id);
      const batch = orderToBatch.get(o.id);

      let cookReadyMs: number | null = null;
      if (timing?.ready_target) {
        cookReadyMs = new Date(timing.ready_target).getTime();
      } else if (o.bestellt_am && o.geschaetzte_zubereitung_min) {
        cookReadyMs = new Date(o.bestellt_am).getTime() + o.geschaetzte_zubereitung_min * 60_000;
      }

      let driverEtaMs: number | null = null;
      if (batch?.started_at && batch.total_eta_min != null) {
        driverEtaMs = new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000;
      }

      let gapMin: number | null = null;
      let urgency: SyncRow['urgency'] = 'unknown';

      if (cookReadyMs !== null && driverEtaMs !== null) {
        gapMin = Math.round((cookReadyMs - driverEtaMs) / 60_000);
        if (gapMin > 10) urgency = 'long-wait';
        else if (gapMin > 3) urgency = 'short-wait';
        else if (gapMin >= -3) urgency = 'perfect';
        else urgency = 'early-driver';
      } else if (cookReadyMs !== null) {
        const remainMs = cookReadyMs - now;
        gapMin = Math.round(remainMs / 60_000);
        urgency = 'unknown';
      }

      return {
        orderId: o.id,
        nr: o.bestellnummer.replace(/^FF-/, ''),
        status: o.status,
        cookReadyMs,
        driverEtaMs,
        gapMin,
        urgency,
      };
    })
    .filter((r) => r.cookReadyMs !== null || r.driverEtaMs !== null);

  rows.sort((a, b) => {
    const order: SyncRow['urgency'][] = ['long-wait', 'short-wait', 'unknown', 'perfect', 'early-driver'];
    return order.indexOf(a.urgency) - order.indexOf(b.urgency);
  });

  if (rows.length === 0) return null;

  const urgencyConfig: Record<SyncRow['urgency'], { label: string; bg: string; text: string; icon: React.ElementType }> = {
    'long-wait': { label: 'Lange Wartezeit', bg: 'bg-red-500/20', text: 'text-red-300', icon: AlertTriangle },
    'short-wait': { label: 'Kurze Wartezeit', bg: 'bg-amber-500/20', text: 'text-amber-300', icon: Clock },
    'perfect': { label: 'Perfekte Sync', bg: 'bg-matcha-600/20', text: 'text-matcha-400', icon: CheckCircle2 },
    'early-driver': { label: 'Fahrer zu früh', bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Zap },
    'unknown': { label: 'Kein Fahrer', bg: 'bg-white/5', text: 'text-matcha-500', icon: Timer },
  };

  const statusEmoji: Record<string, string> = {
    neu: '📥', bestätigt: '✓', in_zubereitung: '🔥', fertig: '✅', unterwegs: '🚴',
  };

  function fmtTime(ms: number | null): string {
    if (ms === null) return '—';
    const d = new Date(ms);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="rounded-xl border border-matcha-700/50 bg-matcha-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-matcha-800/30 transition"
      >
        <Timer className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">
          Fahrer-Koch-Sync · {rows.length} Bestellung{rows.length !== 1 ? 'en' : ''}
        </span>
        <span className="ml-auto">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-matcha-500" /> : <ChevronDown className="h-3.5 w-3.5 text-matcha-500" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-matcha-800/60 divide-y divide-matcha-800/40">
          {rows.map((row) => {
            const cfg = urgencyConfig[row.urgency];
            const Icon = cfg.icon;
            return (
              <div key={row.orderId} className={cn('flex items-center gap-3 px-3 py-2', cfg.bg)}>
                <span className="text-base shrink-0">{statusEmoji[row.status] ?? '?'}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white tabular-nums">#{row.nr}</span>
                    <Icon className={cn('h-3 w-3 shrink-0', cfg.text)} />
                    <span className={cn('text-[10px] font-bold', cfg.text)}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-matcha-500 tabular-nums">
                    {row.cookReadyMs !== null && (
                      <span>Fertig: {fmtTime(row.cookReadyMs)}</span>
                    )}
                    {row.driverEtaMs !== null && (
                      <span>Fahrer: {fmtTime(row.driverEtaMs)}</span>
                    )}
                  </div>
                </div>

                {row.gapMin !== null && (
                  <div className="shrink-0 text-right">
                    <div className={cn('font-mono text-sm font-black tabular-nums', cfg.text)}>
                      {row.gapMin > 0 ? `+${row.gapMin}` : row.gapMin}m
                    </div>
                    <div className="text-[8px] text-matcha-600">Gap</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
