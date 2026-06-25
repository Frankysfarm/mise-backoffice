'use client';

/**
 * Phase 501 — Live-Verdienst-Tracker
 *
 * Kompakter Echtzeit-Verdienst für den Fahrer:
 * - Heutiger Gesamtverdienst (Lieferpauschalen + Trinkgeld)
 * - Schicht-Ziel-Fortschrittsbalken (z.B. 80 € Ziel)
 * - Ø Verdienst pro Lieferung
 * - Geschätzte Verdienst-Prognose bis Schichtende
 * - 60s Auto-Refresh
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, Target, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { euro } from '@/lib/utils';

interface Props {
  driverId: string | null;
  shiftGoalEur?: number;
}

interface EarningsData {
  totalEur: number;
  deliveries: number;
  tipEur: number;
  avgPerDelivery: number;
  projectedEur: number | null;
  shiftStartedAt: string | null;
}

export function FahrerPhase501LiveVerdienst({ driverId, shiftGoalEur = 80 }: Props) {
  const [data, setData]     = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function load() {
    if (!driverId) return;
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const { data: rows } = await supabase
        .from('delivery_batch_stops')
        .select(`
          geliefert_am,
          customer_orders(gesamtbetrag, zahlungsart),
          delivery_batches!inner(driver_id, started_at)
        `)
        .eq('delivery_batches.driver_id', driverId)
        .not('geliefert_am', 'is', null)
        .gte('geliefert_am', today.toISOString());

      const { data: tips } = await supabase
        .from('delivery_tips')
        .select('amount_eur, created_at')
        .eq('driver_id', driverId)
        .gte('created_at', today.toISOString());

      const deliveries = (rows ?? []).length;
      const deliveryFeeEur = deliveries * 2.5;
      const tipEur = (tips ?? []).reduce((s: number, t: any) => s + (t.amount_eur ?? 0), 0);
      const totalEur = deliveryFeeEur + tipEur;
      const avgPerDelivery = deliveries > 0 ? totalEur / deliveries : 0;

      const firstBatch = (rows ?? []).reduce((earliest: string | null, r: any) => {
        const sa = r.delivery_batches?.started_at ?? null;
        if (!sa) return earliest;
        if (!earliest || sa < earliest) return sa;
        return earliest;
      }, null);

      let projectedEur: number | null = null;
      if (firstBatch && deliveries > 0) {
        const elapsedMin = (Date.now() - new Date(firstBatch).getTime()) / 60_000;
        if (elapsedMin > 30) {
          const ratePerHour = (totalEur / elapsedMin) * 60;
          const remainHours = Math.max(0, (8 * 60 - elapsedMin) / 60);
          projectedEur = totalEur + ratePerHour * remainHours;
        }
      }

      setData({ totalEur, deliveries, tipEur, avgPerDelivery, projectedEur, shiftStartedAt: firstBatch });
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (!driverId) return null;

  const pct = data ? Math.min(100, (data.totalEur / shiftGoalEur) * 100) : 0;
  const goalReached = pct >= 100;

  return (
    <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-700">
        <Euro className="h-4 w-4 text-matcha-400 shrink-0" />
        <span className="text-sm font-bold text-white tracking-wide">Live-Verdienst</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 ml-auto" />}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Total */}
        <div className="flex items-end gap-2">
          <span className={cn('text-3xl font-black tabular-nums leading-none', goalReached ? 'text-matcha-400' : 'text-white')}>
            {data ? euro(data.totalEur) : '—'}
          </span>
          <span className="text-sm text-gray-400 pb-0.5">heute</span>
          {goalReached && (
            <span className="ml-auto text-xs font-black text-matcha-400 animate-pulse">Ziel erreicht!</span>
          )}
        </div>

        {/* Goal progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400 font-semibold">Ziel {euro(shiftGoalEur)}</span>
            <span className="text-[10px] text-gray-300 font-bold">{Math.round(pct)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                goalReached ? 'bg-matcha-400' : pct >= 70 ? 'bg-amber-400' : 'bg-matcha-600',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        {data && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-700/50 px-2 py-2 text-center">
              <div className="text-sm font-black text-white tabular-nums">{data.deliveries}</div>
              <div className="text-[9px] text-gray-400 font-semibold">Lieferungen</div>
            </div>
            <div className="rounded-xl bg-gray-700/50 px-2 py-2 text-center">
              <div className="text-sm font-black text-amber-400 tabular-nums">{euro(data.tipEur)}</div>
              <div className="text-[9px] text-gray-400 font-semibold">Trinkgeld</div>
            </div>
            <div className="rounded-xl bg-gray-700/50 px-2 py-2 text-center">
              <div className="text-sm font-black text-white tabular-nums">{euro(data.avgPerDelivery)}</div>
              <div className="text-[9px] text-gray-400 font-semibold">Ø/Lieferung</div>
            </div>
          </div>
        )}

        {/* Projection */}
        {data?.projectedEur && (
          <div className="flex items-center gap-2 rounded-xl bg-matcha-900/40 border border-matcha-700/40 px-3 py-2">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
            <span className="text-xs text-matcha-300">
              Prognose Schichtende: <span className="font-black">{euro(data.projectedEur)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
