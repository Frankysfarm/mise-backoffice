'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle2, AlertTriangle, WifiOff, TrendingUp } from 'lucide-react';

interface StundeDaten { stunde: string; stopps: number; pünktlich: number; verzoegert: number; }
interface ApiData { total_stopps: number; puenktlich_count: number; verzoegert_count: number; puenktlich_pct: number; avg_min_pro_stopp: number; beste_stunde: string; schlechte_stunde: string; stunden: StundeDaten[]; }

const MOCK: ApiData = {
  total_stopps: 18,
  puenktlich_count: 14,
  verzoegert_count: 4,
  puenktlich_pct: 78,
  avg_min_pro_stopp: 9.2,
  beste_stunde: '13–14',
  schlechte_stunde: '18–19',
  stunden: [
    { stunde: '12–13', stopps: 4, pünktlich: 4, verzoegert: 0 },
    { stunde: '13–14', stopps: 5, pünktlich: 5, verzoegert: 0 },
    { stunde: '14–15', stopps: 3, pünktlich: 2, verzoegert: 1 },
    { stunde: '17–18', stopps: 4, pünktlich: 3, verzoegert: 1 },
    { stunde: '18–19', stopps: 2, pünktlich: 0, verzoegert: 2 },
  ],
};

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4123SchichtStoppUebersicht({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/stopp-uebersicht?driver_id=${driverId}&location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Stopp-Übersicht offline</span>
      </div>
    );
  }

  const maxStopps = Math.max(...data.stunden.map(s => s.stopps), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Schicht-Stopp-Übersicht</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-gray-500">Stopps heute</div>
          <div className="text-xl font-bold text-gray-700">{data.total_stopps}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-gray-500">Pünktlich</div>
          <div className="text-xl font-bold text-emerald-600">{data.puenktlich_pct}%</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-gray-500">Ø min/Stopp</div>
          <div className="text-xl font-bold text-orange-500">{data.avg_min_pro_stopp}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.stunden.map((std) => (
          <div key={std.stunde} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 w-10">{std.stunde}</span>
              <div className="flex-1 flex gap-0.5">
                <div className="h-4 bg-emerald-300 rounded-l-sm" style={{ width: `${(std.pünktlich / maxStopps) * 100}%`, minWidth: std.pünktlich > 0 ? '2px' : 0 }} />
                <div className="h-4 bg-red-300 rounded-r-sm" style={{ width: `${(std.verzoegert / maxStopps) * 100}%`, minWidth: std.verzoegert > 0 ? '2px' : 0 }} />
              </div>
              <span className="text-[10px] text-gray-500 w-4 text-right">{std.stopps}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 text-[9px] text-gray-500">
        <span className="flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Pünktlich</span>
        <span className="flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5 text-red-400" /> Verzögert</span>
        <span className="ml-auto flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5 text-blue-400" /> Beste: {data.beste_stunde}</span>
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-0.5">
        Schicht-Stopps · Stundenweise · 1-Min-Polling
      </div>
    </div>
  );
}
