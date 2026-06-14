'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Euro, Loader2 } from 'lucide-react';

type Summary = {
  revenueEur: number;
  costEur: number;
  profitEur: number;
  marginPct: number | null;
  totalOrders: number;
  revenueTrendPct: number | null;
  profitTrendPct: number | null;
};

function TrendChip({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold', up ? 'text-matcha-600' : 'text-red-500')}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

const fmtEur = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function DispatchProfitStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    const load = () =>
      fetch('/api/delivery/admin/profitability')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.summary) setData(d.summary as Summary); })
        .catch(() => {})
        .finally(() => setLoading(false));
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-2 text-muted-foreground text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Lade Profitabilitäts-Daten…
      </div>
    );
  }

  if (!data) return null;

  const marginColor = data.marginPct === null
    ? 'text-muted-foreground'
    : data.marginPct >= 30 ? 'text-matcha-700'
    : data.marginPct >= 15 ? 'text-amber-600'
    : 'text-red-600';

  const kpis = [
    {
      label: 'Umsatz (30 Tage)',
      value: fmtEur(data.revenueEur),
      trend: data.revenueTrendPct,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      label: 'Lieferkosten',
      value: fmtEur(data.costEur),
      trend: null,
      color: 'text-orange-700',
      bg: 'bg-orange-50',
    },
    {
      label: 'Gewinn',
      value: fmtEur(data.profitEur),
      trend: data.profitTrendPct,
      color: data.profitEur >= 0 ? 'text-matcha-700' : 'text-red-600',
      bg: data.profitEur >= 0 ? 'bg-matcha-50' : 'bg-red-50',
    },
    {
      label: 'Marge',
      value: data.marginPct !== null ? `${data.marginPct.toFixed(1)} %` : '—',
      trend: null,
      color: marginColor,
      bg: 'bg-stone-50',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100">
        <Euro className="h-3.5 w-3.5 text-matcha-600" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Profitabilität · 30 Tage</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{data.totalOrders} Lieferungen</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn('rounded-xl p-3', k.bg)}>
            <div className={cn('text-base font-black tabular-nums leading-tight', k.color)}>{k.value}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-stone-500 font-medium">{k.label}</span>
              {k.trend !== null && <TrendChip pct={k.trend} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
