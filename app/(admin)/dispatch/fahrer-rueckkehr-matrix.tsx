'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Truck, CheckCircle2, Clock } from 'lucide-react';

type Stop = {
  id: string;
  geliefert_am: string | null;
  order: { eta_earliest: string | null; eta_latest: string | null } | null;
};

type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

interface Props {
  batches: Batch[];
}

const ACTIVE_STATUSES = ['assigned', 'on_route', 'en_route', 'unterwegs', 'active'];

export function DispatchFahrerRueckkehrMatrix({ batches }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));
  if (active.length === 0) return null;

  const rows = active
    .map((b) => {
      const name = b.fahrer
        ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.`
        : 'Fahrer';
      const totalStops = b.stops.length;
      const doneStops = b.stops.filter((s) => s.geliefert_am).length;
      const remaining = totalStops - doneStops;

      // Find latest ETA from remaining stops or fall back to startzeit + total_eta_min
      let returnMs: number | null = null;
      const pendingStops = b.stops.filter((s) => !s.geliefert_am);
      const lastEta = pendingStops
        .map((s) => s.order?.eta_latest)
        .filter(Boolean)
        .sort()
        .reverse()[0];
      if (lastEta) {
        returnMs = new Date(lastEta).getTime();
      } else if (b.startzeit && b.total_eta_min) {
        returnMs = new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
      }

      const returnInMin = returnMs !== null ? Math.round((returnMs - now) / 60_000) : null;
      const urgency: 'soon' | 'coming' | 'far' | 'unknown' =
        returnInMin !== null
          ? returnInMin <= 5
            ? 'soon'
            : returnInMin <= 15
              ? 'coming'
              : 'far'
          : 'unknown';

      return { b, name, totalStops, doneStops, remaining, returnInMin, urgency };
    })
    .sort((a, z) => {
      if (a.returnInMin !== null && z.returnInMin !== null) return a.returnInMin - z.returnInMin;
      if (a.returnInMin !== null) return -1;
      if (z.returnInMin !== null) return 1;
      return 0;
    });

  const soonCount = rows.filter((r) => r.urgency === 'soon').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100">
        <Truck className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Rückkehr-Matrix</span>
        {soonCount > 0 && (
          <span className="ml-auto rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {soonCount} bald frei
          </span>
        )}
      </div>

      <div className="divide-y divide-stone-100">
        {rows.map(({ b, name, totalStops, doneStops, remaining, returnInMin, urgency }) => (
          <div
            key={b.id}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5',
              urgency === 'soon' ? 'bg-matcha-50/60' : '',
            )}
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white',
                urgency === 'soon'
                  ? 'bg-matcha-500'
                  : urgency === 'coming'
                    ? 'bg-amber-400'
                    : urgency === 'far'
                      ? 'bg-stone-300'
                      : 'bg-stone-200',
              )}
            >
              {urgency === 'soon' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Truck className="h-3.5 w-3.5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold truncate">{name}</span>
                {b.zone && (
                  <span className="text-[9px] rounded bg-stone-100 px-1.5 py-0.5 font-bold text-stone-600">
                    Zone {b.zone}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="h-1 w-20 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-matcha-400 transition-all duration-500"
                    style={{ width: `${totalStops > 0 ? (doneStops / totalStops) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {doneStops}/{totalStops}
                </span>
                {remaining > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    ({remaining} offen)
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              {returnInMin !== null ? (
                <>
                  <div
                    className={cn(
                      'font-mono text-sm font-black tabular-nums',
                      urgency === 'soon'
                        ? 'text-matcha-600'
                        : urgency === 'coming'
                          ? 'text-amber-600'
                          : 'text-muted-foreground',
                    )}
                  >
                    {returnInMin <= 0 ? 'Gleich' : `~${returnInMin}m`}
                  </div>
                  <div className="text-[8px] text-muted-foreground">Rückkehr</div>
                </>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Offen</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
