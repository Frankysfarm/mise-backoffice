'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5606 — Bewertungs-Trend-Board (Dispatch)
// Star yellow-400; bewertung_delta ABSTEIGEND Rang 1=größte positive Verbesserung=bester;
// 3-KPI-Grid Beste/r/Team-Trend/Schwächste/r; Balken farbkodiert; DeltaIcons; Rückfall-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  bewertung_delta: number;
  aktuell_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, bewertung_delta:  0.4, aktuell_avg: 4.8, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, bewertung_delta:  0.2, aktuell_avg: 4.5, rank_delta: -1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, bewertung_delta: -0.1, aktuell_avg: 4.1, rank_delta:  0, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, bewertung_delta: -0.5, aktuell_avg: 3.4, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.0,
  bester_name: 'Max M.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(delta: number): string {
  if (delta > 0)    return '#4ade80';
  if (delta === 0)  return '#fbbf24';
  return '#f87171';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

function fmtDelta(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

export function DispatchPhase5606BewertungsTrendBoard({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-bewertungs-trend-ranking?location_id=${locationId}`);
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

  const bester   = data.fahrer.find(f => f.rang === 1);
  const schwaech = data.fahrer.find(f => f.rang === data.gesamt);
  const maxAbs   = Math.max(...data.fahrer.map(f => Math.abs(f.bewertung_delta)), 0.1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-400" />
          <span className="text-xs font-semibold text-white">Bewertungs-Trend</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Rückfall
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Beste/r</div>
          <div className="text-xs font-bold text-green-400">{bester ? fmtDelta(bester.bewertung_delta) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Trend</div>
          <div className="text-xs font-bold text-white">{fmtDelta(data.team_avg_delta)}</div>
          <div className="text-[10px] text-gray-500">Ø 30 Tage</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Schwächste/r</div>
          <div className="text-xs font-bold text-red-400">{schwaech ? fmtDelta(schwaech.bewertung_delta) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.schwaechster_name}</div>
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
                style={{ width: `${(Math.abs(f.bewertung_delta) / maxAbs) * 100}%`, backgroundColor: barColor(f.bewertung_delta) }}
              />
            </div>
            <span className="text-[10px] font-mono text-yellow-300 w-10 text-right">{f.aktuell_avg.toFixed(1)}★</span>
            <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{fmtDelta(f.bewertung_delta)}</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_rueckfall && <AlertTriangle className="h-3 w-3 text-red-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
