'use client';

import { useEffect, useState } from 'react';
import { BarChart2, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  auslastung_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, auslastung_pct: 74, rank_delta: 1, ampel: 'gruen', alert_bottom: false },
  ],
  team_avg_pct: 65,
  gesamt: 4,
};

function borderClass(ampel: string) {
  if (ampel === 'gruen') return 'border-blue-400';
  if (ampel === 'gelb')  return 'border-yellow-400';
  return 'border-red-500';
}

function coaching(pct: number) {
  if (pct >= 80) return { text: 'Ausgezeichnet! Sehr hohe Auslastung.', color: 'text-green-400' };
  if (pct >= 60) return { text: 'Gut. Versuche, deine Auslastung weiter zu steigern.', color: 'text-yellow-400' };
  return { text: 'Auslastung zu niedrig — mehr Touren übernehmen?', color: 'text-red-400' };
}

export function FahrerPhase5371MeineAuslastung({
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
      `/api/delivery/admin/fahrer-auslastungs-ranking?location_id=${locationId}&driver_id=${driverId}`
    );
    if (!res.ok) { setData(MOCK); return; }
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-2 text-gray-500">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm">Auslastung nicht verfügbar (offline)</span>
      </div>
    );
  }

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Auslastung…</div>;

  const me = data.fahrer[0];
  if (!me) return null;

  const c = coaching(me.auslastung_pct);
  const teamAvg = data.team_avg_pct;
  const maxVal = Math.max(me.auslastung_pct, teamAvg, 1);

  return (
    <div className={`bg-gray-900 rounded-xl p-4 space-y-3 border-l-4 ${borderClass(me.ampel)}`}>
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-blue-400" />
        <span className="text-white font-semibold">Meine Auslastung</span>
        <span className="ml-auto text-xs text-gray-400">Rang {me.rang}/{data.gesamt}</span>
      </div>

      <div className="text-center">
        <span className="text-4xl font-bold text-blue-400">{me.auslastung_pct}%</span>
        <div className="text-xs text-gray-400 mt-1">Schichtkapazität genutzt</div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-400 w-12">Ich</span>
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400"
              style={{ width: `${Math.min(100, (me.auslastung_pct / maxVal) * 100)}%` }}
            />
          </div>
          <span className="text-white w-8 text-right">{me.auslastung_pct}%</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-400 w-12">Team-Ø</span>
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-400"
              style={{ width: `${Math.min(100, (teamAvg / maxVal) * 100)}%` }}
            />
          </div>
          <span className="text-gray-300 w-8 text-right">{teamAvg}%</span>
        </div>
      </div>

      <p className={`text-xs ${c.color}`}>{c.text}</p>
    </div>
  );
}
