'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Timer, Zap } from 'lucide-react';

/**
 * Phase 1325 — Smart-Kochzeit-Countdown-Ultra (Kitchen)
 *
 * Echtzeit-Countdown für jede Bestellung mit 5-Stufen-Farbkodierung:
 *   🔴 ÜBERFÄLLIG  — Bestellung verspätet, sofortiger Handlungsbedarf
 *   🟠 KRITISCH    — < 3 Min bis Deadline, Koch-Alarm
 *   🟡 DRINGEND    — 3–8 Min, Priorisierung empfohlen
 *   🟢 NORMAL      — 8–20 Min, regulärer Betrieb
 *   💎 OPTIMAL     — > 20 Min, Puffer vorhanden
 */

interface KitchenOrder {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  created_at?: string | null;
  promised_at?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  items?: Array<{ name?: string; quantity?: number; menge?: number }> | null;
  positionen?: Array<{ name?: string; quantity?: number; menge?: number }> | null;
  kunde_name?: string | null;
  typ?: string | null;
}

interface Props {
  locationId?: string | null;
  orders?: KitchenOrder[];
}

type Tier = 'overdone' | 'critical' | 'urgent' | 'normal' | 'optimal';

const TIER_THRESHOLDS = {
  overdone: -Infinity,   // min < 0
  critical: 0,           // 0 ≤ min < 3
  urgent: 3,             // 3 ≤ min < 8
  normal: 8,             // 8 ≤ min < 20
  optimal: 20,           // min ≥ 20
};

const TIER_STYLES: Record<Tier, { bg: string; border: string; text: string; badge: string; label: string; pulse: boolean; barColor: string }> = {
  overdone: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-300 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-500 text-white',
    label: 'ÜBERFÄLLIG',
    pulse: true,
    barColor: 'bg-red-500',
  },
  critical: {
    bg: 'bg-orange-50 dark:bg-orange-950/25',
    border: 'border-orange-300 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-500 text-white',
    label: 'KRITISCH',
    pulse: true,
    barColor: 'bg-orange-400',
  },
  urgent: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-400 text-white',
    label: 'DRINGEND',
    pulse: false,
    barColor: 'bg-amber-400',
  },
  normal: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/15',
    border: 'border-matcha-200 dark:border-matcha-800',
    text: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-500 text-white',
    label: 'NORMAL',
    pulse: false,
    barColor: 'bg-matcha-500',
  },
  optimal: {
    bg: 'bg-blue-50 dark:bg-blue-950/15',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-500 text-white',
    label: 'OPTIMAL',
    pulse: false,
    barColor: 'bg-blue-400',
  },
};

function getTier(remainMin: number): Tier {
  if (remainMin < 0) return 'overdone';
  if (remainMin < 3) return 'critical';
  if (remainMin < 8) return 'urgent';
  if (remainMin < 20) return 'normal';
  return 'optimal';
}

function formatCountdown(totalSec: number): string {
  if (totalSec < 0) {
    const absSec = Math.abs(totalSec);
    const m = Math.floor(absSec / 60);
    const s = absSec % 60;
    return `-${m}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getDeadline(order: KitchenOrder): Date | null {
  if (order.promised_at) return new Date(order.promised_at);
  if (order.created_at && order.geschaetzte_zubereitung_min) {
    const created = new Date(order.created_at);
    return new Date(created.getTime() + order.geschaetzte_zubereitung_min * 60_000);
  }
  return null;
}

function OrderCountdownRow({ order, now }: { order: KitchenOrder; now: Date }) {
  const deadline = getDeadline(order);
  const remainSec = deadline ? Math.round((deadline.getTime() - now.getTime()) / 1000) : null;
  const remainMin = remainSec !== null ? remainSec / 60 : 20;
  const tier = getTier(remainMin);
  const style = TIER_STYLES[tier];

  const items = (order.items ?? order.positionen ?? []).slice(0, 3);
  const itemCount = (order.items ?? order.positionen ?? []).length;

  const totalPrep = order.geschaetzte_zubereitung_min ?? 15;
  const elapsed = deadline && order.created_at
    ? Math.max(0, (now.getTime() - new Date(order.created_at).getTime()) / 60_000)
    : 0;
  const progressPct = Math.min(100, Math.round((elapsed / totalPrep) * 100));

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-all duration-300',
      style.bg, style.border,
      style.pulse && 'animate-[pulse_1.5s_ease-in-out_infinite]',
    )}>
      <div className="flex items-start gap-3">
        {/* Countdown clock */}
        <div className={cn(
          'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-mono font-black text-sm',
          style.badge,
        )}>
          {remainSec !== null ? (
            <>
              <span className="text-[15px] leading-none">{formatCountdown(remainSec)}</span>
              <span className="text-[8px] opacity-80 mt-0.5">Min</span>
            </>
          ) : (
            <Clock className="h-5 w-5 opacity-70" />
          )}
        </div>

        {/* Order info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold">
              #{order.bestellnummer ?? order.id.slice(-6)}
            </span>
            {order.kunde_name && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                {order.kunde_name}
              </span>
            )}
            <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full', style.badge)}>
              {style.label}
            </span>
            {order.typ && (
              <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                {order.typ}
              </span>
            )}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {items.map((it, i) => (
                <span key={i}>{i > 0 ? ', ' : ''}{it.quantity ?? it.menge ?? 1}× {it.name}</span>
              ))}
              {itemCount > 3 && <span> +{itemCount - 3} weitere</span>}
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000', style.barColor)}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
              {progressPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KitchenPhase1325SmartKochzeitCountdownUltra({ locationId, orders: externalOrders }: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | Tier>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second for countdown
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Poll orders from API if not provided externally
  useEffect(() => {
    if (externalOrders) {
      setOrders(externalOrders);
      return;
    }
    if (!locationId) return;

    const fetch_ = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/kitchen/orders?location_id=${encodeURIComponent(locationId)}&status=accepted,preparing`, { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          setOrders(Array.isArray(d) ? d : d.orders ?? []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    fetch_();
    intervalRef.current = setInterval(fetch_, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [locationId, externalOrders]);

  const activeOrders = orders.filter(o =>
    !['delivered', 'geliefert', 'cancelled', 'storniert', 'fertig'].includes(o.status ?? '')
  );

  const enriched = activeOrders.map(o => {
    const deadline = getDeadline(o);
    const remainSec = deadline ? Math.round((deadline.getTime() - now.getTime()) / 1000) : null;
    const remainMin = remainSec !== null ? remainSec / 60 : 20;
    return { order: o, remainMin, tier: getTier(remainMin) };
  }).sort((a, b) => a.remainMin - b.remainMin);

  const filtered = filter === 'all' ? enriched : enriched.filter(e => e.tier === filter);

  // Summary counts
  const counts: Record<Tier, number> = { overdone: 0, critical: 0, urgent: 0, normal: 0, optimal: 0 };
  for (const e of enriched) counts[e.tier]++;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Smart-Kochzeit-Countdown
          </span>
          {counts.overdone > 0 && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[9px] font-black animate-pulse">
              {counts.overdone} ÜBERFÄLLIG
            </span>
          )}
          {counts.critical > 0 && (
            <span className="rounded-full bg-orange-500 text-white px-2 py-0.5 text-[9px] font-black">
              {counts.critical} KRITISCH
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-1">
            {activeOrders.length} aktiv
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Filter tabs */}
          <div className="flex gap-1 px-4 pt-3 pb-2 flex-wrap">
            {(['all', 'overdone', 'critical', 'urgent', 'normal', 'optimal'] as const).map(f => {
              const count = f === 'all' ? activeOrders.length : counts[f];
              const style = f !== 'all' ? TIER_STYLES[f] : null;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition',
                    filter === f
                      ? (style ? `${style.badge} border-transparent` : 'bg-foreground text-background border-transparent')
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted',
                  )}
                >
                  {f === 'all' ? 'Alle' : TIER_STYLES[f].label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {/* Orders */}
          <div className="px-4 pb-4 space-y-2 max-h-[480px] overflow-y-auto">
            {loading && filtered.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">Lade Bestellungen…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                {filter === 'all' ? 'Keine aktiven Bestellungen.' : `Keine Bestellungen im Status "${TIER_STYLES[filter as Tier]?.label}".`}
              </div>
            )}
            {filtered.map(({ order }) => (
              <OrderCountdownRow key={order.id} order={order} now={now} />
            ))}
          </div>

          {/* Summary bar */}
          {activeOrders.length > 0 && (
            <div className="border-t px-4 py-2 flex items-center gap-3 text-[10px] flex-wrap">
              <Zap className="h-3 w-3 text-matcha-600 shrink-0" />
              <span className="font-bold text-muted-foreground">Übersicht:</span>
              {(Object.entries(counts) as [Tier, number][])
                .filter(([, c]) => c > 0)
                .map(([tier, count]) => (
                  <span key={tier} className={cn('font-bold', TIER_STYLES[tier].text)}>
                    {count}× {TIER_STYLES[tier].label}
                  </span>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}
