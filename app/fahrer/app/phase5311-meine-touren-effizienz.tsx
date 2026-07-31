'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Zap } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  effizienz_score: number;
  touren_pro_stunde: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  gesamt: number;
}

function coachingTipp(score: number): { text: string; color: string } {
  if (score >= 80) return {
    text: 'Top-Effizienz! Du packst mehr Touren in weniger Zeit — das ist der Unterschied zu den Besten.',
    color: 'text-green-300',
  };
  if (score >= 60) return {
    text: 'Gute Touren-Effizienz. Kurze Routen bündeln und Abholzeiten optimieren bringt dich noch weiter.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Deine Touren-Effizienz hat Potenzial. Achte auf kurze Routen und vermeide unnötige Wartezeiten.',
    color: 'text-orange-400',
  };
}

export function FahrerPhase5311MeineTourenEffizienz({
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
    const res = await fetch(`/api/delivery/admin/fahrer-touren-effizienz-ranking?${params}`).catch(() => null);
    if (res?.ok) setData(await res.json());
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
        <span className="text-xs text-gray-500">Meine Touren-Effizienz — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.effizienz_score);
  const barWidth = Math.min(100, mein.effizienz_score);
  const teamBarWidth = Math.min(100, data.team_avg_score);

  const borderColor =
    mein.ampel === 'gruen' ? 'border-yellow-700 bg-yellow-950/30' :
    mein.ampel === 'gelb'  ? 'border-yellow-800 bg-yellow-950/20' :
                             'border-red-700 bg-red-950/30';
  const headerBg =
    mein.ampel === 'gruen' ? 'border-yellow-800/40 bg-yellow-900/20' :
    mein.ampel === 'gelb'  ? 'border-yellow-900/40 bg-yellow-900/10' :
                             'border-red-800/40 bg-red-900/20';

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${headerBg}`}>
        <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Touren-Effizienz</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className="text-4xl font-black tabular-nums text-yellow-300">
          {mein.effizienz_score}
          <span className="text-xl font-semibold text-gray-400"> / 100</span>
        </div>
        <div className="text-2xl font-bold mt-1 text-yellow-300">
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-1">{mein.touren_pro_stunde} Touren/h</div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø {data.team_avg_score}</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden mb-1">
          <div className="absolute left-0 top-0 h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${barWidth}%` }} />
        </div>
        <div className="relative h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div className="absolute left-0 top-0 h-full rounded-full bg-gray-500 transition-all" style={{ width: `${teamBarWidth}%` }} />
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
