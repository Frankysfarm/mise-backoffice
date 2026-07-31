'use client';

import { useEffect, useState } from 'react';
import { Zap, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  deliveries_pro_h: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pro_h: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, deliveries_pro_h: 4.8, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, deliveries_pro_h: 4.1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, deliveries_pro_h: 3.6, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, deliveries_pro_h: 2.2, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pro_h: 3.7,
  gesamt: 4,
};

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 4.5) return {
    text: 'Top-Produktivität! Du lieferst besonders viele Aufträge pro Stunde — exzellente Effizienz!',
    color: 'text-green-300',
  };
  if (val >= 3.0) return {
    text: 'Gute Leistung. Kürzere Wartezeiten beim Abholen können deine Stundenzahl weiter steigern.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Wenige Lieferungen/h. Kürzere Routen und schnellere Abholungen helfen dir, mehr zu schaffen.',
    color: 'text-orange-400',
  };
}

export function FahrerPhase5355MeineProduktivitaet({
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
      `/api/delivery/admin/fahrer-lieferungen-pro-stunde-ranking?location_id=${locationId}&driver_id=${driverId}`
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
        <span className="text-xs text-gray-500">Meine Produktivität — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.deliveries_pro_h);
  const maxVal = data.fahrer[0]?.deliveries_pro_h ?? 1;
  const barWidth     = Math.min(100, Math.round((mein.deliveries_pro_h / maxVal) * 100));
  const teamBarWidth = Math.min(100, Math.round((data.team_avg_pro_h / maxVal) * 100));

  const borderColor =
    mein.ampel === 'gruen' ? 'border-violet-700 bg-violet-950/30' :
    mein.ampel === 'gelb'  ? 'border-yellow-800 bg-yellow-950/20' :
                             'border-red-700 bg-red-950/30';
  const headerBg =
    mein.ampel === 'gruen' ? 'border-violet-800/40 bg-violet-900/20' :
    mein.ampel === 'gelb'  ? 'border-yellow-900/40 bg-yellow-900/10' :
                             'border-red-800/40 bg-red-900/20';

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${headerBg}`}>
        <Zap className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Produktivität (30 Tage)</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className="text-4xl font-black tabular-nums text-violet-300">
          {mein.deliveries_pro_h.toFixed(1)}<span className="text-xl font-bold">/h</span>
        </div>
        <div className="text-2xl font-bold mt-1 text-violet-300">
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">Lieferungen pro Stunde · 30 Tage</div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø {data.team_avg_pro_h.toFixed(1)}/h</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden mb-1">
          <div className="absolute left-0 top-0 h-full rounded-full bg-violet-400 transition-all" style={{ width: `${barWidth}%` }} />
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
