'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3, TrendingUp, TrendingDown, AlertTriangle, Package, Euro, Clock, Star, Bike, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiTile {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  trend_val: string;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface HourlyPoint {
  hour: string;
  orders: number;
  revenue: number;
}

interface ApiData {
  kpis: KpiTile[];
  hourly: HourlyPoint[];
  sla_pct: number;
  alert_text?: string;
}

const MOCK: ApiData = {
  kpis: [
    { label: 'Bestellungen',   value: '87',       trend: 'up',     trend_val: '+12%', ampel: 'gruen' },
    { label: 'Umsatz',         value: '2.340 €',  trend: 'up',     trend_val: '+8%',  ampel: 'gruen' },
    { label: 'Ø Lieferzeit',   value: '28 Min',   trend: 'stable', trend_val: '0 Min', ampel: 'gelb' },
    { label: 'Pünktlichkeit',  value: '91%',      trend: 'up',     trend_val: '+3%',  ampel: 'gruen' },
    { label: 'Ø Bewertung',    value: '4.7 ★',    trend: 'stable', trend_val: '0',    ampel: 'gruen' },
    { label: 'Akt. Fahrer',    value: '6',        trend: 'stable', trend_val: '–',    ampel: 'gruen' },
  ],
  hourly: [
    { hour: '10', orders: 5,  revenue: 140 },
    { hour: '11', orders: 9,  revenue: 250 },
    { hour: '12', orders: 18, revenue: 490 },
    { hour: '13', orders: 22, revenue: 610 },
    { hour: '14', orders: 15, revenue: 420 },
    { hour: '15', orders: 8,  revenue: 230 },
    { hour: '16', orders: 10, revenue: 200 },
  ],
  sla_pct: 91,
};

const KPI_ICONS = [Package, Euro, Clock, CheckCircle2, Star, Bike];

function ampelColor(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bg: 'bg-red-50'    };
  if (a === 'gelb') return { text: 'text-amber-600', bg: 'bg-amber-50'  };
  return                   { text: 'text-green-600', bg: 'bg-green-50'  };
}

type ChartMode = 'orders' | 'revenue';

export function LieferdienstPhase2618StatistikenLiveDashboard({ locationId }: { locationId?: string | null }) {
  const [open, setOpen]     = useState(true);
  const [data, setData]     = useState<ApiData>(MOCK);
  const [mode, setMode]     = useState<ChartMode>('orders');

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/stats?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const slaOk     = data.sla_pct >= 85;
  const hasAlert  = !!data.alert_text;
  const maxOrders = Math.max(...data.hourly.map(h => h.orders), 1);
  const maxRev    = Math.max(...data.hourly.map(h => h.revenue), 1);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Statistiken Live-Dashboard</span>
          {hasAlert && <AlertTriangle size={14} className="text-amber-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${slaOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            SLA {data.sla_pct}%
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasAlert && (
            <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-lg p-2 text-xs text-amber-700">
              <AlertTriangle size={12} /> {data.alert_text}
            </div>
          )}

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2">
            {data.kpis.map((k, i) => {
              const Icon = KPI_ICONS[i] ?? Package;
              const cls  = ampelColor(k.ampel);
              return (
                <div key={k.label} className={`rounded-lg p-2 ${cls.bg}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <Icon size={10} className={cls.text} />
                    <span className="text-[10px] text-gray-500 truncate">{k.label}</span>
                  </div>
                  <div className={`text-sm font-bold ${cls.text}`}>{k.value}</div>
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    {k.trend === 'up'   && <TrendingUp   size={9} className="text-green-500" />}
                    {k.trend === 'down' && <TrendingDown size={9} className="text-red-500"   />}
                    <span>{k.trend_val}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700">Stundenverlauf</span>
              <div className="flex gap-1">
                {(['orders', 'revenue'] as ChartMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`text-[10px] px-2 py-0.5 rounded-full ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {m === 'orders' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={data.hourly} barSize={14}>
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val) => mode === 'revenue' ? [`${val} €`, 'Umsatz'] : [val, 'Bestellungen']}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey={mode} radius={[3, 3, 0, 0]}>
                  {data.hourly.map((h, i) => {
                    const pct = mode === 'orders' ? h.orders / maxOrders : h.revenue / maxRev;
                    const color = pct > 0.8 ? '#6366f1' : pct > 0.5 ? '#818cf8' : '#a5b4fc';
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* SLA indicator */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>SLA-Einhaltung</span>
              <span className={slaOk ? 'text-green-600' : 'text-red-600'}>{data.sla_pct}% (Ziel ≥85%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${slaOk ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${data.sla_pct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
