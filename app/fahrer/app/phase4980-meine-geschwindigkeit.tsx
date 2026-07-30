'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Zap } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_kmh: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_hoch: boolean;
  }>;
  team_avg_kmh: number;
  gesamt: number;
  ziel_kmh: number;
}

function coachingTipp(kmh: number): { text: string; color: string } {
  if (kmh >= 40) return {
    text: 'Außergewöhnliche Geschwindigkeit! Du führst das Ranking an — starke Effizienz und Streckentempo.',
    color: 'text-orange-300',
  };
  if (kmh >= 25) return {
    text: 'Gutes Tempo! Optimierte Routenwahl und zügige Stopps können dein Ranking weiter verbessern.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Potenzial: Effizientere Routen und kürzere Stopp-Zeiten steigern dein Geschwindigkeits-Ranking.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'rot') return 'text-orange-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-gray-400';
}

export function FahrerPhase4980MeineGeschwindigkeit({
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
    const res = await fetch(`/api/delivery/admin/fahrer-geschwindigkeit-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Geschwindigkeit — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.avg_kmh);
  const ref = data.team_avg_kmh * 1.5 || 1;
  const ichPct = Math.min(100, Math.round((mein.avg_kmh / ref) * 100));
  const avgPct = Math.min(100, Math.round((data.team_avg_kmh / ref) * 100));

  return (
    <div className="rounded-2xl border border-orange-700 bg-orange-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-orange-700/40 flex items-center gap-2 bg-orange-900/20">
        <Zap className="w-4 h-4 text-orange-300" />
        <span className="text-sm font-semibold text-orange-200">Meine Geschwindigkeit (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.avg_kmh}km/h
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Geschwindigkeit</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-orange-300' : 'text-gray-300'}`}>
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
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-orange-300 w-14 text-right">{mein.avg_kmh}km/h</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-14 text-right">{data.team_avg_kmh}km/h</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
