'use client';

import { useEffect, useState } from 'react';
import { WifiOff, TrendingUp } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  roi_score: number;
  roi: number;
  einnahmen: number;
  gesamtkosten: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  team_avg_roi: number;
  gesamt: number;
}

function coachingTipp(score: number): { text: string; color: string } {
  if (score >= 75) return {
    text: 'Exzellenter ROI! Du lieferst mehr Einnahmen als du Kosten verursachst. Weiter so!',
    color: 'text-emerald-300',
  };
  if (score >= 50) return {
    text: 'Solider ROI. Mehr Stopps pro Stunde oder kürzere Routen verbessern deinen Score.',
    color: 'text-yellow-400',
  };
  return {
    text: 'ROI unter Ziel. Achte auf kurze Routen und effiziente Zeiteinteilung.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-emerald-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5097MeinRoiScore({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-roi-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 flex items-center gap-2 mb-3">
        <WifiOff className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Mein ROI-Score — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.roi_score);
  const ichPct = Math.min(100, mein.roi_score);
  const avgPct = Math.min(100, data.team_avg_score);

  return (
    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-emerald-700/40 flex items-center gap-2 bg-emerald-900/20">
        <TrendingUp className="w-4 h-4 text-emerald-300" />
        <span className="text-sm font-semibold text-emerald-200">Mein ROI-Score — Heute</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.roi_score}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">ROI {mein.roi}× · {mein.einnahmen}€ / {mein.gesamtkosten}€</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-emerald-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini Bar: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-emerald-300 w-10 text-right">{mein.roi_score}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-10 text-right">{data.team_avg_score}</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
