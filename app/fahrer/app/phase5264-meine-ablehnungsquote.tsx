'use client';

import { useEffect, useState } from 'react';
import { WifiOff, XOctagon } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  ablehnungsquote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_ablehnungsquote_pct: number;
  ziel_pct: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val <= 2) return {
    text: 'Sehr niedrige Ablehnungsquote! Du nimmst fast alle Aufträge an — das schätzen Dispatcher und verbessert dein Ranking.',
    color: 'text-green-300',
  };
  if (val <= 5) return {
    text: 'Akzeptable Ablehnungsquote. Unter 2% maximiert deinen Score und dein Einkommen.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Zu viele Ablehnungen. Nimm Aufträge konsequenter an, um Ranking und Verdienst zu steigern.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5264MeineAblehnungsquote({
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
    const res = await fetch(`/api/delivery/admin/fahrer-ablehnungsquote?${params}`);
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
        <span className="text-xs text-gray-500">Meine Ablehnungsquote — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.ablehnungsquote_pct);
  const teamAvg = data.team_avg_ablehnungsquote_pct;
  const maxVal = Math.max(teamAvg * 2, mein.ablehnungsquote_pct, 1);

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
        <XOctagon className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Ablehnungsquote</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className={`text-4xl font-black tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.ablehnungsquote_pct.toFixed(1)}<span className="text-xl font-semibold">%</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${ampelColor(mein.ampel)}`}>
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.fahrer.length}</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø · Ziel ≤{data.ziel_pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              mein.ampel === 'gruen' ? 'bg-green-500' :
              mein.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.round((mein.ablehnungsquote_pct / maxVal) * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 text-gray-500">
          <span>{mein.ablehnungsquote_pct.toFixed(1)}%</span>
          <span>{teamAvg.toFixed(1)}%</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
