'use client';

/**
 * Phase 580 — Dispatch: Zone-Demand-Heatmap-Live
 *
 * Mini-Heatmap der Zonen A/B/C/D nach aktuellem Bestelldruck.
 * Farbkodiert: grün (ruhig) → gelb (mittel) → rot (hoch).
 * Zeigt aktive Bestellungen + unterwegs-Batches je Zone.
 *
 * Ticker: 60s
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Map } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  delivery_zone?: string | null;
  zone?: string | null;
}

interface Stop {
  id: string;
  geliefert_am: string | null;
  order?: { delivery_zone?: string | null } | null;
}

interface Batch {
  id: string;
  status: string;
  zone?: string | null;
  stops: Stop[];
}

interface Props {
  orders?: Order[];
  batches?: Batch[];
}

type ZoneLevel = 'low' | 'medium' | 'high' | 'critical';

const ZONES = ['A', 'B', 'C', 'D'] as const;
type Zone = typeof ZONES[number];

const LEVEL_CFG: Record<ZoneLevel, { label: string; bg: string; border: string; textColor: string; barColor: string }> = {
  low:      { label: 'Ruhig',    bg: 'bg-emerald-50',  border: 'border-emerald-300', textColor: 'text-emerald-700', barColor: 'bg-emerald-400' },
  medium:   { label: 'Mittel',   bg: 'bg-amber-50',    border: 'border-amber-300',   textColor: 'text-amber-700',   barColor: 'bg-amber-400'   },
  high:     { label: 'Hoch',     bg: 'bg-orange-50',   border: 'border-orange-300',  textColor: 'text-orange-700',  barColor: 'bg-orange-500'  },
  critical: { label: 'Kritisch', bg: 'bg-red-50',      border: 'border-red-300',     textColor: 'text-red-700',     barColor: 'bg-red-500'     },
};

function getLevel(demand: number): ZoneLevel {
  if (demand >= 6) return 'critical';
  if (demand >= 4) return 'high';
  if (demand >= 2) return 'medium';
  return 'low';
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'bereit', 'dispatched']);

export function DispatchPhase580ZoneDemandHeatmap({ orders = [], batches = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const zoneData = useMemo(() => {
    const pendingByZone = new Map<Zone, number>();
    const inTransitByZone = new Map<Zone, number>();

    for (const zone of ZONES) {
      pendingByZone.set(zone, 0);
      inTransitByZone.set(zone, 0);
    }

    // Pending orders waiting for dispatch
    for (const o of orders) {
      const z = (o.delivery_zone ?? o.zone ?? '').toUpperCase() as Zone;
      if (ZONES.includes(z) && ACTIVE_STATUSES.has(o.status)) {
        pendingByZone.set(z, (pendingByZone.get(z) ?? 0) + 1);
      }
    }

    // Active batches in transit
    for (const b of batches) {
      if (b.status !== 'unterwegs' && b.status !== 'active' && b.status !== 'dispatched') continue;
      // Use batch zone or infer from stops
      let z = (b.zone ?? '').toUpperCase() as Zone;
      if (!ZONES.includes(z)) {
        // Try to infer from first undelivered stop's order zone
        const firstStop = b.stops.find(s => !s.geliefert_am);
        z = ((firstStop?.order?.delivery_zone ?? '')).toUpperCase() as Zone;
      }
      if (ZONES.includes(z)) {
        inTransitByZone.set(z, (inTransitByZone.get(z) ?? 0) + 1);
      }
    }

    return ZONES.map(zone => {
      const pending   = pendingByZone.get(zone) ?? 0;
      const inTransit = inTransitByZone.get(zone) ?? 0;
      const demand    = pending + inTransit;
      const level     = getLevel(demand);
      return { zone, pending, inTransit, demand, level };
    });
  }, [orders, batches, tick]);

  const maxDemand = Math.max(...zoneData.map(z => z.demand), 1);
  const hotZone = zoneData.reduce((a, b) => b.demand > a.demand ? b : a, zoneData[0]);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Demand Live</span>
          {hotZone.demand > 0 && (
            <Badge className={cn('text-[10px] px-2 py-0.5', LEVEL_CFG[hotZone.level].barColor.replace('bg-', 'bg-'), 'text-white')}>
              Zone {hotZone.zone}: {hotZone.demand}
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-2.5">
          {/* Zone grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {zoneData.map(({ zone, pending, inTransit, demand, level }) => {
              const cfg = LEVEL_CFG[level];
              return (
                <div key={zone} className={cn('rounded-xl border p-3 space-y-2', cfg.bg, cfg.border)}>
                  <div className="flex items-center justify-between">
                    <span className={cn('font-display text-base font-black', cfg.textColor)}>Zone {zone}</span>
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full text-white', cfg.barColor)}>{cfg.label}</span>
                  </div>
                  {/* Demand bar */}
                  <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', cfg.barColor)}
                      style={{ width: `${Math.min(100, (demand / maxDemand) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{pending} wartend</span>
                    <span>{inTransit} unterwegs</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Heatmap total */}
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border">
            <span>Gesamt aktiv: <span className="font-bold text-foreground">{zoneData.reduce((a, z) => a + z.demand, 0)}</span></span>
            <span>Hotspot: <span className="font-bold text-foreground">Zone {hotZone.zone} ({hotZone.demand})</span></span>
          </div>
        </div>
      )}
    </Card>
  );
}
