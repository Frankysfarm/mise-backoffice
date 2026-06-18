'use client';

import { cn } from '@/lib/utils';
import { Truck } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_latest: string | null;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer: { vorname: string; nachname: string } | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  stops: Stop[];
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-blue-500';
}

export function DispatchTourStageProgress({ batches }: { batches: Batch[] }) {
  const active = batches.filter(b => b.status !== 'abgeschlossen');

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Truck className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Fortschritt Live</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{active.length} aktiv</span>
      </div>

      {active.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Keine aktiven Touren
        </div>
      ) : (
        <div className="divide-y">
          {active.map(batch => {
            const total = batch.stops.length;
            const delivered = batch.stops.filter(s => s.geliefert_am !== null).length;
            const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
            const remaining = total - delivered;
            const driverName = batch.fahrer
              ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
              : 'Unbekannt';

            return (
              <div key={batch.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold">{driverName}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">
                      {delivered}/{total} Stops · {remaining} verbleibend
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      'text-xs font-black',
                      pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-blue-700',
                    )}>
                      {pct}%
                    </span>
                    {batch.total_eta_min !== null && remaining > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        ~{Math.round((batch.total_eta_min / total) * remaining)} Min
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', getProgressColor(pct))}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {batch.total_distance_km !== null && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {batch.total_distance_km.toFixed(1)} km gesamt
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
