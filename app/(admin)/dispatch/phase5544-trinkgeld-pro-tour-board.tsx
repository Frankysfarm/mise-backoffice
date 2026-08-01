'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5544 — Trinkgeld-pro-Tour-Board (Dispatch)
// Coins yellow-400; avg_trinkgeld ABSTEIGEND Rang 1=höchstes Trinkgeld=bester;
// 3-KPI-Grid Beste/r/Team-Ø/Niedrigste/r; Balken farbkodiert; DeltaIcons; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

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

function barColor(a: Ampel): string {
  if (a === 'rot')  return '#f87171';
  if (a === 'gelb') return '#fbbf24';
  return '#facc15';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

function fmtTip(v: number): string {
  return `${v.toFixed(2)} €`;
}

export function DispatchPhase5544TrinkgeldProTourBoard({ locationId }: { locationId: string | null }) {
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

  const bester  = data.fahrer.find(f => f.rang === 1);
  const letzter = data.fahrer.find(f => f.rang === data.gesamt);
  const maxVal  = Math.max(...data.fahrer.map(f => f.avg_trinkgeld), 0.01);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-yellow-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-yellow-400" />
          <span className="text-xs font-semibold text-white">Trinkgeld pro Tour</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Niedrig
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Beste/r</div>
          <div className="text-xs font-bold text-yellow-400">{bester ? fmtTip(bester.avg_trinkgeld) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.beste_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">{fmtTip(data.team_avg_trinkgeld)}</div>
          <div className="text-[10px] text-gray-500">30 Tage</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Niedrigste/r</div>
          <div className="text-xs font-bold text-red-400">{letzter ? fmtTip(letzter.avg_trinkgeld) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.niedrigste_name}</div>
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
                style={{ width: `${(f.avg_trinkgeld / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-12 text-right">{fmtTip(f.avg_trinkgeld)}</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="h-3 w-3 text-yellow-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
