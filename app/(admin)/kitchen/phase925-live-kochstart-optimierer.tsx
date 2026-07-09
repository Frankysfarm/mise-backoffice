'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, TrendingUp, Zap } from 'lucide-react';

/**
 * Phase 925 — Live-Kochstart-Optimierer (Kitchen)
 *
 * Zeigt alle aktiven Bestellungen mit Smart-Timing-Ampel:
 * - Grün: Kochstart kann noch warten
 * - Gelb: Jetzt starten empfohlen
 * - Rot: Sofortiger Kochstart erforderlich
 *
 * Berechnet optimalen Kochstart basierend auf geschätzter Zubereitungszeit
 * und ETA des zugewiesenen Fahrers.
 */

const PREP_DEFAULT_MIN = 15;

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  fahrer_eta_min?: number | null;
  items?: { name?: string; quantity?: number }[];
  artikel?: { name?: string; menge?: number }[];
}

interface Props {
  orders: Order[];
}

type TimingStatus = 'green' | 'yellow' | 'red' | 'done';

function calcTimingStatus(order: Order, nowMs: number): {
  status: TimingStatus;
  waitMin: number;
  prepMin: number;
  countdown: number;
} {
  const prepMin = order.geschaetzte_zubereitung_min ?? PREP_DEFAULT_MIN;
  const etaMin = order.fahrer_eta_min ?? 30;
  const orderedMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : nowMs;
  const elapsedMin = (nowMs - orderedMs) / 60000;

  // Idealer Kochstart: so dass fertig wenn Fahrer kommt
  // Wartezeit = ETA - PrepMin - aktuelle Wartezeit
  const idealWaitMin = Math.max(0, etaMin - prepMin - elapsedMin);
  const countdown = Math.round(idealWaitMin);

  let status: TimingStatus;
  if (['fertig', 'abgeholt', 'unterwegs'].includes(order.status)) {
    status = 'done';
  } else if (countdown <= 0) {
    status = 'red';
  } else if (countdown <= 3) {
    status = 'yellow';
  } else {
    status = 'green';
  }

  return { status, waitMin: idealWaitMin, prepMin, countdown };
}

const STATUS_STYLES: Record<TimingStatus, {
  bg: string; border: string; badge: string; label: string; icon: string;
}> = {
  green:  { bg: 'bg-matcha-50',  border: 'border-matcha-200', badge: 'bg-matcha-500 text-white',  label: 'Warten',   icon: 'text-matcha-600' },
  yellow: { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-500 text-white',   label: 'Bald',     icon: 'text-amber-600'  },
  red:    { bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-500 text-white',     label: 'JETZT!',   icon: 'text-red-600'    },
  done:   { bg: 'bg-stone-50',   border: 'border-stone-200',  badge: 'bg-stone-400 text-white',   label: 'Fertig',   icon: 'text-stone-400'  },
};

export function KitchenPhase925LiveKochstartOptimierer({ orders }: Props) {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const active = orders.filter((o) =>
    ['neu', 'angenommen', 'in_zubereitung', 'zubereitung'].includes(o.status)
  );

  const rows = useMemo(() => {
    const now = Date.now();
    return active
      .map((o) => ({ order: o, ...calcTimingStatus(o, now) }))
      .sort((a, b) => {
        const priority = { red: 0, yellow: 1, green: 2, done: 3 };
        return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
      });
  }, [active]);

  const redCount = rows.filter((r) => r.status === 'red').length;
  const yellowCount = rows.filter((r) => r.status === 'yellow').length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Live-Kochstart-Optimierer
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {rows.length} aktiv
          </span>
          {redCount > 0 && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
              {redCount} JETZT
            </span>
          )}
          {yellowCount > 0 && !redCount && (
            <span className="rounded-full bg-amber-400 text-white px-2 py-0.5 text-[10px] font-bold">
              {yellowCount} bald
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-2">
          {/* Summary-Row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Sofort kochen', count: redCount, color: 'bg-red-100 text-red-700 border-red-200' },
              { label: 'Bald starten', count: yellowCount, color: 'bg-amber-100 text-amber-700 border-amber-200' },
              { label: 'Kann warten', count: rows.filter((r) => r.status === 'green').length, color: 'bg-matcha-100 text-matcha-700 border-matcha-200' },
            ].map((s) => (
              <div key={s.label} className={cn('rounded-xl border text-center py-2 px-1', s.color)}>
                <div className="text-lg font-black tabular-nums">{s.count}</div>
                <div className="text-[9px] font-semibold leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Order rows */}
          <div className="space-y-1.5">
            {rows.map(({ order, status, countdown, prepMin }) => {
              const s = STATUS_STYLES[status];
              const items = order.items ?? order.artikel ?? [];
              return (
                <div
                  key={order.id}
                  className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', s.bg, s.border)}
                >
                  {/* Status badge */}
                  <div className={cn('shrink-0 rounded-lg px-2 py-1 text-[10px] font-black min-w-[52px] text-center', s.badge)}>
                    {status === 'green' && countdown > 0 ? `${countdown}m` : s.label}
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800 tabular-nums">
                        #{order.bestellnummer ?? order.id.slice(0, 6)}
                      </span>
                      {items.length > 0 && (
                        <span className="text-[10px] text-stone-500 truncate">
                          {items.length} Artikel
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-stone-400">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {prepMin} Min Zubereitung
                      </span>
                      {status === 'green' && countdown > 0 && (
                        <span className="flex items-center gap-0.5 text-matcha-500">
                          <TrendingUp className="h-2.5 w-2.5" />
                          Start in {countdown} Min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Icon */}
                  {status === 'red' && (
                    <Flame className={cn('h-5 w-5 shrink-0 animate-pulse', s.icon)} />
                  )}
                  {status === 'yellow' && (
                    <Zap className={cn('h-4 w-4 shrink-0', s.icon)} />
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-muted-foreground text-right pt-1">
            Aktualisiert alle 5 Sek. · ETA-Schätzung basiert auf ø Fahrerzeit
          </p>
        </div>
      )}
    </div>
  );
}
