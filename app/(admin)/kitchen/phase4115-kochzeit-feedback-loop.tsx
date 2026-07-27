'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, ChefHat, Star } from 'lucide-react';

interface TagEntry { tag: string; avg_min: number; delta_pct: number; bewertung: 'sehr_gut' | 'gut' | 'ok' | 'schlecht'; }
interface ApiData { verlauf: TagEntry[]; lernkurve_pct: number; beste_tag: string; schlechteste_tag: string; aktuelle_abweichung_min: number; ziel_min: number; empfehlung: string; }

const MOCK: ApiData = {
  verlauf: [
    { tag: 'Mo', avg_min: 15, delta_pct: 0, bewertung: 'ok' },
    { tag: 'Di', avg_min: 13, delta_pct: -13, bewertung: 'gut' },
    { tag: 'Mi', avg_min: 11, delta_pct: -15, bewertung: 'sehr_gut' },
    { tag: 'Do', avg_min: 12, delta_pct: 9, bewertung: 'gut' },
    { tag: 'Fr', avg_min: 14, delta_pct: 17, bewertung: 'ok' },
    { tag: 'Sa', avg_min: 17, delta_pct: 21, bewertung: 'schlecht' },
    { tag: 'So', avg_min: 12, delta_pct: -29, bewertung: 'sehr_gut' },
  ],
  lernkurve_pct: 67,
  beste_tag: 'Mi',
  schlechteste_tag: 'Sa',
  aktuelle_abweichung_min: 2,
  ziel_min: 12,
  empfehlung: 'Samstags 2 Köche mehr einplanen – Kochzeit steigt um Ø 42% gegenüber Werktagen.',
};

interface Props { locationId: string | null; }

export function KitchenPhase4115KochzeitFeedbackLoop({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-kochzeit-feedback?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const maxMin = Math.max(...data.verlauf.map(d => d.avg_min), data.ziel_min);
  const barHeight = 36;

  const bewertungColor = (b: TagEntry['bewertung']) => b === 'sehr_gut' ? 'bg-emerald-400' : b === 'gut' ? 'bg-blue-400' : b === 'ok' ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-bold text-gray-900">Kochzeit Feedback-Loop</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className="text-[10px] text-teal-600 font-semibold">Lernkurve {data.lernkurve_pct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-emerald-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Bester Tag</div>
          <div className="text-sm font-bold text-emerald-600">{data.beste_tag}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Ziel</div>
          <div className="text-sm font-bold text-gray-700">{data.ziel_min} min</div>
        </div>
        <div className="bg-red-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Schlechtester</div>
          <div className="text-sm font-bold text-red-500">{data.schlechteste_tag}</div>
        </div>
      </div>

      <div className="flex items-end gap-1 h-10">
        {data.verlauf.map((d) => {
          const h = Math.round((d.avg_min / maxMin) * barHeight);
          const isAboveTarget = d.avg_min > data.ziel_min;
          return (
            <div key={d.tag} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col justify-end" style={{ height: barHeight }}>
                <div className={`w-full rounded-t-sm ${isAboveTarget ? 'bg-red-300' : 'bg-emerald-300'}`} style={{ height: h }} />
              </div>
              <span className="text-[9px] text-gray-400">{d.tag}</span>
            </div>
          );
        })}
        <div className="w-px bg-blue-300 relative flex-shrink-0" style={{ height: barHeight + 12, marginBottom: -8 }}>
          <span className="absolute -top-3 -left-3 text-[8px] text-blue-500 whitespace-nowrap">Ziel</span>
        </div>
      </div>

      <div className="space-y-1">
        {data.verlauf.map((d) => (
          <div key={d.tag + '_row'} className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 w-4">{d.tag}</span>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bewertungColor(d.bewertung)}`} />
            <span className="text-[10px] text-gray-700">{d.avg_min} min</span>
            <span className={`text-[9px] ml-auto font-semibold flex items-center gap-0.5 ${d.delta_pct < 0 ? 'text-emerald-600' : d.delta_pct > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {d.delta_pct < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : d.delta_pct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : null}
              {d.delta_pct !== 0 ? `${Math.abs(d.delta_pct)}%` : '—'}
            </span>
          </div>
        ))}
      </div>

      {data.empfehlung && (
        <div className="flex gap-1.5 bg-teal-50 rounded-lg p-2">
          <Star className="w-3 h-3 text-teal-500 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-teal-700">{data.empfehlung}</span>
        </div>
      )}

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-0.5">
        7-Tage-Verlauf · 1-Min-Polling · KI-Lernkurve
      </div>
    </div>
  );
}
