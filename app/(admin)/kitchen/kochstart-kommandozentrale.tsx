'use client';

/**
 * KochstartKommandozentrale — Unified Smart-Timing Command Center
 *
 * Kombiniert drei Kernfunktionen in einer kompakten Card:
 *  1. Optimaler Kochstart-Zeitpunkt je Bestellung (basierend auf Fahrer-ETA)
 *  2. Echtzeit-Countdown mit Farbkodierung (grün/gelb/orange/rot)
 *  3. Einzel-Aktionen: "Jetzt starten" + "Fertig melden"
 *
 * Props: orders, timings, batches, stops, drivers
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Bike, CheckCircle2, ChefHat, Clock, Flame,
  Play, Timer, TrendingUp, Zap,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────── */

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items?: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status?: { aktueller_batch_id: string | null } | null;
};

type Batch = {
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
};

type UrgencyLevel = 'ok' | 'warn' | 'urgent' | 'overdue';

interface OrderTiming {
  order: Order;
  timing: KitchenTiming | undefined;
  urgency: UrgencyLevel;
  secsLeft: number | null;
  driverEtaSec: number | null;
  driverName: string | null;
  shouldCookNow: boolean;
  optimalCookStartSec: number | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const URGENCY_CONFIG: Record<UrgencyLevel, { ring: string; bg: string; text: string; border: string; dot: string }> = {
  ok:      { ring: 'text-matcha-600', bg: 'bg-matcha-50',   text: 'text-matcha-700', border: 'border-matcha-200',  dot: 'bg-matcha-500' },
  warn:    { ring: 'text-amber-600',  bg: 'bg-amber-50',    text: 'text-amber-700',  border: 'border-amber-300',   dot: 'bg-amber-500' },
  urgent:  { ring: 'text-orange-600', bg: 'bg-orange-50',   text: 'text-orange-700', border: 'border-orange-400',  dot: 'bg-orange-500 animate-pulse' },
  overdue: { ring: 'text-red-600',    bg: 'bg-red-50',      text: 'text-red-700',    border: 'border-red-500',     dot: 'bg-red-500 animate-ping' },
};

const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  ok: 'Im Plan', warn: 'Aufpassen', urgent: 'Dringend!', overdue: 'ÜBERFÄLLIG',
};

function getUrgency(secsLeft: number | null): UrgencyLevel {
  if (secsLeft === null) return 'ok';
  if (secsLeft <= 0) return 'overdue';
  if (secsLeft <= 120) return 'urgent';
  if (secsLeft <= 300) return 'warn';
  return 'ok';
}

function fmtCountdown(secs: number | null): string {
  if (secs === null) return '–:––';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${secs < 0 ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
}

/* ── SVG Countdown Ring ──────────────────────────────────────────────────── */

function CountdownRing({
  secs,
  totalSecs,
  urgency,
  size = 52,
}: {
  secs: number | null;
  totalSecs: number;
  urgency: UrgencyLevel;
  size?: number;
}) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = (secs !== null && totalSecs > 0)
    ? Math.max(0, Math.min(1, secs / totalSecs)) : 0;
  const offset = circ * (1 - pct);
  const stroke = urgency === 'overdue' ? '#ef4444' : urgency === 'urgent' ? '#f97316' : urgency === 'warn' ? '#f59e0b' : '#22c55e';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={stroke} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
      />
    </svg>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export function KochstartKommandozentrale({
  orders,
  timings,
  batches,
  stops,
  drivers,
  onStartCooking,
  onMarkReady,
}: {
  orders: Order[];
  timings: KitchenTiming[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
  onStartCooking?: (orderId: string) => void;
  onMarkReady?: (orderId: string) => void;
}) {
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  // Tick every second for countdown updates
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  // Build timing map
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  // Build batch→driver map
  const batchDriverMap = new Map<string, { name: string; etaSec: number | null }>();
  for (const b of batches) {
    const driver = drivers.find((d) => d.id === b.driver_id);
    const name = driver ? `${driver.vorname} ${driver.nachname.charAt(0)}.` : 'Fahrer';
    let etaSec: number | null = null;
    if (b.started_at && b.total_eta_min != null) {
      etaSec = Math.floor((new Date(b.started_at).getTime() + b.total_eta_min * 60_000 - now) / 1000);
    }
    batchDriverMap.set(b.id, { name, etaSec });
  }

  // Build order→batch ETA map via stops
  const orderBatchMap = new Map<string, string>();
  for (const s of stops) orderBatchMap.set(s.order_id, s.batch_id);

  // Compute order timings
  const activeOrders = orders.filter((o) =>
    ['bestätigt', 'in_zubereitung'].includes(o.status) && o.typ === 'lieferung',
  );

  const rows: OrderTiming[] = activeOrders.map((order) => {
    const timing = timingMap.get(order.id);
    const prepSec = (timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20) * 60;

    // Seconds left until ready
    let secsLeft: number | null = null;
    if (timing?.ready_target) {
      secsLeft = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
    } else if (timing?.cook_start_at) {
      const endMs = new Date(timing.cook_start_at).getTime() + prepSec * 1000;
      secsLeft = Math.floor((endMs - now) / 1000);
    } else if (order.status === 'in_zubereitung' && order.bestellt_am) {
      const startMs = new Date(order.bestellt_am).getTime();
      secsLeft = Math.floor(startMs / 1000 + prepSec - now / 1000);
    }

    // Driver ETA
    const batchId = orderBatchMap.get(order.id);
    const batchInfo = batchId ? batchDriverMap.get(batchId) : null;
    const driverEtaSec = batchInfo?.etaSec ?? null;
    const driverName = batchInfo?.name ?? null;

    // Optimal cook start: driver ETA - prep time
    let optimalCookStartSec: number | null = null;
    if (driverEtaSec !== null) {
      optimalCookStartSec = driverEtaSec - prepSec;
    }

    // Should cook now if driver arrives in <prepSec, or already in_zubereitung and urgent
    const shouldCookNow = order.status === 'bestätigt' && (
      (optimalCookStartSec !== null && optimalCookStartSec <= 60) ||
      (driverEtaSec !== null && driverEtaSec <= prepSec + 120)
    );

    const urgency = getUrgency(secsLeft);

    return { order, timing, urgency, secsLeft, driverEtaSec, driverName, shouldCookNow, optimalCookStartSec };
  });

  // Sort: overdue → urgent → warn → ok → shouldCookNow at top of pending
  rows.sort((a, b) => {
    const rank = { overdue: 0, urgent: 1, warn: 2, ok: 3 };
    if (a.shouldCookNow && !b.shouldCookNow) return -1;
    if (!a.shouldCookNow && b.shouldCookNow) return 1;
    return rank[a.urgency] - rank[b.urgency];
  });

  const overdueCount = rows.filter((r) => r.urgency === 'overdue').length;
  const urgentCount = rows.filter((r) => r.urgency === 'urgent').length;
  const cookNowCount = rows.filter((r) => r.shouldCookNow).length;
  const cookingCount = rows.filter((r) => r.order.status === 'in_zubereitung').length;
  const pendingCount = rows.filter((r) => r.order.status === 'bestätigt').length;

  // Kitchen health score
  const healthScore = rows.length === 0 ? 100 : Math.max(0, Math.round(
    rows.reduce((s, r) => {
      const pts = r.urgency === 'ok' ? 100 : r.urgency === 'warn' ? 65 : r.urgency === 'urgent' ? 30 : 0;
      return s + pts;
    }, 0) / rows.length,
  ));
  const healthColor = healthScore >= 75 ? 'text-matcha-600' : healthScore >= 50 ? 'text-amber-600' : 'text-red-600';

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 shrink-0">
          <ChefHat className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-black">Kochstart-Kommandozentrale</div>
          <div className="text-[10px] text-muted-foreground">
            {cookingCount} kochend · {pendingCount} wartend · Gesundheit{' '}
            <span className={healthColor}>{healthScore}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 text-[9px] font-black px-2 py-0.5 animate-pulse">
              ⚠ {overdueCount} überfällig
            </span>
          )}
          {urgentCount > 0 && (
            <span className="rounded-full bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5">
              ⚡ {urgentCount} dringend
            </span>
          )}
          {cookNowCount > 0 && (
            <span className="rounded-full bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5">
              🚀 {cookNowCount} jetzt starten
            </span>
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t">
          {/* Summary bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/20 border-b text-[10px] font-bold">
            {[
              { color: 'bg-matcha-500', label: 'Im Plan', count: rows.filter(r => r.urgency === 'ok').length },
              { color: 'bg-amber-500', label: 'Aufpassen', count: rows.filter(r => r.urgency === 'warn').length },
              { color: 'bg-orange-500', label: 'Dringend', count: urgentCount },
              { color: 'bg-red-500', label: 'Überfällig', count: overdueCount },
            ].map((item) => item.count > 0 && (
              <span key={item.label} className="flex items-center gap-1 text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full shrink-0', item.color)} />
                {item.count}× {item.label}
              </span>
            ))}
            <div className="ml-auto h-1.5 w-24 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  healthScore >= 75 ? 'bg-matcha-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500',
                )}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>

          {/* Order rows */}
          <div className="divide-y">
            {rows.map(({ order, timing, urgency, secsLeft, driverEtaSec, driverName, shouldCookNow, optimalCookStartSec }) => {
              const cfg = URGENCY_CONFIG[urgency];
              const prepSec = (timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20) * 60;
              const isCooking = order.status === 'in_zubereitung';

              return (
                <div
                  key={order.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    cfg.bg,
                    shouldCookNow && !isCooking ? 'ring-1 ring-inset ring-blue-400' : '',
                  )}
                >
                  {/* Countdown ring */}
                  <div className="relative shrink-0">
                    <CountdownRing secs={secsLeft} totalSecs={prepSec} urgency={urgency} size={52} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={cn('text-[9px] font-black tabular-nums leading-none', cfg.ring)}>
                        {fmtCountdown(secsLeft)}
                      </span>
                    </div>
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-flex items-center gap-0.5 h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                      <span className="text-xs font-black truncate">{order.bestellnummer}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{order.kunde_name}</span>
                      <span className={cn(
                        'text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0',
                        isCooking ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700',
                      )}>
                        {isCooking ? '🔥 kochend' : '⏳ wartend'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className={cn('text-[9px] font-bold', cfg.text)}>
                        {URGENCY_LABEL[urgency]}
                      </span>
                      {driverEtaSec !== null && (
                        <span className="flex items-center gap-1 text-[9px] text-blue-600 font-bold">
                          <Bike className="h-2.5 w-2.5" />
                          {driverName && `${driverName} · `}
                          Fahrer in {Math.max(0, Math.ceil(driverEtaSec / 60))} Min
                        </span>
                      )}
                      {shouldCookNow && !isCooking && (
                        <span className="text-[9px] font-black text-blue-700 bg-blue-100 rounded-full px-1.5 py-0.5 animate-pulse">
                          🚀 JETZT STARTEN
                        </span>
                      )}
                      {optimalCookStartSec !== null && optimalCookStartSec > 60 && !isCooking && (
                        <span className="text-[9px] text-muted-foreground">
                          Start in ~{Math.ceil(optimalCookStartSec / 60)} Min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!isCooking && onStartCooking && (
                      <button
                        onClick={() => onStartCooking(order.id)}
                        className={cn(
                          'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black transition',
                          shouldCookNow
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                        )}
                      >
                        <Play className="h-2.5 w-2.5" />
                        Starten
                      </button>
                    )}
                    {isCooking && onMarkReady && (
                      <button
                        onClick={() => onMarkReady(order.id)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black bg-matcha-100 text-matcha-700 hover:bg-matcha-200 transition"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Fertig
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer tip */}
          {cookNowCount > 0 && (
            <div className="px-4 py-2.5 bg-blue-50 border-t flex items-center gap-2 text-xs font-bold text-blue-700">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              {cookNowCount} Bestellung{cookNowCount !== 1 ? 'en' : ''} sollte{cookNowCount !== 1 ? 'n' : ''} sofort gestartet werden — Fahrer ist unterwegs!
            </div>
          )}
          {overdueCount === 0 && cookNowCount === 0 && urgentCount === 0 && (
            <div className="px-4 py-2.5 bg-matcha-50 border-t flex items-center gap-2 text-xs text-matcha-700">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              Küche läuft optimal — alle Bestellungen im Plan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
