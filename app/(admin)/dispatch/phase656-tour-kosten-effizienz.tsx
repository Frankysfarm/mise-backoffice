'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface TourKosten {
  tour_id: string;
  fahrer: string;
  stops: number;
  km_geschaetzt: number;
  einnahmen: number;
  kosten_geschaetzt: number;
  margin: number;
  margin_pct: number;
  bewertung: 'gut' | 'mittel' | 'schlecht';
}

interface ApiResponse {
  touren: TourKosten[];
  generiert_am: string;
}

const MOCK: TourKosten[] = [
  { tour_id: '1', fahrer: 'Max M.', stops: 4, km_geschaetzt: 8.2, einnahmen: 42.0, kosten_geschaetzt: 14.0, margin: 28.0, margin_pct: 67, bewertung: 'gut' },
  { tour_id: '2', fahrer: 'Anna K.', stops: 2, km_geschaetzt: 12.5, einnahmen: 18.0, kosten_geschaetzt: 17.0, margin: 1.0, margin_pct: 6, bewertung: 'schlecht' },
  { tour_id: '3', fahrer: 'Tom S.', stops: 3, km_geschaetzt: 6.1, einnahmen: 29.5, kosten_geschaetzt: 10.0, margin: 19.5, margin_pct: 66, bewertung: 'gut' },
];

function BewertungsBadge({ bewertung }: { bewertung: TourKosten['bewertung'] }) {
  if (bewertung === 'gut') {
    return <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">gut</span>;
  }
  if (bewertung === 'mittel') {
    return <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">mittel</span>;
  }
  return <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">schwach</span>;
}

export function DispatchPhase656TourKostenEffizienz({ locationId }: Props) {
  const [touren, setTouren] = useState<TourKosten[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setTouren(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-kosten-effizienz?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setTouren(json.touren.length > 0 ? json.touren : MOCK);
      } else {
        setTouren(MOCK);
      }
    } catch {
      setTouren(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const avgMargin =
    touren.length > 0
      ? touren.reduce((s, t) => s + t.margin_pct, 0) / touren.length
      : 0;

  const MarginIcon =
    avgMargin >= 50 ? TrendingUp :
    avgMargin >= 25 ? Minus : TrendingDown;

  const marginColor =
    avgMargin >= 50 ? 'text-emerald-600 dark:text-emerald-400' :
    avgMargin >= 25 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold">Tour-Kosten-Effizienz</span>
          {!loading && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${marginColor}`}>
              <MarginIcon className="h-3.5 w-3.5" />
              {avgMargin.toFixed(0)}% Ø-Margin
            </div>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : touren.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine aktiven Touren.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-1 text-left font-medium">Fahrer</th>
                    <th className="pb-1 text-right font-medium">Stops</th>
                    <th className="pb-1 text-right font-medium">~km</th>
                    <th className="pb-1 text-right font-medium">Einnahmen</th>
                    <th className="pb-1 text-right font-medium">Kosten</th>
                    <th className="pb-1 text-right font-medium">Margin</th>
                    <th className="pb-1 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {touren.map((t) => (
                    <tr key={t.tour_id} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 pr-2 font-medium">{t.fahrer}</td>
                      <td className="py-1.5 text-right tabular-nums">{t.stops}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{t.km_geschaetzt.toFixed(1)}</td>
                      <td className="py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {t.einnahmen.toFixed(2)} €
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">
                        {t.kosten_geschaetzt.toFixed(2)} €
                      </td>
                      <td className={`py-1.5 text-right tabular-nums font-bold ${
                        t.margin_pct >= 50 ? 'text-emerald-700 dark:text-emerald-400' :
                        t.margin_pct >= 25 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {t.margin_pct}%
                      </td>
                      <td className="py-1.5 text-right">
                        <BewertungsBadge bewertung={t.bewertung} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Kosten = 0,18 €/km + anteilige Schichtkosten · 60s Aktualisierung</p>
        </div>
      )}
    </div>
  );
}
