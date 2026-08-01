'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5471 — Retour-Quote-Board (Dispatch)
// RotateCcw orange-400; retour_quote_pct AUFSTEIGEND Rang 1=niedrigste Quote=bester;
// 3-KPI-Grid Beste/r/Team-Ø/Schlechteste/r; Balken farbkodiert; DeltaIcons; Hoch-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  retour_quote_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  beste_name: string;
  schlechteste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.',  rang: 1, retour_quote_pct:  1.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',   rang: 2, retour_quote_pct:  2.5, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',    rang: 3, retour_quote_pct:  5.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',    rang: 4, retour_quote_pct: 12.3, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 5.45,
  beste_name: 'Julia F.',
  schlechteste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(a: Ampel): string {
  if (a === 'rot')  return '#f97316';
  if (a === 'gelb') return '#fbbf24';
  return '#4ade80';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

export function DispatchPhase5471RetourQuoteBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-retour-quote-ranking?location_id=${locationId}`);
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

  const beste     = data.fahrer.find(f => f.rang === 1);
  const schlechteste = data.fahrer.find(f => f.rang === data.gesamt);
  const maxVal    = Math.max(...data.fahrer.map(f => f.retour_quote_pct), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-orange-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-white">Retour-Quote-Ranking</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Hoch
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Beste/r</div>
          <div className="text-xs font-bold text-green-400">{beste ? `${beste.retour_quote_pct.toFixed(1)}%` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.beste_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">{data.team_avg_pct.toFixed(1)}%</div>
          <div className="text-[10px] text-gray-500">Retourquote</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Schlechteste/r</div>
          <div className="text-xs font-bold text-orange-400">{schlechteste ? `${schlechteste.retour_quote_pct.toFixed(1)}%` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.schlechteste_name}</div>
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
                style={{ width: `${(f.retour_quote_pct / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-10 text-right">{f.retour_quote_pct.toFixed(1)}%</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="h-3 w-3 text-orange-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
