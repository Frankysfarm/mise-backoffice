'use client';

/**
 * Phase 501 — Stunden-Analyse
 *
 * Stündliche Analyse der heutigen Bestellungen vs. 7-Tage-Durchschnitt:
 * - Balkendiagramm: heute (matcha) vs. Ø (grau)
 * - Peak-Stunde hervorgehoben
 * - Pünktlichkeitsrate je Stunde als farbige Pill
 * - Collapsible, 5-Minuten-Refresh
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, Clock, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  locationId: string | null;
}

interface HourBucket {
  hour: number;
  label: string;
  today: number;
  avg7d: number;
  onTimePct: number | null;
}

function timeLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function LieferdienstPhase501StundenAnalyse({ locationId }: Props) {
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(true);
  const supabase = createClient();

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekStart  = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);

      const { data: todayOrders } = await supabase
        .from('customer_orders')
        .select('bestellt_am, fertig_am, lieferzeit_min')
        .eq('location_id', locationId)
        .gte('bestellt_am', todayStart.toISOString())
        .in('status', ['geliefert', 'abgeholt', 'abgeschlossen', 'unterwegs', 'fertig', 'in_zubereitung']);

      const { data: weekOrders } = await supabase
        .from('customer_orders')
        .select('bestellt_am')
        .eq('location_id', locationId)
        .gte('bestellt_am', weekStart.toISOString())
        .lt('bestellt_am', todayStart.toISOString())
        .in('status', ['geliefert', 'abgeholt', 'abgeschlossen']);

      const currentHour = new Date().getHours();
      const hours = Array.from({ length: Math.min(currentHour + 1, 24) }, (_, i) => i);

      const todayByHour: Record<number, number> = {};
      const onTimeByHour: Record<number, number[]> = {};

      for (const o of todayOrders ?? []) {
        if (!o.bestellt_am) continue;
        const h = new Date(o.bestellt_am).getHours();
        todayByHour[h] = (todayByHour[h] ?? 0) + 1;
        if (o.lieferzeit_min !== null && o.lieferzeit_min !== undefined) {
          if (!onTimeByHour[h]) onTimeByHour[h] = [];
          onTimeByHour[h].push(o.lieferzeit_min <= 35 ? 1 : 0);
        }
      }

      const weekByHour: Record<number, number> = {};
      for (const o of weekOrders ?? []) {
        if (!o.bestellt_am) continue;
        const h = new Date(o.bestellt_am).getHours();
        weekByHour[h] = (weekByHour[h] ?? 0) + 1;
      }

      const newBuckets: HourBucket[] = hours.map((h) => ({
        hour: h,
        label: timeLabel(h),
        today: todayByHour[h] ?? 0,
        avg7d: weekByHour[h] ? Math.round(weekByHour[h] / 7) : 0,
        onTimePct: onTimeByHour[h]
          ? Math.round((onTimeByHour[h].reduce((a, b) => a + b, 0) / onTimeByHour[h].length) * 100)
          : null,
      }));

      setBuckets(newBuckets);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const maxToday   = Math.max(1, ...buckets.map((b) => b.today));
  const peakHour   = buckets.reduce((best, b) => (b.today > (best?.today ?? 0) ? b : best), buckets[0]);
  const totalToday = buckets.reduce((s, b) => s + b.today, 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-5 py-4 hover:bg-stone-50 transition text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-stone-800">Stunden-Analyse</div>
          <div className="text-xs text-stone-400">
            {totalToday} Bestellungen heute
            {peakHour && peakHour.today > 0 && ` · Peak ${peakHour.label}`}
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-stone-300" />}
        <span className="text-xs text-stone-300">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 py-4">
          {buckets.length === 0 && !loading && (
            <div className="text-sm text-stone-400 text-center py-4">
              Noch keine Daten für heute.
            </div>
          )}

          {buckets.length > 0 && (
            <>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-3 text-[10px] text-stone-400 font-semibold">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded bg-matcha-400" /> Heute
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded bg-stone-200" /> Ø 7 Tage
                </span>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
                {buckets.map((b) => {
                  const heightToday = Math.max(4, (b.today / maxToday) * 88);
                  const heightAvg   = Math.max(2, (b.avg7d / maxToday) * 88);
                  const isPeak      = b.hour === peakHour?.hour && b.today > 0;

                  return (
                    <div
                      key={b.hour}
                      className="flex flex-col items-center gap-0.5 flex-1 min-w-[22px]"
                    >
                      {/* Bars */}
                      <div className="flex items-end gap-0.5 h-20">
                        {/* Avg bar */}
                        <div
                          className="w-1.5 rounded-t bg-stone-200"
                          style={{ height: heightAvg }}
                        />
                        {/* Today bar */}
                        <div
                          className={cn(
                            'w-1.5 rounded-t transition-all duration-300',
                            isPeak ? 'bg-amber-400' : 'bg-matcha-400',
                          )}
                          style={{ height: heightToday }}
                        />
                      </div>
                      {/* Hour label */}
                      <span className="text-[7px] text-stone-300 font-semibold tabular-nums">
                        {String(b.hour).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* On-time rate pills for recent hours */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {buckets
                  .filter((b) => b.today > 0 && b.onTimePct !== null)
                  .slice(-6)
                  .map((b) => (
                    <div
                      key={b.hour}
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold',
                        (b.onTimePct ?? 0) >= 85
                          ? 'bg-matcha-50 text-matcha-700'
                          : (b.onTimePct ?? 0) >= 70
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700',
                      )}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {b.label} · {b.onTimePct}%
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
