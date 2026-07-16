'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, AlertTriangle, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

/**
 * Phase 1919 — Zonen-Heatmap-Karte (Dispatch)
 *
 * Balkendiagramm Zonen nach Lieferzeit-Farbe (grün/amber/rot); Slow-Zone-Alert-Banner;
 * Sortierbar; 30-Min-Polling.
 */

interface ZoneStats {
  zone: string;
  anzahl: number;
  avg_lieferzeit_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  slow_zone_alert: boolean;
}

interface HeatmapDaten {
  zonen: ZoneStats[];
  gesamt_avg_min: number;
  slow_zone_count: number;
}

const MOCK: HeatmapDaten = {
  zonen: [
    { zone: '10115', anzahl: 34, avg_lieferzeit_min: 18, ampel: 'gruen', slow_zone_alert: false },
    { zone: '10117', anzahl: 27, avg_lieferzeit_min: 22, ampel: 'gruen', slow_zone_alert: false },
    { zone: '10119', anzahl: 19, avg_lieferzeit_min: 31, ampel: 'gelb', slow_zone_alert: false },
    { zone: '10178', anzahl: 12, avg_lieferzeit_min: 42, ampel: 'rot', slow_zone_alert: true },
    { zone: '10243', anzahl: 8, avg_lieferzeit_min: 38, ampel: 'rot', slow_zone_alert: true },
  ],
  gesamt_avg_min: 26,
  slow_zone_count: 2,
};

type SortKey = 'anzahl' | 'avg_lieferzeit_min' | 'zone';

export function DispatchPhase1919ZonenHeatmapKarte({ locationId, className }: { locationId: string | null; className?: string }) {
  const [daten, setDaten] = useState<HeatmapDaten | null>(null);
  const [offen, setOffen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('anzahl');

  useEffect(() => {
    if (!locationId) { setDaten(MOCK); return; }

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/zonen-lieferheatmap?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        setDaten({ zonen: json.zonen ?? [], gesamt_avg_min: json.gesamt_avg_min ?? 25, slow_zone_count: json.slow_zone_count ?? 0 });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!daten) return null;

  const sortiert = [...daten.zonen].sort((a, b) => {
    if (sortKey === 'zone') return a.zone.localeCompare(b.zone);
    if (sortKey === 'avg_lieferzeit_min') return a.avg_lieferzeit_min - b.avg_lieferzeit_min;
    return b.anzahl - a.anzahl;
  });

  const maxAnzahl = Math.max(...sortiert.map((z) => z.anzahl), 1);
  const ampelKlasse = (a: ZoneStats['ampel']) =>
    a === 'gruen' ? 'bg-green-500' : a === 'gelb' ? 'bg-amber-500' : 'bg-red-500';
  const ampelText = (a: ZoneStats['ampel']) =>
    a === 'gruen' ? 'text-green-700 dark:text-green-300' : a === 'gelb' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Map className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Heatmap</span>
        <span className="ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
          {sortiert.length} Zonen · Ø {daten.gesamt_avg_min} Min
        </span>
        {daten.slow_zone_count > 0 && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            {daten.slow_zone_count} langsam!
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {daten.slow_zone_count > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700 dark:text-red-300">
                {daten.slow_zone_count} Zone{daten.slow_zone_count > 1 ? 'n' : ''} mehr als 30% über Gesamtschnitt — Fahrer prüfen!
              </p>
            </div>
          )}

          {/* Sort-Buttons */}
          <div className="flex gap-1.5">
            {(['anzahl', 'avg_lieferzeit_min', 'zone'] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={cn(
                  'text-[10px] font-semibold rounded-full px-2.5 py-1 border transition-colors',
                  sortKey === k
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60',
                )}
              >
                {k === 'anzahl' ? 'Volumen' : k === 'avg_lieferzeit_min' ? 'Lieferzeit' : 'PLZ'}
              </button>
            ))}
          </div>

          {/* Balken */}
          <div className="space-y-2">
            {sortiert.map((z) => (
              <div key={z.zone} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-bold', ampelText(z.ampel))}>{z.zone}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{z.anzahl} Liefer.</span>
                    <span className={cn('font-bold', ampelText(z.ampel))}>{z.avg_lieferzeit_min} Min</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', ampelKlasse(z.ampel))}
                    style={{ width: `${(z.anzahl / maxAnzahl) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Gesamt-Ø {daten.gesamt_avg_min} Min · letzte 7 Tage · 30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
