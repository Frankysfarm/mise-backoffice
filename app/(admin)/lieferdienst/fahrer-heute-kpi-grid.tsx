'use client';

import { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

type DriverRow = {
  driverId: string;
  name: string;
  stopsToday: number;
  earningsEur: number;
  onTimeRate: number | null;
  liveScore: number;
  liveScoreLabel: string;
  currentState: string | null;
};

export function LieferdienstFahrerHeuteKpiGrid({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = () => {
      fetch(`/api/delivery/admin/driver-performance-realtime?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const rows: DriverRow[] = (d.drivers ?? []).map((dr: Record<string, unknown>) => {
            const today = dr.today as Record<string, unknown>;
            return {
              driverId:      dr.driverId as string,
              name:          (dr.name as string | null) ?? 'Fahrer',
              stopsToday:    (today?.stopsCompleted as number) ?? 0,
              earningsEur:   (today?.earningsEur as number) ?? 0,
              onTimeRate:    (today?.onTimeRate as number | null) ?? null,
              liveScore:     (dr.liveScore as number) ?? 0,
              liveScoreLabel: (dr.liveScoreLabel as string) ?? '',
              currentState:  (dr.currentState as string | null) ?? null,
            };
          });
          setDrivers(rows.filter((r) => r.stopsToday > 0));
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId || loading) {
    return loading ? (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade Fahrer-Daten…
      </div>
    ) : null;
  }

  if (drivers.length === 0) return null;

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-matcha-700 bg-matcha-100' :
    score >= 60 ? 'text-amber-700 bg-amber-100' :
    'text-red-700 bg-red-100';

  const stateLabel = (state: string | null) => {
    if (!state) return '';
    return state === 'delivering' ? '🚴 unterwegs' : state === 'idle' ? '🟢 frei' : state;
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-char">Fahrer Heute</div>
          <div className="text-xs text-stone-400">Stopps · Einnahmen · Pünktlichkeit</div>
        </div>
        <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
          {drivers.length} aktiv
        </span>
      </div>

      <div className="divide-y divide-stone-100">
        {drivers.map((d) => (
          <div key={d.driverId} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold truncate">{d.name}</span>
                {d.currentState && (
                  <span className="text-[9px] text-muted-foreground">{stateLabel(d.currentState)}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">{d.stopsToday}</span> Stopps
                {d.earningsEur > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-matcha-700">{euro(d.earningsEur)}</span>
                  </>
                )}
                {d.onTimeRate !== null && (
                  <>
                    <span>·</span>
                    <span className={cn('font-semibold', d.onTimeRate >= 0.8 ? 'text-matcha-700' : d.onTimeRate >= 0.6 ? 'text-amber-600' : 'text-red-600')}>
                      {Math.round(d.onTimeRate * 100)}% pünktl.
                    </span>
                  </>
                )}
              </div>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums', scoreColor(d.liveScore))}>
              {d.liveScore}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
