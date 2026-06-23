'use client';

import { useEffect, useState } from 'react';
import { Navigation2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DriverEtaRow {
  driverId: string;
  driverName: string;
  stopsRemaining: number;
  etaMinutes: number;
  score: number;
}

interface Props {
  locationId: string | null | undefined;
}

const MOCK_DRIVERS: DriverEtaRow[] = [
  { driverId: '1', driverName: 'Markus T.', stopsRemaining: 5, etaMinutes: 38, score: 54 },
  { driverId: '2', driverName: 'Jana B.',   stopsRemaining: 3, etaMinutes: 22, score: 71 },
  { driverId: '3', driverName: 'Leon R.',   stopsRemaining: 1, etaMinutes: 7,  score: 88 },
  { driverId: '4', driverName: 'Sara K.',   stopsRemaining: 2, etaMinutes: 15, score: 62 },
];

function stopsBadge(stops: number) {
  if (stops === 0) return 'bg-matcha-100 text-matcha-700';
  if (stops === 1) return 'bg-matcha-500 text-white';
  if (stops <= 3)  return 'bg-amber-400 text-white';
  return 'bg-red-500 text-white';
}

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-matcha-500 text-white';
  if (score >= 60) return 'bg-amber-400 text-white';
  return 'bg-red-500 text-white';
}

export function DispatchFahrerEtaKommando({ locationId }: Props) {
  const [rows, setRows] = useState<DriverEtaRow[]>([]);
  const [lastUpdate, setLastUpdate] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      if (!locationId) {
        if (!cancelled) setRows(MOCK_DRIVERS);
        return;
      }
      fetch(`/api/delivery/admin/driver-performance?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => {
          if (!r.ok) throw new Error('api');
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          const mapped: DriverEtaRow[] = (data.drivers ?? [])
            .filter((d: any) => d.is_active)
            .map((d: any) => ({
              driverId: d.driver_id ?? d.employee_id ?? String(Math.random()),
              driverName: d.driver_name ?? d.name ?? 'Fahrer',
              stopsRemaining: d.stops_remaining ?? d.remaining_stops ?? 0,
              etaMinutes: d.eta_minutes ?? d.eta_min ?? 0,
              score: d.score ?? d.performance_score ?? 0,
            }));
          setRows(mapped.length > 0 ? mapped : MOCK_DRIVERS);
          setLastUpdate(Date.now());
        })
        .catch(() => {
          if (!cancelled) setRows(MOCK_DRIVERS);
        });
    };

    load();
    const id = setInterval(load, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locationId]);

  const sorted = [...rows].sort((a, b) => b.stopsRemaining - a.stopsRemaining);

  if (sorted.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Navigation2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer ETA-Kommando
        </span>
        <Badge variant="secondary" className="ml-auto">
          {sorted.length} Fahrer
        </Badge>
      </div>
      <div className="divide-y">
        {sorted.map((row) => (
          <div key={row.driverId} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold truncate block">{row.driverName}</span>
            </div>
            <div
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black min-w-[28px] text-center tabular-nums',
                stopsBadge(row.stopsRemaining),
              )}
            >
              {row.stopsRemaining}
            </div>
            <div className="shrink-0 text-right min-w-[52px]">
              {row.stopsRemaining === 0 ? (
                <span className="text-[11px] font-black text-matcha-600">fertig</span>
              ) : (
                <span className="font-mono text-sm font-black tabular-nums text-foreground">
                  {row.etaMinutes} Min
                </span>
              )}
            </div>
            <div
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black min-w-[34px] text-center tabular-nums',
                scoreBadge(row.score),
              )}
            >
              {row.score}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
