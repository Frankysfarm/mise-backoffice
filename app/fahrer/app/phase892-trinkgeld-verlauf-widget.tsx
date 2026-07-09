'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * phase892 — Trinkgeld-Verlauf-Widget
 *
 * Mini-Balkendiagramm der letzten 7 Touren-Trinkgelder.
 * Zeigt Ø-Trinkgeld + Gesamt + Trend-Indikator (up/down/stable).
 * 10-Min-Polling gegen /api/delivery/driver/tip-history?limit=7, Fallback Mock.
 */

interface TrinkgeldTour {
  tour_id: string;
  datum: string;
  betrag_eur: number;
  bestellungen: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK_TOUREN: TrinkgeldTour[] = [
  { tour_id: '1', datum: '2026-07-03', betrag_eur: 2.50, bestellungen: 3 },
  { tour_id: '2', datum: '2026-07-04', betrag_eur: 1.00, bestellungen: 2 },
  { tour_id: '3', datum: '2026-07-05', betrag_eur: 3.80, bestellungen: 4 },
  { tour_id: '4', datum: '2026-07-06', betrag_eur: 0.00, bestellungen: 2 },
  { tour_id: '5', datum: '2026-07-07', betrag_eur: 4.50, bestellungen: 5 },
  { tour_id: '6', datum: '2026-07-08', betrag_eur: 2.00, bestellungen: 3 },
  { tour_id: '7', datum: '2026-07-09', betrag_eur: 3.20, bestellungen: 4 },
];

function calcTrend(touren: TrinkgeldTour[]): 'up' | 'down' | 'stable' {
  if (touren.length < 4) return 'stable';
  const recent = touren.slice(-3).reduce((s, t) => s + t.betrag_eur, 0) / 3;
  const prev   = touren.slice(-6, -3);
  if (!prev.length) return 'stable';
  const prevAvg = prev.reduce((s, t) => s + t.betrag_eur, 0) / prev.length;
  const delta = prevAvg > 0 ? (recent - prevAvg) / prevAvg : 0;
  return delta > 0.1 ? 'up' : delta < -0.1 ? 'down' : 'stable';
}

export function FahrerPhase892TrinkgeldVerlaufWidget({ driverId, isOnline }: Props) {
  const [touren, setTouren] = useState<TrinkgeldTour[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!isOnline || !driverId) return;
    setLoading(true);
    fetch(`/api/delivery/driver/tip-history?driver_id=${driverId}&limit=7`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        setTouren(d?.touren?.length ? (d.touren as TrinkgeldTour[]) : MOCK_TOUREN);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline || !touren.length) return null;

  const maxBetrag = Math.max(...touren.map(t => t.betrag_eur), 0.01);
  const avg       = touren.reduce((s, t) => s + t.betrag_eur, 0) / touren.length;
  const gesamt    = touren.reduce((s, t) => s + t.betrag_eur, 0);
  const trend     = calcTrend(touren);

  const TrendIcon =
    trend === 'up'   ? <TrendingUp   className="h-3.5 w-3.5 text-matcha-400"      /> :
    trend === 'down' ? <TrendingDown className="h-3.5 w-3.5 text-red-400"          /> :
                       <Minus         className="h-3.5 w-3.5 text-blue-300/70"     />;

  return (
    <section className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Euro className="h-4 w-4 text-yellow-300" />
        <span className="text-sm font-bold text-white">Trinkgeld-Verlauf</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-300 ml-auto" />}
        <div className="flex items-center gap-1 ml-auto">
          {TrendIcon}
          <span className={cn(
            'text-[10px] font-semibold',
            trend === 'up'   ? 'text-matcha-400' :
            trend === 'down' ? 'text-red-400'    : 'text-blue-300',
          )}>
            {trend === 'up' ? 'Steigend ↑' : trend === 'down' ? 'Fallend ↓' : 'Stabil →'}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/10 p-2 text-center">
          <div className="text-xs font-black text-yellow-300 tabular-nums">
            {avg.toFixed(2)}€
          </div>
          <div className="text-[8px] text-blue-300">Ø pro Tour</div>
        </div>
        <div className="rounded-xl bg-white/10 p-2 text-center">
          <div className="text-xs font-black text-white tabular-nums">
            {gesamt.toFixed(2)}€
          </div>
          <div className="text-[8px] text-blue-300">Gesamt (7T)</div>
        </div>
      </div>

      {/* Bar chart */}
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-blue-300 mb-2">
          Letzte 7 Touren
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {touren.map((t, i) => {
            const h = maxBetrag > 0 ? Math.max(4, Math.round((t.betrag_eur / maxBetrag) * 56)) : 4;
            const isLast = i === touren.length - 1;
            const color =
              t.betrag_eur === 0                  ? 'bg-white/20'     :
              t.betrag_eur >= avg * 1.3           ? 'bg-yellow-400'   :
              t.betrag_eur >= avg * 0.8           ? 'bg-matcha-400'   :
                                                    'bg-blue-300/60';
            return (
              <div key={t.tour_id} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[8px] text-white/60 tabular-nums">
                  {t.betrag_eur > 0 ? `${t.betrag_eur.toFixed(0)}€` : '–'}
                </span>
                <div
                  className={cn('w-full rounded-t transition-all duration-500', color, isLast ? 'ring-1 ring-yellow-300' : '')}
                  style={{ height: `${h}px` }}
                />
                <span className={cn('text-[8px] text-blue-300', isLast ? 'font-bold text-yellow-300' : '')}>
                  {new Date(t.datum).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Avg dashed line label */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 border-t border-dashed border-yellow-300/40" />
        <span className="text-[9px] text-yellow-300/70">Ø {avg.toFixed(2)}€</span>
        <div className="h-px flex-1 border-t border-dashed border-yellow-300/40" />
      </div>
    </section>
  );
}
