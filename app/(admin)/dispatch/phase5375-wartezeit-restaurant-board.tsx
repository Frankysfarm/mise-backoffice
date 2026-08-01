'use client';

import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5375 — Wartezeit-Restaurant-Board
// Rang 1 = kürzeste Wartezeit = Bester; Clock orange-400;
// 3-KPI-Grid Bester/Team-Ø/Längste; Balken farbkodiert;
// DeltaIcons; Lang-Alert >10min; AUFSTEIGEND; 30-Min-Polling; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_wartezeit_min: number;
  tour_count: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_wartezeit: number;
  beste_name: string;
  laengste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Tim B.',   rang: 1, avg_wartezeit_min: 3,  tour_count: 42, rank_delta:  0, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_wartezeit_min: 5,  tour_count: 38, rank_delta:  1, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Julia F.', rang: 3, avg_wartezeit_min: 8,  tour_count: 61, rank_delta: -1, ampel: 'gelb',  alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Max M.',   rang: 4, avg_wartezeit_min: 13, tour_count: 55, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
  ],
  team_avg_wartezeit: 7,
  beste_name: 'Tim B.',
  laengste_name: 'Max M.',
  alert_count: 1,
  gesamt: 4,
};

function ampelColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

function barColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5375WartezeitRestaurantBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit-restaurant-ranking?location_id=${locationId}`);
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

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Wartezeit-Board…</div>;

  const maxMin = Math.max(...data.fahrer.map(f => f.avg_wartezeit_min), 1);

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Wartezeit Restaurant</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} Lang-Wartezeit
          </span>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-sm font-bold text-green-400 truncate">{data.beste_name.split(' ')[0]}</div>
          <div className="text-[9px] text-gray-500">Kürzeste</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-sm font-bold text-orange-400">{data.team_avg_wartezeit}min</div>
          <div className="text-[9px] text-gray-500">Team-Ø</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-sm font-bold text-red-400 truncate">{data.laengste_name.split(' ')[0]}</div>
          <div className="text-[9px] text-gray-500">Längste</div>
        </div>
      </div>

      {/* Ranking */}
      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 w-4 text-right">{f.rang}</span>
            <DeltaIcon delta={f.rank_delta} />
            <div className={`w-2 h-2 rounded-full shrink-0 ${ampelColor(f.ampel)}`} />
            <span className="text-[12px] text-white w-20 truncate">{f.fahrer_name}</span>
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(f.ampel)}`}
                style={{ width: `${(f.avg_wartezeit_min / maxMin) * 100}%` }}
              />
            </div>
            <span className={`text-[11px] font-mono w-10 text-right ${f.alert_lang ? 'text-red-400' : 'text-gray-300'}`}>
              {f.avg_wartezeit_min}min
            </span>
            {f.alert_lang && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
