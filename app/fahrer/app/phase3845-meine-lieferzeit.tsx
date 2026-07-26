'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

interface ApiData {
  fahrer_single: {
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_min: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_lang: boolean;
  };
  team_avg_min: number;
  gesamt: number;
  ziel_min: number;
}

const MOCK: ApiData = {
  fahrer_single: {
    fahrer_id: 'f1',
    fahrer_name: 'Julia F.',
    rang: 1,
    avg_min: 18,
    ampel: 'gruen',
    alert_lang: false,
  },
  team_avg_min: 26,
  gesamt: 4,
  ziel_min: 25,
};

const COACHING: Record<string, string> = {
  gruen: 'Sehr schnelle Lieferzeiten! Weiter so.',
  gelb: 'Lieferzeit im Mittelfeld. Routenoptimierung prüfen.',
  rot: 'Lange Lieferzeiten! Bitte Route und Pausen überprüfen.',
};

export function FahrerPhase3845MeineLieferzeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-lieferzeit-durchschnitt?location_id=${locationId}&driver_id=${driverId}`,
      );
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-xs text-gray-400">
        Offline — Daten nicht verfügbar
      </div>
    );
  }

  const f = data.fahrer_single;
  const zielMin = data.ziel_min;
  const rangPct = data.gesamt > 0 ? Math.round((f.rang / data.gesamt) * 100) : 100;
  const zielBarPct = Math.min((f.avg_min / Math.max(zielMin * 2, 1)) * 100, 100);

  const valueColor =
    f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const barColor =
    f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
  const rangColor =
    f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-blue-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Ø Lieferzeit</span>
        {loading && <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* Wert + Rang */}
      <div className="flex items-end justify-between">
        <span className={`text-5xl font-black ${valueColor}`}>{f.avg_min}<span className="text-2xl ml-1">min</span></span>
        <span className={`text-3xl font-bold ${rangColor}`}>#{f.rang}<span className="text-sm font-normal text-gray-400"> / {data.gesamt}</span></span>
      </div>

      {f.alert_lang && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Lange Lieferzeiten! Bitte Route überprüfen.</span>
        </div>
      )}

      {/* Rang-Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Rang</span>
          <span>{f.rang}/{data.gesamt}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rangPct}%` }} />
        </div>
      </div>

      {/* Ziel-Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Ziel ≤{zielMin} min</span>
          <span>{f.avg_min} min</span>
        </div>
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${zielBarPct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500" style={{ left: `${Math.min((zielMin / Math.max(zielMin * 2, 1)) * 100, 100)}%` }} />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>Team-Ø</span>
        <span className="font-semibold text-blue-600">{data.team_avg_min} min</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 italic">
        {COACHING[f.ampel]}
      </div>
    </div>
  );
}
