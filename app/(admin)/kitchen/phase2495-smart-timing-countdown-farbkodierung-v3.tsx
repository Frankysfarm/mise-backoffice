'use client';

/**
 * Phase 2495 — Smart-Timing Countdown Farbkodierung Cockpit V3
 * Echtzeit-Countdown je Bestellung (grün/gelb/rot), On-Time-Quote,
 * Batch-Fortschrittsbalken, Alarm bei Überfälligkeit. 30-Sek-Polling.
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, CheckCircle2, Flame, Timer } from 'lucide-react';

interface OrderTiming {
  id: string;
  nummer: string;
  status: string;
  bestellt_am: string;
  ziel_min: number;
  items_count: number;
}

function remainingMin(bestellt_am: string, ziel_min: number): number {
  const elapsed = (Date.now() - new Date(bestellt_am).getTime()) / 60_000;
  return Math.round(ziel_min - elapsed);
}

function ampelColor(rem: number) {
  if (rem > 10) return { ring: '#22c55e', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600', label: 'OK' };
  if (rem > 3) return { ring: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600', label: 'BALD' };
  return { ring: '#ef4444', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600', label: 'DRINGEND' };
}

function CountdownRing({ rem, ziel }: { rem: number; ziel: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, rem / ziel));
  const offset = circ * (1 - pct);
  const col = ampelColor(rem);
  const absRem = Math.abs(rem);
  const isOver = rem <= 0;
  return (
    <svg width={50} height={50} className="shrink-0">
      <circle cx={25} cy={25} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={25} cy={25} r={r} fill="none"
        stroke={col.ring} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 25 25)"
        className="transition-all duration-1000"
      />
      <text
        x={25} y={22} textAnchor="middle" fontSize={10} fontWeight="900"
        fill={col.ring} fontFamily="monospace"
      >
        {isOver ? '+' : ''}{absRem}
      </text>
      <text x={25} y={33} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="sans-serif">
        min
      </text>
    </svg>
  );
}

export function KitchenPhase2495SmartTimingCountdownFarbkodierungV3({
  locationId,
}: {
  locationId?: string;
}) {
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from('customer_orders')
      .select('id, nummer, status, bestellt_am, items:order_items(id)')
      .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
      .order('bestellt_am', { ascending: true })
      .limit(12);

    if (data) {
      setOrders(data.map((o: any) => ({
        id: o.id,
        nummer: o.nummer ?? o.id.slice(-4),
        status: o.status,
        bestellt_am: o.bestellt_am,
        ziel_min: o.status === 'fertig' ? 30 : o.status === 'in_zubereitung' ? 25 : 30,
        items_count: (o.items ?? []).length,
      })));
    }
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    const pollIv = setInterval(load, 30_000);
    const tickIv = setInterval(() => setTick(t => t + 1), 10_000);
    return () => {
      clearInterval(pollIv);
      clearInterval(tickIv);
    };
  }, [load]);

  const active = orders.filter(o => o.status !== 'fertig');
  const done = orders.filter(o => o.status === 'fertig');
  const overdue = active.filter(o => remainingMin(o.bestellt_am, o.ziel_min) <= 0);
  const onTime = active.length > 0
    ? Math.round(((active.length - overdue.length) / active.length) * 100)
    : 100;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing · Countdown</span>
        </div>
        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {overdue.length} überfällig
            </span>
          )}
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black',
            onTime >= 85 ? 'bg-emerald-100 text-emerald-700' :
            onTime >= 65 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          )}>
            {onTime}% On-Time
          </span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 divide-x border-b text-center">
        <div className="py-2 px-3">
          <div className="text-base font-black text-emerald-600 tabular-nums">
            {active.filter(o => remainingMin(o.bestellt_am, o.ziel_min) > 10).length}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Grün</div>
        </div>
        <div className="py-2 px-3">
          <div className="text-base font-black text-amber-500 tabular-nums">
            {active.filter(o => { const r = remainingMin(o.bestellt_am, o.ziel_min); return r > 3 && r <= 10; }).length}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Gelb</div>
        </div>
        <div className="py-2 px-3">
          <div className="text-base font-black text-red-600 tabular-nums">
            {active.filter(o => remainingMin(o.bestellt_am, o.ziel_min) <= 3).length}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Rot</div>
        </div>
      </div>

      {/* Order list */}
      <div className="divide-y max-h-[340px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" /> Lade…
          </div>
        ) : active.length === 0 && done.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-matcha-500" /> Keine offenen Bestellungen
          </div>
        ) : (
          <>
            {active.map(o => {
              const rem = remainingMin(o.bestellt_am, o.ziel_min);
              const col = ampelColor(rem);
              return (
                <div key={o.id} className={cn('flex items-center gap-3 px-4 py-2.5', col.bg)}>
                  <CountdownRing rem={rem} ziel={o.ziel_min} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold">#{o.nummer}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', col.text, 'bg-white/60')}>
                        {col.label}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{o.items_count} Pos.</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {o.status === 'in_zubereitung' ? (
                        <><Flame className="h-3 w-3 text-orange-400" /> In Zubereitung</>
                      ) : o.status === 'fertig' ? (
                        <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Fertig</>
                      ) : (
                        <><Clock className="h-3 w-3" /> Bestätigt</>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-1000',
                          rem > 10 ? 'bg-emerald-400' : rem > 3 ? 'bg-amber-400' : 'bg-red-500'
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, (rem / o.ziel_min) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {done.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] text-emerald-700 font-semibold">
                  {done.length} Bestellung{done.length > 1 ? 'en' : ''} fertig · warten auf Fahrer
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
