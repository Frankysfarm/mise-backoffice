'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Play, SkipForward, Zap,
} from 'lucide-react';

/**
 * Phase 1002 — Smart-Timing-Farbkodierung-Ultimate (Kitchen)
 *
 * 5-Stufen-Farbskala je Bestellung basierend auf Zeit bis zur Deadline:
 *   🔴 Überfällig  → Bestellung bereits verspätet
 *   🟠 Kritisch    → < 5 Min bis Deadline
 *   🟡 Dringend    → 5–15 Min bis Deadline
 *   🟢 Normal      → 15–25 Min bis Deadline
 *   💎 Optimal     → > 25 Min bis Deadline
 *
 * Zeigt zusätzlich empfohlenen Kochstart basierend auf Komplexität.
 * Pollt /api/delivery/kitchen/orders alle 15s.
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
  /** Direkte Order-Übergabe (aus Parent-State) */
  orders?: KitchenOrder[];
}

// ─── Timing-Tiers ──────────────────────────────────────────────────────────

type Tier = 'overdone' | 'critical' | 'urgent' | 'normal' | 'optimal';

interface TierStyle {
  bg: string;
  border: string;
  text: string;
  badge: string;
  dot: string;
  label: string;
  ring: string;
}

const TIER: Record<Tier, TierStyle> = {
  overdone: {
    bg: 'bg-red-50 dark:bg-red-950/25',
    border: 'border-red-300 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    dot: 'bg-red-500 animate-ping',
    label: 'ÜBERFÄLLIG',
    ring: 'ring-2 ring-red-400 ring-offset-1',
  },
  critical: {
    bg: 'bg-orange-50 dark:bg-orange-950/25',
    border: 'border-orange-300 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
    dot: 'bg-orange-500',
    label: 'KRITISCH',
    ring: '',
  },
  urgent: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    dot: 'bg-amber-400',
    label: 'DRINGEND',
    ring: '',
  },
  normal: {
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/10',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'NORMAL',
    ring: '',
  },
  optimal: {
    bg: 'bg-sky-50/50 dark:bg-sky-950/10',
    border: 'border-sky-200 dark:border-sky-800',
    text: 'text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    dot: 'bg-sky-400',
    label: 'OPTIMAL',
    ring: '',
  },
};

function getTier(remainMs: number): Tier {
  if (remainMs < 0) return 'overdone';
  if (remainMs < 5 * 60_000) return 'critical';
  if (remainMs < 15 * 60_000) return 'urgent';
  if (remainMs < 25 * 60_000) return 'normal';
  return 'optimal';
}

function getDeadlineMs(order: KitchenOrder): number {
  if (order.promised_at) return new Date(order.promised_at).getTime();
  const base = order.created_at ? new Date(order.created_at).getTime() : Date.now();
  const prepMin = order.geschaetzte_zubereitung_min ?? 25;
  return base + prepMin * 60_000;
}

function getKochstartMs(order: KitchenOrder): number {
  const deadline = getDeadlineMs(order);
  const prepMin = order.geschaetzte_zubereitung_min ?? 20;
  return deadline - prepMin * 60_000;
}

function fmtCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60_000);
  const s = Math.floor((abs % 60_000) / 1_000);
  return `${ms < 0 ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function itemCount(order: KitchenOrder): number {
  const arr = order.items ?? order.positionen ?? [];
  return arr.reduce((s, i) => s + (i.menge ?? i.quantity ?? 1), 0);
}

const ACTIVE_STATUSES = new Set([
  'neu', 'eingegangen', 'bestätigt', 'confirmed', 'accepted',
  'in_zubereitung', 'zubereitung', 'preparing', 'in_preparation',
]);

// Mock data used when no API response received
const MOCK_ORDERS: KitchenOrder[] = [
  { id: 'm1', bestellnummer: 'B-0041', status: 'in_zubereitung', created_at: new Date(Date.now() - 26 * 60_000).toISOString(), geschaetzte_zubereitung_min: 25, items: [{ name: 'Döner Box', quantity: 2 }, { name: 'Pommes', quantity: 1 }], kunde_name: 'A. Müller', typ: 'lieferung' },
  { id: 'm2', bestellnummer: 'B-0042', status: 'bestätigt', created_at: new Date(Date.now() - 10 * 60_000).toISOString(), geschaetzte_zubereitung_min: 20, items: [{ name: 'Pizza Margherita', quantity: 1 }], kunde_name: 'B. Weber', typ: 'lieferung' },
  { id: 'm3', bestellnummer: 'B-0043', status: 'neu', created_at: new Date(Date.now() - 2 * 60_000).toISOString(), geschaetzte_zubereitung_min: 18, items: [{ name: 'Burger Classic', quantity: 3 }], kunde_name: 'C. Schmidt', typ: 'abholung' },
  { id: 'm4', bestellnummer: 'B-0044', status: 'in_zubereitung', created_at: new Date(Date.now() - 18 * 60_000).toISOString(), geschaetzte_zubereitung_min: 15, items: [{ name: 'Salat Mix', quantity: 2 }, { name: 'Suppe', quantity: 1 }], kunde_name: 'D. Klein', typ: 'lieferung' },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function KitchenPhase1002SmartTimingFarbkodierungUltimate({ locationId, orders: propOrders }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [usingMock, setUsingMock] = useState(false);

  // Sekunden-Ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  // Prop-Orders haben Vorrang
  useEffect(() => {
    if (propOrders && propOrders.length > 0) {
      setOrders(propOrders);
      setUsingMock(false);
    }
  }, [propOrders]);

  // API-Poll als Fallback
  useEffect(() => {
    if (propOrders && propOrders.length > 0) return;
    if (!locationId) { setOrders(MOCK_ORDERS); setUsingMock(true); return; }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/orders?location_id=${locationId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('not ok');
        const d = await res.json();
        const list: KitchenOrder[] = Array.isArray(d) ? d : (d.orders ?? []);
        if (list.length > 0) { setOrders(list); setUsingMock(false); }
        else { setOrders(MOCK_ORDERS); setUsingMock(true); }
      } catch {
        setOrders(MOCK_ORDERS);
        setUsingMock(true);
      }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId, propOrders]);

  const active = orders.filter(o => ACTIVE_STATUSES.has(o.status ?? ''));

  // Sort by deadline ascending (most urgent first)
  const sorted = [...active].sort((a, b) => getDeadlineMs(a) - getDeadlineMs(b));

  // Stats per tier
  const tierCounts = sorted.reduce((acc, o) => {
    const tier = getTier(getDeadlineMs(o) - now);
    acc[tier] = (acc[tier] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const criticalCount = (tierCounts.overdone ?? 0) + (tierCounts.critical ?? 0);

  return (
    <div className="rounded-2xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'p-1.5 rounded-lg',
            criticalCount > 0 ? 'bg-red-100 dark:bg-red-950/40' : 'bg-emerald-100 dark:bg-emerald-950/40',
          )}>
            <Zap className={cn('h-4 w-4', criticalCount > 0 ? 'text-red-600' : 'text-emerald-600')} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground leading-tight">Smart-Timing Farbkodierung</div>
            <div className="text-[11px] text-muted-foreground leading-tight">{active.length} aktive Bestellungen</div>
          </div>
          {criticalCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-[11px] font-black rounded-full bg-red-500 text-white animate-pulse">
              {criticalCount} kritisch!
            </span>
          )}
          {usingMock && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              Demo
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Tier-Pills summary */}
          <div className="hidden sm:flex gap-1.5">
            {(['overdone', 'critical', 'urgent', 'normal', 'optimal'] as Tier[]).map(tier =>
              (tierCounts[tier] ?? 0) > 0 ? (
                <span key={tier} className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded', TIER[tier].badge)}>
                  {tierCounts[tier]}
                </span>
              ) : null,
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine aktiven Bestellungen
            </div>
          ) : (
            sorted.map(order => {
              const deadlineMs = getDeadlineMs(order);
              const remainMs = deadlineMs - now;
              const tier = getTier(remainMs);
              const style = TIER[tier];
              const cookStartMs = getKochstartMs(order);
              const cookStartRemain = cookStartMs - now;
              const shouldStartCooking = cookStartRemain <= 0 && remainMs > 0;
              const prepMin = order.geschaetzte_zubereitung_min ?? 20;
              const cnt = itemCount(order);

              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-all',
                    style.bg, style.border, style.ring,
                    tier === 'overdone' && 'animate-pulse',
                  )}
                >
                  {/* Color dot */}
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', style.dot)} />

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-foreground tabular-nums">
                        #{order.bestellnummer ?? order.id.slice(-4).toUpperCase()}
                      </span>
                      {order.kunde_name && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{order.kunde_name}</span>
                      )}
                      <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded', style.badge)}>
                        {style.label}
                      </span>
                      {order.typ === 'abholung' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 font-semibold">
                          ABHOLUNG
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {cnt} Artikel · {prepMin} Min Zubereitung · Deadline {fmtTime(deadlineMs)}
                    </div>
                  </div>

                  {/* Kochstart-Empfehlung */}
                  {shouldStartCooking && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 shrink-0">
                      <Play className="h-3 w-3 text-orange-600" />
                      <span className="text-[10px] font-black text-orange-700 dark:text-orange-300">JETZT KOCHEN</span>
                    </div>
                  )}
                  {!shouldStartCooking && cookStartRemain > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shrink-0">
                      <SkipForward className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Kochstart {fmtCountdown(cookStartRemain)}
                      </span>
                    </div>
                  )}

                  {/* Countdown */}
                  <div className={cn('tabular-nums font-black text-base min-w-[56px] text-right', style.text)}>
                    {fmtCountdown(remainMs)}
                  </div>
                </div>
              );
            })
          )}

          {/* Legend */}
          <div className="pt-1 flex flex-wrap gap-2 border-t border-border/50 mt-2">
            {([
              ['overdone', 'Überfällig'],
              ['critical', '< 5 Min'],
              ['urgent', '5–15 Min'],
              ['normal', '15–25 Min'],
              ['optimal', '> 25 Min'],
            ] as [Tier, string][]).map(([tier, label]) => (
              <span key={tier} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={cn('w-2 h-2 rounded-full', TIER[tier].dot.replace('animate-ping', ''))} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
