'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerKm {
  driver_id: string;
  name: string;
  km_heute: number;
  km_ziel: number;
  zielerreichung_pct: number;
  km_7tage_avg: number;
  trend: 'up' | 'down' | 'gleich';
  trend_delta_km: number;
}

interface ApiData {
  fahrer: FahrerKm[];
  team_km_gesamt: number;
  team_zielerreichung_pct: number;
  alert_count: number;
}

export function DispatchPhase2154TageskilometerBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tageskilometer?location_id=${locationId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const fahrer = data?.fahrer ?? [];
  const alerts = fahrer.filter((f) => {
    const h = new Date().getHours();
    return h >= 14 && f.zielerreichung_pct < 50;
  });

  if (!fahrer.length) return null;

  const teamAvg = data ? data.team_km_gesamt / fahrer.length : 0;

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
            {[...fahrer].sort((a, b) => b.km_heute - a.km_heute).map((f) => {
              const pct = Math.min(1, f.zielerreichung_pct / 100);
              const overTarget = f.zielerreichung_pct > 120;
              const barColor = overTarget
                ? 'bg-amber-500'
                : pct >= 0.8
                ? 'bg-emerald-500'
                : pct >= 0.5
                ? 'bg-yellow-400'
                : 'bg-red-500';

              return (
                <div key={f.driver_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Route className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{f.name}</span>
                      {f.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                      {f.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                    </div>
                    <span className={cn('font-semibold', overTarget && 'text-amber-600')}>
                      {f.km_heute.toFixed(1)} / {f.km_ziel} km
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {fahrer.some((f) => f.zielerreichung_pct > 120) && (
            <p className="text-xs text-amber-600">
              Fahrer mit &gt;120% Ziel: Überarbeitung prüfen → Schicht früher beenden?
            </p>
          )}
        </div>
      )}
    </div>
  );
}
