'use client';

/**
 * Phase 549 — Tour-Live-Effizienz-Matrix
 *
 * Kompakte Echtzeit-Matrix aller aktiven Touren:
 * - Fahrername + Fahrzeug
 * - Stopps abgeschlossen / gesamt mit Fortschrittsbalken
 * - Verbleibende Zeit (ETA) farbkodiert (grün / amber / rot)
 * - Effizienz-Score (Stop-Pace vs. ETA)
 * Aktualisiert sich jede Minute über Polling.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, Route, Timer, TrendingUp } from 'lucide-react';

interface Stop {
  geliefert_am: string | null;
  angekommen_am?: string | null;
}

interface Batch {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  fahrer_id?: string;
  fahrer?: { vorname: string; nachname: string } | null;
  vehicle?: string | null;
  zone?: string | null;
  stops: Stop[];
}

interface Props {
  batches: Batch[];
  drivers?: { employee_id: string; fahrzeug?: string | null; employee?: { vorname: string; nachname: string } | null }[];
}

type Health = 'on-time' | 'tight' | 'late' | 'unknown';

const HEALTH: Record<Health, { label: string; bar: string; text: string; badge: string }> = {
  'on-time': { label: 'Pünktlich', bar: 'bg-matcha-500', text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700 border-matcha-200' },
  tight:     { label: 'Knapp',    bar: 'bg-amber-400',  text: 'text-amber-700',  badge: 'bg-amber-50  text-amber-700  border-amber-200'  },
  late:      { label: 'Verspätet',bar: 'bg-red-400',    text: 'text-red-700',    badge: 'bg-red-50    text-red-700    border-red-200'    },
  unknown:   { label: 'Unbekannt',bar: 'bg-muted',      text: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground border-border' },
};

export function DispatchPhase549TourLiveEffizienzMatrix({ batches, drivers = [] }: Props) {
  const [nowMs, setNowMs] = useState(Date.now);
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const active = batches.filter(b => ['on_route', 'unterwegs', 'assigned', 'pickup'].includes(b.status));
    return active
      .map(b => {
        const total = b.stops.length;
        const done = b.stops.filter(s => s.geliefert_am).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        const elapsedMin = b.started_at ? Math.floor((nowMs - new Date(b.started_at).getTime()) / 60_000) : null;
        const etaMin = b.total_eta_min ?? null;
        const remainMin = etaMin !== null && elapsedMin !== null ? Math.max(0, etaMin - elapsedMin) : null;

        let health: Health = 'unknown';
        if (etaMin !== null && elapsedMin !== null) {
          const usedPct = elapsedMin / etaMin;
          const donePct = total > 0 ? done / total : 0;
          const delta = usedPct - donePct;
          health = delta > 0.3 ? 'late' : delta > 0.1 ? 'tight' : 'on-time';
        }

        const driver = drivers.find(d => d.employee_id === b.fahrer_id);
        const vorname = b.fahrer?.vorname ?? driver?.employee?.vorname ?? '–';
        const nachname = b.fahrer?.nachname ?? driver?.employee?.nachname ?? '';
        const vehicle = b.vehicle ?? driver?.fahrzeug ?? null;

        const pace = done > 0 && elapsedMin !== null ? Math.round(elapsedMin / done) : null;

        return { id: b.id, vorname, nachname, vehicle, zone: b.zone, total, done, pct, elapsedMin, etaMin, remainMin, health, pace };
      })
      .sort((a, b) => {
        const ord: Record<Health, number> = { late: 0, tight: 1, 'on-time': 2, unknown: 3 };
        return ord[a.health] - ord[b.health];
      });
  }, [batches, drivers, nowMs]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Live-Effizienz</span>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">{rows.length} aktiv</span>
      </div>

      <div className="divide-y">
        {rows.map(r => {
          const hs = HEALTH[r.health];
          return (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3">
              {/* Health badge */}
              <div className={cn('shrink-0 rounded-md px-2 py-0.5 text-[9px] font-black border w-[62px] text-center', hs.badge)}>
                {hs.label}
              </div>

              {/* Driver + zone */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold truncate">{r.vorname} {r.nachname}</span>
                  {r.vehicle && (
                    <span className="text-[9px] rounded bg-muted px-1 py-0.5 font-mono">{r.vehicle}</span>
                  )}
                  {r.zone && (
                    <span className="text-[9px] rounded bg-blue-50 text-blue-700 px-1 py-0.5 border border-blue-100">
                      Z{r.zone}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', hs.bar)}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                    {r.done}/{r.total}
                  </span>
                </div>
              </div>

              {/* Time info */}
              <div className="shrink-0 text-right space-y-0.5">
                {r.remainMin !== null && (
                  <div className={cn('text-sm font-black tabular-nums', hs.text)}>
                    ~{r.remainMin}m
                  </div>
                )}
                {r.elapsedMin !== null && (
                  <div className="text-[9px] text-muted-foreground tabular-nums">{r.elapsedMin}m vergangen</div>
                )}
                {r.pace !== null && (
                  <div className="text-[9px] text-muted-foreground">{r.pace} Min/Stop</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
