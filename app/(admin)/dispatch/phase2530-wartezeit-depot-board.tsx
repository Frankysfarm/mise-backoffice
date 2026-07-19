'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_depot_min: number;
  avg_wartezeit_depot_vw: number | null;
  intervalle_anzahl: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_wartezeit_depot_min: number;
  alert_count: number;
}

function ampelClass(min: number) {
  if (min > 20) return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
  if (min > 10) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
}

function DepotBar({ min }: { min: number }) {
  const maxMin = 30;
  const w = Math.min(100, (min / maxMin) * 100);
  const color = min > 20 ? 'bg-red-500' : min > 10 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: `${(10 / maxMin) * 100}%` }} title="Ziel ≤10min" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: `${(20 / maxMin) * 100}%` }} title="Alert >20min" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd2', fahrer_name: 'Sarah K.', avg_wartezeit_depot_min: 25.4, avg_wartezeit_depot_vw: 18.1, intervalle_anzahl: 13, trend: 'steigend', trend_delta: 7.3,  ampel: 'rot',   alert: true  },
    { fahrer_id: 'd5', fahrer_name: 'Anna B.',  avg_wartezeit_depot_min: 22.9, avg_wartezeit_depot_vw: 20.0, intervalle_anzahl: 10, trend: 'steigend', trend_delta: 2.9,  ampel: 'rot',   alert: true  },
    { fahrer_id: 'd3', fahrer_name: 'Lena S.',  avg_wartezeit_depot_min: 14.7, avg_wartezeit_depot_vw: 14.2, intervalle_anzahl: 6,  trend: 'stabil',   trend_delta: 0.5,  ampel: 'gelb',  alert: false },
    { fahrer_id: 'd4', fahrer_name: 'Tom B.',   avg_wartezeit_depot_min: 6.1,  avg_wartezeit_depot_vw: 7.8,  intervalle_anzahl: 4,  trend: 'fallend',  trend_delta: -1.7, ampel: 'gruen', alert: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   avg_wartezeit_depot_min: 8.2,  avg_wartezeit_depot_vw: 9.5,  intervalle_anzahl: 8,  trend: 'fallend',  trend_delta: -1.3, ampel: 'gruen', alert: false },
  ],
  team_avg_wartezeit_depot_min: 15.5,
  alert_count: 2,
};

export function DispatchPhase2530WartezeitDepotBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit-depot?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.avg_wartezeit_depot_min - a.avg_wartezeit_depot_min);
  const hasAlert = data.alert_count > 0;
  const teamCls = ampelClass(data.team_avg_wartezeit_depot_min);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  const teamVWAvg = sorted.length > 0
    ? sorted.reduce((s, f) => s + (f.avg_wartezeit_depot_vw ?? f.avg_wartezeit_depot_min), 0) / sorted.length
    : 0;
  const teamTrend = data.team_avg_wartezeit_depot_min > teamVWAvg + 1 ? 'steigend'
    : data.team_avg_wartezeit_depot_min < teamVWAvg - 1 ? 'fallend' : 'stabil';

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-600' : 'text-green-600'} />
          <span className="text-sm font-bold text-gray-800">Wartezeit-Depot-Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamCls.text} ${teamCls.bg}`}>
            Ø {data.team_avg_wartezeit_depot_min.toFixed(1)} min
          </span>
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              <AlertTriangle size={10} /> {data.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Team-Ø heute</div>
              <div className={`text-lg font-black tabular-nums ${teamCls.text}`}>{data.team_avg_wartezeit_depot_min.toFixed(1)} min</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Vorwoche Ø</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-black tabular-nums text-gray-700">{teamVWAvg.toFixed(1)} min</span>
                <TrendIcon trend={teamTrend} />
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Ziel ≤10 min</div>
              <div className={`text-lg font-black tabular-nums ${hasAlert ? 'text-red-600' : 'text-green-600'}`}>
                {data.alert_count} Alert
              </div>
            </div>
          </div>

          {/* Alert Banner */}
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={13} className="shrink-0" />
              Wartezeit &gt;20 min: {alertFahrer.join(', ')} — Disposition prüfen!
            </div>
          )}

          {/* Driver List */}
          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelClass(f.avg_wartezeit_depot_min);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${cls.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cls.dot}`} />
                    <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
                    <span className={`text-xs font-black tabular-nums shrink-0 ${cls.text}`}>{f.avg_wartezeit_depot_min.toFixed(1)} min</span>
                    <TrendIcon trend={f.trend} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <DepotBar min={f.avg_wartezeit_depot_min} />
                    <span className="text-[9px] text-gray-400 shrink-0">
                      {f.intervalle_anzahl} Intervalle
                      {f.trend_delta !== 0 && ` · VW ${f.trend_delta > 0 ? '+' : ''}${f.trend_delta.toFixed(1)} min`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> ≤10 min</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 10–20 min</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> &gt;20 min</span>
            <span className="ml-auto">30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
