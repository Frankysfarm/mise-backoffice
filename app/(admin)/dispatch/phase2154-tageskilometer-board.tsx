'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Bike, Car, AlertTriangle, TrendingUp, TrendingDown, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

type FahrerKm = {
  fahrer_id: string;
  name: string;
  km_heute: number;
  km_ziel: number;
  trend_7tage: number;
  fahrzeug: string;
};

export function DispatchPhase2154TageskilometerBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FahrerKm[]>([]);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tageskilometer?location_id=${locationId}`)
        .then((r) => r.json())
        .then((d) => setData(d.drivers ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const alerts = data.filter((d) => {
    const pct = d.km_heute / d.km_ziel;
    // Alert wenn nach Halbzeit noch <50% gefahren
    const now = new Date();
    const h = now.getHours();
    return h >= 14 && pct < 0.5;
  });

  if (!data.length) return null;

  const teamAvg = data.reduce((s, d) => s + d.km_heute, 0) / data.length;

  return (
    <div className="rounded-xl border border-border bg-card text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Route className="h-4 w-4 text-primary" />
          Tageskilometer
          {alerts.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
              {alerts.length} unter Ziel
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div className="text-xs text-muted-foreground">
            Ø Team heute: <span className="font-semibold text-foreground">{teamAvg.toFixed(1)} km</span>
          </div>

          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{alerts.length} Fahrer nach Halbzeit unter 50% Ziel — Routenoptimierung prüfen</span>
            </div>
          )}

          <div className="space-y-2">
            {[...data].sort((a, b) => b.km_heute - a.km_heute).map((d) => {
              const pct = Math.min(1, d.km_heute / d.km_ziel);
              const overTarget = d.km_heute > d.km_ziel * 1.2;
              const underTarget = d.km_heute < d.km_ziel * 0.5;
              const barColor = overTarget
                ? 'bg-amber-500'
                : pct >= 0.8
                ? 'bg-emerald-500'
                : pct >= 0.5
                ? 'bg-yellow-400'
                : 'bg-red-500';
              const trending = d.km_heute > d.trend_7tage;

              return (
                <div key={d.fahrer_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {d.fahrzeug === 'car' ? (
                        <Car className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Bike className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="font-medium">{d.name}</span>
                      {trending ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      )}
                    </div>
                    <span className={cn('font-semibold', overTarget && 'text-amber-600')}>
                      {d.km_heute.toFixed(1)} / {d.km_ziel} km
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {data.some((d) => d.km_heute > d.km_ziel * 1.2) && (
            <p className="text-xs text-amber-600">
              Fahrer mit &gt;120% Ziel: Überarbeitung prüfen → Schicht früher beenden?
            </p>
          )}
        </div>
      )}
    </div>
  );
}
