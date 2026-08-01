'use client';

import { useEffect, useRef, useState } from 'react';
import { Sigma, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5446 — Lieferzeit-Varianz-Board (Dispatch)
// Sigma purple-400; lieferzeit_varianz_min AUFSTEIGEND Rang 1=niedrigste=konstantester;
// 3-KPI-Grid Konstanteste/Team-Ø/Unbeständigste; Balken farbkodiert; DeltaIcons; Hoch-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  lieferzeit_varianz_min: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Sara K.',  rang: 1, lieferzeit_varianz_min: 1.8, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, lieferzeit_varianz_min: 3.2, rank_delta: -1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, lieferzeit_varianz_min: 5.7, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, lieferzeit_varianz_min: 9.4, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg: 5.0,
  bester_name: 'Sara K.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(a: Ampel): string {
  if (a === 'gruen') return '#a78bfa';
  if (a === 'gelb')  return '#fbbf24';
  return '#f87171';
}

function DeltaIcon({ d }: { d: number }) {
  // For AUFSTEIGEND: rank improves (lower number) = positive
  if (d > 0) return <TrendingUp className="h-3 w-3 text-purple-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

export function DispatchPhase5446LieferzeitVarianzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-varianz-ranking?location_id=${locationId}`);
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

  const maxVal      = Math.max(...data.fahrer.map(f => f.lieferzeit_varianz_min), 1);
  const konstanteste = data.fahrer.find(f => f.rang === 1);
  const unbestaendig = data.fahrer.find(f => f.rang === data.gesamt);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sigma className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-white">Lieferzeit-Varianz-Ranking</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Hoch
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Konstanteste/r</div>
          <div className="text-xs font-bold text-purple-400">{konstanteste ? `±${konstanteste.lieferzeit_varianz_min.toFixed(1)}min` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">±{data.team_avg.toFixed(1)}min</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Unbeständigste/r</div>
          <div className="text-xs font-bold text-red-400">{unbestaendig ? `±${unbestaendig.lieferzeit_varianz_min.toFixed(1)}min` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.schlechtester_name}</div>
        </div>
      </div>

      {/* Fahrerliste */}
      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-[10px] text-white truncate w-20">{f.fahrer_name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-800">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(f.lieferzeit_varianz_min / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-14 text-right">±{f.lieferzeit_varianz_min.toFixed(1)}min</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="h-3 w-3 text-red-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
