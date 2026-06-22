'use client';

/**
 * MultiLocationOverview — Phase 410 / Phase 411
 * Standort-Vergleichs-Grid: Kacheln je Standort mit Status, Überlas-Score, Circuit-Status.
 * CEO-Level Birds-Eye-View aller Standorte.
 * API: GET /api/delivery/admin/kitchen-capacity?action=all-locations
 */

import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, Circle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type CapacityStatus = 'optimal' | 'busy' | 'overloaded' | 'circuit_open' | 'unknown';

interface LocationCard {
  locationId:    string;
  locationName:  string;
  overloadScore: number;
  status:        CapacityStatus;
  circuitActive: boolean;
  activeOrders:  number;
  readyOrders:   number;
  snapshotAge:   number;
}

const STATUS_STYLE: Record<CapacityStatus, { label: string; color: string; dot: string }> = {
  optimal:      { label: 'Optimal',     color: 'text-matcha-700',  dot: 'bg-matcha-500'  },
  busy:         { label: 'Ausgelastet', color: 'text-amber-700',   dot: 'bg-amber-400'   },
  overloaded:   { label: 'Überlastet',  color: 'text-orange-700',  dot: 'bg-orange-500'  },
  circuit_open: { label: 'Circuit!',    color: 'text-red-700',     dot: 'bg-red-600'     },
  unknown:      { label: 'Unbekannt',   color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-red-600';
  if (score >= 60) return 'text-orange-600';
  if (score >= 30) return 'text-amber-600';
  return 'text-matcha-700';
}

export function MultiLocationOverview() {
  const [locations, setLocations] = useState<LocationCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/delivery/admin/kitchen-capacity?action=all-locations', { cache: 'no-store' });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      const cards: LocationCard[] = Array.isArray(json.cards) ? (json.cards as LocationCard[]) : [];
      setLocations(cards);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const criticalCount = locations.filter((l) => l.circuitActive || l.status === 'circuit_open').length;
  const overloadedCount = locations.filter((l) => l.status === 'overloaded').length;

  return (
    <Card className={cn('overflow-hidden', criticalCount > 0 && 'border-red-300')}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left"
      >
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Standort-Übersicht</span>
        {criticalCount > 0 && (
          <Badge className="ml-1 bg-red-600 text-white text-[10px]">{criticalCount} Circuit offen</Badge>
        )}
        {overloadedCount > 0 && criticalCount === 0 && (
          <Badge className="ml-1 bg-orange-500 text-white text-[10px]">{overloadedCount} überlastet</Badge>
        )}
        {locations.length > 0 && criticalCount === 0 && overloadedCount === 0 && (
          <Badge variant="secondary" className="ml-1 text-[10px]">{locations.length} Standorte</Badge>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform text-muted-foreground', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="p-3">
          {loading && <div className="text-xs text-muted-foreground text-center py-3">Lade…</div>}

          {!loading && locations.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">
              Keine Standortdaten verfügbar
            </div>
          )}

          {!loading && locations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {locations.map((loc) => {
                const style = STATUS_STYLE[loc.status] ?? STATUS_STYLE.unknown;
                return (
                  <div
                    key={loc.locationId}
                    className={cn(
                      'rounded-lg border p-3 space-y-2',
                      loc.circuitActive ? 'bg-red-50 border-red-200' :
                      loc.status === 'overloaded' ? 'bg-orange-50 border-orange-200' :
                      loc.status === 'busy' ? 'bg-amber-50 border-amber-100' :
                      'bg-muted/20 border-border',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Circle className={cn('h-2 w-2 shrink-0 fill-current', style.dot, style.color)} />
                      <span className="text-xs font-semibold truncate">{loc.locationName}</span>
                      {loc.circuitActive && (
                        <Zap className="h-3 w-3 text-red-600 shrink-0 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-xs font-medium', style.color)}>{style.label}</span>
                      <span className={cn('text-lg font-black tabular-nums', scoreColor(loc.overloadScore))}>
                        {Math.round(loc.overloadScore)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                      <span>{loc.activeOrders} aktiv</span>
                      <span>{loc.readyOrders} fertig</span>
                    </div>
                    {loc.snapshotAge > 300 && (
                      <div className="flex items-center gap-1 text-[9px] text-amber-600">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Snapshot {Math.round(loc.snapshotAge / 60)} Min alt
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
