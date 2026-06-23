'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Flame, Play, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { startCookingNow, markTimingReady } from './actions';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  typ: string;
  items: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type UrgencyLevel = 'ok' | 'bald' | 'kritisch' | 'ueberfaellig' | 'fertig';

const URGENCY_META: Record<UrgencyLevel, { bg: string; border: string; badge: string; label: string; icon: React.ElementType }> = {
  ok:          { bg: 'bg-green-50',   border: 'border-green-200',  badge: 'bg-green-500 text-white',   label: 'Im Plan',   icon: CheckCircle2 },
  bald:        { bg: 'bg-amber-50',   border: 'border-amber-300',  badge: 'bg-amber-400 text-white',   label: 'Bald',      icon: Clock },
  kritisch:    { bg: 'bg-orange-50',  border: 'border-orange-400', badge: 'bg-orange-500 text-white',  label: 'Kritisch',  icon: AlertTriangle },
  ueberfaellig:{ bg: 'bg-red-50',     border: 'border-red-500',    badge: 'bg-red-600 text-white',     label: 'Überfällig',icon: Flame },
  fertig:      { bg: 'bg-matcha-50',  border: 'border-matcha-300', badge: 'bg-matcha-500 text-white',  label: 'Fertig',    icon: CheckCircle2 },
};

function computeUrgency(order: Order, timing: KitchenTiming | undefined, nowMs: number): { level: UrgencyLevel; secsLeft: number; totalSecs: number } {
  if (order.status === 'fertig' || order.status === 'unterwegs') return { level: 'fertig', secsLeft: 0, totalSecs: 1 };

  if (timing?.ready_target && timing.cook_start_at) {
    const readyMs = new Date(timing.ready_target).getTime();
    const startMs = new Date(timing.cook_start_at).getTime();
    const totalSecs = Math.max(1, (readyMs - startMs) / 1000);
    const secsLeft = (readyMs - nowMs) / 1000;
    if (secsLeft < -120) return { level: 'ueberfaellig', secsLeft, totalSecs };
    if (secsLeft < 60)   return { level: 'kritisch',     secsLeft, totalSecs };
    if (secsLeft < 240)  return { level: 'bald',         secsLeft, totalSecs };
    return { level: 'ok', secsLeft, totalSecs };
  }

  if (!order.bestellt_am) return { level: 'ok', secsLeft: 0, totalSecs: 1 };
  const targetMin = order.geschaetzte_zubereitung_min ?? 20;
  const totalSecs = targetMin * 60;
  const elapsedSecs = (nowMs - new Date(order.bestellt_am).getTime()) / 1000;
  const secsLeft = totalSecs - elapsedSecs;
  const pct = elapsedSecs / totalSecs;
  if (pct >= 1.15) return { level: 'ueberfaellig', secsLeft, totalSecs };
  if (pct >= 0.9)  return { level: 'kritisch',     secsLeft, totalSecs };
  if (pct >= 0.7)  return { level: 'bald',         secsLeft, totalSecs };
  return { level: 'ok', secsLeft, totalSecs };
}

function formatCountdown(secs: number): string {
  if (secs <= 0) {
    const over = Math.abs(Math.round(secs));
    return `-${Math.floor(over / 60)}:${String(over % 60).padStart(2, '0')}`;
  }
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MiniProgressRing({ pct, level, size = 44 }: { pct: number; level: UrgencyLevel; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct)) * circ;
  const strokeColor = level === 'ok' ? '#22c55e' : level === 'bald' ? '#f59e0b' : level === 'kritisch' ? '#f97316' : level === 'ueberfaellig' ? '#ef4444' : '#4d7c0f';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={strokeColor} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
    </svg>
  );
}

const URGENCY_ORDER: UrgencyLevel[] = ['ueberfaellig', 'kritisch', 'bald', 'ok', 'fertig'];

export function KitchenSmartKochstartLiveMatrix({
  orders,
  timings,
  maxRows = 8,
}: {
  orders: Order[];
  timings: KitchenTiming[];
  maxRows?: number;
}) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeOrders = orders.filter(o => ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));
  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const sorted = [...activeOrders]
    .map(o => {
      const timing = timingMap.get(o.id);
      const { level, secsLeft, totalSecs } = computeUrgency(o, timing, nowMs);
      const pct = timing?.cook_start_at
        ? 1 - Math.max(0, secsLeft) / totalSecs
        : Math.min(1, 1 - Math.max(0, secsLeft) / totalSecs);
      return { o, timing, level, secsLeft, totalSecs, pct };
    })
    .sort((a, b) => URGENCY_ORDER.indexOf(a.level) - URGENCY_ORDER.indexOf(b.level))
    .slice(0, maxRows);

  const counts = sorted.reduce((acc, { level }) => { acc[level] = (acc[level] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const urgentCount = (counts.ueberfaellig ?? 0) + (counts.kritisch ?? 0);

  async function handleStartCooking(timingId: string) {
    setPending(p => new Set(p).add(timingId));
    await startCookingNow(timingId);
    setPending(p => { const n = new Set(p); n.delete(timingId); return n; });
  }
  async function handleMarkReady(timingId: string) {
    setPending(p => new Set(p).add(timingId));
    await markTimingReady(timingId);
    setPending(p => { const n = new Set(p); n.delete(timingId); return n; });
  }

  if (activeOrders.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-sm text-gray-800">Smart-Timing Matrix</span>
          {urgentCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
              {urgentCount} dringend
            </span>
          )}
        </div>
        <div className="flex gap-2 text-[10px]">
          {Object.entries(URGENCY_META).map(([lvl, meta]) => (
            counts[lvl] ? (
              <span key={lvl} className={cn('px-2 py-0.5 rounded-full font-semibold', meta.badge)}>
                {counts[lvl]} {meta.label}
              </span>
            ) : null
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map(({ o, timing, level, secsLeft, pct }) => {
          const meta = URGENCY_META[level];
          const Icon = meta.icon;
          const canStart = o.status === 'bestätigt' && timing && timing.status === 'scheduled';
          const canReady = o.status === 'in_zubereitung' && timing && timing.status === 'cooking';
          const isPending = timing && pending.has(timing.id);

          return (
            <div key={o.id} className={cn('flex items-center gap-3 p-3 rounded-xl border transition-all', meta.bg, meta.border)}>
              <MiniProgressRing pct={pct} level={level} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs font-bold text-gray-700">#{o.bestellnummer}</span>
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', meta.badge)}>
                    <Icon className="w-2.5 h-2.5 inline mr-0.5" />{meta.label}
                  </span>
                  {o.typ === 'lieferung' && <span className="text-[10px] text-blue-600 font-semibold">Liefer</span>}
                </div>
                <p className="text-xs text-gray-600 truncate">{o.kunde_name} · {o.items.slice(0, 2).map(i => `${i.menge}× ${i.name}`).join(', ')}{o.items.length > 2 ? ` +${o.items.length - 2}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0 min-w-[52px]">
                <span className={cn('font-mono text-base font-bold tabular-nums',
                  level === 'ueberfaellig' ? 'text-red-600' :
                  level === 'kritisch' ? 'text-orange-600' :
                  level === 'bald' ? 'text-amber-600' :
                  level === 'fertig' ? 'text-matcha-600' : 'text-green-600')}>
                  {level === 'fertig' ? '✓' : formatCountdown(secsLeft)}
                </span>
              </div>
              {(canStart || canReady) && (
                <button
                  disabled={!!isPending}
                  onClick={() => canStart && timing ? handleStartCooking(timing.id) : timing ? handleMarkReady(timing.id) : undefined}
                  className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 disabled:opacity-50',
                    canStart ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-matcha-500 hover:bg-matcha-600 text-white')}>
                  {isPending ? '…' : canStart ? <><Play className="w-3 h-3" />Start</> : <>✓ Fertig</>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
