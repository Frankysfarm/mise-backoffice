'use client';

import { useEffect, useRef, useState } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5556 — km-pro-Tag-Board (Dispatch)
// Gauge blue-400; avg_km_pro_tag ABSTEIGEND Rang 1=höchstes km/Tag=aktivster;
// 3-KPI-Grid Aktivste/r/Team-Ø/Wenigste/r; Balken farbkodiert; DeltaIcons; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_km_pro_tag: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km_pro_tag: number;
  aktivster_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Sara K.',  rang: 1, avg_km_pro_tag: 87.4, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_km_pro_tag: 74.2, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Julia F.', rang: 3, avg_km_pro_tag: 58.1, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_km_pro_tag: 31.5, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_km_pro_tag: 62.8,
  aktivster_name: 'Sara K.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColorByAmpel(a: Ampel): string {
  if (a === 'gruen') return '#60a5fa'; // blue-400
  if (a === 'gelb')  return '#fbbf24';
  return '#f87171';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

function fmtKm(v: number): string {
  return `${v.toFixed(1)} km`;
}

export function DispatchPhase5556KmProTagBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-km-pro-tag?location_id=${locationId}`);
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

  const aktivster = data.fahrer.find(f => f.rang === 1);
  const wenigster = data.fahrer.find(f => f.rang === data.gesamt);
  const maxVal    = Math.max(...data.fahrer.map(f => f.avg_km_pro_tag), 0.01);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-white">km pro Tag</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Niedrig
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Aktivste/r</div>
          <div className="text-xs font-bold text-blue-400">{aktivster ? aktivster.avg_km_pro_tag.toFixed(1) : '—'} km</div>
          <div className="text-[10px] text-gray-500 truncate">{data.aktivster_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">{data.team_avg_km_pro_tag.toFixed(1)} km</div>
          <div className="text-[10px] text-gray-500">30 Tage</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Wenigste/r</div>
          <div className="text-xs font-bold text-red-400">{wenigster ? wenigster.avg_km_pro_tag.toFixed(1) : '—'} km</div>
          <div className="text-[10px] text-gray-500 truncate">{data.wenigster_name}</div>
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
                style={{ width: `${(f.avg_km_pro_tag / maxVal) * 100}%`, backgroundColor: barColorByAmpel(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-14 text-right">{fmtKm(f.avg_km_pro_tag)}</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="h-3 w-3 text-red-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
