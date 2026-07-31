'use client';

import { useEffect, useState } from 'react';
import { WifiOff, UserMinus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abwesenheit_tage: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val <= 2) return {
    text: 'Sehr niedrige Abwesenheit! Du bist zuverlässig anwesend — das stärkt dein Ranking und den Teamzusammenhalt.',
    color: 'text-green-300',
  };
  if (val <= 5) return {
    text: 'Akzeptable Abwesenheit. Unter 2 Tage maximiert deinen Score und zeigt höchste Verlässlichkeit.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Hohe Abwesenheit. Regelmäßige Verfügbarkeit verbessert dein Ranking und sichert dein Einkommen.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'mock', fahrer_name: 'Ich', rang: 2, abwesenheit_tage: 1, rank_delta: 0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg: 4.0,
  gesamt: 8,
};

export function FahrerPhase5288MeineAbwesenheit({
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
    const res = await fetch(`/api/delivery/admin/fahrer-abwesenheit-ranking?${params}`).catch(() => null);
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
        <span className="text-xs text-gray-500">Meine Abwesenheit — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.abwesenheit_tage);
  const teamAvg = data.team_avg;
  const maxVal = Math.max(mein.abwesenheit_tage, teamAvg, 1);

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${
      mein.ampel === 'gruen' ? 'border-green-700 bg-green-950/40' :
      mein.ampel === 'gelb'  ? 'border-yellow-700 bg-yellow-950/30' :
                               'border-red-700 bg-red-950/40'
    }`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${
        mein.ampel === 'gruen' ? 'border-green-800/40 bg-green-900/20' :
        mein.ampel === 'gelb'  ? 'border-yellow-800/40 bg-yellow-900/20' :
                                 'border-red-800/40 bg-red-900/20'
      }`}>
        <UserMinus className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Abwesenheit (letzte 30 Tage)</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className={`text-4xl font-black tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.abwesenheit_tage}<span className="text-xl font-semibold"> Tage</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${ampelColor(mein.ampel)}`}>
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø</span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              mein.ampel === 'gruen' ? 'bg-green-500' :
              mein.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${(mein.abwesenheit_tage / maxVal) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 text-gray-500">
          <span>{mein.abwesenheit_tage} Tage</span>
          <span>{teamAvg.toFixed(1)} Tage</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
