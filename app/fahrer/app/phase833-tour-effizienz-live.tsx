'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Zap, Clock, MapPin, Euro, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  locationId?: string | null;
}

interface EffizienzData {
  stoppsProStunde: number;
  kmProStopp: number;
  trinkgeldRate: number;
  gesamtScore: number;
  trend: 'up' | 'down' | 'stable';
  vergleichVortag: number;
  aktiveTouren: number;
  fertigeStopps: number;
}

const MOCK: EffizienzData = {
  stoppsProStunde: 2.8,
  kmProStopp: 3.2,
  trinkgeldRate: 0.78,
  gesamtScore: 82,
  trend: 'up',
  vergleichVortag: 5,
  aktiveTouren: 1,
  fertigeStopps: 7,
};

function scoreLabel(score: number) {
  if (score >= 80) return { text: 'Sehr gut', cls: 'text-matcha-600 bg-matcha-50 border-matcha-200' };
  if (score >= 60) return { text: 'Gut', cls: 'text-amber-600 bg-amber-50 border-amber-200' };
  return { text: 'Ausbaufähig', cls: 'text-red-600 bg-red-50 border-red-200' };
}

export function FahrerPhase833TourEffizienzLive({ driverId, locationId }: Props) {
  const [data, setData] = useState<EffizienzData | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/driver?driver_id=${driverId}&action=effizienz_live`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.effizienz) { setData(json.effizienz); return; }
    } catch { /* noop */ }
    setData(MOCK);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const label = scoreLabel(data.gesamtScore);
  const trendIcon = data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→';
  const trendCls = data.trend === 'up' ? 'text-matcha-600' : data.trend === 'down' ? 'text-red-500' : 'text-stone-500';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-stone-50 hover:bg-stone-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <TrendingUp className="h-4 w-4 text-stone-600" />
        <span className="text-sm font-bold text-stone-800">Tour-Effizienz Live</span>
        <span className={cn('ml-auto text-[10px] font-bold border rounded-full px-2 py-0.5', label.cls)}>
          {label.text} · {data.gesamtScore}/100
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {expanded && (
        <>
          {/* Score Balken */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-stone-500">Gesamt-Score</span>
              <span className={cn('text-[10px] font-bold', trendCls)}>
                {trendIcon} {data.vergleichVortag > 0 ? '+' : ''}{data.vergleichVortag}% vs. gestern
              </span>
            </div>
            <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  data.gesamtScore >= 80 ? 'bg-matcha-500' : data.gesamtScore >= 60 ? 'bg-amber-400' : 'bg-red-500'
                )}
                style={{ width: `${data.gesamtScore}%` }}
              />
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-3 divide-x divide-stone-100 border-y border-stone-100">
            <div className="px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="h-3 w-3 text-stone-400" />
                <span className="text-[9px] text-stone-400">Stopps/h</span>
              </div>
              <div className="text-lg font-black tabular-nums text-stone-800">{data.stoppsProStunde.toFixed(1)}</div>
              <div className="text-[8px] text-stone-400">Ø heute</div>
            </div>
            <div className="px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MapPin className="h-3 w-3 text-stone-400" />
                <span className="text-[9px] text-stone-400">km/Stopp</span>
              </div>
              <div className="text-lg font-black tabular-nums text-stone-800">{data.kmProStopp.toFixed(1)}</div>
              <div className="text-[8px] text-stone-400">Ø heute</div>
            </div>
            <div className="px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Euro className="h-3 w-3 text-stone-400" />
                <span className="text-[9px] text-stone-400">Trinkgeld</span>
              </div>
              <div className="text-lg font-black tabular-nums text-stone-800">{(data.trinkgeldRate * 100).toFixed(0)}%</div>
              <div className="text-[8px] text-stone-400">Bestellungen</div>
            </div>
          </div>

          {/* Zusatzinfo */}
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-stone-400" />
              <span className="text-[10px] text-stone-500">{data.fertigeStopps} Stopps heute</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-stone-400" />
              <span className="text-[10px] text-stone-500">{data.aktiveTouren} aktive Tour</span>
            </div>
          </div>
        </>
      )}

      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50">
        <span className="text-[9px] text-stone-400">Live-Effizienz · alle 60s aktualisiert</span>
      </div>
    </div>
  );
}
