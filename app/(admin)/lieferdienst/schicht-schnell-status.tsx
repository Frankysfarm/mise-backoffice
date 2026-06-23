'use client';

import { useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type OverviewData = {
  orders?: number;
  revenue?: number;
  avg_delivery_min?: number;
  on_time_pct?: number;
  active_drivers?: number;
  cancellation_rate?: number;
};

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

export function LieferdienstSchichtSchnellStatus({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;

    const load = () => {
      fetch(`/api/delivery/admin/overview?location_id=${encodeURIComponent(locationId)}&period=today`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!mounted) return;
          if (d) setData(d);
        })
        .catch(() => {})
        .finally(() => { if (mounted) setLoading(false); });
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  const onTimePct = data?.on_time_pct ?? null;
  const onTimeColor = onTimePct === null
    ? 'text-stone-600'
    : onTimePct >= 85 ? 'text-matcha-700'
    : onTimePct >= 70 ? 'text-amber-700'
    : 'text-red-700';

  const onTimeBg = onTimePct === null
    ? 'bg-stone-50'
    : onTimePct >= 85 ? 'bg-matcha-50'
    : onTimePct >= 70 ? 'bg-amber-50'
    : 'bg-red-50';

  const kpis = [
    {
      label: 'Bestellungen',
      value: data?.orders != null ? String(data.orders) : '—',
      icon: '📦',
      trend: 'neutral' as const,
      bg: 'bg-stone-50',
      text: 'text-stone-800',
    },
    {
      label: 'Umsatz',
      value: data?.revenue != null
        ? data.revenue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
        : '—',
      icon: '💶',
      trend: 'up' as const,
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
    },
    {
      label: 'Ø Lieferzeit',
      value: data?.avg_delivery_min != null ? `${Math.round(data.avg_delivery_min)} Min` : '—',
      icon: '⏱️',
      trend: 'neutral' as const,
      bg: 'bg-blue-50',
      text: 'text-blue-800',
    },
    {
      label: 'Pünktlichkeit',
      value: data?.on_time_pct != null ? `${Math.round(data.on_time_pct)}%` : '—',
      icon: '✅',
      trend: (onTimePct ?? 0) >= 85 ? 'up' as const : (onTimePct ?? 0) >= 70 ? 'neutral' as const : 'down' as const,
      bg: onTimeBg,
      text: onTimeColor,
    },
    {
      label: 'Aktive Fahrer',
      value: data?.active_drivers != null ? String(data.active_drivers) : '—',
      icon: '🚴',
      trend: 'neutral' as const,
      bg: 'bg-purple-50',
      text: 'text-purple-800',
    },
    {
      label: 'Storno-Quote',
      value: data?.cancellation_rate != null ? `${Math.round(data.cancellation_rate)}%` : '—',
      icon: '❌',
      trend: (data?.cancellation_rate ?? 0) <= 5 ? 'up' as const : 'down' as const,
      bg: (data?.cancellation_rate ?? 0) <= 5 ? 'bg-stone-50' : 'bg-red-50',
      text: (data?.cancellation_rate ?? 0) <= 5 ? 'text-stone-700' : 'text-red-700',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition border-b border-stone-100"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <BarChart2 className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold text-stone-800">Schicht-Schnellstatus</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400 ml-1" />}
        <span className="ml-auto shrink-0">
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </span>
      </button>

      {open && (
        <div className="p-4">
          {loading && !data ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {kpis.map((kpi) => (
                <div key={kpi.label} className={cn('rounded-xl p-3', kpi.bg)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base leading-none">{kpi.icon}</span>
                    <TrendIcon trend={kpi.trend} />
                  </div>
                  <div className={cn('text-lg font-black tabular-nums leading-none', kpi.text)}>
                    {kpi.value}
                  </div>
                  <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
