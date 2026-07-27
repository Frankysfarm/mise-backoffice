'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, WifiOff } from 'lucide-react';

interface VerbesserungData {
  fahrer: {
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    delta_min: number;
    aktuell_min: number;
    vormonat_min: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }[];
  team_avg_delta: number;
  gesamt: number;
  ziel_delta_min: number;
}

function fmt(v: number) {
  if (v < 0) return `${v} min`;
  if (v > 0) return `+${v} min`;
  return '±0 min';
}

export function FahrerPhase3990MeineReaktionszeitVerbesserung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<VerbesserungData | null>(null);

  async function load() {
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-verbesserung?${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center gap-3 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Reaktionszeit-Verbesserung nicht verfügbar (offline)</span>
      </div>
    );
  }

  if (!data) return null;

  const mich = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mich) return null;

  const deltaColor = mich.delta_min < 0 ? 'text-green-600' : mich.delta_min > 0 ? 'text-red-600' : 'text-gray-500';
  const ampelBg = mich.ampel === 'gruen' ? 'bg-green-50 border-green-200' : mich.ampel === 'gelb' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  const tipp =
    mich.ampel === 'gruen'
      ? 'Super! Du hast deine Reaktionszeit verbessert. Weiter so!'
      : mich.ampel === 'gelb'
      ? 'Auftrag schneller annehmen — Ziel: 1 min kürzer als letzten Monat.'
      : 'Deine Reaktionszeit ist gestiegen. Bitte Benachrichtigungen aktivieren.';

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${ampelBg}`}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="w-5 h-5 text-green-600" />
        <span className="font-semibold text-gray-800">Meine Reaktionszeit-Verbesserung</span>
      </div>

      <div className="text-center mb-3">
        <div className={`text-5xl font-bold ${deltaColor}`}>{fmt(mich.delta_min)}</div>
        <div className="text-3xl font-semibold text-gray-600 mt-1">Rang {mich.rang} / {data.gesamt}</div>
        <div className="text-sm text-gray-500 mt-1">
          Vormonat {mich.vormonat_min} min → Aktuell {mich.aktuell_min} min
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>Ziel: {fmt(data.ziel_delta_min)}</span>
        <span>Team-Avg: {fmt(data.team_avg_delta)}</span>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-white/70 border border-white p-2 text-xs text-gray-600">
        {mich.delta_min < 0 ? <TrendingDown className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> : <TrendingUp className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
        <span>{tipp}</span>
      </div>
    </div>
  );
}
