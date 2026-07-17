'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface StationData {
  station: string;
  activeOrders: number;
  avgPrepMin: number;
  targetMin: number;
  efficiency: number; // 0-100
  trend: 'up' | 'down' | 'flat';
  overdueCount: number;
}

const MOCK_STATIONS: StationData[] = [
  { station: 'Grill', activeOrders: 3, avgPrepMin: 8.2, targetMin: 9, efficiency: 91, trend: 'up', overdueCount: 0 },
  { station: 'Salat', activeOrders: 2, avgPrepMin: 4.1, targetMin: 4, efficiency: 98, trend: 'flat', overdueCount: 0 },
  { station: 'Fritteusen', activeOrders: 4, avgPrepMin: 6.8, targetMin: 6, efficiency: 72, trend: 'down', overdueCount: 1 },
  { station: 'Backofen', activeOrders: 2, avgPrepMin: 12.5, targetMin: 12, efficiency: 84, trend: 'up', overdueCount: 0 },
  { station: 'Kalt', activeOrders: 1, avgPrepMin: 2.3, targetMin: 3, efficiency: 100, trend: 'up', overdueCount: 0 },
];

function EffizienzBalken({ value, overdueCount }: { value: number; overdueCount: number }) {
  const color =
    overdueCount > 0 ? 'bg-red-500' :
    value >= 90 ? 'bg-emerald-500' :
    value >= 75 ? 'bg-amber-400' :
    'bg-red-400';
  return (
    <div className="w-full bg-stone-100 rounded-full h-1.5 mt-1">
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-700`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export function KitchenPhase2195EchtzeitPrepEffizienzMatrix() {
  const [stations, setStations] = useState<StationData[]>(MOCK_STATIONS);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('kitchen_stations')
        .select('station,active_orders,avg_prep_min,target_min,efficiency,trend,overdue_count')
        .order('efficiency', { ascending: true });
      if (data && data.length > 0) {
        setStations(data.map((d) => ({
          station: d.station,
          activeOrders: d.active_orders ?? 0,
          avgPrepMin: d.avg_prep_min ?? 0,
          targetMin: d.target_min ?? 10,
          efficiency: d.efficiency ?? 80,
          trend: d.trend ?? 'flat',
          overdueCount: d.overdue_count ?? 0,
        })));
      }
    } catch {
      // keep mock data
    }
    setLastUpdate(new Date());
  }, [supabase]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const totalOverdue = stations.reduce((s, st) => s + st.overdueCount, 0);
  const avgEfficiency = Math.round(stations.reduce((s, st) => s + st.efficiency, 0) / stations.length);

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-stone-800">Stations-Effizienz Live</span>
          {totalOverdue > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {totalOverdue} überfällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            avgEfficiency >= 90 ? 'bg-emerald-100 text-emerald-700' :
            avgEfficiency >= 75 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            Ø {avgEfficiency}%
          </span>
          <span className="text-[10px] text-stone-400">
            {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {stations.map((s) => {
          const TrendIcon = s.trend === 'up' ? TrendingUp : s.trend === 'down' ? TrendingDown : Minus;
          const trendColor = s.trend === 'up' ? 'text-emerald-500' : s.trend === 'down' ? 'text-red-500' : 'text-stone-400';
          const deltaMin = s.avgPrepMin - s.targetMin;
          return (
            <div key={s.station} className="flex items-start gap-3">
              <div className="w-20 shrink-0">
                <p className="text-xs font-medium text-stone-700 truncate">{s.station}</p>
                <p className="text-[10px] text-stone-400">{s.activeOrders} aktiv</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-600">
                    {s.avgPrepMin.toFixed(1)} / {s.targetMin} Min
                  </span>
                  <div className="flex items-center gap-1">
                    <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                    <span className={`text-[10px] font-medium ${
                      s.overdueCount > 0 ? 'text-red-600' :
                      s.efficiency >= 90 ? 'text-emerald-600' :
                      s.efficiency >= 75 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {s.efficiency}%
                      {deltaMin > 0 && <span className="ml-0.5">+{deltaMin.toFixed(1)}m</span>}
                    </span>
                  </div>
                </div>
                <EffizienzBalken value={s.efficiency} overdueCount={s.overdueCount} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center gap-3 text-[10px] text-stone-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥90%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 75–89%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;75%</span>
        <span className="ml-auto flex items-center gap-1"><Clock className="w-3 h-3" /> 15s Refresh</span>
      </div>
    </div>
  );
}
