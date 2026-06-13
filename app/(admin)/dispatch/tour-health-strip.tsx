'use client';

/**
 * DispatchTourHealthStrip
 * Kompakter Echtzeit-Gesundheitsstreifen für alle aktiven Touren.
 * Zeigt einen farbigen Balken pro Tour mit Fahrername, Fortschritt,
 * Restzeit und Health-Status (pünktlich / knapp / verspätet).
 * Ergänzt das bestehende Tour-Scoreboard mit einer kompakteren Übersicht.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
  }[];
};

type HealthStatus = 'on-time' | 'tight' | 'late' | 'unknown';

interface TourRow {
  id: string;
  driverName: string;
  zone: string | null;
  totalStops: number;
  completedStops: number;
  remainMin: number | null;
  elapsedMin: number;
  totalEtaMin: number | null;
  progressPct: number;
  health: HealthStatus;
  overdueMin: number;
}

const HEALTH_STYLE: Record<HealthStatus, { bg: string; bar: string; text: string; label: string; icon: typeof AlertTriangle }> = {
  'on-time': { bg: 'bg-matcha-100', bar: 'bg-matcha-500', text: 'text-matcha-700', label: 'Pünktlich', icon: CheckCircle2 },
  tight:     { bg: 'bg-amber-100',  bar: 'bg-amber-500',  text: 'text-amber-700',  label: 'Knapp',     icon: Clock },
  late:      { bg: 'bg-red-100',    bar: 'bg-red-500',    text: 'text-red-700',    label: 'Verspätet', icon: AlertTriangle },
  unknown:   { bg: 'bg-muted/30',   bar: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Unbekannt', icon: Bike },
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

export function DispatchTourHealthStrip({ batches }: { batches: Batch[] }) {
  useTick();

  const activeBatches = batches.filter(b =>
    ['aktiv', 'unterwegs', 'pickup', 'on_route', 'assigned'].includes(b.status),
  );

  if (activeBatches.length === 0) return null;

  const now = Date.now();

  const rows: TourRow[] = activeBatches.map(b => {
    const driverName = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
      : 'Fahrer?';

    const totalStops = b.stops.length;
    const completedStops = b.stops.filter(s => s.geliefert_am).length;
    const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

    const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
    const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
    const totalEtaMin = b.total_eta_min ?? null;
    const remainMin = totalEtaMin !== null ? Math.max(0, totalEtaMin - elapsedMin) : null;

    let health: HealthStatus = 'unknown';
    let overdueMin = 0;

    if (totalEtaMin !== null) {
      const usedPct = elapsedMin / totalEtaMin;
      const donePct = totalStops > 0 ? completedStops / totalStops : 0;
      const delta = usedPct - donePct;
      if (delta > 0.3) {
        health = 'late';
        overdueMin = Math.round(delta * totalEtaMin);
      } else if (delta > 0.1) {
        health = 'tight';
      } else {
        health = 'on-time';
      }
    }

    return {
      id: b.id,
      driverName,
      zone: b.zone,
      totalStops,
      completedStops,
      remainMin,
      elapsedMin,
      totalEtaMin,
      progressPct,
      health,
      overdueMin,
    };
  }).sort((a, b) => {
    const order: HealthStatus[] = ['late', 'tight', 'on-time', 'unknown'];
    return order.indexOf(a.health) - order.indexOf(b.health);
  });

  const lateCount = rows.filter(r => r.health === 'late').length;
  const tightCount = rows.filter(r => r.health === 'tight').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Zap className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">
          Tour-Puls · {rows.length} aktiv
        </span>
        <div className="ml-auto flex items-center gap-2">
          {lateCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5 animate-pulse">
              {lateCount} verspätet
            </span>
          )}
          {tightCount > 0 && lateCount === 0 && (
            <span className="rounded-full bg-amber-400 text-white text-[9px] font-black px-2 py-0.5">
              {tightCount} knapp
            </span>
          )}
          {lateCount === 0 && tightCount === 0 && (
            <span className="rounded-full bg-matcha-500 text-white text-[9px] font-black px-2 py-0.5">
              Alles im Plan
            </span>
          )}
        </div>
      </div>

      <div className="divide-y">
        {rows.map(row => {
          const hs = HEALTH_STYLE[row.health];
          const Icon = hs.icon;

          return (
            <div key={row.id} className={cn('px-3 py-2.5 flex items-center gap-3', hs.bg)}>
              {/* Icon */}
              <Icon className={cn('h-4 w-4 shrink-0', hs.text)} />

              {/* Driver + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs font-bold truncate', hs.text)}>
                    {row.driverName}
                  </span>
                  {row.zone && (
                    <span className="text-[9px] font-bold rounded-full bg-white/60 border px-1.5 py-0.5">
                      Zone {row.zone}
                    </span>
                  )}
                  <span className={cn('ml-auto text-[10px] font-black tabular-nums', hs.text)}>
                    {row.completedStops}/{row.totalStops}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', hs.bar)}
                    style={{ width: `${row.progressPct}%` }}
                  />
                </div>
              </div>

              {/* ETA */}
              <div className="shrink-0 text-right min-w-[48px]">
                {row.remainMin !== null ? (
                  <>
                    <div className={cn('font-mono text-sm font-black tabular-nums', hs.text)}>
                      {row.remainMin}m
                    </div>
                    <div className="text-[8px] text-muted-foreground">verbleibt</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-sm font-black tabular-nums text-muted-foreground">
                      {row.elapsedMin}m
                    </div>
                    <div className="text-[8px] text-muted-foreground">vergangen</div>
                  </>
                )}
                {row.overdueMin > 0 && (
                  <div className="text-[9px] font-black text-red-600 tabular-nums">
                    +{row.overdueMin}m
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
