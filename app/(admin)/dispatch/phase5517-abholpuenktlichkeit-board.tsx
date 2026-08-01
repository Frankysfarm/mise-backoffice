'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5517 — Abholpünktlichkeit-Board (Dispatch)
// Timer violet-400; avg_minuten AUFSTEIGEND Rang 1=schnellste Abholung=bester;
// 3-KPI-Grid Schnellste/r/Team-Ø/Langsamste/r; Balken farbkodiert; DeltaIcons; Langsam-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_minuten: number;
  rank_delta: number;
  ampel: Ampel;
  alert_langsam: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_minuten: number;
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_minuten: 2.1, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_minuten: 3.8, rank_delta:  1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_minuten: 5.2, rank_delta: -1, ampel: 'gelb',  alert_langsam: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_minuten: 7.6, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg_minuten: 4.7,
  schnellste_name: 'Julia F.',
  langsamste_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

function barColor(a: Ampel): string {
  if (a === 'rot')  return '#f87171';
  if (a === 'gelb') return '#fbbf24';
  return '#34d399';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

export function DispatchPhase5517AbholpuenktlichkeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-abholpuenktlichkeit-ranking?location_id=${locationId}`);
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

  const schnellste  = data.fahrer.find(f => f.rang === 1);
  const langsamste  = data.fahrer.find(f => f.rang === data.gesamt);
  const maxVal      = Math.max(...data.fahrer.map(f => f.avg_minuten), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-white">Abholpünktlichkeit</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Langsam
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Schnellste/r</div>
          <div className="text-xs font-bold text-violet-400">{schnellste ? `${schnellste.avg_minuten} min` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.schnellste_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">{data.team_avg_minuten} min</div>
          <div className="text-[10px] text-gray-500">Ziel ≤ 4 min</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Langsamste/r</div>
          <div className="text-xs font-bold text-red-400">{langsamste ? `${langsamste.avg_minuten} min` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.langsamste_name}</div>
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
                style={{ width: `${(f.avg_minuten / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-12 text-right">{f.avg_minuten} m</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_langsam && <AlertTriangle className="h-3 w-3 text-red-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
