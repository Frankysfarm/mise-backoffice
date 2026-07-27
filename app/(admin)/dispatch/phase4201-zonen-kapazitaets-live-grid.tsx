'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Users, AlertTriangle, TrendingUp } from 'lucide-react';

interface ZoneRow {
  zone_name: string;
  aktive_fahrer: number;
  offene_touren: number;
  auslastung_pct: number;
  avg_eta_min: number;
  status: 'ok' | 'warn' | 'krit';
}

interface ApiData {
  zones: ZoneRow[];
  total_fahrer: number;
  total_touren: number;
  fleet_auslastung_pct: number;
  alert_count: number;
}

const MOCK: ApiData = {
  zones: [
    { zone_name: 'Innenstadt', aktive_fahrer: 4, offene_touren: 3, auslastung_pct: 75, avg_eta_min: 18, status: 'ok' },
    { zone_name: 'Nord',       aktive_fahrer: 2, offene_touren: 4, auslastung_pct: 95, avg_eta_min: 26, status: 'krit' },
    { zone_name: 'West',       aktive_fahrer: 3, offene_touren: 2, auslastung_pct: 55, avg_eta_min: 22, status: 'ok' },
    { zone_name: 'Ost',        aktive_fahrer: 1, offene_touren: 3, auslastung_pct: 88, avg_eta_min: 31, status: 'warn' },
  ],
  total_fahrer: 10,
  total_touren: 12,
  fleet_auslastung_pct: 78,
  alert_count: 2,
};

const statusStyle: Record<ZoneRow['status'], string> = {
  ok:   'bg-green-50 border-green-200',
  warn: 'bg-yellow-50 border-yellow-200',
  krit: 'bg-red-50 border-red-200',
};
const auslastungsColor = (pct: number) =>
  pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-400' : 'bg-green-500';

interface Props { locationId: string | null; }

export function DispatchPhase4201ZonenKapazitaetsLiveGrid({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/dispatch/zonen-kapazitaet?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-900">Zonen-Kapazität Live</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2 h-2 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-indigo-50 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Users className="w-3 h-3 text-indigo-500" />
            <span className="text-[10px] text-indigo-600">Fahrer</span>
          </div>
          <span className="text-sm font-bold text-indigo-700">{data.total_fahrer}</span>
        </div>
        <div className="bg-purple-50 rounded-lg p-2">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-purple-500" />
            <span className="text-[10px] text-purple-600">Touren</span>
          </div>
          <span className="text-sm font-bold text-purple-700">{data.total_touren}</span>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center justify-center mb-0.5">
            <span className="text-[10px] text-gray-600">Auslast.</span>
          </div>
          <span className="text-sm font-bold text-gray-700">{data.fleet_auslastung_pct}%</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {data.zones.map((z) => (
          <div key={z.zone_name} className={`rounded-lg border p-2 ${statusStyle[z.status]}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-gray-700">{z.zone_name}</span>
              <span className="text-[10px] text-gray-500">{z.aktive_fahrer}F / {z.offene_touren}T · {z.avg_eta_min}min</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${auslastungsColor(z.auslastung_pct)}`}
                style={{ width: `${Math.min(z.auslastung_pct, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 px-0.5 pt-0.5 border-t border-gray-100">
        <span>Rot = kritische Zone</span>
        <span>20-Sek-Polling</span>
      </div>
    </div>
  );
}
