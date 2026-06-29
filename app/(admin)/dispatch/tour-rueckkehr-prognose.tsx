'use client';

import { useEffect, useState } from 'react';
import { Bike, Car, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReturnUrgency = 'soon' | 'coming' | 'later';

interface TourEntry {
  driverId: string;
  driverName: string;
  vehicle: string | null;
  completedStops: number;
  pendingStops: number;
  totalStops: number;
  avgStopMinutes: number;
  estimatedReturnMinutes: number;
  estimatedReturnAt: string;
  urgency: ReturnUrgency;
}

interface ApiResponse {
  ok: boolean;
  drivers: TourEntry[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const urgencyStyle: Record<ReturnUrgency, { row: string; badge: string; label: string; bar: string }> = {
  soon:   { row: 'bg-green-50',  badge: 'bg-green-100 text-green-700',  label: 'Bald zurück', bar: 'bg-green-500' },
  coming: { row: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',  label: 'Unterwegs',   bar: 'bg-amber-400' },
  later:  { row: 'bg-stone-50',  badge: 'bg-stone-100 text-stone-600',  label: 'Noch länger', bar: 'bg-stone-400' },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DispatchTourRueckkehrPrognose({ locationId }: Props) {
  const [drivers, setDrivers] = useState<TourEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/tour-abschluss-prognose?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setDrivers(d.drivers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && drivers.length === 0) return null;

  const soonCount = drivers.filter((d) => d.urgency === 'soon').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Rückkehr-Prognose</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {soonCount > 0 && (
          <span className="ml-auto rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-[10px] font-bold">
            {soonCount} bald zurück
          </span>
        )}
        {!loading && soonCount === 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">{drivers.length} aktiv</span>
        )}
        <span className="ml-1 text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {drivers.map((d) => {
            const s = urgencyStyle[d.urgency];
            const stopPct = d.totalStops > 0
              ? Math.round((d.completedStops / d.totalStops) * 100)
              : 0;

            return (
              <div key={d.driverId} className={cn('px-5 py-3 flex items-center gap-3', s.row)}>
                <div className="text-stone-400 shrink-0">
                  {d.vehicle === 'car' ? <Car className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{d.driverName}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', s.badge)}>
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="w-24 bg-stone-200 rounded-full h-1.5 shrink-0">
                      <div className={cn('h-1.5 rounded-full transition-all', s.bar)} style={{ width: `${stopPct}%` }} />
                    </div>
                    <span className="text-[10px] text-stone-500">
                      {d.completedStops}/{d.totalStops} Stopps · Ø {d.avgStopMinutes} Min
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">{fmtTime(d.estimatedReturnAt)}</div>
                  <div className="text-[10px] text-stone-500">~{d.estimatedReturnMinutes} Min</div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="px-5 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Wird geladen…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
