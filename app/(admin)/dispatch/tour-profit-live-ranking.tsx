'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, Trophy } from 'lucide-react';

type BatchStop = {
  id: string;
  geliefert_am: string | null;
  order: { gesamtbetrag: number } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string;
  started_at: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

const ACTIVE_STATUSES = ['unterwegs', 'on_route', 'aktiv', 'assigned'];

type ProfitTier = 'high' | 'mid' | 'low';

function profitTier(perHour: number): ProfitTier {
  if (perHour >= 80) return 'high';
  if (perHour >= 50) return 'mid';
  return 'low';
}

const TIER_STYLE: Record<ProfitTier, { badge: string; bar: string; rank: string; border: string }> = {
  high: { badge: 'bg-matcha-100 text-matcha-700 border-matcha-300', bar: 'bg-matcha-500', rank: 'text-matcha-700', border: 'border-matcha-200' },
  mid:  { badge: 'bg-amber-100 text-amber-700 border-amber-300',   bar: 'bg-amber-400',   rank: 'text-amber-700',   border: 'border-amber-200'  },
  low:  { badge: 'bg-red-100 text-red-700 border-red-300',         bar: 'bg-red-400',     rank: 'text-red-700',     border: 'border-red-200'    },
};

const STATUS_LABEL: Record<string, string> = {
  unterwegs: 'Unterwegs',
  on_route:  'Unterwegs',
  aktiv:     'Aktiv',
  assigned:  'Zugewiesen',
};

export function TourProfitLiveRanking({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));
  if (activeBatches.length === 0) return null;

  const ranked = activeBatches
    .map((b) => {
      const completedRevenue = b.stops
        .filter((s) => s.geliefert_am != null)
        .reduce((sum, s) => sum + (s.order?.gesamtbetrag ?? 0), 0);
      const totalRevenue = b.stops.reduce((sum, s) => sum + (s.order?.gesamtbetrag ?? 0), 0);
      const etaHours = (b.total_eta_min ?? 60) / 60;
      const profitPerHour = etaHours > 0 ? totalRevenue / etaHours : 0;
      const totalStops = b.stops.length;
      const completedStops = b.stops.filter((s) => s.geliefert_am != null).length;
      const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
      const tier = profitTier(profitPerHour);
      const name = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.` : 'Fahrer';
      return { batch: b, completedRevenue, totalRevenue, profitPerHour, progressPct, tier, name, completedStops, totalStops };
    })
    .sort((a, b) => b.profitPerHour - a.profitPerHour);

  const topEur = Math.max(...ranked.map((r) => r.profitPerHour), 1);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-matcha-900/5">
        <Euro className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Tour-Profit-Ranking
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {activeBatches.length} Touren
          </span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { label: '≥ €80/h', val: ranked.filter((r) => r.tier === 'high').length, color: 'text-matcha-600' },
          { label: '€50-80/h', val: ranked.filter((r) => r.tier === 'mid').length,  color: 'text-amber-600'  },
          { label: '< €50/h',  val: ranked.filter((r) => r.tier === 'low').length,  color: 'text-red-600'    },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex flex-col items-center py-2 px-1">
            <span className={cn('font-mono text-lg font-black tabular-nums leading-none', color)}>{val}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Rankings */}
      <div className="divide-y divide-border/50">
        {ranked.map(({ batch, totalRevenue, profitPerHour, progressPct, tier, name, completedStops, totalStops }, idx) => {
          const s = TIER_STYLE[tier];
          const barWidth = Math.min(100, (profitPerHour / topEur) * 100);

          return (
            <div key={batch.id} className="px-4 py-3 flex items-center gap-3">
              {/* Rank */}
              <div className="shrink-0 flex items-center justify-center">
                {idx === 0 ? (
                  <Trophy className="h-5 w-5 text-matcha-500" />
                ) : (
                  <span className={cn('font-black text-sm tabular-nums w-5 text-center', s.rank)}>
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Driver + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-xs font-bold text-foreground truncate">{name}</span>
                  <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold', s.badge)}>
                    {STATUS_LABEL[batch.status] ?? batch.status}
                  </span>
                  <span className="text-[9px] text-muted-foreground ml-auto">
                    {completedStops}/{totalStops} Stopps
                  </span>
                </div>

                {/* Profit bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', s.bar)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* €/h value */}
              <div className="shrink-0 text-right">
                <div className={cn('font-black text-sm tabular-nums leading-none', s.rank)}>
                  {profitPerHour.toFixed(0)} €/h
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                  {totalRevenue.toFixed(2)} € ges.
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
        <p className="text-[9px] text-muted-foreground text-center uppercase tracking-widest font-bold">
          Aktualisierung alle 60s · €/h basierend auf Tour-ETA
        </p>
      </div>
    </div>
  );
}
