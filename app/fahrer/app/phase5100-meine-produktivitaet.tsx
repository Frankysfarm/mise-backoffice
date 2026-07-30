'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Zap } from 'lucide-react';

interface FahrerRang {
  rank: number;
  driver_id: string;
  fahrer_name: string;
  gesamtscore: number;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  trend: 'up' | 'down' | 'gleich';
}

interface ApiResponse {
  rangliste: FahrerRang[];
}

function coachingTipp(score: number): { text: string; color: string } {
  if (score >= 80) return {
    text: 'Top-Produktivität! Du bist einer der effizientesten Fahrer im Team. Weiter so!',
    color: 'text-emerald-300',
  };
  if (score >= 60) return {
    text: 'Gute Leistung. Noch mehr Stopps pro Stunde oder bessere Bewertungen steigern deinen Score.',
    color: 'text-amber-400',
  };
  return {
    text: 'Produktivität unter Ziel. Fokus auf pünktliche Lieferungen und kurze Routenzeiten.',
    color: 'text-red-400',
  };
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-300';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function FahrerPhase5100MeineProduktivitaet({
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
    const res = await fetch(`/api/delivery/admin/fahrer-produktivitaets-rangliste?${params}`);
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
        <span className="text-xs text-gray-500">Meine Produktivität — offline</span>
      </div>
    );
  }

  if (!data?.rangliste?.length) return null;

  const liste = data.rangliste;
  const mein = liste.find(f => f.driver_id === driverId) ?? liste[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.gesamtscore);
  const teamAvg = Math.round(liste.reduce((s, f) => s + f.gesamtscore, 0) / liste.length);
  const maxScore = 100;
  const ichPct = Math.min(100, mein.gesamtscore);
  const avgPct = Math.min(100, teamAvg);

  return (
    <div className="rounded-2xl border border-amber-700 bg-amber-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-amber-700/40 flex items-center gap-2 bg-amber-900/20">
        <Zap className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-semibold text-amber-200">Meine Produktivität — Heute</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${scoreColor(mein.gesamtscore)}`}>
            {mein.gesamtscore}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {mein.stopps_pro_h} Stopps/h · {mein.puenktlichkeit_pct}% pünktlich
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rank === 1 ? 'text-amber-300' : 'text-gray-300'}`}>
            #{mein.rank}
          </div>
          <div className="text-xs text-gray-500">von {liste.length}</div>
        </div>
      </div>

      {/* Mini Bar: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400"
              style={{ width: `${Math.round((ichPct / maxScore) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-amber-300 w-10 text-right">{mein.gesamtscore}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500"
              style={{ width: `${Math.round((avgPct / maxScore) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-10 text-right">{teamAvg}</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
