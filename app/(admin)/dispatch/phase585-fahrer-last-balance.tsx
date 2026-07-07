'use client';

/**
 * Phase 585 — Dispatch: Fahrer-Last-Balance-Kommando
 *
 * Zeigt welcher Fahrer aktuell die meisten offenen Stopps hat.
 * Empfiehlt Umverteilung wenn Ungleichgewicht > 3 Stopps zwischen
 * dem am stärksten und am schwächsten belasteten Fahrer.
 *
 * Ticker: 30s
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronDown, ChevronUp, Scale, TrendingDown, TrendingUp } from 'lucide-react';

interface BatchStop {
  status?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  driver_id?: string | null;
  zone?: string | null;
  stops?: BatchStop[] | null;
  tour_stops?: BatchStop[] | null;
}

interface Driver {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  name?: string | null;
  status?: string | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

const ACTIVE_BATCH_STATUSES  = new Set(['pending', 'active', 'in_progress', 'on_the_way', 'assigned']);
const ACTIVE_DRIVER_STATUSES = new Set(['online', 'busy', 'on_delivery']);
const PENDING_STOP_STATUSES  = new Set([undefined, null, 'pending', 'assigned']);

interface DriverLoad {
  driverId: string;
  name: string;
  openStops: number;
  batchCount: number;
}

function driverName(d: Driver): string {
  if (d.name) return d.name;
  return [d.vorname, d.nachname].filter(Boolean).join(' ') || `Fahrer ${d.id.slice(-4)}`;
}

function countOpenStops(batch: Batch): number {
  const stops = batch.stops ?? batch.tour_stops ?? [];
  return stops.filter(s => PENDING_STOP_STATUSES.has(s.status as string | null | undefined)).length;
}

export function DispatchPhase585FahrerLastBalance({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { loads, imbalance, recommendation } = useMemo(() => {
    const activeBatches = batches.filter(b => ACTIVE_BATCH_STATUSES.has(b.status ?? ''));
    const activeDriverIds = new Set(
      drivers.filter(d => ACTIVE_DRIVER_STATUSES.has(d.status ?? '')).map(d => d.id),
    );

    const loadMap = new Map<string, DriverLoad>();

    for (const b of activeBatches) {
      if (!b.driver_id) continue;
      const existing = loadMap.get(b.driver_id);
      const open = countOpenStops(b);
      if (existing) {
        existing.openStops += open;
        existing.batchCount += 1;
      } else {
        const drv = drivers.find(d => d.id === b.driver_id);
        loadMap.set(b.driver_id, {
          driverId: b.driver_id,
          name: drv ? driverName(drv) : `Fahrer ${b.driver_id.slice(-4)}`,
          openStops: open,
          batchCount: 1,
        });
      }
    }

    // Include online drivers with 0 stops
    for (const drv of drivers) {
      if (activeDriverIds.has(drv.id) && !loadMap.has(drv.id)) {
        loadMap.set(drv.id, {
          driverId: drv.id,
          name: driverName(drv),
          openStops: 0,
          batchCount: 0,
        });
      }
    }

    const loads = Array.from(loadMap.values()).sort((a, b) => b.openStops - a.openStops);

    if (loads.length < 2) {
      return { loads, imbalance: 0, recommendation: null };
    }

    const max = loads[0].openStops;
    const min = loads[loads.length - 1].openStops;
    const imbalance = max - min;

    const recommendation = imbalance > 3
      ? `Umverteilung: ${loads[loads.length - 1].name} hat nur ${min} Stopp${min !== 1 ? 's' : ''} — ${loads[0].name} hat ${max}`
      : null;

    return { loads, imbalance, recommendation };
  }, [batches, drivers, tick]);

  if (loads.length === 0) return null;

  const maxStops = Math.max(1, loads[0]?.openStops ?? 1);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Scale className={cn('h-4 w-4', imbalance > 3 ? 'text-amber-600' : 'text-matcha-600')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Last-Balance</span>
          <Badge className={cn(
            'text-[10px] px-2 py-0.5',
            imbalance > 3 ? 'bg-amber-500 text-white' : 'bg-matcha-500 text-white',
          )}>
            Δ {imbalance} Stopps
          </Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className={cn(
          'border-t px-4 py-3 space-y-3',
          imbalance > 3 ? 'bg-amber-50' : 'bg-matcha-50/40',
        )}>
          {/* Recommendation banner */}
          {recommendation && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-xs font-bold text-amber-700">{recommendation}</span>
            </div>
          )}

          {/* Driver load rows */}
          <div className="space-y-2">
            {loads.map((load, idx) => {
              const barPct = maxStops > 0 ? Math.round((load.openStops / maxStops) * 100) : 0;
              const isHeaviest = idx === 0 && imbalance > 3;
              const isLightest = idx === loads.length - 1 && imbalance > 3 && loads.length > 1;
              return (
                <div key={load.driverId} className="flex items-center gap-2">
                  {/* Rank */}
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                    isHeaviest ? 'bg-amber-500 text-white' : isLightest ? 'bg-matcha-500 text-white' : 'bg-muted text-muted-foreground',
                  )}>
                    {idx + 1}
                  </div>

                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn('text-xs font-bold truncate', isHeaviest ? 'text-amber-700' : 'text-foreground')}>
                        {load.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {isHeaviest && <TrendingUp className="h-3 w-3 text-amber-500" />}
                        {isLightest && loads.length > 1 && <TrendingDown className="h-3 w-3 text-matcha-500" />}
                        <span className={cn(
                          'text-xs font-black tabular-nums',
                          isHeaviest ? 'text-amber-700' : isLightest ? 'text-matcha-700' : 'text-foreground',
                        )}>
                          {load.openStops}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          isHeaviest ? 'bg-amber-400' : isLightest ? 'bg-matcha-500' : 'bg-slate-400',
                        )}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Batches */}
                  <div className="shrink-0 text-right">
                    <div className="text-[9px] text-muted-foreground tabular-nums">{load.batchCount} Tour{load.batchCount !== 1 ? 'en' : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {!recommendation && (
            <div className="text-center text-[10px] text-muted-foreground">
              Last gleichmäßig verteilt ✓
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
