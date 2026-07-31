'use client';

import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Mock-Daten: API /api/delivery/admin/fahrer-kundenbewertung-ranking noch nicht vorhanden

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rating: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Marco R.',   rang: 1, avg_rating: 4.9, rank_delta: 0,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Lena K.',    rang: 2, avg_rating: 4.7, rank_delta: +1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Tobias M.',  rang: 3, avg_rating: 4.5, rank_delta: -1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Sara B.',    rang: 4, avg_rating: 3.8, rank_delta: 0,  ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f5', fahrer_name: 'Jonas W.',   rang: 5, avg_rating: 3.2, rank_delta: -2, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_rating: 4.22,
  beste_name: 'Marco R.',
  niedrigste_name: 'Jonas W.',
  alert_count: 1,
  gesamt: 5,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function KitchenPhase5137KundenbewertungTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-kundenbewertung-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-kundenbewertung-ranking';
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setData(MOCK_DATA);
    } catch { setData(MOCK_DATA); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const champion = data.fahrer[0];

  return (
    <div className="rounded-lg border border-amber-600/20 bg-slate-900/80 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Star className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold text-white">Kundenbewertung</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />{data.alert_count}
          </span>
        )}
      </div>
      {champion && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">🥇</span>
          <span className="text-sm font-bold text-amber-300">{champion.fahrer_name}</span>
          <span className="text-lg font-bold text-white tabular-nums">{champion.avg_rating.toFixed(1)}★</span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Team-Ø <span className="text-white font-semibold">{data.team_avg_rating.toFixed(1)}★</span></span>
        <span>{data.gesamt} Fahrer</span>
      </div>
      {data.fahrer.slice(0, 3).map(f => (
        <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 w-4">{f.rang}.</span>
          <span className={ampelColor(f.ampel)}>{f.fahrer_name}</span>
          <DeltaIcon delta={f.rank_delta} />
          <span className="ml-auto tabular-nums font-medium text-white">{f.avg_rating.toFixed(1)}★</span>
        </div>
      ))}
      {data.alert_count > 0 && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
          ⚠ {data.alert_count} Fahrer unter 4.0★
        </div>
      )}
      <div className="text-[10px] text-slate-600">30-Min-Polling · Mock-Fallback</div>
    </div>
  );
}
