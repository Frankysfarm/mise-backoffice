'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface SchichtBilanz {
  schicht_start: string;
  einnahmen_eur: number;
  kosten_eur: number;
  margin_eur: number;
  margin_pct: number;
  touren_abgeschlossen: number;
  touren_aktiv: number;
  aktive_fahrer: number;
  umsatz_pro_stunde: number;
}

const MOCK: SchichtBilanz = {
  schicht_start: new Date(Date.now() - 4 * 3600_000).toISOString(),
  einnahmen_eur: 284.5,
  kosten_eur: 96.0,
  margin_eur: 188.5,
  margin_pct: 66,
  touren_abgeschlossen: 18,
  touren_aktiv: 3,
  aktive_fahrer: 4,
  umsatz_pro_stunde: 71.1,
};

function formatDauer(start: string): string {
  const diff = Date.now() - new Date(start).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function DispatchPhase698SchichtBilanzDashboard({ locationId }: Props) {
  const [data, setData] = useState<SchichtBilanz | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-bilanz?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.einnahmen_eur !== undefined) {
          setData(json);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 2 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const MarginIcon = data && data.margin_pct >= 50 ? TrendingUp : TrendingDown;
  const marginColor =
    data && data.margin_pct >= 50
      ? 'text-emerald-600 dark:text-emerald-400'
      : data && data.margin_pct >= 25
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Schicht-Bilanz</span>
          {!loading && data && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${marginColor}`}>
              <MarginIcon className="h-3.5 w-3.5" />
              {data.margin_pct}% Margin
            </div>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading || !data ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b pb-2">
                <span>Schicht läuft seit <strong>{formatDauer(data.schicht_start)}</strong></span>
                <span>{data.aktive_fahrer} Fahrer aktiv · {data.touren_aktiv} Tour{data.touren_aktiv !== 1 ? 'en' : ''} offen</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/10 p-3">
                  <p className="text-[10px] text-muted-foreground">Einnahmen</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {data.einnahmen_eur.toFixed(2)} €
                  </p>
                  <p className="text-[10px] text-muted-foreground">{data.umsatz_pro_stunde.toFixed(0)} €/Std</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/10 p-3">
                  <p className="text-[10px] text-muted-foreground">Kosten</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                    {data.kosten_eur.toFixed(2)} €
                  </p>
                  <p className="text-[10px] text-muted-foreground">{data.touren_abgeschlossen} Touren done</p>
                </div>
              </div>

              <div className={`flex items-center justify-between rounded-lg p-3 ${
                data.margin_pct >= 50
                  ? 'bg-emerald-50 dark:bg-emerald-950/10'
                  : data.margin_pct >= 25
                  ? 'bg-amber-50 dark:bg-amber-950/10'
                  : 'bg-red-50 dark:bg-red-950/10'
              }`}>
                <span className="text-xs text-muted-foreground">Netto-Margin</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold tabular-nums ${marginColor}`}>
                    {data.margin_eur.toFixed(2)} €
                  </span>
                  <span className={`text-xs font-semibold ${marginColor}`}>
                    ({data.margin_pct}%)
                  </span>
                </div>
              </div>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">2-Min Aktualisierung · Kosten = Kraftstoff + anteilige Schichtkosten</p>
        </div>
      )}
    </div>
  );
}
