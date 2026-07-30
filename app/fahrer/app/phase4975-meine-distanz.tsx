'use client';

import { useEffect, useState } from 'react';
import { WifiOff, MapPin } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    distanz_gesamt: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_hoch: boolean;
  }>;
  team_avg_distanz: number;
  gesamt: number;
}

function coachingTipp(km: number): { text: string; color: string } {
  if (km >= 1000) return {
    text: 'Außergewöhnliche Reichweite! Du führst das Distanz-Ranking an — maximale Abdeckung für das Team.',
    color: 'text-emerald-300',
  };
  if (km >= 500) return {
    text: 'Starke Kilometerleistung! Mehr Touren in entfernteren Zonen steigern dein Ranking weiter.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Potenzial: Weitere Strecken und mehr Touren verbessern dein Distanz-Ranking und deinen Bonus.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'rot') return 'text-emerald-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-gray-400';
}

export function FahrerPhase4975MeineDistanz({
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
    const res = await fetch(`/api/delivery/admin/fahrer-distanz-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Distanz — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.distanz_gesamt);
  const ichPct = data.team_avg_distanz > 0
    ? Math.min(100, Math.round((mein.distanz_gesamt / (data.team_avg_distanz * 1.5)) * 100))
    : 0;
  const avgPct = data.team_avg_distanz > 0
    ? Math.min(100, Math.round((data.team_avg_distanz / (data.team_avg_distanz * 1.5)) * 100))
    : 0;

  return (
    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-emerald-700/40 flex items-center gap-2 bg-emerald-900/20">
        <MapPin className="w-4 h-4 text-emerald-300" />
        <span className="text-sm font-semibold text-emerald-200">Meine Distanz (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.distanz_gesamt}km
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Gefahrene Kilometer gesamt</div>
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
          <span className="text-[10px] text-emerald-300 w-12 text-right">{mein.distanz_gesamt}km</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-12 text-right">{data.team_avg_distanz}km</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
