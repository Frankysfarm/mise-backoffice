'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5529 — Pauseneffizienz-Board (Dispatch)
// Coffee cyan-400; pausenquote_pct AUFSTEIGEND Rang 1=niedrigste Pausenquote=effizientester;
// 3-KPI-Grid Effizienteste/r/Team-Ø/Meiste-Pausen; Balken farbkodiert; DeltaIcons; Hoch-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  pausenquote_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  effizienteste_name: string;
  meiste_pausen_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, pausenquote_pct: 3.2,  rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, pausenquote_pct: 6.8,  rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, pausenquote_pct: 11.4, rank_delta: -1, ampel: 'gelb',  alert_hoch: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, pausenquote_pct: 18.7, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 10.0,
  effizienteste_name: 'Julia F.',
  meiste_pausen_name: 'Tim B.',
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

export function DispatchPhase5529PauseneffizienzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-pauseneffizienz-ranking?location_id=${locationId}`);
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

  const effizienteste = data.fahrer.find(f => f.rang === 1);
  const meiste        = data.fahrer.find(f => f.rang === data.gesamt);
  const maxVal        = Math.max(...data.fahrer.map(f => f.pausenquote_pct), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Coffee className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-white">Pauseneffizienz</span>
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
          <div className="text-[10px] text-gray-400">Effizienteste/r</div>
          <div className="text-xs font-bold text-cyan-400">{effizienteste ? `${effizienteste.pausenquote_pct}%` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.effizienteste_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">{data.team_avg_pct}%</div>
          <div className="text-[10px] text-gray-500">Ziel ≤ 10%</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Meiste Pausen</div>
          <div className="text-xs font-bold text-red-400">{meiste ? `${meiste.pausenquote_pct}%` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.meiste_pausen_name}</div>
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
                style={{ width: `${(f.pausenquote_pct / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-10 text-right">{f.pausenquote_pct}%</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="h-3 w-3 text-red-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
