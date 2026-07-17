'use client';

import { useEffect, useMemo, useState } from 'react';
import { Route, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface FahrerKm {
  driver_id: string;
  name: string;
  km_heute: number;
  km_ziel: number;
  zielerreichung_pct: number;
}

export function KitchenPhase2157KilometerMonitor({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FahrerKm[]>([]);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tageskilometer?location_id=${locationId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { fahrer?: FahrerKm[] }) => setData(d.fahrer ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const overloaded = useMemo(
    () => data.filter((f) => f.zielerreichung_pct > 120),
    [data]
  );

  if (!data.length || !overloaded.length) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
          <Route className="h-4 w-4" />
          Kilometer-Monitor
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">
            {overloaded.length} überlastet
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
      </button>

      {open && (
        <div className="border-t border-amber-500/20 px-4 pb-4 pt-3 space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {overloaded.length} Fahrer über 120% Tagesziel — Überarbeitung möglich. Dispatch informieren.
            </span>
          </div>

          {overloaded.map((f) => (
            <div key={f.driver_id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span className="font-medium">{f.name}</span>
              <span className="text-amber-600 font-semibold">
                {f.km_heute.toFixed(1)} km · Ziel {f.km_ziel} km ({f.zielerreichung_pct}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
