'use client';

import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5379 — Kundenzufriedenheits-Board
// Star amber-400; 3-KPI-Grid Bester/Team-Ø/Niedrigster; Balken farbkodiert;
// DeltaIcons; Niedrig-Alert <4.0; ABSTEIGEND; 30-Min-Polling; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sterne: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_sterne: 4.8, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_sterne: 4.5, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_sterne: 3.9, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sterne: 3.2, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 4.1,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

function dotColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5379KundenzufriedenheitsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kundenzufriedenheit-ranking?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Kundenzufriedenheits-Board…</div>;

  const maxSterne = 5;

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-400" />
        <span className="text-white font-semibold">Kundenzufriedenheit</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} Niedrig-Bewertung
          </span>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-sm font-bold text-green-400 truncate">{data.bester_name.split(' ')[0]}</div>
          <div className="text-[9px] text-gray-500">Bester</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-sm font-bold text-amber-400">{data.team_avg.toFixed(1)}★</div>
          <div className="text-[9px] text-gray-500">Team-Ø</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-sm font-bold text-red-400 truncate">{data.schlechtester_name.split(' ')[0]}</div>
          <div className="text-[9px] text-gray-500">Niedrigster</div>
        </div>
      </div>

      {/* Ranking */}
      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 w-4 text-right">{f.rang}</span>
            <DeltaIcon delta={f.rank_delta} />
            <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor(f.ampel)}`} />
            <span className="text-[12px] text-white w-20 truncate">{f.fahrer_name}</span>
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(f.ampel)}`}
                style={{ width: `${(f.avg_sterne / maxSterne) * 100}%` }}
              />
            </div>
            <span className={`text-[11px] font-mono w-10 text-right ${f.alert_niedrig ? 'text-red-400' : 'text-gray-300'}`}>
              {f.avg_sterne.toFixed(1)}★
            </span>
            {f.alert_niedrig && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
