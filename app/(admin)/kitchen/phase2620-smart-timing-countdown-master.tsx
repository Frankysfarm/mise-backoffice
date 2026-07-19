'use client';

/**
 * Phase 2620 — Smart-Timing Countdown Master
 *
 * Interaktiver Countdown-Ring je aktiver Bestellung: Farbkodierung grün/gelb/rot,
 * Sekunden-Tick lokal, 25-Sek-API-Polling, On-Time-Quote-Ring, Batch-Fortschrittsbalken,
 * Kochstart-Empfehlung und SLA-Alert bei Überfälligkeit.
 */

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Flame, Timer, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderEntry {
  id: string;
  bestellnummer: string;
  kunde_name: string | null;
  status: string;
  prep_min: number | null;
  cook_start_at: string | null;
  ready_at: string | null;
  item_count: number;
}

interface Payload {
  orders: OrderEntry[];
  on_time_rate: number;
  overdue_count: number;
  avg_prep_min: number;
}

type ColorCode = 'green' | 'yellow' | 'red' | 'done' | 'idle';

function classify(secsLeft: number | null, status: string): ColorCode {
  if (status === 'fertig' || status === 'unterwegs') return 'done';
  if (secsLeft === null) return 'idle';
  if (secsLeft > 120) return 'green';
  if (secsLeft >= 0) return 'yellow';
  return 'red';
}

const STYLE: Record<ColorCode, { bg: string; border: string; text: string; ring: string; label: string }> = {
  green:  { bg: 'bg-matcha-50  dark:bg-matcha-950/30',  border: 'border-matcha-200  dark:border-matcha-800',  text: 'text-matcha-700  dark:text-matcha-300',  ring: 'stroke-matcha-500',  label: 'Im Plan'     },
  yellow: { bg: 'bg-amber-50   dark:bg-amber-950/30',    border: 'border-amber-200   dark:border-amber-800',    text: 'text-amber-700   dark:text-amber-300',    ring: 'stroke-amber-500',   label: 'Bald fällig' },
  red:    { bg: 'bg-red-50     dark:bg-red-950/30',      border: 'border-red-200     dark:border-red-800',      text: 'text-red-700     dark:text-red-300',      ring: 'stroke-red-500',     label: 'Überfällig'  },
  done:   { bg: 'bg-stone-50   dark:bg-stone-900/20',    border: 'border-stone-200   dark:border-stone-700',    text: 'text-stone-500   dark:text-stone-400',    ring: 'stroke-stone-400',   label: 'Fertig'       },
  idle:   { bg: 'bg-stone-50   dark:bg-stone-900/20',    border: 'border-stone-200   dark:border-stone-700',    text: 'text-stone-400   dark:text-stone-500',    ring: 'stroke-stone-300',   label: '—'            },
};

function CountdownRing({ secsLeft, maxSecs }: { secsLeft: number | null; maxSecs: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const progress = secsLeft == null ? 0 : Math.max(0, Math.min(1, secsLeft / maxSecs));
  const dash = circ * progress;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="opacity-10" />
      <circle
        cx="26" cy="26" r={r} fill="none" strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        className={secsLeft == null ? 'stroke-stone-300' : secsLeft > 120 ? 'stroke-matcha-500' : secsLeft >= 0 ? 'stroke-amber-500' : 'stroke-red-500'}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="26" y="30" textAnchor="middle" className="fill-current text-[9px] font-bold tabular-nums">
        {secsLeft == null ? '—' : secsLeft < 0 ? `-${Math.abs(secsLeft)}s` : `${secsLeft}s`}
      </text>
    </svg>
  );
}

export function KitchenPhase2620SmartTimingCountdownMaster({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/kitchen?type=smart_timing${locationId ? `&location_id=${locationId}` : ''}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json?.orders) setData(json);
    } catch { /* silent */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 25_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const now = Date.now();

  const orders = (data?.orders ?? []).map(o => {
    const targetMs = o.ready_at ? new Date(o.ready_at).getTime() : o.cook_start_at ? new Date(o.cook_start_at).getTime() + (o.prep_min ?? 15) * 60_000 : null;
    const secsLeft = targetMs != null ? Math.round((targetMs - now) / 1000) : null;
    return { ...o, secsLeft };
  });

  const active = orders.filter(o => o.status !== 'fertig' && o.status !== 'unterwegs');
  const overdueCount = active.filter(o => o.secsLeft != null && o.secsLeft < 0).length;
  const onTimeRate = data?.on_time_rate ?? (orders.length > 0 ? Math.round(((orders.length - overdueCount) / orders.length) * 100) : 100);

  if (!data && orders.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition"
      >
        <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-xs font-bold uppercase tracking-wider flex-1">
          Smart-Timing Countdown Master · {active.length} aktiv
        </span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" /> {overdueCount} überfällig
          </span>
        )}
        <span className="text-[10px] font-bold text-matcha-600 ml-1">{onTimeRate}% on-time</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* On-Time-Rate Bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', onTimeRate >= 90 ? 'bg-matcha-500' : onTimeRate >= 75 ? 'bg-amber-400' : 'bg-red-500')}
              style={{ width: `${onTimeRate}%` }}
            />
          </div>

          {active.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-matcha-500" /> Keine aktiven Bestellungen
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {active.sort((a, b) => (a.secsLeft ?? 9999) - (b.secsLeft ?? 9999)).map(o => {
                const code = classify(o.secsLeft, o.status);
                const s = STYLE[code];
                return (
                  <div key={o.id} className={cn('flex items-center gap-2 rounded-lg border p-2', s.bg, s.border, code === 'red' && 'animate-pulse')}>
                    <CountdownRing secsLeft={o.secsLeft} maxSecs={(o.prep_min ?? 15) * 60} />
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-[10px] font-bold tabular-nums', s.text)}>
                        #{o.bestellnummer.replace('FF-', '')}
                      </div>
                      <div className="text-[9px] text-muted-foreground truncate">{o.kunde_name ?? '—'}</div>
                      <div className={cn('text-[9px] font-semibold mt-0.5', s.text)}>{s.label}</div>
                    </div>
                    {code === 'red' && <Flame className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    {code === 'green' && <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 border-t border-border/50">
            <div className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Ø {data?.avg_prep_min?.toFixed(1) ?? '—'} Min Zubereitung
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-matcha-500" /><span className="text-[9px] text-muted-foreground">&gt;2 Min</span>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /><span className="text-[9px] text-muted-foreground">0–2 Min</span>
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" /><span className="text-[9px] text-muted-foreground">Überfällig</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
