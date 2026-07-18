'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Package, Euro, Clock, Star, AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';

interface HourlyBucket {
  hour: number;
  orders: number;
  revenue: number;
  avg_delivery_min: number;
}

interface ZoneStat {
  zone: string;
  orders: number;
  avg_delivery_min: number;
  on_time_rate: number;
}

interface StatsData {
  orders_today: number;
  orders_yesterday: number;
  revenue_today: number;
  revenue_yesterday: number;
  avg_delivery_min: number;
  avg_delivery_min_yesterday: number;
  on_time_rate: number;
  cancellation_rate: number;
  driver_count_online: number;
  hourly: HourlyBucket[];
  zones: ZoneStat[];
  generatedAt: string;
}

interface Props { locationId: string | null; }

function Kpi({ label, value, prev, unit, icon: Icon, color }: {
  label: string; value: number | string; prev?: number | null;
  unit?: string; icon: any; color: string;
}) {
  const numVal = typeof value === 'number' ? value : parseFloat(String(value));
  const trend = prev != null ? (numVal > prev ? 'up' : numVal < prev ? 'down' : 'neutral') : null;
  return (
    <div className={`rounded-xl ${color} p-3`}>
      <div className="flex items-start justify-between">
        <Icon className="w-4 h-4 opacity-60 mt-0.5" />
        {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
        {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
      </div>
      <div className="mt-1.5 text-xl font-black tabular-nums">
        {value}{unit}
      </div>
      <div className="text-[10px] font-semibold opacity-70 mt-0.5">{label}</div>
    </div>
  );
}

export function LieferdienstPhase2320StatistikDashboardUltimate({ locationId }: Props) {
  const [data, setData] = useState<StatsData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/analytics?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(d))
        .catch(() => null);
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const cancelAlert = (data?.cancellation_rate ?? 0) > 10;
  const onTimeAlert = (data?.on_time_rate ?? 100) < 80;

  return (
    <div className={`rounded-xl border ${cancelAlert || onTimeAlert ? 'border-amber-200' : 'border-teal-200'} bg-white shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${cancelAlert || onTimeAlert ? 'bg-amber-50' : 'bg-teal-50'} rounded-t-xl`}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${cancelAlert || onTimeAlert ? 'text-amber-500' : 'text-teal-500'}`} />
          <span className={`font-semibold text-sm ${cancelAlert || onTimeAlert ? 'text-amber-800' : 'text-teal-800'}`}>
            Statistiken-Dashboard (Phase 2320)
          </span>
          {(cancelAlert || onTimeAlert) && (
            <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">
              Alert
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            {data?.orders_today ?? 0} Bestellungen · {data ? ((data.revenue_today ?? 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi
              label="Bestellungen heute"
              value={data?.orders_today ?? 0}
              prev={data?.orders_yesterday}
              icon={Package}
              color="bg-teal-50 text-teal-900"
            />
            <Kpi
              label="Umsatz heute"
              value={data ? ((data.revenue_today ?? 0) / 100).toFixed(0) : '—'}
              unit="€"
              prev={data ? (data.revenue_yesterday ?? null) : null}
              icon={Euro}
              color="bg-green-50 text-green-900"
            />
            <Kpi
              label="Ø Lieferzeit"
              value={data?.avg_delivery_min ?? 0}
              unit=" min"
              prev={data?.avg_delivery_min_yesterday}
              icon={Clock}
              color="bg-blue-50 text-blue-900"
            />
            <Kpi
              label="Pünktlichkeitsrate"
              value={`${data?.on_time_rate ?? 0}%`}
              icon={Star}
              color={onTimeAlert ? 'bg-red-50 text-red-900' : 'bg-emerald-50 text-emerald-900'}
            />
            <Kpi
              label="Stornoquote"
              value={`${data?.cancellation_rate ?? 0}%`}
              icon={AlertTriangle}
              color={cancelAlert ? 'bg-red-50 text-red-900' : 'bg-gray-50 text-gray-700'}
            />
            <Kpi
              label="Fahrer online"
              value={data?.driver_count_online ?? 0}
              icon={Users}
              color="bg-purple-50 text-purple-900"
            />
          </div>

          {/* Alerts */}
          {cancelAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Stornoquote über 10% — Ursachenanalyse empfohlen
            </div>
          )}
          {onTimeAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              <Clock className="w-4 h-4 shrink-0" />
              Pünktlichkeitsrate unter 80% — Kapazitätsprüfung empfohlen
            </div>
          )}

          {/* Hourly Chart */}
          {(data?.hourly ?? []).length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 mb-2">Bestellungen nach Stunde</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={data!.hourly} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickFormatter={h => `${h}h`} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                    formatter={(v: any, name: string) => [v, name === 'orders' ? 'Bestellungen' : name]}
                    labelFormatter={l => `${l}:00 Uhr`}
                  />
                  <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                    {(data?.hourly ?? []).map((_, i) => (
                      <Cell key={i} fill="#0d9488" fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Zone Stats */}
          {(data?.zones ?? []).length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 mb-2">Zonen-Übersicht</div>
              <div className="space-y-1.5">
                {(data?.zones ?? []).map(z => (
                  <div key={z.zone} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-700 font-medium truncate w-24 shrink-0">{z.zone || 'Unbekannt'}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${z.on_time_rate >= 80 ? 'bg-teal-500' : z.on_time_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, z.on_time_rate)}%` }}
                      />
                    </div>
                    <span className="text-gray-500 shrink-0 w-12 text-right">{z.orders} Best.</span>
                    <span className="text-gray-400 shrink-0 w-12 text-right">{z.avg_delivery_min} min</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!locationId && (
            <div className="text-xs text-gray-400 text-center py-4">Bitte Filiale auswählen</div>
          )}
        </div>
      )}
    </div>
  );
}
