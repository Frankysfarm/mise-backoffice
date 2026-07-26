'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface ApiData {
  fahrer_single: {
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    reklamations_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_hoch: boolean;
  };
  team_avg_pct: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK: ApiData = {
  fahrer_single: {
    fahrer_id: 'f1',
    fahrer_name: 'Julia F.',
    rang: 1,
    reklamations_pct: 1,
    ampel: 'gruen',
    alert_hoch: false,
  },
  team_avg_pct: 6,
  gesamt: 4,
  ziel_pct: 3,
};

const COACHING: Record<string, string> = {
  gruen: 'Sehr wenige Reklamationen! Weiter so.',
  gelb: 'Einige Reklamationen. Prüfe Verpackung und Umgang mit Kunden.',
  rot: 'Hohe Reklamationsquote! Bitte mit Dispatcher besprechen.',
};

export function FahrerPhase3840MeineReklamationsQuote({
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
        `/api/delivery/admin/fahrer-reklamations-quote?location_id=${locationId}&driver_id=${driverId}`,
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
  const zielPct = data.ziel_pct;
  const rangPct = data.gesamt > 0 ? Math.round((f.rang / data.gesamt) * 100) : 100;
  const zielBarPct = Math.min((f.reklamations_pct / Math.max(zielPct * 2, 1)) * 100, 100);

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
        <ShieldAlert className="w-5 h-5 text-orange-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Reklamationsquote</span>
        {loading && <span className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* Hauptwert */}
      <div className="text-center">
        <div className={`text-5xl font-black leading-none ${valueColor}`}>{f.reklamations_pct}%</div>
        <div className="mt-1 text-sm text-gray-500">Reklamationsquote (30 Tage)</div>
        <div className={`text-3xl font-black mt-1 ${rangColor}`}>
          Rang {f.rang} / {data.gesamt}
        </div>
      </div>

      {/* Alert */}
      {f.alert_hoch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Hohe Reklamationsquote! Bitte mit Dispatcher besprechen.</span>
        </div>
      )}

      {/* Rang-Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Rang-Position</span>
          <span>{rangPct}% von unten</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${100 - rangPct}%` }} />
        </div>
      </div>

      {/* Ziel-Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Ziel ≤{zielPct}%</span>
          <span>{f.reklamations_pct}% / {zielPct * 2}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${zielBarPct}%` }} />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="flex items-center justify-between text-xs px-3 py-2 bg-gray-50 rounded-lg">
        <span className="text-gray-500">Team-Durchschnitt</span>
        <span className="font-bold text-gray-800">{data.team_avg_pct}%</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="text-[11px] text-gray-500 italic text-center">{COACHING[f.ampel]}</div>

      <div className="text-[10px] text-gray-400 text-center">Ziel ≤{zielPct}% · 30-Min-Polling</div>
    </div>
  );
}
