'use client';

import { useEffect, useState } from 'react';
import { XCircle, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  rate_pct: number;
  cancelled_orders: number;
  assigned_orders: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rate: number;
  beste_name: string;
  hoechste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, rate_pct: 4, cancelled_orders: 2, assigned_orders: 55, rank_delta: 1, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_rate: 8,
  beste_name: 'Julia F.',
  hoechste_name: 'Tim B.',
  alert_count: 0,
  gesamt: 4,
};

function borderClass(ampel: string) {
  if (ampel === 'gruen') return 'border-green-500';
  if (ampel === 'gelb')  return 'border-yellow-400';
  return 'border-red-500';
}

function coaching(rate: number) {
  if (rate <= 3) return { text: 'Ausgezeichnet! Sehr niedrige Stornoquote.', color: 'text-green-400' };
  if (rate <= 7) return { text: 'Gut. Versuche, Stornos weiter zu reduzieren.', color: 'text-yellow-400' };
  return { text: 'Stornoquote zu hoch — bitte Ursachen prüfen.', color: 'text-red-400' };
}

export function FahrerPhase5367MeineStornoquote({
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
      `/api/delivery/admin/fahrer-storno-rate-ranking?location_id=${locationId}&driver_id=${driverId}`
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
        <span className="text-sm">Stornoquote nicht verfügbar (offline)</span>
      </div>
    );
  }

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Stornoquote…</div>;

  const me = data.fahrer[0];
  if (!me) return null;

  const c = coaching(me.rate_pct);
  const teamAvg = data.team_avg_rate;
  const maxVal = Math.max(me.rate_pct, teamAvg, 1);

  return (
    <div className={`bg-gray-900 rounded-xl p-4 space-y-3 border-l-4 ${borderClass(me.ampel)}`}>
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Meine Stornoquote</span>
        <span className="ml-auto text-xs text-gray-400">Rang {me.rang}/{data.gesamt}</span>
      </div>

      <div className="text-center">
        <span className="text-4xl font-bold text-orange-400">{me.rate_pct}%</span>
        <div className="text-xs text-gray-400 mt-1">{me.cancelled_orders} von {me.assigned_orders} Touren storniert</div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-400 w-12">Ich</span>
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-400"
              style={{ width: `${Math.min(100, (me.rate_pct / maxVal) * 100)}%` }}
            />
          </div>
          <span className="text-white w-8 text-right">{me.rate_pct}%</span>
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
