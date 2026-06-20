'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, Package, Clock, Star } from 'lucide-react';

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  total_distance_km?: number | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order?: {
      gesamtbetrag?: number;
      zahlungsart?: string | null;
    } | null;
  }[];
};

interface Props {
  activeBatch: ActiveBatch | null;
  todayEarnings?: number;
  todayDeliveries?: number;
  todayRating?: number;
  onlineMinutes?: number;
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function TourSchichtBilanz({
  activeBatch,
  todayEarnings = 0,
  todayDeliveries = 0,
  todayRating,
  onlineMinutes = 0,
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!activeBatch) return null;

  const now = Date.now();
  const startMs = activeBatch.started_at ? new Date(activeBatch.started_at).getTime() : null;
  const tourMinutes = startMs ? Math.floor((now - startMs) / 60_000) : 0;

  const completedStops = activeBatch.stops.filter(s => s.geliefert_am != null).length;
  const totalStops = activeBatch.stops.length;
  const openStops = totalStops - completedStops;

  // Revenue this tour
  const tourRevenue = activeBatch.stops
    .filter(s => s.geliefert_am != null)
    .reduce((sum, s) => sum + (s.order?.gesamtbetrag ?? 0), 0);

  // ETA remaining
  const etaMin = activeBatch.total_eta_min ?? null;
  const remainMin = etaMin && startMs
    ? Math.max(0, Math.ceil((startMs + etaMin * 60_000 - now) / 60_000))
    : null;

  // Delivery rate (deliveries per hour today)
  const deliveryRate = onlineMinutes > 0
    ? ((todayDeliveries / onlineMinutes) * 60).toFixed(1)
    : '—';

  const kpis = [
    { label: 'Heute Lieferungen', value: todayDeliveries.toString(), icon: Package, color: 'text-matcha-700', bg: 'bg-matcha-50' },
    { label: 'Heute Umsatz', value: fmtEur(todayEarnings), icon: Euro, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Lieferungen/h', value: deliveryRate, icon: TrendingUp, color: 'text-blue-700', bg: 'bg-blue-50' },
    ...(todayRating
      ? [{ label: 'Ø Bewertung', value: todayRating.toFixed(1), icon: Star, color: 'text-amber-700', bg: 'bg-amber-50' }]
      : []
    ),
  ];

  return (
    <section className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-white/70">Schicht-Bilanz</div>
          <div className="text-sm font-bold text-white">Aktuelle Tour</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black tabular-nums text-white">
            {completedStops}/{totalStops}
          </div>
          <div className="text-[10px] text-white/60">Stopps fertig</div>
        </div>
      </div>

      {/* Tour Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-white/60">
          <span>Tour-Fortschritt</span>
          {remainMin !== null && <span>~{remainMin} Min verbleibend</span>}
        </div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700',
              openStops === 0 ? 'bg-matcha-400' :
              (completedStops / totalStops) > 0.6 ? 'bg-matcha-400' :
              'bg-white/70'
            )}
            style={{ width: totalStops > 0 ? `${Math.round((completedStops / totalStops) * 100)}%` : '0%' }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/50">
          <span>{tourMinutes} Min unterwegs</span>
          {tourRevenue > 0 && (
            <span className="text-emerald-400 font-bold">{fmtEur(tourRevenue)} Tour</span>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl bg-white/10 border border-white/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <k.icon size={12} className="text-white/60" />
              <span className="text-[9px] text-white/60 font-medium">{k.label}</span>
            </div>
            <div className="text-sm font-black tabular-nums text-white">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Open stops reminder */}
      {openStops > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
          <Clock size={12} className="text-white/60" />
          <span className="text-[11px] text-white/80">
            <span className="font-bold text-white">{openStops}</span> Stopp{openStops !== 1 ? 's' : ''} ausstehend
            {remainMin !== null ? ` · ~${remainMin} Min` : ''}
          </span>
        </div>
      )}

      {openStops === 0 && completedStops > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-matcha-500/20 border border-matcha-400/30 px-3 py-2">
          <span className="text-base">✓</span>
          <span className="text-[11px] text-matcha-300 font-bold">Alle Stopps erledigt!</span>
        </div>
      )}
    </section>
  );
}
