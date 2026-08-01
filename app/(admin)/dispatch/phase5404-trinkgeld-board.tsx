'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';

// Phase 5404 — Trinkgeld-Board (Dispatch)
// Coins orange-400; avg_trinkgeld_eur ABSTEIGEND Rang 1=höchstes Trinkgeld=bester;
// 3-KPI-Grid Beste/r/Team-Ø/Niedrigste/r; Balken farbkodiert grün/gelb/rot;
// DeltaIcons TrendingUp/Down/Minus; Niedrig-Alert <0.80€; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_trinkgeld: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_trinkgeld: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_trinkgeld: 2.80, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_trinkgeld: 2.10, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_trinkgeld: 1.50, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_trinkgeld: 0.40, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_trinkgeld: 1.70,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelColor(a: Ampel) {
  if (a === 'gruen') return '#34d399';
  if (a === 'gelb')  return '#fbbf24';
  return '#f87171';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

export function DispatchPhase5404TrinkgeldBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-trinkgeld-pro-tour-ranking?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const maxTip = Math.max(...data.fahrer.map(f => f.avg_trinkgeld), 0.01);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-semibold text-white">Trinkgeld-Ranking</span>
          {loading && <span className="text-xs text-gray-500">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Niedrig-Alert
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-400">Bester</div>
          <div className="text-xs font-bold text-emerald-400 truncate">{data.beste_name}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">€{data.team_avg_trinkgeld.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-400">Niedrigster</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.niedrigste_name}</div>
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-5 shrink-0">#{f.rang}</span>
            <DeltaIcon d={f.rank_delta} />
            <span className="text-xs text-gray-200 flex-1 truncate">{f.fahrer_name}</span>
            <span className="text-xs font-mono text-gray-300 w-12 text-right">€{f.avg_trinkgeld.toFixed(2)}</span>
            <div className="w-20 bg-gray-800 rounded-full h-1.5 shrink-0">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${(f.avg_trinkgeld / maxTip) * 100}%`, backgroundColor: ampelColor(f.ampel) }}
              />
            </div>
            {f.alert_niedrig && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="text-[10px] text-gray-600 text-right">Ø Trinkgeld/Tour · 30-Min-Update · {data.gesamt} Fahrer</div>
    </div>
  );
}
