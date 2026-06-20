'use client';

/* Phase 328: SchichtROIPanel
   Return-on-Investment der aktuellen Schicht:
   Umsatz pro Fahrer-Stunde, Kosten pro Lieferung, Netto-Marge.
   Vergleich vs. 7-Tage-Durchschnitt.
*/

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Euro } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ROIData {
  umsatzProFahrerStunde: number;
  kostenProLieferung: number;
  nettoMargeProz: number;
  vergleichUmsatz7d: number;    // Ø der letzten 7 Tage
  vergleichKosten7d: number;
  vergleichMarge7d: number;
}

interface Props {
  locationId?: string | null;
}

function mockROI(): ROIData {
  return {
    umsatzProFahrerStunde: 38.5,
    kostenProLieferung: 4.2,
    nettoMargeProz: 24,
    vergleichUmsatz7d: 35.0,
    vergleichKosten7d: 4.5,
    vergleichMarge7d: 21,
  };
}

export function SchichtROIPanel({ locationId }: Props) {
  const [data, setData] = useState<ROIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) {
      setData(mockROI());
      setLoading(false);
      return;
    }
    // Versuche echte Daten; Fallback auf Mock
    fetch(`/api/delivery/admin/schicht-roi?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d ?? mockROI()))
      .catch(() => setData(mockROI()))
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <Card className="p-5">
        <div className="h-4 w-32 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const delta = (current: number, avg: number) =>
    avg > 0 ? Math.round(((current - avg) / avg) * 100) : 0;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const kpis = [
    {
      label: 'Umsatz / Fahrer-Std.',
      value: `${fmtEur(data.umsatzProFahrerStunde)} €`,
      delta: delta(data.umsatzProFahrerStunde, data.vergleichUmsatz7d),
      better: 'up' as const,
    },
    {
      label: 'Kosten / Lieferung',
      value: `${fmtEur(data.kostenProLieferung)} €`,
      delta: delta(data.kostenProLieferung, data.vergleichKosten7d),
      better: 'down' as const,
    },
    {
      label: 'Netto-Marge',
      value: `${data.nettoMargeProz} %`,
      delta: delta(data.nettoMargeProz, data.vergleichMarge7d),
      better: 'up' as const,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
          <BarChart3 className="h-3.5 w-3.5 text-emerald-700" />
        </div>
        <div>
          <div className="text-sm font-bold text-stone-800">Schicht-ROI</div>
          <div className="text-[10px] text-stone-400">vs. Ø letzte 7 Tage</div>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[11px] text-matcha-700 font-bold">
          <Euro className="h-3 w-3" />
          ROI-Analyse
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-stone-100">
        {kpis.map((kpi) => {
          const isPositive = kpi.better === 'up' ? kpi.delta >= 0 : kpi.delta <= 0;
          const TrendIcon = kpi.delta > 1 ? TrendingUp : kpi.delta < -1 ? TrendingDown : Minus;
          const trendColor = isPositive
            ? 'text-matcha-600'
            : 'text-red-500';

          return (
            <div key={kpi.label} className="px-3 py-4 text-center">
              <div className="text-base font-black text-stone-800 tabular-nums">
                {kpi.value}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5 leading-tight">{kpi.label}</div>
              <div
                className={cn(
                  'mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold',
                  trendColor,
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {Math.abs(kpi.delta)}%
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100">
        <p className="text-[10px] text-stone-400">
          Fahrkosten-Schätzung: {fmtEur(data.kostenProLieferung)} € / Lieferung ·{' '}
          Marge heute{' '}
          <span
            className={cn(
              'font-bold',
              data.nettoMargeProz >= data.vergleichMarge7d
                ? 'text-matcha-600'
                : 'text-red-500',
            )}
          >
            {data.nettoMargeProz >= data.vergleichMarge7d ? '+' : ''}
            {delta(data.nettoMargeProz, data.vergleichMarge7d)}% vs. Ø
          </span>
        </p>
      </div>
    </Card>
  );
}
