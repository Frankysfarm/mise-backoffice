'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gauge, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';

type BatchStop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

interface DriverRow {
  batchId: string;
  name: string;
  zone: string | null;
  completedStops: number;
  totalStops: number;
  elapsedMin: number;
  stopsPerHour: number;
  targetStopsPerHour: number;
  status: 'schnell' | 'normal' | 'langsam';
  progressPct: number;
}

const TARGET_STOPS_PER_HOUR = 3.5;

function computeRows(batches: Batch[], now: number): DriverRow[] {
  return batches
    .filter((b) => ['unterwegs', 'on_route', 'aktiv', 'assigned'].includes(b.status))
    .map((b) => {
      const completedStops = b.stops.filter((s) => s.geliefert_am !== null).length;
      const totalStops = b.stops.length;
      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now - 30 * 60_000;
      const elapsedMin = Math.max(1, (now - startMs) / 60_000);
      const stopsPerHour = completedStops > 0 ? (completedStops / elapsedMin) * 60 : 0;
      const ratio = stopsPerHour / TARGET_STOPS_PER_HOUR;
      const status: DriverRow['status'] = ratio >= 0.9 ? 'schnell' : ratio >= 0.6 ? 'normal' : 'langsam';
      const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
      const name = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname}` : 'Unbekannt';

      return {
        batchId: b.id,
        name,
        zone: b.zone,
        completedStops,
        totalStops,
        elapsedMin: Math.round(elapsedMin),
        stopsPerHour: Math.round(stopsPerHour * 10) / 10,
        targetStopsPerHour: TARGET_STOPS_PER_HOUR,
        status,
        progressPct,
      };
    })
    .sort((a, b) => b.stopsPerHour - a.stopsPerHour);
}

const statusStyle = {
  schnell: { bg: 'bg-matcha-50', badge: 'bg-matcha-100 text-matcha-800', bar: 'bg-matcha-500', label: 'Schnell', icon: TrendingUp, iconCls: 'text-matcha-600' },
  normal:  { bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-800',   bar: 'bg-amber-400',   label: 'Normal', icon: CheckCircle2, iconCls: 'text-amber-600' },
  langsam: { bg: 'bg-red-50',    badge: 'bg-red-100 text-red-800',        bar: 'bg-red-400',     label: 'Langsam', icon: AlertTriangle, iconCls: 'text-red-600' },
};

export function DispatchFahrerTempoMatrix({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const rows = computeRows(batches, Date.now());
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Fahrer-Tempo
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          Ziel: {TARGET_STOPS_PER_HOUR} Stopps/h
        </span>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => {
          const s = statusStyle[row.status];
          const Icon = s.icon;
          const barWidth = Math.min(100, (row.stopsPerHour / TARGET_STOPS_PER_HOUR) * 100);

          return (
            <div key={row.batchId} className={cn('px-4 py-2.5 flex items-center gap-3', s.bg)}>
              <Icon className={cn('h-3.5 w-3.5 shrink-0', s.iconCls)} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold truncate">{row.name}</span>
                  {row.zone && (
                    <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold shrink-0">
                      Z{row.zone}
                    </span>
                  )}
                  <span className={cn('ml-auto text-[9px] rounded-full px-1.5 py-0.5 font-black', s.badge)}>
                    {s.label}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black tabular-nums shrink-0">
                    {row.stopsPerHour.toFixed(1)}/h
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-xs font-black tabular-nums">
                  {row.completedStops}/{row.totalStops}
                </div>
                <div className="text-[9px] text-muted-foreground">{row.elapsedMin} Min</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
