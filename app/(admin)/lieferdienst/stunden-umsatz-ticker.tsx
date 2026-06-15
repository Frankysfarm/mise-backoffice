'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  locationId: string;
}

type HourlyData = {
  currentHourEur: number;
  lastHourEur: number;
  yesterdaySameHourEur: number;
};

const MOCK: HourlyData = {
  currentHourEur: 342.5,
  lastHourEur: 287.0,
  yesterdaySameHourEur: 310.0,
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function StundenUmsatzTicker({ locationId }: Props) {
  const [data, setData] = useState<HourlyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/reporting?action=hourly_revenue&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!res.ok) throw new Error('no data');
        const json = await res.json();
        if (cancelled) return;
        if (json.currentHourEur != null) {
          setData({
            currentHourEur: json.currentHourEur ?? 0,
            lastHourEur: json.lastHourEur ?? 0,
            yesterdaySameHourEur: json.yesterdaySameHourEur ?? 0,
          });
        } else {
          setData(MOCK);
        }
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-3 w-32 rounded bg-stone-100 mb-3" />
        <div className="h-8 w-24 rounded bg-stone-100" />
      </div>
    );
  }

  if (!data) return null;

  const deltaVsYesterday = data.currentHourEur - data.yesterdaySameHourEur;
  const deltaPositive = deltaVsYesterday >= 0;
  const deltaPct = data.yesterdaySameHourEur > 0
    ? Math.abs((deltaVsYesterday / data.yesterdaySameHourEur) * 100)
    : 0;

  const now = new Date();
  const hourLabel = `${String(now.getHours()).padStart(2, '0')}:00 – ${String(now.getHours()).padStart(2, '0')}:59 Uhr`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-stone-100 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <Euro className="h-3.5 w-3.5" />
        </div>
        <div>
          <div className="text-xs font-bold text-stone-800">Stunden-Umsatz</div>
          <div className="text-[10px] text-stone-400">{hourLabel}</div>
        </div>
        <div className={cn(
          'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
          deltaPositive ? 'bg-matcha-50 text-matcha-700' : 'bg-red-50 text-red-700',
        )}>
          {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {deltaPositive ? '+' : '-'}{deltaPct.toFixed(1)}% vs. gestern
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Umsatz diese Stunde
          </div>
          <div className="font-display text-3xl font-black text-stone-900 tabular-nums leading-none mt-0.5">
            {fmtEur(data.currentHourEur)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Letzte Stunde</div>
            <div className="font-bold text-sm text-stone-700 tabular-nums mt-0.5">{fmtEur(data.lastHourEur)}</div>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Gestern gleiche Std.</div>
            <div className="font-bold text-sm text-stone-700 tabular-nums mt-0.5">{fmtEur(data.yesterdaySameHourEur)}</div>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px] text-stone-400">
            <span>Ø gestern</span>
            <span className={cn('font-bold', deltaPositive ? 'text-matcha-600' : 'text-red-600')}>
              {deltaPositive ? '+' : ''}{fmtEur(deltaVsYesterday)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', deltaPositive ? 'bg-matcha-500' : 'bg-red-400')}
              style={{ width: `${Math.min(deltaPct * 2, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
