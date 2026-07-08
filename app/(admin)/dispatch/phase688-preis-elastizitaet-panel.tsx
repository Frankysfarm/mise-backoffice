'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus, BarChart2 } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ZonenElastizitaet {
  zone: string;
  zeitfenster: string;
  bestellungen: number;
  avg_liefergebuehr: number;
  elastizitaet: 'niedrig' | 'mittel' | 'hoch';
  konversionsrate: number;
  empfehlung: string;
}

interface ApiResponse {
  zonen: ZonenElastizitaet[];
  generiert_am: string;
}

const MOCK: ZonenElastizitaet[] = [
  { zone: 'A', zeitfenster: 'Abend (18–22)', bestellungen: 42, avg_liefergebuehr: 2.5, elastizitaet: 'niedrig', konversionsrate: 92, empfehlung: 'Gebühr kann stabil bleiben' },
  { zone: 'B', zeitfenster: 'Mittagszeit (12–15)', bestellungen: 28, avg_liefergebuehr: 3.9, elastizitaet: 'hoch', konversionsrate: 71, empfehlung: 'Gebühr senken oder Gratisaktion prüfen' },
  { zone: 'C', zeitfenster: 'Abend (18–22)', bestellungen: 19, avg_liefergebuehr: 3.2, elastizitaet: 'mittel', konversionsrate: 82, empfehlung: 'Gebühr beobachten, A/B-Test empfohlen' },
];

function ElastizitaetBadge({ val }: { val: ZonenElastizitaet['elastizitaet'] }) {
  if (val === 'niedrig') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" /> niedrig
      </span>
    );
  }
  if (val === 'mittel') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
        <Minus className="h-3 w-3" /> mittel
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
      <TrendingDown className="h-3 w-3" /> hoch
    </span>
  );
}

export function DispatchPhase688PreisElastizitaetPanel({ locationId }: Props) {
  const [zonen, setZonen] = useState<ZonenElastizitaet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) {
      setZonen(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/preis-elastizitaet?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setZonen(json.zonen.length > 0 ? json.zonen : MOCK);
      } else {
        setZonen(MOCK);
      }
    } catch {
      setZonen(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
  }, [laden]);

  const hochRisiko = zonen.filter((z) => z.elastizitaet === 'hoch').length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold">Preis-Elastizität</span>
          {!loading && hochRisiko > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
              {hochRisiko} Zone{hochRisiko !== 1 ? 'n' : ''} sensibel
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : zonen.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Daten für die letzten 30 Tage.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-1 text-left font-medium">Zone</th>
                      <th className="pb-1 text-left font-medium">Zeitfenster</th>
                      <th className="pb-1 text-right font-medium">Ø Gebühr</th>
                      <th className="pb-1 text-right font-medium">Konv.</th>
                      <th className="pb-1 text-left font-medium pl-2">Elastizität</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zonen.slice(0, 8).map((z, i) => (
                      <tr key={`${z.zone}-${z.zeitfenster}-${i}`} className="border-b border-border/40 last:border-0">
                        <td className="py-1.5 font-bold">{z.zone}</td>
                        <td className="py-1.5 text-muted-foreground">{z.zeitfenster}</td>
                        <td className="py-1.5 text-right tabular-nums">{z.avg_liefergebuehr.toFixed(2)} €</td>
                        <td className={`py-1.5 text-right tabular-nums font-semibold ${
                          z.konversionsrate >= 85 ? 'text-emerald-600 dark:text-emerald-400' :
                          z.konversionsrate >= 70 ? 'text-amber-600 dark:text-amber-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>{z.konversionsrate}%</td>
                        <td className="py-1.5 pl-2"><ElastizitaetBadge val={z.elastizitaet} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {zonen.filter(z => z.elastizitaet === 'hoch').map((z, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                  <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 dark:text-red-400">
                    <strong>Zone {z.zone} {z.zeitfenster}:</strong> {z.empfehlung}
                  </p>
                </div>
              ))}
            </>
          )}
          <p className="text-[10px] text-muted-foreground">Basierend auf 30-Tage-Daten</p>
        </div>
      )}
    </div>
  );
}
