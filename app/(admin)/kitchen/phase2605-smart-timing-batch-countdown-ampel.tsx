'use client';

/**
 * Phase 2605 — Smart-Timing Batch-Countdown Ampel
 *
 * Zeigt aktive Bestellungen als Kacheln mit Farbkodierung:
 * grün (≥3 Min), gelb (0–3 Min), rot (überfällig).
 * Countdown-Ring je Bestellung, On-Time-Quote, SLA-Alert.
 * 1-Sek-Tick lokal, 30-Sek-API-Polling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Timer, Zap } from 'lucide-react';

interface OrderRow {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  ready_target: string | null;
  cook_start_at: string | null;
  item_count: number;
}

type Farbe = 'gruen' | 'gelb' | 'rot' | 'fertig';

function klassifiziere(secsLeft: number | null, status: string): Farbe {
  if (status === 'fertig' || status === 'unterwegs') return 'fertig';
  if (secsLeft === null) return 'gruen';
  if (secsLeft > 180) return 'gruen';
  if (secsLeft >= 0) return 'gelb';
  return 'rot';
}

const FARBEN: Record<Farbe, { bg: string; border: string; textBig: string; textSm: string; dot: string }> = {
  gruen:  { bg: 'bg-matcha-50  dark:bg-matcha-950/30',  border: 'border-matcha-300 dark:border-matcha-700',  textBig: 'text-matcha-700  dark:text-matcha-300',  textSm: 'text-matcha-500',  dot: 'bg-matcha-500' },
  gelb:   { bg: 'bg-amber-50   dark:bg-amber-950/30',    border: 'border-amber-300  dark:border-amber-700',    textBig: 'text-amber-700   dark:text-amber-300',    textSm: 'text-amber-500',   dot: 'bg-amber-400' },
  rot:    { bg: 'bg-red-50     dark:bg-red-950/30',      border: 'border-red-300    dark:border-red-700',      textBig: 'text-red-700     dark:text-red-300',      textSm: 'text-red-500',     dot: 'bg-red-500 animate-pulse' },
  fertig: { bg: 'bg-stone-50   dark:bg-stone-900/20',    border: 'border-stone-200  dark:border-stone-700',    textBig: 'text-stone-400   dark:text-stone-500',    textSm: 'text-stone-400',   dot: 'bg-stone-300' },
};

function CountdownRing({ secsLeft, totalSecs, farbe, size = 52 }: { secsLeft: number; totalSecs: number; farbe: Farbe; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = totalSecs > 0 ? Math.max(0, Math.min(1, secsLeft / totalSecs)) : 0;
  const stroke = farbe === 'gruen' ? '#6a9e5f' : farbe === 'gelb' ? '#f59e0b' : farbe === 'rot' ? '#ef4444' : '#d6d3d1';
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={stroke} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - pct * circ}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
      />
    </svg>
  );
}

function formatCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function OrderKachel({ order, tick }: { order: OrderRow; tick: number }) {
  const now = Date.now();
  const prepSecs = (order.geschaetzte_zubereitung_min ?? 15) * 60;
  let secsLeft: number;
  if (order.ready_target) {
    secsLeft = Math.floor((new Date(order.ready_target).getTime() - now) / 1000);
  } else if (order.bestellt_am) {
    const elapsed = Math.floor((now - new Date(order.bestellt_am).getTime()) / 1000);
    secsLeft = prepSecs - elapsed;
  } else {
    secsLeft = prepSecs;
  }

  const farbe = klassifiziere(secsLeft, order.status);
  const f = FARBEN[farbe];
  const isOverdue = secsLeft < 0 && farbe !== 'fertig';

  return (
    <div className={cn('relative rounded-xl border-2 p-2.5 flex items-center gap-2.5 transition-all', f.bg, f.border, isOverdue && 'shadow-[0_0_12px_rgba(239,68,68,0.25)]')}>
      <div className="relative shrink-0">
        <CountdownRing secsLeft={Math.max(0, secsLeft)} totalSecs={prepSecs} farbe={farbe} />
        <div className="absolute inset-0 flex items-center justify-center rotate-90">
          {farbe === 'fertig' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-matcha-500" />
          ) : (
            <span className={cn('font-mono text-[9px] font-black tabular-nums', f.textBig)}>
              {formatCountdown(secsLeft)}
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full shrink-0', f.dot)} />
          <span className="text-[11px] font-black text-foreground truncate">#{order.bestellnummer}</span>
        </div>
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{order.kunde_name}</div>
        <div className={cn('text-[10px] font-semibold mt-0.5', f.textSm)}>
          {order.item_count} Artikel · {farbe === 'fertig' ? 'Fertig' : isOverdue ? `+${Math.abs(Math.ceil(secsLeft / 60))} Min überfällig` : `${Math.ceil(secsLeft / 60)} Min`}
        </div>
      </div>
    </div>
  );
}

export function KitchenPhase2605SmartTimingBatchCountdownAmpel({ locationId }: { locationId?: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const supabase = createClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const q = supabase
      .from('customer_orders')
      .select('id, bestellnummer, kunde_name, status, bestellt_am, geschaetzte_zubereitung_min')
      .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
      .order('bestellt_am', { ascending: true })
      .limit(20);
    if (locationId) q.eq('location_id', locationId);
    const { data } = await q;
    if (!data) { setLoading(false); return; }

    // Get kitchen timings
    const ids = data.map(o => o.id);
    const { data: timings } = await supabase
      .from('kitchen_timings')
      .select('order_id, ready_target, cook_start_at, prep_min')
      .in('order_id', ids);

    const timingMap = new Map((timings ?? []).map((t: any) => [t.order_id, t]));
    const rows: OrderRow[] = data.map((o: any) => {
      const t = timingMap.get(o.id) as any;
      return {
        id: o.id,
        bestellnummer: o.bestellnummer,
        kunde_name: o.kunde_name ?? '—',
        status: o.status,
        bestellt_am: o.bestellt_am,
        geschaetzte_zubereitung_min: t?.prep_min ?? o.geschaetzte_zubereitung_min,
        ready_target: t?.ready_target ?? null,
        cook_start_at: t?.cook_start_at ?? null,
        item_count: 0,
      };
    });
    setOrders(rows);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const api = setInterval(load, 30_000);
    const tick = setInterval(() => setTick(n => n + 1), 1_000);
    return () => { clearInterval(api); clearInterval(tick); };
  }, [load]);

  const active = orders.filter(o => o.status !== 'fertig' && o.status !== 'unterwegs');
  const fertig = orders.filter(o => o.status === 'fertig' || o.status === 'unterwegs');
  const now = Date.now();
  const overdueCount = active.filter(o => {
    const prepSecs = (o.geschaetzte_zubereitung_min ?? 15) * 60;
    const secsLeft = o.ready_target
      ? Math.floor((new Date(o.ready_target).getTime() - now) / 1000)
      : o.bestellt_am ? prepSecs - Math.floor((now - new Date(o.bestellt_am).getTime()) / 1000) : prepSecs;
    return secsLeft < 0;
  }).length;
  const onTimeCount = active.length - overdueCount;
  const onTimeQuote = active.length > 0 ? Math.round((onTimeCount / active.length) * 100) : 100;

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (orders.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 rounded-t-2xl transition"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900">
            <Timer className="h-3.5 w-3.5 text-matcha-700 dark:text-matcha-300" />
          </div>
          <span className="text-sm font-bold text-foreground">Batch-Countdown Ampel</span>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} überfällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            'text-[11px] font-black tabular-nums',
            onTimeQuote >= 80 ? 'text-matcha-600' : onTimeQuote >= 60 ? 'text-amber-600' : 'text-red-600',
          )}>
            {onTimeQuote}% on-time
          </span>
          {open ? <Clock className="h-4 w-4 text-muted-foreground" /> : <Zap className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* KPI Strip */}
          <div className="flex gap-2 mb-3">
            {[
              { label: 'Aktiv', val: active.length, icon: ChefHat, col: 'text-foreground' },
              { label: 'On-Time', val: onTimeCount, icon: CheckCircle2, col: 'text-matcha-600' },
              { label: 'Überfällig', val: overdueCount, icon: AlertTriangle, col: 'text-red-600' },
              { label: 'Fertig', val: fertig.length, icon: CheckCircle2, col: 'text-stone-400' },
            ].map(k => (
              <div key={k.label} className="flex-1 rounded-lg bg-muted/30 p-2 text-center">
                <div className={cn('text-base font-black tabular-nums', k.col)}>{k.val}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Order Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[...active, ...fertig].map(o => (
              <OrderKachel key={o.id} order={o} tick={tick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
