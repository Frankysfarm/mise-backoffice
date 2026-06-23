'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

type PrognoseRow = {
  batchId: string;
  driverName: string;
  zone: string | null;
  completedStops: number;
  totalStops: number;
  avgMinPerStop: number;
  remainingMin: number;
  predictedFinishAt: Date;
  plannedFinishAt: Date | null;
  delayMin: number;
  status: 'pünktlich' | 'leichte Verspätung' | 'kritische Verspätung';
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function calcRows(batches: Batch[], now: number): PrognoseRow[] {
  return batches
    .filter((b) =>
      ['unterwegs', 'on_route', 'gestartet'].includes(b.status) &&
      b.stops.length > 0,
    )
    .map((b) => {
      const driverName = b.fahrer
        ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
        : 'Fahrer';

      const totalStops = b.stops.length;
      const completedStops = b.stops.filter((s) => s.geliefert_am !== null).length;
      const remainingStops = totalStops - completedStops;

      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now;
      const elapsedMin = Math.max(1, (now - startMs) / 60_000);

      // Ø Min pro Stopp aus bisher abgeschlossenen Stopps — fallback: ETA/total oder 8 Min
      const avgMinPerStop =
        completedStops >= 1
          ? elapsedMin / completedStops
          : b.total_eta_min != null && totalStops > 0
            ? b.total_eta_min / totalStops
            : 8;

      const remainingMin = Math.ceil(remainingStops * avgMinPerStop);
      const predictedFinishAt = new Date(now + remainingMin * 60_000);

      // Geplantes Tour-Ende = Start + total_eta_min (oder Start + Anzahl Stopps × 8 Min)
      const plannedTotalMin =
        b.total_eta_min != null
          ? b.total_eta_min
          : totalStops * 8;
      const plannedFinishAt = new Date(startMs + plannedTotalMin * 60_000);

      const delayMin = Math.round(
        (predictedFinishAt.getTime() - plannedFinishAt.getTime()) / 60_000,
      );

      const status: PrognoseRow['status'] =
        delayMin > 20
          ? 'kritische Verspätung'
          : delayMin > 5
            ? 'leichte Verspätung'
            : 'pünktlich';

      return {
        batchId: b.id,
        driverName,
        zone: b.zone,
        completedStops,
        totalStops,
        avgMinPerStop: Math.round(avgMinPerStop * 10) / 10,
        remainingMin,
        predictedFinishAt,
        plannedFinishAt,
        delayMin,
        status,
      };
    })
    .sort((a, b) => b.delayMin - a.delayMin);
}

const statusStyle = {
  pünktlich: {
    bg: 'bg-matcha-50',
    badge: 'bg-matcha-500 text-white',
    icon: CheckCircle2,
    iconColor: 'text-matcha-500',
    barColor: 'bg-matcha-500',
  },
  'leichte Verspätung': {
    bg: 'bg-amber-50',
    badge: 'bg-amber-400 text-white',
    icon: Clock,
    iconColor: 'text-amber-500',
    barColor: 'bg-amber-400',
  },
  'kritische Verspätung': {
    bg: 'bg-red-50',
    badge: 'bg-red-500 text-white',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    barColor: 'bg-red-400',
  },
} as const;

export function DispatchTourAbschlussPrognose({ batches }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const rows = calcRows(batches, now);

  if (rows.length === 0) return null;

  const critical = rows.filter((r) => r.status === 'kritische Verspätung').length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Tour-Abschluss-Prognose
        </span>
        {critical > 0 && (
          <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
            {critical} kritisch
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {rows.length} aktive Tour{rows.length !== 1 ? 'en' : ''}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {rows.map((row) => {
          const ss = statusStyle[row.status];
          const Icon = ss.icon;
          const progressPct = row.totalStops > 0
            ? Math.round((row.completedStops / row.totalStops) * 100)
            : 0;

          return (
            <div key={row.batchId} className={cn('px-4 py-3', ss.bg)}>
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ss.iconColor)} />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{row.driverName}</span>
                    {row.zone && (
                      <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                        Zone {row.zone}
                      </span>
                    )}
                    <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[9px] font-black shrink-0', ss.badge)}>
                      {row.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', ss.barColor)}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                      {row.completedStops}/{row.totalStops} Stopps
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        Ø {row.avgMinPerStop} Min/Stopp
                      </span>
                    </div>
                    <div className="text-[10px] font-semibold">
                      Prognose:{' '}
                      <span className={cn(
                        'font-black',
                        row.status === 'pünktlich'
                          ? 'text-matcha-700'
                          : row.status === 'leichte Verspätung'
                            ? 'text-amber-700'
                            : 'text-red-700',
                      )}>
                        {fmtTime(row.predictedFinishAt)}
                      </span>
                    </div>
                    {row.plannedFinishAt && (
                      <div className="text-[10px] text-muted-foreground">
                        Geplant: {fmtTime(row.plannedFinishAt)}
                      </div>
                    )}
                    {row.delayMin > 0 && (
                      <div className={cn(
                        'text-[10px] font-black tabular-nums',
                        row.delayMin > 20 ? 'text-red-600' : 'text-amber-600',
                      )}>
                        +{row.delayMin} Min
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      {critical > 0 && (
        <div className="border-t bg-red-50 px-4 py-2">
          <p className="text-[10px] text-red-700 font-semibold">
            {critical} Tour{critical !== 1 ? 'en' : ''} mit kritischer Verspätung — Dispatcher-Eingriff empfohlen.
          </p>
        </div>
      )}
    </div>
  );
}
