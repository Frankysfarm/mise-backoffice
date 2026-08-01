'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5536 — Schichtstart-Pünktlichkeit-Board (Dispatch)
// Clock3 sky-400; avg_verzoegerung_min AUFSTEIGEND Rang 1=kürzeste Verzögerung=bester;
// 3-KPI-Grid Pünktlichste/r/Team-Ø/Verspätetste/r; Balken farbkodiert; DeltaIcons; Hoch-Alert >3min; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_verzoegerung_min: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  puenktlichster_name: string;
  verspaetetster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Nico W.',  rang: 1, avg_verzoegerung_min: 0.5, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_verzoegerung_min: 1.2, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_verzoegerung_min: 2.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_verzoegerung_min: 4.1, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg: 2.15,
  puenktlichster_name: 'Nico W.',
  verspaetetster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(a: Ampel): string {
  if (a === 'rot')  return '#f87171';
  if (a === 'gelb') return '#fbbf24';
  return '#38bdf8';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

export function DispatchPhase5536SchichtstartPuenktlichkeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schichtstart-puenktlichkeit-ranking?location_id=${locationId}`);
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
  const maxVal  = Math.max(...data.fahrer.map(f => f.avg_verzoegerung_min), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-sky-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-xs font-semibold text-white">Schichtstart-Pünktlichkeit</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Hoch
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Pünktlichste/r</div>
          <div className="text-xs font-bold text-sky-400">{bester ? `+${bester.avg_verzoegerung_min}min` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.puenktlichster_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">+{data.team_avg}min</div>
          <div className="text-[10px] text-gray-500">Verzögerung</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Verspätetste/r</div>
          <div className="text-xs font-bold text-red-400">{letzter ? `+${letzter.avg_verzoegerung_min}min` : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.verspaetetster_name}</div>
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
                style={{ width: `${(f.avg_verzoegerung_min / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-10 text-right">+{f.avg_verzoegerung_min}m</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="h-3 w-3 text-yellow-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
