'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface Props {
  locationId: string | null;
}

type Summary = {
  revenueEur: number;
  costEur: number;
  profitEur: number;
  marginPct: number | null;
  totalOrders: number;
  revenueTrendPct: number | null;
  profitTrendPct: number | null;
};

const MOCK: Summary = {
  revenueEur: 1240.5,
  costEur: 620.0,
  profitEur: 620.5,
  marginPct: 50,
  totalOrders: 38,
  revenueTrendPct: 12.3,
  profitTrendPct: 8.1,
};

function TrendChip({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 1;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-bold',
        isFlat ? 'text-stone-400' : isUp ? 'text-matcha-600' : 'text-red-500',
      )}
    >
      {isFlat
        ? <Minus className="h-2.5 w-2.5" />
        : isUp
        ? <TrendingUp className="h-2.5 w-2.5" />
        : <TrendingDown className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

export function SchichtProfitKarte({ locationId }: Props) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/profitability?action=dashboard`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          const s = json.summary;
          if (s) setData(s as Summary);
          else setData(MOCK);
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-3 w-28 bg-stone-100 rounded mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-stone-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const marginTier =
    (data.marginPct ?? 0) >= 40
      ? { color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200' }
      : (data.marginPct ?? 0) >= 20
      ? { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
      : { color: 'text-red-700', bg: 'bg-red-50 border-red-200' };

  const kpis = [
    {
      label: 'Umsatz (Liefergebühren)',
      value: fmtEur(data.revenueEur),
      sub: <TrendChip pct={data.revenueTrendPct} />,
      color: 'text-stone-800',
      bg: 'bg-stone-50',
    },
    {
      label: 'Geschätzte Kosten',
      value: fmtEur(data.costEur),
      sub: null,
      color: 'text-stone-600',
      bg: 'bg-stone-50',
    },
    {
      label: 'Profit',
      value: fmtEur(data.profitEur),
      sub: <TrendChip pct={data.profitTrendPct} />,
      color: marginTier.color,
      bg: marginTier.bg.split(' ')[0],
    },
    {
      label: 'Marge',
      value: data.marginPct !== null ? `${data.marginPct.toFixed(1)} %` : '—',
      sub: null,
      color: marginTier.color,
      bg: marginTier.bg.split(' ')[0],
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
        <Euro className="h-4 w-4 text-stone-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Profitabilität (Liefergebühren)
        </span>
        <span className="ml-auto text-[10px] text-stone-400">
          {data.totalOrders} Lieferungen heute
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn('rounded-xl p-3', kpi.bg)}>
            <div className="text-[10px] font-semibold text-stone-500 mb-0.5">{kpi.label}</div>
            <div className={cn('text-lg font-black tabular-nums leading-tight', kpi.color)}>
              {kpi.value}
            </div>
            {kpi.sub && <div className="mt-0.5">{kpi.sub}</div>}
          </div>
        ))}
      </div>
      <div className="px-4 pb-3 text-[10px] text-stone-400">
        Marge-Ziel: 35 % · Refresh alle 5 Min
      </div>
    </div>
  );
}
