'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Euro, Star, TrendingDown, TrendingUp, Minus, Truck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiItem {
  label: string;
  value: string;
  unit: string;
  status: 'good' | 'warn' | 'bad';
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
}

interface ApiData {
  kpis: KpiItem[];
  alert: string | null;
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  kpis: [
    { label: 'Bestellungen', value: '47', unit: 'heute', status: 'good', trend: 'up', trendPct: 12 },
    { label: 'Umsatz', value: '1.240', unit: '€', status: 'good', trend: 'up', trendPct: 8 },
    { label: 'Lieferzeit Ø', value: '28', unit: 'Min', status: 'warn', trend: 'up', trendPct: 5 },
    { label: 'Pünktlichkeit', value: '84', unit: '%', status: 'warn', trend: 'down', trendPct: 3 },
    { label: 'Bewertung', value: '4.3', unit: '★', status: 'good', trend: 'flat', trendPct: 0 },
    { label: 'Stornos', value: '3', unit: 'heute', status: 'bad', trend: 'up', trendPct: 50 },
    { label: 'Aktive Fahrer', value: '4', unit: 'online', status: 'good', trend: 'flat', trendPct: 0 },
    { label: 'Offene Aufträge', value: '6', unit: 'aktiv', status: 'warn', trend: 'up', trendPct: 20 },
  ],
  alert: 'Pünktlichkeit unter 90% — Fahrer-Kapazität prüfen!',
  letzte_aktualisierung: new Date().toISOString(),
};

function TrendIcon({ trend, size = 12 }: { trend: 'up' | 'down' | 'flat'; size?: number }) {
  if (trend === 'up') return <TrendingUp size={size} />;
  if (trend === 'down') return <TrendingDown size={size} />;
  return <Minus size={size} />;
}

function statusBg(status: 'good' | 'warn' | 'bad'): string {
  if (status === 'good') return 'bg-green-50 border-green-200';
  if (status === 'warn') return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function statusText(status: 'good' | 'warn' | 'bad'): string {
  if (status === 'good') return 'text-green-700';
  if (status === 'warn') return 'text-amber-700';
  return 'text-red-700';
}

function trendColor(trend: 'up' | 'down' | 'flat', status: 'good' | 'warn' | 'bad'): string {
  if (trend === 'flat') return 'text-gray-400';
  const goodUp = (trend === 'up' && status === 'good') || (trend === 'down' && status === 'bad');
  return goodUp ? 'text-green-600' : 'text-red-500';
}

export function LieferdienstPhase2570StatistikenEchtzeitKompaktDashboard({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/lieferdienst/statistiken-kompakt?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm mb-3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-100">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-matcha-600" />
          <span className="font-semibold text-sm text-gray-900">Statistiken Echtzeit</span>
        </div>
        <span className="text-[10px] text-gray-400">
          {new Date(data.letzte_aktualisierung).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </span>
      </div>

      {data.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 font-medium">
          <AlertTriangle size={12} className="flex-shrink-0" />
          {data.alert}
        </div>
      )}

      <div className="grid grid-cols-4 divide-x divide-y divide-matcha-100">
        {data.kpis.map((kpi, i) => (
          <div key={i} className={cn('p-3 border', statusBg(kpi.status))}>
            <div className="text-[10px] text-gray-500 mb-1 truncate">{kpi.label}</div>
            <div className={cn('text-lg font-black tabular-nums leading-none', statusText(kpi.status))}>
              {kpi.value}
              <span className="text-[10px] font-normal ml-0.5">{kpi.unit}</span>
            </div>
            {kpi.trend !== 'flat' && (
              <div className={cn('flex items-center gap-0.5 text-[10px] font-semibold mt-1', trendColor(kpi.trend, kpi.status))}>
                <TrendIcon trend={kpi.trend} size={9} />
                {kpi.trendPct}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
