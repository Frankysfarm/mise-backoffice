'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Clock } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  schichten_gesamt: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_spaet: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  gesamt: number;
}

function coachingTipp(pct: number): { text: string; color: string } {
  if (pct >= 90) return {
    text: 'Ausgezeichnete Pünktlichkeit! Du startest deine Schichten fast immer pünktlich — ein Zeichen echter Professionalität.',
    color: 'text-green-300',
  };
  if (pct >= 75) return {
    text: 'Gute Pünktlichkeit. Noch etwas früher starten sichert dir einen besseren Rang und stärkt das Teamvertrauen.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Deine Pünktlichkeit liegt unter dem Teamschnitt. Pünktliches Starten verbessert deinen Score und sichert Boni.',
    color: 'text-red-400',
  };
}

export function FahrerPhase5303MeineSchichtPuenktlichkeit({
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
    const res = await fetch(`/api/delivery/admin/fahrer-schicht-puenktlichkeit-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Schicht-Pünktlichkeit — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.puenktlichkeit_pct);
  const teamAvg = data.team_avg_pct;
  const maxBar = Math.max(mein.puenktlichkeit_pct, teamAvg, 1) * 1.1;

  const borderColor =
    mein.ampel === 'gruen' ? 'border-green-700 bg-green-950/40' :
    mein.ampel === 'gelb'  ? 'border-yellow-700 bg-yellow-950/30' :
                             'border-red-700 bg-red-950/40';
  const headerBg =
    mein.ampel === 'gruen' ? 'border-green-800/40 bg-green-900/20' :
    mein.ampel === 'gelb'  ? 'border-yellow-800/40 bg-yellow-900/20' :
                             'border-red-800/40 bg-red-900/20';
  const valColor =
    mein.ampel === 'gruen' ? 'text-green-300' :
    mein.ampel === 'gelb'  ? 'text-yellow-400' : 'text-red-400';
  const barColor =
    mein.ampel === 'gruen' ? 'bg-green-500' :
    mein.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${headerBg}`}>
        <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Schicht-Pünktlichkeit</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className={`text-4xl font-black tabular-nums ${valColor}`}>
          {mein.puenktlichkeit_pct}<span className="text-xl font-semibold text-gray-400">%</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${valColor}`}>
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-1">{mein.schichten_gesamt} Schichten analysiert</div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${Math.min((mein.puenktlichkeit_pct / maxBar) * 100, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 text-gray-500">
          <span>{mein.puenktlichkeit_pct}%</span>
          <span>{teamAvg}%</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
