'use client';

import { useEffect, useState } from 'react';
import { Home, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  rueckkehr_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, rueckkehr_min: 6,  ampel: 'gruen' },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, rueckkehr_min: 9,  ampel: 'gruen' },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, rueckkehr_min: 14, ampel: 'gelb'  },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, rueckkehr_min: 22, ampel: 'rot'   },
  ],
  team_avg: 13,
  gesamt: 4,
};

function coachingTipp(min: number): { text: string; color: string } {
  if (min <= 10) return {
    text: 'Sehr schnelle Rückkehr! Du bist einer der effizientesten Fahrer im Team.',
    color: 'text-green-300',
  };
  if (min <= 15) return {
    text: 'Gute Rückkehrzeit. Noch ein paar Minuten schneller und du erreichst die Spitzengruppe.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Rückkehrzeit über 15 Minuten. Prüfe die Route zurück zur Basis für mehr Effizienz.',
    color: 'text-orange-400',
  };
}

export function FahrerPhase5327MeineRueckkehrzeit({
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
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-rueckkehrzeit-ranking?location_id=${locationId}`
    ).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
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
        <span className="text-xs text-gray-500">Meine Rückkehrzeit — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.rueckkehr_min);
  const maxMin = Math.max(...data.fahrer.map(f => f.rueckkehr_min), 1);
  const barWidth = Math.min(100, (mein.rueckkehr_min / maxMin) * 100);
  const teamBarWidth = Math.min(100, (data.team_avg / maxMin) * 100);

  const borderColor =
    mein.ampel === 'gruen' ? 'border-blue-700 bg-blue-950/30' :
    mein.ampel === 'gelb'  ? 'border-blue-800 bg-blue-950/20' :
                             'border-red-700 bg-red-950/30';
  const headerBg =
    mein.ampel === 'gruen' ? 'border-blue-800/40 bg-blue-900/20' :
    mein.ampel === 'gelb'  ? 'border-blue-900/40 bg-blue-900/10' :
                             'border-red-800/40 bg-red-900/20';

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${headerBg}`}>
        <Home className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Rückkehrzeit (30 Tage)</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className="text-4xl font-black tabular-nums text-blue-300">
          {mein.rueckkehr_min}
          <span className="text-xl font-semibold text-gray-400"> min</span>
        </div>
        <div className="text-2xl font-bold mt-1 text-blue-300">
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø {data.team_avg} min</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden mb-1">
          <div className="absolute left-0 top-0 h-full rounded-full bg-blue-400 transition-all" style={{ width: `${barWidth}%` }} />
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
