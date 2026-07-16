'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

/**
 * Phase 1939 — Lieferstrecken-Visualisierung (Dispatch)
 *
 * Balken (Fahrer→km); Gesamt-KPI; Longest-Route-Alert; Trend-Pfeil; 30-Min-Polling.
 */

interface FahrerStrecke {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  touren_heute: number;
  avg_km_tour: number;
}

interface StreckenData {
  location_id: string;
  gesamt_km_heute: number;
  avg_km_tour: number;
  laengste_km: number;
  kuerzeste_km: number;
  trend_vs_vorwoche: number;
  alert_long_route: boolean;
  fahrer: FahrerStrecke[];
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase1939LieferstreckenVisualisierung({ locationId }: Props) {
  const [data, setData] = useState<StreckenData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/lieferstrecken-analyse?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const maxKm = data ? Math.max(...data.fahrer.map(f => f.km_heute), 1) : 1;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Route className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="font-semibold text-sm flex-1">Lieferstrecken</span>
        {data && (
          <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full px-2 py-0.5">
            {data.gesamt_km_heute} km heute
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <p className="text-xs text-muted-foreground text-center py-4">Lade Streckendaten…</p>
          ) : (
            <>
              {/* KPI-Kacheln */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-muted/20 p-2 text-center">
                  <div className="text-lg font-black text-indigo-600">{data.gesamt_km_heute}</div>
                  <div className="text-[9px] text-muted-foreground">Gesamt km</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2 text-center">
                  <div className="text-lg font-black text-foreground">{data.avg_km_tour}</div>
                  <div className="text-[9px] text-muted-foreground">Ø km/Tour</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-lg font-black text-foreground">
                      {Math.abs(data.trend_vs_vorwoche)}%
                    </span>
                    {data.trend_vs_vorwoche > 0
                      ? <TrendingUp className="h-3 w-3 text-red-500" />
                      : data.trend_vs_vorwoche < 0
                        ? <TrendingDown className="h-3 w-3 text-matcha-600" />
                        : <Minus className="h-3 w-3 text-muted-foreground" />
                    }
                  </div>
                  <div className="text-[9px] text-muted-foreground">vs. Vorwoche</div>
                </div>
              </div>

              {/* Alert */}
              {data.alert_long_route && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Ø Route über 30 km — Tourenplanung prüfen
                  </span>
                </div>
              )}

              {/* Fahrer-Balken */}
              <div className="space-y-2">
                {data.fahrer.map(f => (
                  <div key={f.fahrer_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate max-w-[120px]">{f.fahrer_name}</span>
                      <span className="text-xs font-bold tabular-nums text-indigo-600">{f.km_heute} km</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                        style={{ width: `${(f.km_heute / maxKm) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {f.touren_heute} Touren · Ø {f.avg_km_tour} km/Tour
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[9px] text-muted-foreground text-right">
                {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
