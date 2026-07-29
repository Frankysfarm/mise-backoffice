'use client';

import { useEffect, useState } from 'react';
import { WifiOff, CloudLightning } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    wetter_anteil_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_pct: number;
  gesamt: number;
}

function coachingTipp(pct: number): { text: string; color: string } {
  if (pct >= 50) return {
    text: 'Hoher Schlechtwetter-Anteil! Achte auf sichere Fahrweise bei Nässe und schlechter Sicht — Sicherheit vor Tempo.',
    color: 'text-red-400',
  };
  if (pct >= 25) return {
    text: 'Moderate Schlechtwetter-Touren. Plane etwas mehr Zeit ein und fahre vorsichtig.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Wenige Schlechtwetter-Touren — gute Schichtverteilung. Weiter so!',
    color: 'text-green-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4882MeinWetterAnteil({
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
    const res = await fetch(`/api/delivery/admin/fahrer-wetter-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-amber-700 bg-amber-900/60 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — Schlechtwetter-Anteil nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.wetter_anteil_pct);
  const maxPct = Math.max(me.wetter_anteil_pct, data.team_avg_pct, 1);

  return (
    <div className="rounded-xl border border-amber-700 bg-amber-900/60 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <CloudLightning className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-semibold text-amber-100">Mein Schlechtwetter-Anteil</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.wetter_anteil_pct.toFixed(1)}%</div>
        <div className="text-xs text-gray-400 mt-1">Touren 07–09 Uhr & 13–17 Uhr UTC (letzte 30 Tage)</div>
        <div className={`text-xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich</span>
            <span className={ampelColor(me.ampel)}>{me.wetter_anteil_pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(me.wetter_anteil_pct / maxPct) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø</span>
            <span className="text-gray-300">{data.team_avg_pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(data.team_avg_pct / maxPct) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`text-xs rounded p-2 bg-black/20 ${tippColor}`}>{tipp}</div>
    </div>
  );
}
