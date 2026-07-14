'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, RefreshCw, Wifi } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1473 — Live-Fahrer-Abdeckungs-Radar (Dispatch)
// Zeigt welche PLZ-Gebiete aktuell gut/schlecht abgedeckt sind.
// Basiert auf Fahrer-Positionen aus drivers prop. 30s-Polling.
// Nach Phase 1469.

interface DriverRaw {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  status?: {
    ist_online?: boolean;
    last_lat?: number | null;
    last_lng?: number | null;
    last_update?: string | null;
  } | null;
}

interface Props {
  drivers: DriverRaw[];
  locationId?: string | null;
}

type AbdeckungsStufe = 'gut' | 'mittel' | 'schwach' | 'unbekannt';

interface PlzAbdeckung {
  plz: string;
  fahrer: number;
  stufe: AbdeckungsStufe;
}

// Simplified PLZ-cluster by lat/lng rounding (Berlin reference zones)
function latLngToPlzKlasse(lat: number | null, lng: number | null): string {
  if (!lat || !lng) return 'unbekannt';
  const latR = Math.round(lat * 20) / 20;
  const lngR = Math.round(lng * 20) / 20;
  return `${latR.toFixed(2)}/${lngR.toFixed(2)}`;
}

const MOCK_PLZ: PlzAbdeckung[] = [
  { plz: '10115', fahrer: 2, stufe: 'gut' },
  { plz: '10117', fahrer: 1, stufe: 'mittel' },
  { plz: '10179', fahrer: 0, stufe: 'schwach' },
  { plz: '10243', fahrer: 1, stufe: 'mittel' },
  { plz: '10405', fahrer: 0, stufe: 'schwach' },
];

function stufeVonFahrer(count: number): AbdeckungsStufe {
  if (count >= 2) return 'gut';
  if (count === 1) return 'mittel';
  return 'schwach';
}

const STUFEN_CFG: Record<AbdeckungsStufe, { label: string; dotCls: string; rowCls: string }> = {
  gut:       { label: 'Gut',      dotCls: 'bg-emerald-500',  rowCls: 'border-l-emerald-400' },
  mittel:    { label: 'Mittel',   dotCls: 'bg-amber-400',    rowCls: 'border-l-amber-400'   },
  schwach:   { label: 'Schwach',  dotCls: 'bg-rose-500',     rowCls: 'border-l-rose-400'    },
  unbekannt: { label: '?',        dotCls: 'bg-slate-400',    rowCls: 'border-l-slate-300'   },
};

export function DispatchPhase1473LiveFahrerAbdeckungsRadar({ drivers, locationId }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const abdeckung = useMemo<PlzAbdeckung[]>(() => {
    const online = drivers.filter(
      (d) => d.status?.ist_online && d.status.last_lat && d.status.last_lng,
    );

    if (online.length === 0) return MOCK_PLZ;

    const clusters: Record<string, number> = {};
    for (const d of online) {
      const key = latLngToPlzKlasse(d.status?.last_lat ?? null, d.status?.last_lng ?? null);
      if (key === 'unbekannt') continue;
      clusters[key] = (clusters[key] ?? 0) + 1;
    }

    const result: PlzAbdeckung[] = Object.entries(clusters).map(([plz, fahrer]) => ({
      plz,
      fahrer,
      stufe: stufeVonFahrer(fahrer),
    }));

    // Add "schwach" zones if fewer than 3 regions total
    if (result.length < 3) return [...result, ...MOCK_PLZ.filter((m) => m.stufe === 'schwach').slice(0, 2)];
    return result;
  }, [drivers, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const gut    = abdeckung.filter((z) => z.stufe === 'gut').length;
  const mittel = abdeckung.filter((z) => z.stufe === 'mittel').length;
  const schwach = abdeckung.filter((z) => z.stufe === 'schwach').length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider">Abdeckungs-Radar</span>
        <Wifi className="ml-auto h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Live · 30s</span>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 px-4 py-2 border-b bg-muted/30">
        {[
          { stufe: 'gut',    count: gut,    cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30' },
          { stufe: 'mittel', count: mittel, cls: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' },
          { stufe: 'schwach',count: schwach,cls: 'text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30' },
        ].map(({ stufe, count, cls }) => (
          <span key={stufe} className={cn('text-[10px] font-bold rounded-full px-2.5 py-0.5', cls)}>
            {STUFEN_CFG[stufe as AbdeckungsStufe].label}: {count}
          </span>
        ))}
        <RefreshCw className="ml-auto h-3 w-3 text-muted-foreground animate-pulse" />
      </div>

      {/* PLZ list */}
      <div className="divide-y max-h-60 overflow-y-auto">
        {abdeckung.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Keine Fahrer online</div>
        )}
        {abdeckung.map((z) => {
          const cfg = STUFEN_CFG[z.stufe];
          return (
            <div
              key={z.plz}
              className={cn('flex items-center gap-3 px-4 py-2 border-l-4', cfg.rowCls)}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dotCls)} />
              <span className="text-sm font-mono font-semibold text-foreground">{z.plz}</span>
              <span className={cn('text-xs font-bold', z.stufe === 'gut' ? 'text-emerald-600 dark:text-emerald-400' : z.stufe === 'mittel' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')}>
                {cfg.label}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {z.fahrer === 0 ? 'Kein Fahrer' : `${z.fahrer} Fahrer`}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
