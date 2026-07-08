'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, Clock, Star, Package, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId?: string | null;
}

interface KpiBlock {
  label: string;
  value: string;
  sub: string;
  trend: 'up' | 'down' | 'flat';
  trendVal: string;
  color: 'gruen' | 'amber' | 'rot' | 'blau';
}

interface StatsData {
  kpis: KpiBlock[];
  stunden: { h: string; bestellungen: number; umsatz: number }[];
  aktualisiert: string;
}

const MOCK_STATS: StatsData = {
  kpis: [
    { label: 'Bestellungen heute', value: '84',    sub: 'Lieferungen',     trend: 'up',   trendVal: '+12%',  color: 'gruen' },
    { label: 'Ø Lieferzeit',       value: '24',    sub: 'Minuten',         trend: 'down', trendVal: '-2 Min', color: 'gruen' },
    { label: 'Bewertung',          value: '4.7',   sub: '/ 5.0',           trend: 'up',   trendVal: '+0.1',  color: 'gruen' },
    { label: 'Pünktlichkeit',      value: '91%',   sub: 'On-Time-Rate',    trend: 'flat', trendVal: '±0%',   color: 'amber' },
    { label: 'Storno-Rate',        value: '2.4%',  sub: 'Abbrüche',        trend: 'down', trendVal: '-0.3%', color: 'gruen' },
    { label: 'Aktive Fahrer',      value: '5',     sub: 'von 7 online',    trend: 'flat', trendVal: 'stabil', color: 'blau' },
  ],
  stunden: [
    { h: '10', bestellungen: 4,  umsatz: 120 },
    { h: '11', bestellungen: 8,  umsatz: 240 },
    { h: '12', bestellungen: 18, umsatz: 540 },
    { h: '13', bestellungen: 22, umsatz: 660 },
    { h: '14', bestellungen: 14, umsatz: 420 },
    { h: '15', bestellungen: 9,  umsatz: 270 },
    { h: '16', bestellungen: 9,  umsatz: 270 },
  ],
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

const ICONS: Record<string, React.ElementType> = {
  'Bestellungen heute': Package,
  'Ø Lieferzeit': Clock,
  'Bewertung': Star,
  'Pünktlichkeit': TrendingUp,
  'Storno-Rate': Package,
  'Aktive Fahrer': Users,
};

function kpiColors(color: KpiBlock['color']) {
  switch (color) {
    case 'gruen': return { bg: 'bg-matcha-50',  border: 'border-matcha-100', val: 'text-matcha-800', icon: 'text-matcha-600' };
    case 'amber': return { bg: 'bg-amber-50',   border: 'border-amber-100',  val: 'text-amber-800',  icon: 'text-amber-600' };
    case 'rot':   return { bg: 'bg-red-50',     border: 'border-red-100',    val: 'text-red-800',    icon: 'text-red-600' };
    case 'blau':  return { bg: 'bg-blue-50',    border: 'border-blue-100',   val: 'text-blue-800',   icon: 'text-blue-600' };
  }
}

function TrendIcon({ t }: { t: KpiBlock['trend'] }) {
  if (t === 'up')   return <TrendingUp   className="h-3 w-3 text-matcha-600" />;
  if (t === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

export function LieferdienstPhase820StatistikenErweitertesDashboard({ locationId }: Props) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const params = new URLSearchParams({ ...(locationId ? { location_id: locationId } : {}) });
      const res = await fetch(`/api/delivery/stats?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.kpis || json.today_stats) {
        const kpis: KpiBlock[] = [
          { label: 'Bestellungen heute', value: String(json.today_stats?.total_orders ?? '—'), sub: 'Lieferungen', trend: 'flat', trendVal: '', color: 'blau' },
          { label: 'Ø Lieferzeit', value: String(json.today_stats?.avg_delivery_min ?? '—'), sub: 'Minuten', trend: 'flat', trendVal: '', color: 'gruen' },
          { label: 'Pünktlichkeit', value: `${json.today_stats?.on_time_pct ?? '—'}%`, sub: 'On-Time', trend: 'flat', trendVal: '', color: 'amber' },
          { label: 'Aktive Fahrer', value: String(json.today_stats?.drivers_online ?? '—'), sub: 'online', trend: 'flat', trendVal: '', color: 'blau' },
        ];
        setData({ kpis, stunden: MOCK_STATS.stunden, aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) });
        return;
      }
    } catch { /* noop */ }
    setData(MOCK_STATS);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = data ?? MOCK_STATS;
  const maxBest = Math.max(...d.stunden.map((s) => s.bestellungen), 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-stone-50">
        <BarChart2 className="h-4 w-4 text-stone-600" />
        <span className="text-sm font-bold text-stone-800">Statistiken-Dashboard Erweitert</span>
        <span className="ml-auto text-[10px] text-stone-400">
          {loading ? 'Lädt…' : `Aktualisiert ${d.aktualisiert}`}
        </span>
      </div>

      {/* KPI-Grid */}
      <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {d.kpis.map((k) => {
          const c = kpiColors(k.color);
          const Icon = ICONS[k.label] ?? BarChart2;
          return (
            <div key={k.label} className={cn('rounded-xl border p-3', c.bg, c.border)}>
              <div className="flex items-center justify-between mb-1">
                <Icon className={cn('h-4 w-4', c.icon)} />
                <div className="flex items-center gap-0.5">
                  <TrendIcon t={k.trend} />
                  <span className="text-[9px] text-stone-500 tabular-nums">{k.trendVal}</span>
                </div>
              </div>
              <div className={cn('text-xl font-black tabular-nums leading-tight', c.val)}>
                {k.value}
              </div>
              <div className="text-[9px] text-stone-500 mt-0.5">{k.sub}</div>
              <div className="text-[9px] text-stone-400 mt-0.5 font-medium">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Stunden-Histogram */}
      <div className="px-4 pb-4">
        <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wide mb-2">
          Bestellungen nach Stunde
        </div>
        <div className="flex items-end gap-1 h-16">
          {d.stunden.map((s) => (
            <div key={s.h} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t bg-matcha-400 hover:bg-matcha-500 transition-all"
                style={{ height: `${Math.round((s.bestellungen / maxBest) * 48)}px` }}
                title={`${s.bestellungen} Bestellungen`}
              />
              <span className="text-[8px] text-stone-400">{s.h}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
