'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Bike, ChefHat, CheckCircle2, Clock, Flame, Timer, Zap } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string | null;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type DriverEta = {
  order_id: string;
  eta_sec: number;
  driver_name: string;
};

/* ── Urgency tiers ───────────────────────────────────────────────────────────── */

type UrgencyLevel = 'ok' | 'tight' | 'urgent' | 'critical' | 'done' | 'waiting';

function urgencyFromSec(remainSec: number | null, status: string): UrgencyLevel {
  if (status === 'fertig') return 'done';
  if (remainSec === null) return 'waiting';
  if (remainSec > 300) return 'ok';
  if (remainSec > 120) return 'tight';
  if (remainSec > 0)   return 'urgent';
  return 'critical';
}

const URGENCY_STYLE: Record<UrgencyLevel, { bg: string; text: string; border: string; label: string }> = {
  ok:       { bg: 'bg-emerald-50',  text: 'text-emerald-800', border: 'border-emerald-200', label: 'Pünktlich'  },
  tight:    { bg: 'bg-yellow-50',   text: 'text-yellow-800',  border: 'border-yellow-300',  label: 'Knapp'      },
  urgent:   { bg: 'bg-orange-50',   text: 'text-orange-800',  border: 'border-orange-300',  label: 'Dringend'   },
  critical: { bg: 'bg-red-50',      text: 'text-red-800',     border: 'border-red-400',     label: 'Überfällig' },
  done:     { bg: 'bg-matcha-50',   text: 'text-matcha-700',  border: 'border-matcha-200',  label: 'Fertig'     },
  waiting:  { bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200',   label: 'Wartend'    },
};

function fmtMmSs(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

/* ── Mock fallback ───────────────────────────────────────────────────────────── */

const MOCK_ORDERS: Order[] = [
  { id: 'mock-1', bestellnummer: 'B-1001', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 8 * 60_000).toISOString(), geschaetzte_zubereitung_min: 12, kunde_name: 'Max Müller' },
  { id: 'mock-2', bestellnummer: 'B-1002', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 3 * 60_000).toISOString(), geschaetzte_zubereitung_min: 15, kunde_name: 'Anna Koch'  },
  { id: 'mock-3', bestellnummer: 'B-1003', status: 'neu',            bestellt_am: new Date(Date.now() - 1 * 60_000).toISOString(), geschaetzte_zubereitung_min: 10, kunde_name: 'Tom Bauer'  },
  { id: 'mock-4', bestellnummer: 'B-1004', status: 'fertig',         bestellt_am: new Date(Date.now() - 20 * 60_000).toISOString(), geschaetzte_zubereitung_min: 12, kunde_name: 'Lisa Braun' },
];

const MOCK_TIMINGS: KitchenTiming[] = [
  { order_id: 'mock-1', cook_start_at: new Date(Date.now() - 8 * 60_000).toISOString(), ready_target: new Date(Date.now() + 4 * 60_000).toISOString(), prep_min: 12, status: 'cooking' },
  { order_id: 'mock-2', cook_start_at: new Date(Date.now() - 3 * 60_000).toISOString(), ready_target: new Date(Date.now() + 12 * 60_000).toISOString(), prep_min: 15, status: 'cooking' },
];

const MOCK_DRIVER_ETAS: DriverEta[] = [
  { order_id: 'mock-1', eta_sec: 240, driver_name: 'Klaus S.' },
];

/* ── Component ───────────────────────────────────────────────────────────────── */

interface Props {
  locationId?: string | null;
}

export function KitchenPhase4680SmartTimingHub({ locationId }: Props) {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [timings, setTimings] = useState<KitchenTiming[]>([]);
  const [driverEtas, setDriverEtas] = useState<DriverEta[]>([]);
  const [useMock, setUseMock] = useState(false);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* 1-sec tick */
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  /* Polling */
  const fetchData = async () => {
    try {
      const activeStatuses = ['neu', 'bestätigt', 'in_zubereitung', 'fertig'];
      let qOrders = supabase
        .from('customer_orders')
        .select('id, bestellnummer, status, bestellt_am, geschaetzte_zubereitung_min, kunde_name')
        .in('status', activeStatuses)
        .order('bestellt_am', { ascending: true })
        .limit(20);
      if (locationId) qOrders = qOrders.eq('location_id', locationId);

      const { data: ordersData, error: ordersErr } = await qOrders;
      if (ordersErr || !ordersData?.length) { setUseMock(true); return; }

      const ids = ordersData.map((o: Order) => o.id);
      const { data: timingsData } = await supabase
        .from('mise_kitchen_timings')
        .select('order_id, cook_start_at, ready_target, prep_min, status')
        .in('order_id', ids);

      const { data: batchStops } = await supabase
        .from('mise_delivery_batch_stops')
        .select(`
          order_id,
          batch:mise_delivery_batches(
            id, status,
            fahrer:mise_drivers(name),
            started_at, total_eta_min
          )
        `)
        .in('order_id', ids);

      const etas: DriverEta[] = [];
      (batchStops ?? []).forEach((s: any) => {
        const b = Array.isArray(s.batch) ? s.batch[0] : s.batch;
        if (!b || !['unterwegs', 'assigned', 'pickup'].includes(b.status)) return;
        const driver = Array.isArray(b.fahrer) ? b.fahrer[0] : b.fahrer;
        if (!b.started_at || !b.total_eta_min) return;
        const arrivalMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
        etas.push({
          order_id: s.order_id,
          eta_sec: Math.max(0, Math.round((arrivalMs - Date.now()) / 1_000)),
          driver_name: driver?.name ?? 'Fahrer',
        });
      });

      setOrders(ordersData);
      setTimings(timingsData ?? []);
      setDriverEtas(etas);
      setUseMock(false);
    } catch {
      setUseMock(true);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  /* Derived data */
  const activeOrders = useMock ? MOCK_ORDERS : orders;
  const activeTimings = useMock ? MOCK_TIMINGS : timings;
  const activeEtas = useMock ? MOCK_DRIVER_ETAS : driverEtas;

  const timingMap = new Map(activeTimings.map(t => [t.order_id, t]));
  const etaMap    = new Map(activeEtas.map(e => [e.order_id, e]));

  type CardData = {
    order: Order;
    timing: KitchenTiming | undefined;
    driverEta: DriverEta | undefined;
    remainSec: number | null;
    urgency: UrgencyLevel;
  };

  const cards: CardData[] = activeOrders
    .filter(o => o.status !== 'geliefert' && o.status !== 'storniert')
    .map(o => {
      const timing = timingMap.get(o.id);
      const driverEta = etaMap.get(o.id);
      let remainSec: number | null = null;
      if (timing?.ready_target) {
        remainSec = Math.round((new Date(timing.ready_target).getTime() - now) / 1_000);
      } else if (o.bestellt_am && o.geschaetzte_zubereitung_min) {
        const target = new Date(o.bestellt_am).getTime() + o.geschaetzte_zubereitung_min * 60_000;
        remainSec = Math.round((target - now) / 1_000);
      }
      return { order: o, timing, driverEta, remainSec, urgency: urgencyFromSec(remainSec, o.status) };
    })
    .sort((a, b) => {
      const priority: Record<UrgencyLevel, number> = { critical: 0, urgent: 1, tight: 2, ok: 3, waiting: 4, done: 5 };
      return priority[a.urgency] - priority[b.urgency];
    });

  /* KPI summary */
  const totalActive  = cards.filter(c => c.urgency !== 'done').length;
  const criticalCount = cards.filter(c => c.urgency === 'critical').length;
  const doneCount    = cards.filter(c => c.urgency === 'done').length;
  const onTimePct    = totalActive + doneCount > 0
    ? Math.round((cards.filter(c => ['ok', 'done'].includes(c.urgency)).length / Math.max(1, cards.length)) * 100)
    : 100;

  if (!cards.length) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-indigo-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-white" />
          <span className="text-sm font-bold text-white">Smart Timing Hub</span>
          {useMock && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-medium text-white/80">Demo</span>
          )}
        </div>
        {criticalCount > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 animate-pulse">
            <Flame className="h-3 w-3 text-white" />
            <span className="text-[10px] font-bold text-white">{criticalCount} überfällig</span>
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 divide-x divide-indigo-50 border-b border-indigo-100 bg-indigo-50/30">
        {[
          { label: 'Aktiv',      value: String(totalActive),    icon: ChefHat,        color: 'text-indigo-700' },
          { label: 'Überfällig', value: String(criticalCount),  icon: AlertTriangle,  color: criticalCount > 0 ? 'text-red-600' : 'text-slate-400' },
          { label: 'Fertig',     value: String(doneCount),      icon: CheckCircle2,   color: 'text-emerald-600' },
          { label: 'Pünktl.',    value: `${onTimePct}%`,        icon: Zap,            color: onTimePct >= 80 ? 'text-emerald-600' : 'text-amber-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex flex-col items-center py-2.5 gap-0.5">
            <Icon className={cn('h-3.5 w-3.5 mb-0.5', color)} />
            <span className={cn('text-base font-black tabular-nums leading-none', color)}>{value}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {/* Order Cards */}
      <div className="divide-y divide-slate-50">
        {cards.map(({ order, timing, driverEta, remainSec, urgency }) => {
          const style = URGENCY_STYLE[urgency];
          const isCritical = urgency === 'critical';
          const hasPrepProgress = timing?.cook_start_at && timing?.ready_target;
          let progressPct = 0;
          if (hasPrepProgress) {
            const start  = new Date(timing!.cook_start_at!).getTime();
            const target = new Date(timing!.ready_target!).getTime();
            progressPct = Math.min(100, Math.max(0, Math.round(((now - start) / (target - start)) * 100)));
          }

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                isCritical && 'animate-pulse bg-red-50/70',
              )}
            >
              {/* Urgency dot */}
              <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', {
                'bg-emerald-400': urgency === 'ok',
                'bg-yellow-400':  urgency === 'tight',
                'bg-orange-500':  urgency === 'urgent',
                'bg-red-600':     urgency === 'critical',
                'bg-matcha-400':  urgency === 'done',
                'bg-slate-300':   urgency === 'waiting',
              })} />

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-slate-700">{order.bestellnummer}</span>
                  <span className={cn('rounded px-1 py-0.5 text-[9px] font-semibold', style.bg, style.text, `border ${style.border}`)}>
                    {style.label}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate block">{order.kunde_name ?? '—'}</span>
                {hasPrepProgress && (
                  <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        progressPct >= 100 ? 'bg-emerald-400' : isCritical ? 'bg-red-500' : 'bg-indigo-400',
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Countdown */}
              <div className="text-right flex-shrink-0">
                {remainSec !== null ? (
                  <span className={cn(
                    'font-mono text-base font-black tabular-nums',
                    urgency === 'critical' ? 'text-red-600' : urgency === 'urgent' ? 'text-orange-600' : urgency === 'tight' ? 'text-yellow-700' : 'text-emerald-700',
                  )}>
                    {fmtMmSs(remainSec)}
                  </span>
                ) : (
                  <span className="font-mono text-base font-black tabular-nums text-slate-400">—</span>
                )}
                {driverEta && (
                  <div className="flex items-center justify-end gap-0.5 mt-0.5">
                    <Bike className="h-2.5 w-2.5 text-indigo-500" />
                    <span className="text-[9px] text-indigo-600 font-semibold">{Math.ceil(driverEta.eta_sec / 60)}m</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 bg-slate-50">
        <Clock className="h-3 w-3 text-slate-400" />
        <span className="text-[9px] text-slate-400">15-Sek-Polling • Echtzeit-Countdown</span>
        <div className="ml-auto flex gap-2">
          {(['ok', 'tight', 'urgent', 'critical'] as UrgencyLevel[]).map(u => (
            <span key={u} className="flex items-center gap-0.5 text-[8px] text-slate-500">
              <span className={cn('h-1.5 w-1.5 rounded-full inline-block', {
                'bg-emerald-400': u === 'ok',
                'bg-yellow-400':  u === 'tight',
                'bg-orange-500':  u === 'urgent',
                'bg-red-600':     u === 'critical',
              })} />
              {URGENCY_STYLE[u].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
