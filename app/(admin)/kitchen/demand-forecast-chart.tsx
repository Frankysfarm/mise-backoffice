'use client';

/**
 * DemandForecastChart — Phase 201
 * 24-Stunden Nachfrage-Prognose für die Küche:
 * Balken = historischer Ø der letzten 4 Wochen (gleicher Wochentag)
 * Linie  = heutige Ist-Werte (vergangene Stunden)
 * Highlights die nächsten 3 Stunden als "Vorbereitung empfohlen".
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import { TrendingUp, Clock, Zap, AlertTriangle, ChefHat } from 'lucide-react';

interface HourBucket {
  hour: number;
  label: string;
  hist: number;
  actual: number | null;
  isPast: boolean;
  isCurrent: boolean;
  isSoon: boolean;
  isRush: boolean;
}

interface Props {
  locationId: string | null;
}

function buildBuckets(
  histRows: { hour: number; avg_count: number }[],
  actualRows: { hour: number; count: number }[],
): HourBucket[] {
  const now = new Date();
  const curHour = now.getHours();
  const histMap = new Map(histRows.map(r => [r.hour, r.avg_count]));
  const actualMap = new Map(actualRows.map(r => [r.hour, r.count]));

  return Array.from({ length: 24 }, (_, h) => {
    const hist = histMap.get(h) ?? 0;
    const actual = h < curHour
      ? (actualMap.get(h) ?? 0)
      : h === curHour
        ? (actualMap.get(h) ?? null)
        : null;
    return {
      hour: h,
      label: `${String(h).padStart(2, '0')}`,
      hist: Math.round(hist),
      actual,
      isPast: h < curHour,
      isCurrent: h === curHour,
      isSoon: h > curHour && h <= curHour + 3,
      isRush: hist > 5,
    };
  });
}

type CustomTooltipProps = { active?: boolean; payload?: { name: string; value: number }[]; label?: string };

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-lg p-2.5 text-xs">
      <div className="font-bold text-stone-700 mb-1">{label}:00 Uhr</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className={cn(
            'inline-block w-2 h-2 rounded-full',
            p.name === 'hist' ? 'bg-matcha-400' : 'bg-amber-400',
          )} />
          <span className="text-stone-500">{p.name === 'hist' ? 'Ø 4 Wochen' : 'Heute'}:</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function KitchenDemandForecastChart({ locationId }: Props) {
  const supabase = createClient();
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [rushHours, setRushHours] = useState<number[]>([]);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        // Heutiger Ist-Wert: Bestellungen dieser Stunden
        const { data: todayOrders } = await supabase
          .from('customer_orders')
          .select('bestellt_am')
          .eq('location_id', locationId!)
          .gte('bestellt_am', todayStart.toISOString())
          .lte('bestellt_am', now.toISOString())
          .not('status', 'eq', 'storniert');

        const actualMap = new Map<number, number>();
        for (const o of todayOrders ?? []) {
          if (!o.bestellt_am) continue;
          const h = new Date(o.bestellt_am).getHours();
          actualMap.set(h, (actualMap.get(h) ?? 0) + 1);
        }

        // 4-Wochen historischer Ø (gleicher Wochentag)
        const weekday = now.getDay();
        const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);
        const { data: histOrders } = await supabase
          .from('customer_orders')
          .select('bestellt_am')
          .eq('location_id', locationId!)
          .gte('bestellt_am', fourWeeksAgo.toISOString())
          .lte('bestellt_am', todayStart.toISOString())
          .not('status', 'eq', 'storniert');

        const histBuckets = new Map<number, number[]>();
        for (const o of histOrders ?? []) {
          if (!o.bestellt_am) continue;
          const d = new Date(o.bestellt_am);
          if (d.getDay() !== weekday) continue;
          const h = d.getHours();
          const arr = histBuckets.get(h) ?? [];
          arr.push(1);
          histBuckets.set(h, arr);
        }

        const histRows = Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          avg_count: (histBuckets.get(h)?.length ?? 0) / 4,
        }));
        const actualRows = Array.from(actualMap.entries()).map(([hour, count]) => ({ hour, count }));

        if (!mounted) return;

        const b = buildBuckets(histRows, actualRows);
        setBuckets(b);
        setRushHours(histRows.filter(r => r.avg_count >= 5).map(r => r.hour));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const now = new Date();
  const curHour = now.getHours();
  const upcomingRush = rushHours.filter(h => h > curHour && h <= curHour + 3);
  const currentBucket = buckets.find(b => b.isCurrent);
  const currentActual = currentBucket?.actual ?? 0;
  const currentHist = currentBucket?.hist ?? 0;
  const aboveAvg = (currentActual ?? 0) > currentHist;

  const visibleBuckets = buckets.filter(b => b.hour >= Math.max(0, curHour - 3) && b.hour <= Math.min(23, curHour + 6));

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white p-4 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded mb-4" />
        <div className="h-32 bg-stone-50 rounded-xl" />
      </div>
    );
  }

  if (buckets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Nachfrage-Prognose</div>
            <div className="text-[10px] text-stone-400">Ø 4 Wochen vs. heute</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-matcha-400" />
            <span className="text-[10px] text-stone-500">Ø historisch</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
            <span className="text-[10px] text-stone-500">Heute</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {upcomingRush.length > 0 && (
        <div className="flex items-center gap-2 bg-orange-50 border-b border-orange-100 px-4 py-2">
          <Zap className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span className="text-xs text-orange-700 font-semibold">
            Rush-Stunden in {upcomingRush.map(h => `${h}:00`).join(', ')} Uhr — Vorbereitung empfohlen!
          </span>
        </div>
      )}

      {aboveAvg && currentActual > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-100 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700 font-semibold">
            Aktuelle Stunde über Ø ({currentActual} vs. {currentHist} erwartet)
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="px-3 pt-3 pb-2">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={visibleBuckets} barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine x={String(curHour).padStart(2, '0')} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={1.5} />
            <Bar dataKey="hist" radius={[3, 3, 0, 0]} maxBarSize={18}>
              {visibleBuckets.map(b => (
                <Cell
                  key={b.hour}
                  fill={b.isRush ? '#4ade80' : '#bbf7d0'}
                  opacity={b.isSoon ? 1 : b.isPast ? 0.5 : 0.8}
                />
              ))}
            </Bar>
            <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={18}>
              {visibleBuckets.map(b => (
                <Cell
                  key={b.hour}
                  fill={b.isCurrent ? '#f59e0b' : '#fcd34d'}
                  opacity={b.actual !== null ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer — nächste 3 Rush-Empfehlungen */}
      <div className="flex gap-2 px-4 pb-3 flex-wrap">
        {buckets.filter(b => b.isSoon && b.isRush).slice(0, 3).map(b => (
          <div
            key={b.hour}
            className="flex items-center gap-1 rounded-full bg-matcha-50 border border-matcha-200 px-2.5 py-0.5"
          >
            <ChefHat className="h-3 w-3 text-matcha-600" />
            <span className="text-[10px] font-bold text-matcha-700">
              {b.hour}:00 Uhr — ca. {b.hist} Bestellungen
            </span>
          </div>
        ))}
        {buckets.filter(b => b.isSoon && b.isRush).length === 0 && (
          <span className="text-[10px] text-stone-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Nächste 3h: kein Rush erwartet
          </span>
        )}
      </div>
    </div>
  );
}
