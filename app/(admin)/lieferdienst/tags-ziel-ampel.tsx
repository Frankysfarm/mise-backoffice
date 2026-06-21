'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  locationId: string | null;
}

interface DayStats {
  orderCount: number;
  revenueEur: number;
}

const ORDER_TARGET = 80;
const REVENUE_TARGET = 2500;

function fetchTodayStats(locationId: string): Promise<DayStats> {
  const supabase = createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return supabase
    .from('orders')
    .select('gesamtbetrag')
    .eq('location_id', locationId)
    .gte('bestellt_am', todayStart.toISOString())
    .neq('status', 'storniert')
    .then(({ data }: { data: Array<{ gesamtbetrag: number | null }> | null }) => {
      const rows = data ?? [];
      return {
        orderCount: rows.length,
        revenueEur: rows.reduce((s: number, r: { gesamtbetrag: number | null }) => s + (r.gesamtbetrag ?? 0), 0),
      };
    });
}

function GaugeBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span>{pct}% von Tagesziel</span>
        <span className="tabular-nums">{value} / {target}</span>
      </div>
      <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function LieferdienstTagsZielAmpel({ locationId }: Props) {
  const [data, setData] = useState<DayStats | null>(null);

  useEffect(() => {
    if (!locationId) return;
    fetchTodayStats(locationId).then(setData);
    const iv = setInterval(() => fetchTodayStats(locationId).then(setData), 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId || !data) return null;

  const orderPct = Math.min(100, (data.orderCount / ORDER_TARGET) * 100);
  const revPct = Math.min(100, (data.revenueEur / REVENUE_TARGET) * 100);
  const avgPct = (orderPct + revPct) / 2;

  const status =
    avgPct >= 90 ? 'on_track' : avgPct >= 60 ? 'behind' : 'at_risk';

  const bg =
    status === 'on_track'
      ? 'bg-matcha-50 border-matcha-200'
      : status === 'behind'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200';

  const statusLabel =
    status === 'on_track' ? 'Im Plan ✓' : status === 'behind' ? 'Leicht zurück' : 'Tagesziel gefährdet';

  const statusColor =
    status === 'on_track' ? 'text-matcha-700' : status === 'behind' ? 'text-amber-700' : 'text-red-700';

  const TrendIcon =
    orderPct >= 90 ? TrendingUp : orderPct < 60 ? TrendingDown : Minus;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', bg)}>
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1">
          Tagesziel-Ampel
        </span>
        <div className="flex items-center gap-1">
          <TrendIcon className={cn('h-3.5 w-3.5', statusColor)} />
          <span className={cn('text-[11px] font-bold', statusColor)}>{statusLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cn('rounded-lg p-2.5', status === 'on_track' ? 'bg-matcha-100/60' : status === 'behind' ? 'bg-amber-100/60' : 'bg-red-100/60')}>
          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Bestellungen</div>
          <div className={cn('text-2xl font-black tabular-nums', statusColor)}>
            {data.orderCount}
          </div>
          <div className="text-[9px] text-muted-foreground">Ziel: {ORDER_TARGET}</div>
        </div>
        <div className={cn('rounded-lg p-2.5', status === 'on_track' ? 'bg-matcha-100/60' : status === 'behind' ? 'bg-amber-100/60' : 'bg-red-100/60')}>
          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Umsatz</div>
          <div className={cn('text-xl font-black tabular-nums', statusColor)}>
            {fmtEur(data.revenueEur)}
          </div>
          <div className="text-[9px] text-muted-foreground">Ziel: {fmtEur(REVENUE_TARGET)}</div>
        </div>
      </div>

      <div className="space-y-2">
        <GaugeBar
          value={data.orderCount}
          target={ORDER_TARGET}
          color={status === 'on_track' ? '#4a7c59' : status === 'behind' ? '#d97706' : '#dc2626'}
        />
        <GaugeBar
          value={Math.round(data.revenueEur)}
          target={REVENUE_TARGET}
          color={status === 'on_track' ? '#4a7c59' : status === 'behind' ? '#d97706' : '#dc2626'}
        />
      </div>
    </div>
  );
}
