'use client';

/**
 * DispatchEchtzeitGewinnPanel — Phase 278
 *
 * Zeigt für jede aktive Tour den Echtzeit-Deckungsbeitrag:
 *   Umsatz der Bestellungen − geschätzte Fahrerkosten = Bruttogewinn
 *
 * Fahrerkosten-Schätzung:
 *   - 0,30 € / km × Tourlänge
 *   - Fahrerpauschale: 2,50 € / Stopp
 *
 * Aggregiert auch Session-Gesamtgewinn der aktuellen Schicht.
 */

import { useEffect, useState } from 'react';
import { Bike, Car, Euro, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';

interface Stop {
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    gesamtbetrag?: number;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
}

interface Props {
  batches: Batch[];
}

const COST_PER_KM = 0.30;
const COST_PER_STOP = 2.50;

function calcTourProfit(batch: Batch): { revenue: number; cost: number; profit: number; margin: number } {
  const revenue = batch.stops.reduce((sum, s) => sum + (s.order?.gesamtbetrag ?? 0), 0);
  const km      = batch.total_distance_km ?? 0;
  const stops   = batch.stops.length;
  const cost    = km * COST_PER_KM + stops * COST_PER_STOP;
  const profit  = revenue - cost;
  const margin  = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, cost, profit, margin };
}

export function DispatchEchtzeitGewinnPanel({ batches }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = batches.filter(b =>
    ['unterwegs', 'on_route', 'gestartet', 'aktiv'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  const totals = activeBatches.reduce(
    (acc, b) => {
      const { revenue, cost, profit } = calcTourProfit(b);
      return { revenue: acc.revenue + revenue, cost: acc.cost + cost, profit: acc.profit + profit };
    },
    { revenue: 0, cost: 0, profit: 0 },
  );

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
            Echtzeit-Gewinn Monitor
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-gray-500">
            Umsatz: <span className="font-bold text-gray-700">{euro(totals.revenue)}</span>
          </div>
          <div className={cn(
            'font-black tabular-nums px-2 py-0.5 rounded-full text-[11px]',
            totals.profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600',
          )}>
            {totals.profit >= 0 ? '+' : ''}{euro(totals.profit)} Beitrag
          </div>
        </div>
      </div>

      {/* Session Totals Strip */}
      <div className="grid grid-cols-3 divide-x border-b bg-gray-50">
        {[
          { label: 'Umsatz aktiv',  value: euro(totals.revenue), color: 'text-gray-800' },
          { label: 'Fahrkosten Ø', value: euro(totals.cost),    color: 'text-amber-700' },
          { label: 'Deckungsbeitrag', value: `${euro(totals.profit)}`, color: totals.profit >= 0 ? 'text-emerald-700' : 'text-red-600' },
        ].map(kpi => (
          <div key={kpi.label} className="px-3 py-2 text-center">
            <div className={cn('text-base font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Per Tour */}
      <div className="divide-y divide-gray-50">
        {activeBatches.map(batch => {
          const { revenue, cost, profit, margin } = calcTourProfit(batch);
          const driverName = batch.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
            : 'Fahrer';
          const completedStops = batch.stops.filter(s => s.geliefert_am).length;
          const totalStops = batch.stops.length;
          const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

          // ETA remaining
          const startMs     = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
          const elapsedMin  = startMs ? Math.floor((now - startMs) / 60_000) : 0;
          const remainMin   = batch.total_eta_min != null ? Math.max(0, batch.total_eta_min - elapsedMin) : null;

          const profitColor = profit >= 0 ? 'text-emerald-700' : 'text-red-600';

          return (
            <div key={batch.id} className="px-4 py-3 space-y-2">
              {/* Row 1: Driver + Meta */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Bike className="h-3.5 w-3.5 text-blue-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black text-gray-800">{driverName}</div>
                  <div className="text-[9px] text-gray-400">
                    {totalStops} Stopps · {completedStops} erledigt
                    {batch.total_distance_km ? ` · ${batch.total_distance_km.toFixed(1)} km` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('text-sm font-black tabular-nums', profitColor)}>
                    {profit >= 0 ? '+' : ''}{euro(profit)}
                  </div>
                  <div className="text-[9px] text-gray-400">Beitrag</div>
                </div>
              </div>

              {/* Row 2: Revenue breakdown + progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex gap-3 text-[9px] text-gray-400 shrink-0">
                  <span>Umsatz: <span className="font-bold text-gray-600">{euro(revenue)}</span></span>
                  <span>Kosten: <span className="font-bold text-amber-600">{euro(cost)}</span></span>
                  <span>Marge: <span className={cn('font-bold', profitColor)}>{margin.toFixed(0)}%</span></span>
                </div>
              </div>

              {/* Row 3: ETA */}
              {remainMin !== null && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <Zap className="h-3 w-3 text-blue-400" />
                  <span>Noch ca. <span className="font-bold text-blue-700">{remainMin} Min</span> bis Rückkehr</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 bg-gray-50 border-t flex items-center gap-1.5 text-[9px] text-gray-400">
        <Euro className="h-3 w-3" />
        Kalkulation: {COST_PER_KM.toFixed(2)} €/km + {COST_PER_STOP.toFixed(2)} €/Stopp (Schätzwerte)
      </div>
    </div>
  );
}
