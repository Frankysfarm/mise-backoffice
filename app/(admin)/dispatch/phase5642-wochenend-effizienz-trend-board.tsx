'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5642 — Wochenend-Effizienz-Trend-Board (Dispatch) — Batch 105
// Zap purple-400; effizienz_delta ABSTEIGEND Rang 1=größte Verbesserung=bester;
// 3-KPI-Grid Beste/r/Team-Trend/Schwächste/r; Balken farbkodiert; DeltaIcons; Rückfall-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  effizienz_delta: number;
  aktuell_touren_pro_std: number;
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, effizienz_delta:  0.7, aktuell_touren_pro_std: 3.5, rank_delta:  1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, effizienz_delta:  0.4, aktuell_touren_pro_std: 3.1, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, effizienz_delta: -0.1, aktuell_touren_pro_std: 2.5, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, effizienz_delta: -0.5, aktuell_touren_pro_std: 2.1, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.125,
  bester_name: 'Max M.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(delta: number): string {
  if (delta > 0)   return '#c084fc'; // purple-400
  if (delta === 0) return '#fbbf24'; // yellow
  return '#f87171'; // red
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp  className="h-3 w-3 text-purple-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400"   />;
  return        <Minus        className="h-3 w-3 text-gray-500"   />;
}

function fmtDelta(v: number): string {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}`;
}

export function DispatchPhase5642WochenendEffizienzTrendBoard({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-wochenend-effizienz-trend-ranking?location_id=${locationId}`);
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

  const best   = data.fahrer.find(f => f.rang === 1);
  const worst  = data.fahrer.find(f => f.rang === data.gesamt);
  const maxAbs = Math.max(...data.fahrer.map(f => Math.abs(f.effizienz_delta)), 0.1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-purple-700/40'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-white">Wochenend-Effizienz</span>
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
        <div className="bg-gray-800 rounded p-1.5">
          <div className="text-[10px] text-gray-400 truncate">Beste/r</div>
          <div className="text-xs font-semibold text-purple-400 truncate">{data.bester_name}</div>
          <div className="text-[10px] font-mono text-purple-300">
            {best ? fmtDelta(best.effizienz_delta) : '—'} T/h
          </div>
        </div>
        <div className="bg-gray-800 rounded p-1.5">
          <div className="text-[10px] text-gray-400">Team-Trend</div>
          <div className={`text-xs font-mono font-semibold ${data.team_avg_delta > 0 ? 'text-purple-400' : data.team_avg_delta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {fmtDelta(data.team_avg_delta)} T/h
          </div>
          <div className="text-[10px] text-gray-500">Ø Δ 30 Tage</div>
        </div>
        <div className="bg-gray-800 rounded p-1.5">
          <div className="text-[10px] text-gray-400 truncate">Schwächste/r</div>
          <div className="text-xs font-semibold text-gray-300 truncate">{data.schwaechster_name}</div>
          <div className="text-[10px] font-mono text-gray-400">
            {worst ? fmtDelta(worst.effizienz_delta) : '—'} T/h
          </div>
        </div>
      </div>

      {/* Rangliste */}
      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className={`flex items-center gap-2 rounded px-2 py-1 ${f.alert_rueckfall ? 'bg-red-900/20' : 'bg-gray-800/50'}`}>
            <span className="text-[10px] text-gray-500 w-4 shrink-0">#{f.rang}</span>
            <span className="text-xs text-white truncate flex-1">{f.fahrer_name}</span>
            <DeltaIcon d={f.effizienz_delta} />
            <span className={`text-[10px] font-mono w-14 text-right ${f.effizienz_delta > 0 ? 'text-purple-400' : f.effizienz_delta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {fmtDelta(f.effizienz_delta)} T/h
            </span>
            {/* bar */}
            <div className="w-16 h-1.5 bg-gray-700 rounded overflow-hidden shrink-0">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.min(100, (Math.abs(f.effizienz_delta) / maxAbs) * 100)}%`,
                  backgroundColor: barColor(f.effizienz_delta),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-gray-600 text-right">Sa/So · 30-Tage-Trend · Touren/Std</div>
    </div>
  );
}
