'use client';

/**
 * DispatchAnalyticsWochenvergleich — Wochen-Vergleichs-Karte für Dispatcher.
 *
 * Vergleicht aktuelle Woche vs. Vorwoche:
 *   Lieferungen, SLA-Einhaltung (%), ø Lieferzeit (Min)
 * Mit Trend-Pfeil und farbcodierter Δ-Anzeige.
 *
 * Polling alle 5 Minuten auf /api/delivery/admin/analytics?action=dashboard.
 */

import { useEffect, useRef, useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WeekData {
  thisWeekDeliveries: number;
  lastWeekDeliveries: number;
  thisWeekSlaAvgPct: number | null;
  lastWeekSlaAvgPct: number | null;
  thisWeekAvgMinutes: number | null;
  lastWeekAvgMinutes: number | null;
  deliveriesDeltaPct: number | null;
  slaDeltaPct: number | null;
  minutesDeltaPct: number | null;
}

function DeltaPill({ delta, invertColors }: { delta: number | null; invertColors?: boolean }) {
  if (delta == null) return <span className="text-[10px] text-muted-foreground">—</span>;
  const positive = delta >= 0;
  const good = invertColors ? !positive : positive;
  const Icon = Math.abs(delta) < 1 ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full',
      good ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
    )}>
      <Icon className="h-3 w-3" />
      {positive ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );
}

interface RowProps {
  label: string;
  thisVal: string;
  lastVal: string;
  delta: number | null;
  invertColors?: boolean;
}

function CompareRow({ label, thisVal, lastVal, delta, invertColors }: RowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="flex-1 text-center text-xs font-black tabular-nums">{thisVal}</span>
      <span className="flex-1 text-center text-[11px] text-muted-foreground tabular-nums">{lastVal}</span>
      <div className="w-16 flex justify-end shrink-0">
        <DeltaPill delta={delta} invertColors={invertColors} />
      </div>
    </div>
  );
}

export function DispatchAnalyticsWochenvergleich({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/analytics?action=dashboard&location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.weekComparison) setData(json.weekComparison as WeekData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Calendar className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Wochenvergleich</span>
        {loading && !data && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {data ? (
        <div className="px-4 py-2 divide-y">
          <div className="flex items-center gap-2 pb-1.5">
            <span className="w-28 shrink-0" />
            <span className="flex-1 text-center text-[9px] font-bold uppercase tracking-wider text-matcha-600">Diese Woche</span>
            <span className="flex-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Vorwoche</span>
            <span className="w-16" />
          </div>

          <CompareRow
            label="Lieferungen"
            thisVal={data.thisWeekDeliveries.toString()}
            lastVal={data.lastWeekDeliveries.toString()}
            delta={data.deliveriesDeltaPct}
          />
          <CompareRow
            label="SLA-Einhaltung"
            thisVal={data.thisWeekSlaAvgPct != null ? `${data.thisWeekSlaAvgPct.toFixed(1)}%` : '—'}
            lastVal={data.lastWeekSlaAvgPct != null ? `${data.lastWeekSlaAvgPct.toFixed(1)}%` : '—'}
            delta={data.slaDeltaPct}
          />
          <CompareRow
            label="Ø Lieferzeit"
            thisVal={data.thisWeekAvgMinutes != null ? `${data.thisWeekAvgMinutes.toFixed(0)} Min` : '—'}
            lastVal={data.lastWeekAvgMinutes != null ? `${data.lastWeekAvgMinutes.toFixed(0)} Min` : '—'}
            delta={data.minutesDeltaPct}
            invertColors
          />
        </div>
      ) : (
        !loading && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Noch keine Wochendaten verfügbar.
          </div>
        )
      )}
    </Card>
  );
}
