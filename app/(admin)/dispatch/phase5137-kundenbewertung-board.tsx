'use client';

import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Mock-Daten: API /api/delivery/admin/fahrer-kundenbewertung-ranking noch nicht vorhanden

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  bewertungen_count: number;
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
    { fahrer_id: 'f1', fahrer_name: 'Marco R.',   rang: 1, avg_rating: 4.9, bewertungen_count: 47, rank_delta: 0,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Lena K.',    rang: 2, avg_rating: 4.7, bewertungen_count: 38, rank_delta: +1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Tobias M.',  rang: 3, avg_rating: 4.5, bewertungen_count: 52, rank_delta: -1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Sara B.',    rang: 4, avg_rating: 4.1, bewertungen_count: 29, rank_delta: 0,  ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f5', fahrer_name: 'Jonas W.',   rang: 5, avg_rating: 3.6, bewertungen_count: 33, rank_delta: -2, ampel: 'rot',   alert_niedrig: true  },
    { fahrer_id: 'f6', fahrer_name: 'Nina S.',    rang: 6, avg_rating: 3.2, bewertungen_count: 18, rank_delta: 0,  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_rating: 4.17,
  beste_name: 'Marco R.',
  niedrigste_name: 'Nina S.',
  alert_count: 2,
  gesamt: 6,
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

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase5137KundenbewertungBoard({ locationId }: { locationId: string | null }) {
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

  const maxRating = Math.max(...data.fahrer.map(f => f.avg_rating), 1);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-white text-sm">Kundenbewertung-Board</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />{data.alert_count} unter 4.0★
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800/60 rounded-lg p-2">
          <div className="text-sm font-bold text-green-400">{data.fahrer[0]?.avg_rating.toFixed(1)}★</div>
          <div className="text-[10px] text-slate-500">Höchste</div>
          <div className="text-[10px] text-slate-400 truncate">{data.beste_name}</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <div className="text-sm font-bold text-white">{data.team_avg_rating.toFixed(1)}★</div>
          <div className="text-[10px] text-slate-500">Team-Ø</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2">
          <div className="text-sm font-bold text-red-400">{data.fahrer[data.fahrer.length - 1]?.avg_rating.toFixed(1)}★</div>
          <div className="text-[10px] text-slate-500">Niedrigste</div>
          <div className="text-[10px] text-slate-400 truncate">{data.niedrigste_name}</div>
        </div>
      </div>

      {/* Driver Rows */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 w-4">{f.rang}.</span>
              <span className={ampelColor(f.ampel)} style={{ minWidth: 80 }}>{f.fahrer_name}</span>
              <DeltaIcon delta={f.rank_delta} />
              <span className="text-slate-500 text-[10px]">({f.bewertungen_count})</span>
              <span className="ml-auto tabular-nums font-semibold text-white">{f.avg_rating.toFixed(1)}★</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden ml-6">
              <div
                className={barColor(f.ampel) + ' h-full rounded-full transition-all'}
                style={{ width: `${(f.avg_rating / 5) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.alert_count > 0 && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
          ⚠ {data.alert_count} Fahrer unter 4.0★ — Coaching empfohlen
        </div>
      )}

      <div className="text-[10px] text-slate-600">30-Min-Polling · Mock-Fallback</div>
    </div>
  );
}
