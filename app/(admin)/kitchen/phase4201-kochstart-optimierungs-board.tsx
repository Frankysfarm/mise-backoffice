'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flame, Clock, ChefHat, AlertTriangle } from 'lucide-react';

interface KochSlot {
  order_id: string;
  artikel: string;
  prep_min: number;
  fahrer_eta_min: number;
  kochstart_in_min: number;
  status: 'warten' | 'jetzt' | 'lauf' | 'bereit';
}

interface ApiData {
  slots: KochSlot[];
  on_time_rate: number;
  avg_sync_delta_min: number;
  alert_count: number;
}

const MOCK: ApiData = {
  slots: [
    { order_id: 'o1', artikel: 'Burger + Pommes', prep_min: 12, fahrer_eta_min: 14, kochstart_in_min: 2, status: 'jetzt' },
    { order_id: 'o2', artikel: 'Pasta Arrabiata', prep_min: 10, fahrer_eta_min: 18, kochstart_in_min: 8, status: 'warten' },
    { order_id: 'o3', artikel: 'Pizza Margherita', prep_min: 15, fahrer_eta_min: 15, kochstart_in_min: 0, status: 'lauf' },
    { order_id: 'o4', artikel: 'Salat Bowl', prep_min: 6, fahrer_eta_min: 7, kochstart_in_min: 0, status: 'bereit' },
  ],
  on_time_rate: 87,
  avg_sync_delta_min: 1.8,
  alert_count: 1,
};

const statusLabel: Record<KochSlot['status'], string> = {
  warten: 'Warten', jetzt: 'Jetzt!', lauf: 'In Arbeit', bereit: 'Fertig',
};
const statusColor: Record<KochSlot['status'], string> = {
  warten: 'bg-gray-100 text-gray-500',
  jetzt: 'bg-orange-100 text-orange-700 font-semibold',
  lauf: 'bg-blue-100 text-blue-700',
  bereit: 'bg-green-100 text-green-700',
};
const dotColor: Record<KochSlot['status'], string> = {
  warten: 'bg-gray-300', jetzt: 'bg-orange-500', lauf: 'bg-blue-500', bereit: 'bg-green-500',
};

interface Props { locationId: string | null; }

export function KitchenPhase4201KochstartOptimierungsBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/kochstart-optimierung?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ChefHat className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-gray-900">Kochstart-Optimierung</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2 h-2 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count}
            </span>
          )}
          <span className="text-[10px] text-orange-600 font-medium">{data.on_time_rate}% on-time</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-orange-50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="text-[10px] text-orange-600 font-medium">On-Time</span>
          </div>
          <span className="text-sm font-bold text-orange-700">{data.on_time_rate}%</span>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Clock className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] text-blue-600 font-medium">Sync-Delta</span>
          </div>
          <span className="text-sm font-bold text-blue-700">±{data.avg_sync_delta_min.toFixed(1)} min</span>
        </div>
      </div>
      <div className="space-y-1">
        {data.slots.map((s) => (
          <div key={s.order_id} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[s.status]}`} />
            <span className="text-[10px] text-gray-700 flex-1 truncate">{s.artikel}</span>
            <span className="text-[10px] text-gray-400">F:{s.fahrer_eta_min}m</span>
            <span className={`text-[10px] px-1 py-0.5 rounded ${statusColor[s.status]}`}>{statusLabel[s.status]}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 px-0.5 pt-0.5 border-t border-gray-100">
        <span>Fahrer-ETA-Sync aktiv</span>
        <span>20-Sek-Polling</span>
      </div>
    </div>
  );
}
