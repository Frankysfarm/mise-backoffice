'use client';

/**
 * Phase 2600 — Smart-Timing Countdown Kommandant
 *
 * Konsolidiertes Cockpit: Farbkodierter Countdown je aktiver Bestellung
 * (grün ≥2 Min, gelb 0–2 Min, rot überfällig) + On-Time-Quote +
 * Schicht-Timing-Score. Sekunden-Update lokal, 30-Sek-API-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Flame, Timer, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveOrder {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  prep_min: number | null;
  cook_start_at: string | null;
  ready_target: string | null;
  item_count: number;
}

interface TimingPayload {
  orders: ActiveOrder[];
  on_time_quote: number;
  avg_prep_min: number;
  overdue_count: number;
}

type Color = 'green' | 'yellow' | 'red' | 'done' | 'idle';

function classify(secsLeft: number | null, status: string): Color {
  if (status === 'ready' || status === 'picked_up') return 'done';
  if (secsLeft === null) return 'idle';
  if (secsLeft > 120) return 'green';
  if (secsLeft >= 0) return 'yellow';
  return 'red';
}

const PALETTE: Record<Color, { bg: string; border: string; text: string; badge: string; label: string }> = {
  green:  { bg: 'bg-matcha-50  dark:bg-matcha-950/30',  border: 'border-matcha-200 dark:border-matcha-800',  text: 'text-matcha-700  dark:text-matcha-300',  badge: 'bg-matcha-100  text-matcha-700',  label: 'Im Plan'    },
  yellow: { bg: 'bg-amber-50   dark:bg-amber-950/30',    border: 'border-amber-200  dark:border-amber-800',    text: 'text-amber-700  dark:text-amber-300',    badge: 'bg-amber-100   text-amber-700',   label: 'Bald fällig' },
  red:    { bg: 'bg-red-50     dark:bg-red-950/30',      border: 'border-red-200    dark:border-red-800',      text: 'text-red-700    dark:text-red-300',      badge: 'bg-red-100     text-red-700',     label: 'Überfällig'  },
  done:   { bg: 'bg-stone-50   dark:bg-stone-900/20',    border: 'border-stone-200  dark:border-stone-700',    text: 'text-stone-500  dark:text-stone-400',    badge: 'bg-stone-100   text-stone-500',   label: 'Fertig'      },
  idle:   { bg: 'bg-stone-50   dark:bg-stone-900/20',    border: 'border-stone-200  dark:border-stone-700',    text: 'text-stone-400  dark:text-stone-500',    badge: 'bg-stone-100   text-stone-400',   label: '—'           },
};

function secsLeft(readyTarget: string | null): number | null {
  if (!readyTarget) return null;
  return Math.floor((new Date(readyTarget).getTime() - Date.now()) / 1000);
}

function CountdownBadge({ secs, color }: { secs: number | null; color: Color }) {
  if (color === 'done') return <CheckCircle2 className="w-4 h-4 text-matcha-500" />;
  if (secs === null) return <span className="font-mono text-xs text-stone-400">—</span>;
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return (
    <span className={cn('font-mono text-sm font-black tabular-nums', PALETTE[color].text)}>
      {sign}{m}:{String(s).padStart(2, '0')}
    </span>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 85 ? '#6a9e5f' : score >= 65 ? '#f59e0b' : '#ef4444';
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <div className="relative" style={{ width: 52, height: 52 }}>
      <svg width={52} height={52}>
        <circle cx={26} cy={26} r={r} fill="none" stroke="#e7e5e4" strokeWidth={5} />
        <circle
          cx={26} cy={26} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 26 26)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-black leading-none" style={{ color }}>{score}</span>
        <span className="text-[7px] text-stone-400 leading-none">Score</span>
      </div>
    </div>
  );
}

export function KitchenPhase2600SmartTimingCountdownKommandant({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [payload, setPayload] = useState<TimingPayload | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-timing-status?location_id=${locationId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setPayload(d))
      .catch(() => null);
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  const orders = payload?.orders ?? [];
  const active = orders.filter(o => o.status !== 'storniert');
  const cooking = active.filter(o => o.status === 'in_zubereitung' || o.status === 'cooking' || o.status === 'scheduled');
  const ready = active.filter(o => o.status === 'fertig' || o.status === 'ready');
  const overdueCount = cooking.filter(o => (secsLeft(o.ready_target) ?? 1) <= 0).length;
  const onTime = payload?.on_time_quote ?? 0;
  const timingScore = Math.round(onTime);
  const hasAlert = overdueCount > 0;

  return (
    <div className={cn(
      'rounded-2xl border shadow-sm mb-4 overflow-hidden',
      hasAlert ? 'border-red-200 dark:border-red-800' : 'border-stone-200 dark:border-stone-700',
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-stone-900 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
            hasAlert ? 'bg-red-100 dark:bg-red-900/40' : 'bg-matcha-100 dark:bg-matcha-900/40',
          )}>
            {hasAlert
              ? <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              : <Timer className="w-4 h-4 text-matcha-700 dark:text-matcha-400" />}
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800 dark:text-stone-100">
              Smart-Timing Countdown
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {cooking.length} in Zubereitung · {ready.length} fertig
              {hasAlert && <span className="ml-1.5 font-semibold text-red-600 dark:text-red-400">· {overdueCount} überfällig</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {payload && <ScoreGauge score={timingScore} />}
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {/* KPI strip */}
      {open && (
        <div className="border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 grid grid-cols-3 divide-x divide-stone-200 dark:divide-stone-700">
          {[
            { icon: <Zap className="w-3 h-3" />, label: 'On-Time', value: `${onTime.toFixed(0)}%`, ok: onTime >= 85 },
            { icon: <Clock className="w-3 h-3" />, label: 'Ø Prep', value: `${(payload?.avg_prep_min ?? 0).toFixed(0)} Min`, ok: (payload?.avg_prep_min ?? 0) <= 15 },
            { icon: <Flame className="w-3 h-3" />, label: 'Überfällig', value: String(overdueCount), ok: overdueCount === 0 },
          ].map(kpi => (
            <div key={kpi.label} className="flex flex-col items-center py-2 gap-0.5">
              <div className={cn('flex items-center gap-1 text-[10px] font-semibold', kpi.ok ? 'text-matcha-600 dark:text-matcha-400' : 'text-red-600 dark:text-red-400')}>
                {kpi.icon}{kpi.label}
              </div>
              <div className={cn('text-sm font-black tabular-nums', kpi.ok ? 'text-stone-800 dark:text-stone-100' : 'text-red-700 dark:text-red-300')}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order countdown grid */}
      {open && (
        <div className="p-3 bg-white dark:bg-stone-900 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cooking.length === 0 && ready.length === 0 && (
            <div className="col-span-2 text-center py-6 text-stone-400 dark:text-stone-500 text-sm">
              Keine aktiven Bestellungen
            </div>
          )}
          {[...cooking, ...ready].map(order => {
            const s = secsLeft(order.ready_target);
            const col = classify(s, order.status === 'fertig' || order.status === 'ready' ? 'ready' : order.status);
            const p = PALETTE[col];
            return (
              <div
                key={order.id}
                className={cn('rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2', p.bg, p.border)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', p.badge)}>{p.label}</span>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 truncate">#{order.bestellnummer}</span>
                  </div>
                  <div className="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">{order.kunde_name}</div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">{order.item_count} Artikel</div>
                </div>
                <div className="shrink-0 text-right">
                  <CountdownBadge secs={s} color={col} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
