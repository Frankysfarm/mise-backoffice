'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';

interface TrendPunkt { zeitstempel: string; avg_min: number; bestellungen: number; ampel: 'gruen' | 'gelb' | 'rot'; }
interface ApiData { punkte: TrendPunkt[]; trend_pct: number; trend_richtung: 'besser' | 'schlechter' | 'stabil'; aktuell_min: number; ziel_min: number; prognose_min: number; }

function genPunkte(): TrendPunkt[] {
  return Array.from({ length: 12 }, (_, i) => {
    const base = 12 + Math.sin(i * 0.7) * 3 + (i > 8 ? -2 : 0);
    const avg = parseFloat(base.toFixed(1));
    return { zeitstempel: `-${(11 - i) * 5}m`, avg_min: avg, bestellungen: 3 + Math.floor(Math.random() * 5), ampel: avg <= 12 ? 'gruen' : avg <= 15 ? 'gelb' : 'rot' };
  });
}

const MOCK: ApiData = {
  punkte: genPunkte(),
  trend_pct: -8,
  trend_richtung: 'besser',
  aktuell_min: 11.2,
  ziel_min: 12,
  prognose_min: 10.8,
};

interface Props { locationId: string | null; }

export function KitchenPhase4130EchtzeitKochzeitTrend({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-kochzeit-trend?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const pts = data.punkte;
  const allMin = pts.map(p => p.avg_min);
  const minVal = Math.min(...allMin, data.ziel_min) - 1;
  const maxVal = Math.max(...allMin, data.ziel_min) + 1;
  const range = maxVal - minVal;
  const W = 240;
  const H = 56;
  const toX = (i: number) => (i / (pts.length - 1)) * W;
  const toY = (v: number) => H - ((v - minVal) / range) * H;
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.avg_min).toFixed(1)}`).join(' ');
  const zielY = toY(data.ziel_min);

  const TrendIcon = data.trend_richtung === 'besser' ? TrendingDown : data.trend_richtung === 'schlechter' ? TrendingUp : Minus;
  const trendColor = data.trend_richtung === 'besser' ? 'text-emerald-600' : data.trend_richtung === 'schlechter' ? 'text-red-500' : 'text-gray-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-gray-900">Echtzeit-Kochzeit-Trend</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${trendColor}`}>
            <TrendIcon className="w-3 h-3" /> {Math.abs(data.trend_pct)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-blue-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Aktuell</div>
          <div className="text-sm font-bold text-blue-600">{data.aktuell_min} min</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Ziel</div>
          <div className="text-sm font-bold text-gray-700">{data.ziel_min} min</div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Prognose</div>
          <div className={`text-sm font-bold ${data.prognose_min <= data.ziel_min ? 'text-emerald-600' : 'text-orange-500'}`}>{data.prognose_min} min</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={W} height={H + 4} viewBox={`0 0 ${W} ${H + 4}`} className="w-full">
          <line x1={0} y1={zielY} x2={W} y2={zielY} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3,3" />
          <text x={W - 2} y={zielY - 2} fontSize="7" fill="#9ca3af" textAnchor="end">Ziel</text>
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => {
            const dotColor = p.ampel === 'gruen' ? '#10b981' : p.ampel === 'gelb' ? '#f59e0b' : '#ef4444';
            return <circle key={i} cx={toX(i)} cy={toY(p.avg_min)} r="2.5" fill={dotColor} />;
          })}
        </svg>
      </div>

      <div className="flex justify-between text-[9px] text-gray-400 border-t border-gray-100 pt-0.5">
        <span>60-Min-Fenster · 5-Min-Intervalle</span>
        <span>15-Sek-Polling · Prognose KI</span>
      </div>
    </div>
  );
}
