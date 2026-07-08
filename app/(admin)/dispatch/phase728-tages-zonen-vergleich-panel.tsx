'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ZonVergleich {
  zone: string;
  heute_umsatz: number;
  vorwoche_umsatz: number;
  umsatz_delta_pct: number;
  heute_bestellungen: number;
  vorwoche_bestellungen: number;
  heute_storno_pct: number;
  vorwoche_storno_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

const MOCK: ZonVergleich[] = [
  { zone: 'Zone A', heute_umsatz: 140, vorwoche_umsatz: 112, umsatz_delta_pct: 25, heute_bestellungen: 18, vorwoche_bestellungen: 14, heute_storno_pct: 5, vorwoche_storno_pct: 7, trend: 'besser' },
  { zone: 'Zone B', heute_umsatz: 88, vorwoche_umsatz: 91, umsatz_delta_pct: -3, heute_bestellungen: 12, vorwoche_bestellungen: 13, heute_storno_pct: 8, vorwoche_storno_pct: 6, trend: 'gleich' },
  { zone: 'Zone C', heute_umsatz: 42, vorwoche_umsatz: 68, umsatz_delta_pct: -38, heute_bestellungen: 5, vorwoche_bestellungen: 9, heute_storno_pct: 20, vorwoche_storno_pct: 11, trend: 'schlechter' },
];

function TrendIcon({ trend }: { trend: ZonVergleich['trend'] }) {
  if (trend === 'besser') return <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />;
  if (trend === 'schlechter') return <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function deltaColor(pct: number) {
  if (pct >= 5) return 'text-emerald-600 dark:text-emerald-400';
  if (pct <= -5) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

export function DispatchPhase728TagesZonenVergleichPanel({ locationId }: Props) {
  const [data, setData] = useState<ZonVergleich[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/tages-zonen-vergleich?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.zonen) && json.zonen.length > 0) {
          setData(json.zonen);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const schlechterCount = data.filter((z) => z.trend === 'schlechter').length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Zonen Heute vs. Vorwoche</span>
          {!loading && schlechterCount > 0 && (
            <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
              {schlechterCount} schlechter
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3">
          {loading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Zonendaten</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1.5 text-muted-foreground font-medium">Zone</th>
                    <th className="text-right pb-1.5 text-muted-foreground font-medium">Heute</th>
                    <th className="text-right pb-1.5 text-muted-foreground font-medium">Vorw.</th>
                    <th className="text-right pb-1.5 text-muted-foreground font-medium">Δ%</th>
                    <th className="text-center pb-1.5 text-muted-foreground font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((z) => (
                    <tr key={z.zone} className="border-b last:border-0">
                      <td className="py-1.5 font-medium">{z.zone}</td>
                      <td className="text-right py-1.5 tabular-nums">{z.heute_umsatz.toFixed(0)} €</td>
                      <td className="text-right py-1.5 tabular-nums text-muted-foreground">{z.vorwoche_umsatz.toFixed(0)} €</td>
                      <td className={`text-right py-1.5 tabular-nums font-bold ${deltaColor(z.umsatz_delta_pct)}`}>
                        {z.umsatz_delta_pct > 0 ? '+' : ''}{z.umsatz_delta_pct}%
                      </td>
                      <td className="py-1.5">
                        <div className="flex justify-center">
                          <TrendIcon trend={z.trend} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">5-Min Update · Vergleich: gleicher Wochentag Vorwoche</p>
        </div>
      )}
    </div>
  );
}
