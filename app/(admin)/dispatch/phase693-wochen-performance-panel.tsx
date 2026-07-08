'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, CalendarDays } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface WochenKennzahl {
  umsatz: number;
  bestellungen: number;
  touren: number;
  storno_rate_pct: number;
  sla_pct: number | null;
  avg_lieferzeit_min: number | null;
}

interface ApiResponse {
  aktuell: WochenKennzahl;
  vorwoche: WochenKennzahl;
  delta: {
    umsatz_pct: number;
    bestellungen_pct: number;
    touren_pct: number;
    storno_delta_pct: number;
    sla_delta_pct: number | null;
  };
}

const MOCK: ApiResponse = {
  aktuell: { umsatz: 2340, bestellungen: 104, touren: 48, storno_rate_pct: 7, sla_pct: 87, avg_lieferzeit_min: 31 },
  vorwoche: { umsatz: 2120, bestellungen: 94, touren: 43, storno_rate_pct: 9, sla_pct: 83, avg_lieferzeit_min: 34 },
  delta: { umsatz_pct: 10, bestellungen_pct: 11, touren_pct: 12, storno_delta_pct: -2, sla_delta_pct: 4 },
};

function DeltaBadge({ val, invert = false }: { val: number; invert?: boolean }) {
  const positive = invert ? val < 0 : val > 0;
  const neutral = val === 0;
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  const cls = neutral
    ? 'text-muted-foreground'
    : positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {val > 0 ? `+${val}` : val}{!neutral && '%'}
    </span>
  );
}

function KpiRow({ label, aktuell, vorwoche, delta, unit = '', invert = false }: {
  label: string; aktuell: string; vorwoche: string; delta: number; unit?: string; invert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{aktuell}{unit}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{vorwoche}{unit}</span>
      <DeltaBadge val={delta} invert={invert} />
    </div>
  );
}

export function DispatchPhase693WochenPerformancePanel({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
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
        `/api/delivery/admin/wochen-performance-vergleich?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
  }, [laden]);

  const trend = data
    ? data.delta.umsatz_pct >= 5
      ? 'besser'
      : data.delta.umsatz_pct <= -5
      ? 'schlechter'
      : 'stabil'
    : null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold">Woche vs. Vorwoche</span>
          {!loading && trend && (
            <span className={`text-[10px] font-semibold ${
              trend === 'besser' ? 'text-emerald-600 dark:text-emerald-400' :
              trend === 'schlechter' ? 'text-red-600 dark:text-red-400' :
              'text-muted-foreground'
            }`}>
              {trend === 'besser' ? '↑ Besser als letzte Woche' :
               trend === 'schlechter' ? '↓ Schwächer als letzte Woche' : '= Vergleichbar'}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-1">
          {loading || !data ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <div className="flex items-center justify-between pb-1 text-[10px] font-medium text-muted-foreground">
                <span className="w-32">Kennzahl</span>
                <span>Diese Woche</span>
                <span>Letzte Woche</span>
                <span>Δ</span>
              </div>
              <KpiRow
                label="Umsatz"
                aktuell={`${data.aktuell.umsatz.toFixed(0)} €`}
                vorwoche={`${data.vorwoche.umsatz.toFixed(0)} €`}
                delta={data.delta.umsatz_pct}
              />
              <KpiRow
                label="Bestellungen"
                aktuell={`${data.aktuell.bestellungen}`}
                vorwoche={`${data.vorwoche.bestellungen}`}
                delta={data.delta.bestellungen_pct}
              />
              <KpiRow
                label="Touren"
                aktuell={`${data.aktuell.touren}`}
                vorwoche={`${data.vorwoche.touren}`}
                delta={data.delta.touren_pct}
              />
              <KpiRow
                label="Storno-Rate"
                aktuell={`${data.aktuell.storno_rate_pct}%`}
                vorwoche={`${data.vorwoche.storno_rate_pct}%`}
                delta={data.delta.storno_delta_pct}
                invert
              />
              {data.aktuell.sla_pct !== null && data.vorwoche.sla_pct !== null && (
                <KpiRow
                  label="SLA-Pünktlichkeit"
                  aktuell={`${data.aktuell.sla_pct}%`}
                  vorwoche={`${data.vorwoche.sla_pct}%`}
                  delta={data.delta.sla_delta_pct ?? 0}
                />
              )}
            </>
          )}
          <p className="text-[10px] text-muted-foreground pt-1">Montag–Heute vs. Vorwoche gleicher Zeitraum</p>
        </div>
      )}
    </div>
  );
}
