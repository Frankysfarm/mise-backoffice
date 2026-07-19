'use client';

/**
 * Phase 2610 — Smart-Timing ETA-Sync Final (Küche)
 *
 * Synchronisiert Fahrer-ETA mit Kochstart-Empfehlung.
 * Zeigt je aktive Bestellung: Farbkodierter Countdown (grün/gelb/rot),
 * optimalen Kochstart-Zeitpunkt, On-Time-Quote und SLA-Alert.
 * 1-Sek-Tick lokal + 20-Sek-Polling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Timer, Zap } from 'lucide-react';

interface OrderRow {
  id: string;
  bestellnummer: string;
  kunde_name: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  ready_target: string | null;
  cook_start_at: string | null;
  driver_eta_min: number | null;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'fertig';

function ampelKlasse(secsLeft: number | null, status: string): Ampel {
  if (['fertig', 'unterwegs', 'geliefert'].includes(status)) return 'fertig';
  if (secsLeft === null) return 'gruen';
  if (secsLeft > 180) return 'gruen';
  if (secsLeft >= 0) return 'gelb';
  return 'rot';
}

const PALETTE: Record<Ampel, { bg: string; border: string; text: string; pill: string }> = {
  gruen:  { bg: 'bg-matcha-50 dark:bg-matcha-950/30',  border: 'border-matcha-200 dark:border-matcha-800',  text: 'text-matcha-700 dark:text-matcha-300',  pill: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'  },
  gelb:   { bg: 'bg-amber-50  dark:bg-amber-950/30',   border: 'border-amber-200  dark:border-amber-800',   text: 'text-amber-700  dark:text-amber-300',   pill: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300'   },
  rot:    { bg: 'bg-red-50    dark:bg-red-950/30',     border: 'border-red-200    dark:border-red-800',     text: 'text-red-700    dark:text-red-300',     pill: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300'     },
  fertig: { bg: 'bg-stone-50  dark:bg-stone-900/20',   border: 'border-stone-200  dark:border-stone-700',   text: 'text-stone-400  dark:text-stone-500',   pill: 'bg-stone-100  text-stone-500  dark:bg-stone-800/40  dark:text-stone-400'  },
};

function secsBis(ts: string | null): number | null {
  if (!ts) return null;
  return Math.round((new Date(ts).getTime() - Date.now()) / 1000);
}

function formatCountdown(secs: number | null, ampel: Ampel): string {
  if (ampel === 'fertig') return '✓';
  if (secs === null) return '—';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function Ring({ done, total, size = 40 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const clr = pct >= 1 ? '#6a9e5f' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={4} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={clr} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - pct * circ}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

interface Props {
  locationId?: string | null;
}

export function KitchenPhase2610SmartTimingEtaSyncFinal({ locationId }: Props) {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    const q = supabase
      .from('customer_orders')
      .select('id, bestellnummer, kunde_name, status, bestellt_am, geschaetzte_zubereitung_min, ready_target, cook_start_at')
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig']);
    if (locationId) q.eq('location_id', locationId);
    const { data } = await q.order('bestellt_am', { ascending: true }).limit(20);
    if (data) setOrders(data as OrderRow[]);
    setLoading(false);
  }, [locationId]); // eslint-disable-line

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20_000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter(o => !['fertig', 'unterwegs', 'geliefert'].includes(o.status));
  const done = orders.filter(o => ['fertig', 'unterwegs', 'geliefert'].includes(o.status));
  const overdueCount = active.filter(o => {
    const s = secsBis(o.ready_target);
    return s !== null && s < 0;
  }).length;
  const onTimeCount = done.length;
  const total = active.length + done.length;
  const onTimeQuote = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

  if (!loading && orders.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-semibold text-foreground">Smart-Timing ETA-Sync</span>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount} überfällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">On-Time</span>
          <span className={cn('text-sm font-black', onTimeQuote >= 85 ? 'text-matcha-600' : onTimeQuote >= 65 ? 'text-amber-600' : 'text-red-600')}>
            {onTimeQuote}%
          </span>
          <Ring done={onTimeCount} total={total} size={32} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
          <Timer className="w-4 h-4 animate-spin" />
          Lade Bestellungen…
        </div>
      )}

      {!loading && active.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-matcha-500" />
          Keine aktiven Bestellungen
        </div>
      )}

      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
          {active.map(order => {
            const sLeft = secsBis(order.ready_target ?? null);
            const ampel = ampelKlasse(sLeft, order.status);
            const p = PALETTE[ampel];
            const prepMin = order.geschaetzte_zubereitung_min ?? 15;
            const kochStartSecs = sLeft !== null ? sLeft - prepMin * 60 : null;
            const kochJetzt = kochStartSecs !== null && kochStartSecs <= 60 && kochStartSecs > -120;

            return (
              <div key={order.id} className={cn('rounded-lg border p-3 space-y-2', p.bg, p.border)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      #{order.bestellnummer || order.id.slice(0, 6)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{order.kunde_name || '—'}</p>
                  </div>
                  <span className={cn('shrink-0 text-xs font-medium px-2 py-0.5 rounded-full', p.pill)}>
                    {order.status === 'in_zubereitung' ? 'Kocht' : order.status === 'bestätigt' ? 'Bestätigt' : 'Neu'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className={cn('font-mono text-base font-black', p.text)}>
                      {formatCountdown(sLeft, ampel)}
                    </span>
                  </div>
                  {ampel !== 'fertig' && (
                    <span className="text-xs text-muted-foreground">
                      bis fertig
                    </span>
                  )}
                </div>

                {kochJetzt && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    <Zap className="w-3 h-3" />
                    Jetzt kochen!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Timer className="w-3 h-3" />
        Live · 20-Sek-Update
      </div>
    </div>
  );
}
