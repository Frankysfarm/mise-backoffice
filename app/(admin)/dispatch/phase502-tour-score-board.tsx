'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  MapPin, Clock, Star, TrendingUp, TrendingDown, Bike,
  CheckCircle2, AlertTriangle, Route, Zap, Target,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

type ReadyOrder = {
  id: string;
  bestellnummer: string;
  dispatch_score: number | null;
  delivery_zone: string | null;
  gesamtbetrag: number;
  fertig_am: string | null;
  kunde_name: string;
  status: string;
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn(
        'text-xs font-bold tabular-nums w-8 text-right',
        score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600',
      )}>{score}</span>
    </div>
  );
}

function TourProgress({ stops }: { stops: Stop[] }) {
  const delivered = stops.filter(s => s.geliefert_am).length;
  const total = stops.length;
  const pct = total > 0 ? (delivered / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{delivered}/{total} Stopps</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatEta(isoStr: string | null): string {
  if (!isoStr) return '–';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function elapsedMin(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function DispatchPhase502TourScoreBoard({
  batches,
  orders,
}: {
  batches: Batch[];
  orders: ReadyOrder[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = useMemo(
    () => batches.filter(b => ['assigned', 'pickup', 'unterwegs', 'on_route'].includes(b.status)),
    [batches],
  );

  const pendingOrders = useMemo(
    () => orders.filter(o => ['fertig', 'bereit'].includes(o.status)),
    [orders],
  );

  const scoreDistrib = useMemo(() => {
    const scored = orders.filter(o => o.dispatch_score != null);
    return {
      high: scored.filter(o => (o.dispatch_score ?? 0) >= 80).length,
      mid:  scored.filter(o => (o.dispatch_score ?? 0) >= 60 && (o.dispatch_score ?? 0) < 80).length,
      low:  scored.filter(o => (o.dispatch_score ?? 0) < 60).length,
      avg:  scored.length > 0 ? Math.round(scored.reduce((s, o) => s + (o.dispatch_score ?? 0), 0) / scored.length) : null,
    };
  }, [orders]);

  if (activeBatches.length === 0 && pendingOrders.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Route size={16} className="text-blue-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">Phase 502 · Tour-Score-Board</div>
            <div className="text-[11px] text-gray-500">
              {activeBatches.length} aktive Touren · Score-Visualisierung
            </div>
          </div>
        </div>
        {scoreDistrib.avg != null && (
          <div className="text-right">
            <div className={cn(
              'text-lg font-black tabular-nums',
              scoreDistrib.avg >= 80 ? 'text-emerald-600' : scoreDistrib.avg >= 60 ? 'text-amber-600' : 'text-red-600',
            )}>{scoreDistrib.avg}</div>
            <div className="text-[9px] text-gray-400">Ø Score</div>
          </div>
        )}
      </div>

      {/* Score Distribution */}
      {(scoreDistrib.high + scoreDistrib.mid + scoreDistrib.low) > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-emerald-600">{scoreDistrib.high}</div>
            <div className="text-[9px] text-gray-500">Score ≥ 80</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-amber-600">{scoreDistrib.mid}</div>
            <div className="text-[9px] text-gray-500">Score 60–79</div>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-red-600">{scoreDistrib.low}</div>
            <div className="text-[9px] text-gray-500">Score &lt; 60</div>
          </div>
        </div>
      )}

      {/* Active Tours */}
      {activeBatches.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Aktive Touren</div>
          {activeBatches.map(batch => {
            const elapsed = elapsedMin(batch.startzeit ?? null);
            const eta = batch.total_eta_min;
            const remaining = eta != null ? Math.max(0, eta - elapsed) : null;
            const onTime = remaining != null && remaining > 0;
            const delivered = batch.stops.filter(s => s.geliefert_am).length;
            return (
              <div key={batch.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bike size={13} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-gray-900">
                        {batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : 'Fahrer'}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {batch.zone ?? 'Zone –'} · {batch.total_distance_km?.toFixed(1) ?? '–'} km
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onTime
                      ? <CheckCircle2 size={12} className="text-emerald-500" />
                      : remaining === 0 ? <AlertTriangle size={12} className="text-red-500" /> : null}
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      onTime ? 'text-emerald-600' : 'text-red-600',
                    )}>
                      {remaining != null ? `${remaining} Min` : `${elapsed} Min`}
                    </span>
                  </div>
                </div>

                {/* Tour Progress */}
                <TourProgress stops={batch.stops} />

                {/* Stops List (compact) */}
                {batch.stops.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {batch.stops
                      .sort((a, b) => a.reihenfolge - b.reihenfolge)
                      .slice(0, 3)
                      .map(stop => (
                        <div key={stop.id} className="flex items-center gap-1.5">
                          <div className={cn(
                            'w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0',
                            stop.geliefert_am ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500',
                          )}>
                            {stop.reihenfolge}
                          </div>
                          <span className="text-[10px] text-gray-600 truncate flex-1">
                            {stop.order?.kunde_name ?? `#${stop.order?.bestellnummer}`}
                          </span>
                          {stop.order?.eta_latest && (
                            <span className="text-[9px] text-gray-400 shrink-0">{formatEta(stop.order.eta_latest)}</span>
                          )}
                        </div>
                      ))}
                    {batch.stops.length > 3 && (
                      <div className="text-[9px] text-gray-400 pl-5">+{batch.stops.length - 3} weitere Stopps</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Orders with Scores */}
      {pendingOrders.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Wartende Bestellungen ({pendingOrders.length})
          </div>
          {pendingOrders.slice(0, 4).map(order => (
            <div key={order.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-900">#{order.bestellnummer}</span>
                  {order.delivery_zone && (
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1 rounded">{order.delivery_zone}</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 truncate">{order.kunde_name}</div>
              </div>
              {order.dispatch_score != null && (
                <div className="w-24 shrink-0">
                  <ScoreBar score={order.dispatch_score} />
                </div>
              )}
              <div className="text-xs font-semibold text-gray-700 shrink-0 w-14 text-right tabular-nums">
                {euro(order.gesamtbetrag)}
              </div>
            </div>
          ))}
          {pendingOrders.length > 4 && (
            <div className="text-[10px] text-gray-400 text-center">
              +{pendingOrders.length - 4} weitere Bestellungen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
