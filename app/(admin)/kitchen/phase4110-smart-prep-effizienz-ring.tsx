'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Zap, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

interface KanalRow { kanal: string; avg_prep_min: number; target_min: number; effizienz_pct: number; ampel: 'gruen' | 'gelb' | 'rot'; bestellungen: number; }
interface ApiData { kanaele: KanalRow[]; gesamt_effizienz_pct: number; bester_kanal: string; schlechtester_kanal: string; on_time_pct: number; avg_prep_min: number; }

const MOCK: ApiData = {
  kanaele: [
    { kanal: 'Lieferung', avg_prep_min: 11, target_min: 12, effizienz_pct: 92, ampel: 'gruen', bestellungen: 34 },
    { kanal: 'Abholung', avg_prep_min: 8, target_min: 8, effizienz_pct: 100, ampel: 'gruen', bestellungen: 18 },
    { kanal: 'Tisch', avg_prep_min: 16, target_min: 14, effizienz_pct: 72, ampel: 'gelb', bestellungen: 12 },
    { kanal: 'Express', avg_prep_min: 22, target_min: 15, effizienz_pct: 45, ampel: 'rot', bestellungen: 5 },
  ],
  gesamt_effizienz_pct: 82,
  bester_kanal: 'Abholung',
  schlechtester_kanal: 'Express',
  on_time_pct: 79,
  avg_prep_min: 12,
};

interface Props { locationId: string | null; }

export function KitchenPhase4110SmartPrepEffizienzRing({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-prep-effizienz?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const ringPct = data.gesamt_effizienz_pct;
  const ringColor = ringPct >= 90 ? '#10b981' : ringPct >= 75 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference * (1 - ringPct / 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Prep-Effizienz-Ring</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className="text-[10px] text-gray-400">alle 20s</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#f3f4f6" strokeWidth="6" />
            <circle cx="36" cy="36" r="28" fill="none" stroke={ringColor} strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            <text x="36" y="38" textAnchor="middle" fontSize="13" fontWeight="bold" fill={ringColor}>{ringPct}%</text>
          </svg>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">Ø Prep-Zeit</span>
            <span className="font-semibold text-gray-800">{data.avg_prep_min} min</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">Pünktlich</span>
            <span className={`font-semibold ${data.on_time_pct >= 85 ? 'text-emerald-600' : 'text-yellow-500'}`}>{data.on_time_pct}%</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">Bester Kanal</span>
            <span className="font-semibold text-emerald-600">{data.bester_kanal}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">Schwächster</span>
            <span className="font-semibold text-red-500">{data.schlechtester_kanal}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.kanaele.map((k) => {
          const barColor = k.ampel === 'gruen' ? 'bg-emerald-400' : k.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = k.ampel === 'gruen' ? 'text-emerald-600' : k.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          return (
            <div key={k.kanal} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-700 w-14 truncate">{k.kanal}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${k.effizienz_pct}%`, transition: 'width 0.4s ease' }} />
                </div>
                <span className={`text-[10px] font-bold ${tColor} w-8 text-right`}>{k.effizienz_pct}%</span>
                <span className="text-[9px] text-gray-400 w-12 text-right">{k.avg_prep_min}/{k.target_min}min</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[9px] text-gray-400 pt-0.5 border-t border-gray-100">
        <span>Kanal-Effizienz vs. Zielzeit</span>
        <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> 20-Sek-Polling</span>
      </div>
    </div>
  );
}
