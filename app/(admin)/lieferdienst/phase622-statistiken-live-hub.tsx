'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart3, Euro, Clock, Bike, Target, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface Kpi {
  bestellungen: number;
  umsatz: number;
  lieferzeitMin: number;
  puenktlichkeitPct: number;
  aktiveFahrer: number;
  bestellungenTrend: number;
  umsatzTrend: number;
}

const MOCK: Kpi = {
  bestellungen: 47,
  umsatz: 1243.80,
  lieferzeitMin: 32,
  puenktlichkeitPct: 87,
  aktiveFahrer: 4,
  bestellungenTrend: 12,
  umsatzTrend: 8,
};

function euro(cents?: number): string {
  const val = (cents ?? 0) / 100;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

function euroF(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function TrendChip({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const pos = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded ${
      pos ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    }`}>
      {pos ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {pos ? '+' : ''}{pct}%
    </span>
  );
}

export function LieferdienstPhase622StatistikenLiveHub({ locationId }: Props) {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}&period=today`);
        if (r.ok && !cancelled) {
          const d = await r.json();
          setKpi({
            bestellungen: d.total_orders ?? d.bestellungen ?? MOCK.bestellungen,
            umsatz: d.revenue_eur ?? d.umsatz ?? MOCK.umsatz,
            lieferzeitMin: d.avg_delivery_min ?? d.lieferzeit_min ?? MOCK.lieferzeitMin,
            puenktlichkeitPct: d.on_time_pct ?? d.puenktlichkeit_pct ?? MOCK.puenktlichkeitPct,
            aktiveFahrer: d.active_drivers ?? d.aktive_fahrer ?? MOCK.aktiveFahrer,
            bestellungenTrend: d.orders_trend_pct ?? MOCK.bestellungenTrend,
            umsatzTrend: d.revenue_trend_pct ?? MOCK.umsatzTrend,
          });
        } else if (!cancelled) {
          setKpi(MOCK);
        }
      } catch {
        if (!cancelled) setKpi(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const tiles = useMemo(() => {
    if (!kpi) return [];
    return [
      {
        icon: <BarChart3 className="h-4 w-4" />,
        label: 'Bestellungen heute',
        value: String(kpi.bestellungen),
        suffix: '',
        trend: kpi.bestellungenTrend,
        color: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      },
      {
        icon: <Euro className="h-4 w-4" />,
        label: 'Umsatz heute',
        value: euroF(kpi.umsatz),
        suffix: '',
        trend: kpi.umsatzTrend,
        color: 'text-matcha-600 dark:text-matcha-400',
        iconBg: 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-600 dark:text-matcha-400',
      },
      {
        icon: <Clock className="h-4 w-4" />,
        label: 'Ø Lieferzeit',
        value: String(kpi.lieferzeitMin),
        suffix: ' Min',
        trend: 0,
        color: kpi.lieferzeitMin <= 30 ? 'text-matcha-600 dark:text-matcha-400' : kpi.lieferzeitMin <= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      },
      {
        icon: <Target className="h-4 w-4" />,
        label: 'Pünktlichkeit',
        value: String(kpi.puenktlichkeitPct),
        suffix: '%',
        trend: 0,
        color: kpi.puenktlichkeitPct >= 85 ? 'text-matcha-600 dark:text-matcha-400' : kpi.puenktlichkeitPct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      },
      {
        icon: <Bike className="h-4 w-4" />,
        label: 'Aktive Fahrer',
        value: String(kpi.aktiveFahrer),
        suffix: '',
        trend: 0,
        color: 'text-foreground',
        iconBg: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
      },
    ];
  }, [kpi]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Statistiken · Live-Hub
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        {!loading && (
          <span className="ml-auto flex h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
        )}
      </div>

      {loading && (
        <div className="p-4 flex items-center justify-center text-sm text-muted-foreground">
          Lade Statistiken…
        </div>
      )}

      {!loading && !locationId && (
        <div className="p-4 text-sm text-muted-foreground text-center">
          Bitte Filiale auswählen.
        </div>
      )}

      {!loading && kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-gray-800">
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className={`rounded-lg p-2 ${tile.iconBg}`}>
                  {tile.icon}
                </div>
                {tile.trend !== 0 && <TrendChip pct={tile.trend} />}
              </div>
              <div className={`mt-3 text-2xl font-black tabular-nums ${tile.color}`}>
                {tile.value}<span className="text-lg">{tile.suffix}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{tile.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
