'use client';

import { useEffect, useRef, useState } from 'react';
import { Euro, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5531 — Umsatz-pro-Tour-Board (Dispatch)
// Euro green-400; avg_umsatz ABSTEIGEND Rang 1=höchster Umsatz=bester;
// 3-KPI-Grid Beste/r/Team-Ø/Niedrigste/r; Balken farbkodiert; DeltaIcons; Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_umsatz: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_umsatz: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_umsatz: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_umsatz: 42.5, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_umsatz: 38.2, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_umsatz: 31.7, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_umsatz: 22.3, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_umsatz: 33.7,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_umsatz: 35.0,
};

function barColor(a: Ampel): string {
  if (a === 'rot')  return '#f87171';
  if (a === 'gelb') return '#fbbf24';
  return '#4ade80';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp  className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

function fmtEur(v: number): string {
  return `${v.toFixed(2)} €`;
}

export function DispatchPhase5531UmsatzProTourBoard({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-tour-ranking?location_id=${locationId}`);
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
  const maxVal  = Math.max(...data.fahrer.map(f => f.avg_umsatz), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-green-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Euro className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs font-semibold text-white">Umsatz / Tour</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Niedrig
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Beste/r</div>
          <div className="text-xs font-bold text-green-400">{bester ? fmtEur(bester.avg_umsatz) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">{fmtEur(data.team_avg_umsatz)}</div>
          <div className="text-[10px] text-gray-500">Ziel {fmtEur(data.ziel_umsatz)}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Niedrigste/r</div>
          <div className="text-xs font-bold text-red-400">{letzter ? fmtEur(letzter.avg_umsatz) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.niedrigster_name}</div>
        </div>
      </div>
      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-[10px] text-white truncate w-20">{f.fahrer_name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-800">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(f.avg_umsatz / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-14 text-right">{fmtEur(f.avg_umsatz)}</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="h-3 w-3 text-yellow-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
