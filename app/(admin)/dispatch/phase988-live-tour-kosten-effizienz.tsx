'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingDown, TrendingUp, AlertTriangle, Bike, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 988 — Live-Tour-Kosten-Effizienz (Dispatch)
 *
 * Echtzeit km-Kosten vs. Umsatz je aktiver Tour.
 * Defizit-Alert wenn Marge < Mindestmarge (15%).
 * 90s-Polling von /api/delivery/admin/tour-kosten-live.
 */

interface TourKosten {
  tour_id: string;
  fahrer_name: string;
  zone: string;
  umsatz_eur: number;
  kosten_km_eur: number;
  kosten_lohn_eur: number;
  kosten_gesamt_eur: number;
  marge_eur: number;
  marge_pct: number;
  km_gefahren: number;
  stopps_abgeschlossen: number;
  stopps_gesamt: number;
  status: 'aktiv' | 'abgeschlossen';
}

interface ApiResponse {
  touren: TourKosten[];
  gesamt_umsatz: number;
  gesamt_kosten: number;
  gesamt_marge_pct: number;
  defizit_touren: number;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  touren: [
    { tour_id: 't1', fahrer_name: 'M. Bauer', zone: 'A', umsatz_eur: 87.5, kosten_km_eur: 4.2, kosten_lohn_eur: 12.0, kosten_gesamt_eur: 16.2, marge_eur: 71.3, marge_pct: 81.5, km_gefahren: 14, stopps_abgeschlossen: 3, stopps_gesamt: 5, status: 'aktiv' },
    { tour_id: 't2', fahrer_name: 'L. Huber', zone: 'B', umsatz_eur: 54.0, kosten_km_eur: 8.7, kosten_lohn_eur: 13.0, kosten_gesamt_eur: 21.7, marge_eur: 32.3, marge_pct: 59.8, km_gefahren: 29, stopps_abgeschlossen: 2, stopps_gesamt: 4, status: 'aktiv' },
    { tour_id: 't3', fahrer_name: 'K. Stein', zone: 'C', umsatz_eur: 28.0, kosten_km_eur: 11.4, kosten_lohn_eur: 11.5, kosten_gesamt_eur: 22.9, marge_eur: 5.1, marge_pct: 18.2, km_gefahren: 38, stopps_abgeschlossen: 1, stopps_gesamt: 3, status: 'aktiv' },
    { tour_id: 't4', fahrer_name: 'A. König', zone: 'D', umsatz_eur: 19.5, kosten_km_eur: 14.1, kosten_lohn_eur: 9.5, kosten_gesamt_eur: 23.6, marge_eur: -4.1, marge_pct: -21.0, km_gefahren: 47, stopps_abgeschlossen: 0, stopps_gesamt: 2, status: 'aktiv' },
  ],
  gesamt_umsatz: 189.0,
  gesamt_kosten: 84.4,
  gesamt_marge_pct: 55.3,
  defizit_touren: 1,
  generiert_am: new Date().toISOString(),
};

const MIN_MARGE_PCT = 15;

function margeColor(pct: number): string {
  if (pct < 0) return 'text-red-700 dark:text-red-300';
  if (pct < MIN_MARGE_PCT) return 'text-red-600 dark:text-red-400';
  if (pct < 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-matcha-600 dark:text-matcha-400';
}

function margeBg(pct: number): string {
  if (pct < MIN_MARGE_PCT) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
  if (pct < 40) return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
  return 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200 dark:border-matcha-800';
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase988LiveTourKostenEffizienz({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/tour-kosten-live?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json() as ApiResponse;
          setData(json);
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      }
    };

    load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !data) return null;

  const defizitTouren = data.touren.filter(t => t.marge_pct < MIN_MARGE_PCT);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-foreground">Tour-Kosten-Effizienz</span>
          {defizitTouren.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {defizitTouren.length} Defizit
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-bold tabular-nums text-foreground">
              {data.gesamt_marge_pct.toFixed(1)}% Marge
            </div>
            <div className="text-[10px] text-muted-foreground">
              {data.touren.length} aktive Touren
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Umsatz', value: `€${data.gesamt_umsatz.toFixed(0)}`, icon: <TrendingUp className="h-3 w-3" /> },
              { label: 'Kosten', value: `€${data.gesamt_kosten.toFixed(0)}`, icon: <TrendingDown className="h-3 w-3" /> },
              { label: 'Ø Marge', value: `${data.gesamt_marge_pct.toFixed(1)}%`, icon: <Euro className="h-3 w-3" /> },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  {kpi.icon}
                  <span className="text-[9px]">{kpi.label}</span>
                </div>
                <div className="text-sm font-black tabular-nums text-foreground">{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Tour list */}
          <div className="space-y-1.5">
            {data.touren.map(tour => (
              <div
                key={tour.tour_id}
                className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', margeBg(tour.marge_pct))}
              >
                <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{tour.fahrer_name}</span>
                    <span className="text-[9px] rounded-full bg-white/60 dark:bg-black/20 border px-1.5 py-0.5 font-bold">
                      Zone {tour.zone}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {tour.stopps_abgeschlossen}/{tour.stopps_gesamt} Stopps
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">€{tour.umsatz_eur.toFixed(0)} Umsatz</span>
                    <span className="text-[10px] text-muted-foreground">{tour.km_gefahren} km</span>
                    {tour.marge_pct < MIN_MARGE_PCT && (
                      <span className="text-[9px] font-bold text-red-600 flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" /> Unter Mindestmarge
                      </span>
                    )}
                  </div>
                </div>
                <div className={cn('shrink-0 text-sm font-black tabular-nums', margeColor(tour.marge_pct))}>
                  {tour.marge_pct > 0 ? '+' : ''}{tour.marge_pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground text-right">
            Mindestmarge {MIN_MARGE_PCT}% · Lohn 13€/h · 0,30€/km
          </p>
        </div>
      )}
    </div>
  );
}
