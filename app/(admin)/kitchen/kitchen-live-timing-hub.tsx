'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Flame, Timer, TrendingUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  name: string;
  menge: number;
}

interface LiveOrder {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  items: OrderItem[];
}

interface KitchenTiming {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: LiveOrder[];
  timings?: KitchenTiming[];
}

type UrgencyLevel = 'ok' | 'knapp' | 'kritisch' | 'ueberfaellig' | 'fertig';

interface OrderTiming {
  order: LiveOrder;
  timing?: KitchenTiming;
  urgency: UrgencyLevel;
  elapsedMs: number;
  remainMs: number | null;
  targetMin: number;
  progressPct: number;
}

function calcUrgency(
  order: LiveOrder,
  timing: KitchenTiming | undefined,
  now: number,
): { urgency: UrgencyLevel; elapsedMs: number; remainMs: number | null; targetMin: number; progressPct: number } {
  if (order.status === 'fertig' || order.status === 'unterwegs' || order.status === 'geliefert') {
    return { urgency: 'fertig', elapsedMs: 0, remainMs: null, targetMin: 0, progressPct: 100 };
  }

  const startMs = timing?.cook_start_at
    ? new Date(timing.cook_start_at).getTime()
    : order.bestellt_am
      ? new Date(order.bestellt_am).getTime()
      : now;

  const elapsedMs = now - startMs;
  const targetMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;
  const targetMs = targetMin * 60_000;
  const progressPct = Math.min(100, (elapsedMs / targetMs) * 100);

  let remainMs: number | null = null;
  if (timing?.ready_target) {
    remainMs = new Date(timing.ready_target).getTime() - now;
  } else {
    remainMs = targetMs - elapsedMs;
  }

  let urgency: UrgencyLevel;
  if (remainMs !== null && remainMs < -120_000) urgency = 'ueberfaellig';
  else if (remainMs !== null && remainMs < 60_000) urgency = 'kritisch';
  else if (progressPct >= 75) urgency = 'knapp';
  else urgency = 'ok';

  return { urgency, elapsedMs, remainMs, targetMin, progressPct };
}

const URGENCY_STYLES: Record<UrgencyLevel, { ring: string; bg: string; label: string; labelBg: string; text: string }> = {
  ok: {
    ring: 'ring-green-300',
    bg: 'bg-green-50',
    label: 'Im Plan',
    labelBg: 'bg-green-100 text-green-700',
    text: 'text-green-700',
  },
  knapp: {
    ring: 'ring-amber-300',
    bg: 'bg-amber-50',
    label: 'Knapp',
    labelBg: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
  },
  kritisch: {
    ring: 'ring-orange-400',
    bg: 'bg-orange-50',
    label: 'Kritisch',
    labelBg: 'bg-orange-100 text-orange-700',
    text: 'text-orange-700',
  },
  ueberfaellig: {
    ring: 'ring-red-500',
    bg: 'bg-red-50',
    label: 'Überfällig',
    labelBg: 'bg-red-100 text-red-700',
    text: 'text-red-700',
  },
  fertig: {
    ring: 'ring-matcha-400',
    bg: 'bg-matcha-50',
    label: 'Fertig',
    labelBg: 'bg-matcha-100 text-matcha-700',
    text: 'text-matcha-700',
  },
};

const PROGRESS_COLOR: Record<UrgencyLevel, string> = {
  ok: 'bg-green-500',
  knapp: 'bg-amber-400',
  kritisch: 'bg-orange-500',
  ueberfaellig: 'bg-red-500',
  fertig: 'bg-matcha-500',
};

function formatMs(ms: number): string {
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const sign = ms < 0 ? '+' : '';
  return `${sign}${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function CountdownRing({ pct, urgency }: { pct: number; urgency: UrgencyLevel }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  const color =
    urgency === 'fertig' ? '#22c55e'
    : urgency === 'ok' ? '#22c55e'
    : urgency === 'knapp' ? '#f59e0b'
    : urgency === 'kritisch' ? '#f97316'
    : '#ef4444';

  return (
    <svg width="42" height="42" viewBox="0 0 42 42" className="shrink-0">
      <circle cx="21" cy="21" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="21" cy="21" r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={dash}
        strokeLinecap="round"
        transform="rotate(-90 21 21)"
        className="transition-all duration-1000"
      />
    </svg>
  );
}

function OrderTile({ ot }: { ot: OrderTiming }) {
  const styles = URGENCY_STYLES[ot.urgency];
  const isFertig = ot.urgency === 'fertig';
  const isUeberfaellig = ot.urgency === 'ueberfaellig';

  return (
    <div className={cn(
      'rounded-xl ring-2 p-3 flex flex-col gap-2 transition-all',
      styles.ring,
      styles.bg,
      isUeberfaellig && 'animate-pulse',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-foreground">#{ot.order.bestellnummer}</div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">{ot.order.kunde_name}</div>
        </div>
        <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0', styles.labelBg)}>
          {styles.label}
        </span>
      </div>

      {/* Ring + Timer */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <CountdownRing pct={ot.progressPct} urgency={ot.urgency} />
          {isFertig && (
            <CheckCircle2 className="h-4 w-4 text-matcha-600 absolute inset-0 m-auto" />
          )}
        </div>
        <div className="flex-1">
          {isFertig ? (
            <div className="text-xs font-bold text-matcha-600">Fertig ✓</div>
          ) : ot.remainMs !== null ? (
            <div>
              <div className={cn(
                'text-lg font-black tabular-nums leading-none',
                ot.remainMs < 0 ? 'text-red-600' : styles.text,
              )}>
                {formatMs(ot.remainMs)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                verbleibend
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      {!isFertig && (
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', PROGRESS_COLOR[ot.urgency])}
            style={{ width: `${ot.progressPct}%` }}
          />
        </div>
      )}

      {/* Items preview */}
      {ot.order.items.length > 0 && (
        <div className="text-[10px] text-muted-foreground truncate">
          {ot.order.items.slice(0, 2).map((it, i) => (
            <span key={i}>{i > 0 && ' · '}{it.menge}× {it.name}</span>
          ))}
          {ot.order.items.length > 2 && ` +${ot.order.items.length - 2}`}
        </div>
      )}
    </div>
  );
}

export function KitchenLiveTimingHub({ orders, timings = [] }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const active = orders.filter(o =>
    ['neu', 'bestätigt', 'angenommen', 'in_zubereitung', 'fertig'].includes(o.status)
  );

  const computed: OrderTiming[] = active.map(o => {
    const timing = timingMap.get(o.id);
    const calc = calcUrgency(o, timing, now);
    return { order: o, timing, ...calc };
  });

  // Sort: critical first, then by progress
  computed.sort((a, b) => {
    const urgPrio: Record<UrgencyLevel, number> = {
      ueberfaellig: 0, kritisch: 1, knapp: 2, ok: 3, fertig: 4,
    };
    const pA = urgPrio[a.urgency];
    const pB = urgPrio[b.urgency];
    if (pA !== pB) return pA - pB;
    return b.progressPct - a.progressPct;
  });

  const counts = {
    ueberfaellig: computed.filter(o => o.urgency === 'ueberfaellig').length,
    kritisch: computed.filter(o => o.urgency === 'kritisch').length,
    knapp: computed.filter(o => o.urgency === 'knapp').length,
    ok: computed.filter(o => o.urgency === 'ok').length,
    fertig: computed.filter(o => o.urgency === 'fertig').length,
  };

  const avgProgress = computed.length > 0
    ? Math.round(computed.reduce((s, o) => s + o.progressPct, 0) / computed.length)
    : 0;

  const criticalCount = counts.ueberfaellig + counts.kritisch;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white',
      )}>
        <div className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
          criticalCount > 0 ? 'bg-red-100' : 'bg-matcha-100',
        )}>
          {criticalCount > 0
            ? <Flame className="h-4 w-4 text-red-600" />
            : <Timer className="h-4 w-4 text-matcha-600" />}
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-wider">Live Timing Hub</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            ⌀ Fortschritt: {avgProgress}% · {active.length} aktiv
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5">
          {counts.ueberfaellig > 0 && (
            <Badge className="h-5 text-[9px] bg-red-500 text-white border-0 px-1.5 gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />{counts.ueberfaellig}
            </Badge>
          )}
          {counts.kritisch > 0 && (
            <Badge className="h-5 text-[9px] bg-orange-500 text-white border-0 px-1.5 gap-0.5">
              <Zap className="h-2.5 w-2.5" />{counts.kritisch}
            </Badge>
          )}
          {counts.fertig > 0 && (
            <Badge className="h-5 text-[9px] bg-matcha-500 text-white border-0 px-1.5 gap-0.5">
              <CheckCircle2 className="h-2.5 w-2.5" />{counts.fertig}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary row */}
      {computed.length > 0 && (
        <div className="flex border-b divide-x text-center">
          {[
            { key: 'ueberfaellig', label: 'Überfällig', color: 'text-red-600', bg: counts.ueberfaellig > 0 ? 'bg-red-50' : '' },
            { key: 'kritisch', label: 'Kritisch', color: 'text-orange-600', bg: counts.kritisch > 0 ? 'bg-orange-50' : '' },
            { key: 'knapp', label: 'Knapp', color: 'text-amber-600', bg: '' },
            { key: 'ok', label: 'Ok', color: 'text-green-600', bg: '' },
            { key: 'fertig', label: 'Fertig', color: 'text-matcha-600', bg: '' },
          ].map(({ key, label, color, bg }) => (
            <div key={key} className={cn('flex-1 py-1.5', bg)}>
              <div className={cn('text-base font-black tabular-nums leading-none', color)}>
                {counts[key as UrgencyLevel]}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Order grid */}
      {computed.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
          Keine aktiven Bestellungen
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
          {computed.map(ot => <OrderTile key={ot.order.id} ot={ot} />)}
        </div>
      )}

      {/* Footer timing bar */}
      {computed.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Gesamtfortschritt
            </span>
            <span className="font-bold text-foreground">{avgProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                avgProgress >= 90 ? 'bg-matcha-500'
                : avgProgress >= 65 ? 'bg-amber-400'
                : 'bg-blue-400',
              )}
              style={{ width: `${avgProgress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
