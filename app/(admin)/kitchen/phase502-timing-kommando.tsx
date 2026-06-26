'use client';

import { useEffect, useState, useMemo } from 'react';
import { Clock, Flame, CheckCircle2, AlertTriangle, Timer, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  items: { name: string; menge: number }[];
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
};

type UrgencyLevel = 'ok' | 'warn' | 'critical' | 'overdue' | 'ready';

function getUrgency(secsLeft: number, status: string): UrgencyLevel {
  if (status === 'ready' || status === 'picked_up') return 'ready';
  if (secsLeft < 0) return 'overdue';
  if (secsLeft < 90) return 'critical';
  if (secsLeft < 240) return 'warn';
  return 'ok';
}

const URGENCY_CONFIG: Record<UrgencyLevel, { bg: string; border: string; badge: string; label: string; pulse?: boolean }> = {
  ok:       { bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-500 text-white',  label: 'Im Plan' },
  warn:     { bg: 'bg-amber-50',    border: 'border-amber-300',   badge: 'bg-amber-500 text-white',    label: 'Bald fällig', pulse: true },
  critical: { bg: 'bg-orange-50',   border: 'border-orange-400',  badge: 'bg-orange-600 text-white',   label: 'Dringend!', pulse: true },
  overdue:  { bg: 'bg-red-50',      border: 'border-red-500',     badge: 'bg-red-600 text-white',      label: 'ÜBERFÄLLIG', pulse: true },
  ready:    { bg: 'bg-blue-50',     border: 'border-blue-300',    badge: 'bg-blue-500 text-white',     label: 'Fertig' },
};

function formatCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CountdownRing({ secs, total }: { secs: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, secs / total)) : 0;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = secs < 0 ? '#ef4444' : secs < 90 ? '#ea580c' : secs < 240 ? '#f59e0b' : '#10b981';
  return (
    <svg width={52} height={52} className="shrink-0">
      <circle cx={26} cy={26} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={26} cy={26} r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dasharray 1s linear' }}
      />
      <text x={26} y={30} textAnchor="middle" fontSize={8} fontWeight="700" fill={color}>
        {secs < 0 ? '!' : Math.ceil(secs / 60)}m
      </text>
    </svg>
  );
}

export function KitchenPhase502TimingKommando({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const activeOrders = useMemo(
    () => orders.filter((o) => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)),
    [orders],
  );

  const items = useMemo(() => {
    return activeOrders.map((order) => {
      const timing = timings.find((t) => t.order_id === order.id);
      const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;
      const readyTarget = timing?.ready_target
        ? new Date(timing.ready_target).getTime()
        : order.bestellt_am
          ? new Date(order.bestellt_am).getTime() + prepMin * 60_000
          : now + prepMin * 60_000;
      const secsLeft = Math.floor((readyTarget - now) / 1000);
      const urgency = getUrgency(secsLeft, timing?.status ?? '');
      return { order, timing, secsLeft, urgency, prepMin, readyTarget };
    }).sort((a, b) => a.secsLeft - b.secsLeft);
  }, [activeOrders, timings, now]);

  const summary = useMemo(() => ({
    ok:       items.filter(i => i.urgency === 'ok').length,
    warn:     items.filter(i => i.urgency === 'warn').length,
    critical: items.filter(i => i.urgency === 'critical').length,
    overdue:  items.filter(i => i.urgency === 'overdue').length,
    ready:    orders.filter(o => o.status === 'fertig').length,
  }), [items, orders]);

  if (activeOrders.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-lg">
            <Timer size={16} className="text-emerald-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">Phase 502 · Timing-Kommando</div>
            <div className="text-[11px] text-gray-500">Echtzeit-Countdown + Farbkodierung · {activeOrders.length} aktive Bestellungen</div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 font-mono">
          {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {[
          { key: 'ok',       icon: TrendingUp,    color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Im Plan',     val: summary.ok },
          { key: 'warn',     icon: Clock,         color: 'text-amber-600',   bg: 'bg-amber-50',   label: '< 4 Min',     val: summary.warn },
          { key: 'critical', icon: AlertTriangle, color: 'text-orange-600',  bg: 'bg-orange-50',  label: '< 90 Sek',    val: summary.critical },
          { key: 'overdue',  icon: Flame,         color: 'text-red-600',     bg: 'bg-red-50',     label: 'Überfällig',  val: summary.overdue },
          { key: 'ready',    icon: CheckCircle2,  color: 'text-blue-600',    bg: 'bg-blue-50',    label: 'Fertig',      val: summary.ready },
        ].map(({ key, icon: Icon, color, bg, label, val }) => (
          <div key={key} className={cn('rounded-lg p-2 text-center', bg)}>
            <Icon size={13} className={cn('mx-auto mb-0.5', color)} />
            <div className={cn('text-lg font-bold tabular-nums leading-tight', color)}>{val}</div>
            <div className="text-[9px] text-gray-500 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Order Cards */}
      <div className="space-y-2">
        {items.map(({ order, timing, secsLeft, urgency, prepMin }) => {
          const cfg = URGENCY_CONFIG[urgency];
          return (
            <div
              key={order.id}
              className={cn(
                'rounded-lg border p-3 flex items-center gap-3 transition-all',
                cfg.bg, cfg.border,
                cfg.pulse && 'animate-pulse-subtle',
              )}
            >
              {/* Countdown Ring */}
              <CountdownRing secs={secsLeft} total={prepMin * 60} />

              {/* Order Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-gray-900">#{order.bestellnummer}</span>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="text-[11px] text-gray-600 truncate">{order.kunde_name}</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {order.items.slice(0, 2).map(i => `${i.menge}× ${i.name}`).join(', ')}
                  {order.items.length > 2 && ` +${order.items.length - 2}`}
                </div>
              </div>

              {/* Countdown Display */}
              <div className="text-right shrink-0">
                <div className={cn(
                  'text-2xl font-black tabular-nums font-mono leading-tight',
                  urgency === 'overdue' ? 'text-red-600' :
                  urgency === 'critical' ? 'text-orange-600' :
                  urgency === 'warn' ? 'text-amber-600' :
                  urgency === 'ready' ? 'text-blue-600' : 'text-emerald-600',
                )}>
                  {timing?.status === 'ready' || timing?.status === 'picked_up' ? '✓' : formatCountdown(secsLeft)}
                </div>
                <div className="text-[9px] text-gray-400">
                  {order.status === 'in_zubereitung' ? '🔥 in Arbeit' :
                   order.status === 'bestätigt' ? '⏳ bestätigt' : '🆕 neu'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Smart Tip */}
      {summary.critical + summary.overdue > 0 && (
        <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Zap size={13} className="text-red-600 shrink-0" />
          <span className="text-[11px] text-red-700 font-medium">
            {summary.overdue > 0
              ? `${summary.overdue} Bestellung${summary.overdue > 1 ? 'en' : ''} überfällig! Sofort fertigstellen.`
              : `${summary.critical} Bestellung${summary.critical > 1 ? 'en' : ''} in den nächsten 90 Sekunden fällig.`}
          </span>
        </div>
      )}
    </div>
  );
}
