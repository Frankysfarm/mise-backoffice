'use client';

import { useEffect, useState } from 'react';
import { WifiOff, MapPin } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_je_schicht: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 30) return {
    text: 'Starke Distanz je Schicht! Du legst sehr viele Kilometer zurück und bist hochaktiv.',
    color: 'text-green-300',
  };
  if (val >= 15) return {
    text: 'Gute Distanz je Schicht. Steigere deine Touren-Anzahl, um noch mehr Kilometer zu erreichen.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Niedrige Distanz je Schicht. Nimm mehr Touren an oder prüfe, ob dein Einsatzgebiet erweitert werden kann.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-amber-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5119MeineDistanzJeSchicht({
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
    const res = await fetch(`/api/delivery/admin/fahrer-distanz-schicht-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Distanz je Schicht — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp   = coachingTipp(mein.km_je_schicht);
  const maxKm  = Math.max(mein.km_je_schicht, data.team_avg_km, 1);
  const ichPct = Math.min(100, Math.round((mein.km_je_schicht / maxKm) * 100));
  const avgPct = Math.min(100, Math.round((data.team_avg_km / maxKm) * 100));

  return (
    <div className="rounded-2xl border border-amber-700 bg-amber-950/40 overflow-hidden mb-3">
      <div className="px-4 py-3 border-b border-amber-700/40 flex items-center gap-2 bg-amber-900/20">
        <MapPin className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-semibold text-amber-200">Meine Distanz je Schicht (letzte 30 Tage)</span>
      </div>

      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.km_je_schicht} km
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Distanz je Schicht</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-amber-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-amber-300 w-14 text-right">{mein.km_je_schicht} km</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-14 text-right">{data.team_avg_km} km</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
