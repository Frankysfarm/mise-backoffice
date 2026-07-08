'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  locationId: string;
}

interface StornoData {
  storno_heute: number;
  storno_gesamt_heute: number;
  storno_rate_heute: number;
  storno_rate_30d_avg: number;
  delta_pct: number;
  warnung: boolean;
}

export function FahrerPhase653SchichtStornoWarnung({ locationId }: Props) {
  const [data, setData] = useState<StornoData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(
          `/api/delivery/admin/storno-praevention?location_id=${locationId}`,
        );
        if (r.ok && !cancelled) {
          const json = await r.json();
          if (json.stornoRate !== undefined) {
            setData({
              storno_heute: json.stornoCount ?? 0,
              storno_gesamt_heute: json.gesamtHeute ?? 0,
              storno_rate_heute: json.stornoRate ?? 0,
              storno_rate_30d_avg: json.avgRate30d ?? 0,
              delta_pct: json.deltaRate ?? 0,
              warnung: json.warnung ?? false,
            });
          }
        }
      } catch {
        // silent — no warning shown if data unavailable
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locationId]);

  if (!data) return null;

  if (!data.warnung) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Storno-Rate normal
          </p>
          <p className="text-[10px] text-muted-foreground">
            {data.storno_rate_heute.toFixed(0)}% heute · Ø {data.storno_rate_30d_avg.toFixed(0)}% (30 Tage)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
          Erhöhte Storno-Rate heute
        </p>
        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
          {data.storno_heute} Stornos von {data.storno_gesamt_heute} Bestellungen
          ({data.storno_rate_heute.toFixed(0)}%)
          — Ø der letzten 30 Tage: {data.storno_rate_30d_avg.toFixed(0)}%
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          +{data.delta_pct.toFixed(0)} Prozentpunkte über Durchschnitt
        </p>
      </div>
    </div>
  );
}
