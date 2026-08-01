'use client';

import { useEffect, useState } from 'react';
import { Navigation, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Phase 5390 — Leerfahrten-Ticker
// Navigation orange-400; Effizienz-/r #1 Name+%; Team-Ø; Hoch-Alert >30%;
// 30-Min-Polling; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerfahrten_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_leerfahrten_pct: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, leerfahrten_pct:  5, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, leerfahrten_pct: 38, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_leerfahrten_pct: 19.3,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5390LeerfahrtenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-leerfahrten-ranking?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Leerfahrten-Ticker…</div>;

  const best = data.fahrer.find(f => f.rang === 1);
  const hochAlerts = data.fahrer.filter(f => f.alert_bottom);

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Navigation className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Leerfahrten-Quote</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} hoch
          </span>
        )}
      </div>

      {/* Effizienz-/r */}
      {best && (
        <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-gray-400">Effizienz-/r</div>
            <div className="text-sm font-semibold text-white truncate">{best.fahrer_name}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-orange-400">{best.leerfahrten_pct.toFixed(1)}<span className="text-xs ml-0.5">%</span></div>
            <div className="text-[9px] text-gray-500">Rang {best.rang}</div>
          </div>
        </div>
      )}

      {/* Team-Ø */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-400 text-[11px]">Team-Durchschnitt</span>
        <span className="text-orange-400 font-bold">{data.team_avg_leerfahrten_pct.toFixed(1)} %</span>
      </div>

      {/* Hoch-Alerts */}
      {hochAlerts.length > 0 && (
        <div className="space-y-1">
          {hochAlerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 text-[10px] bg-red-950 border border-red-800 rounded-lg px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-red-300 font-medium">{f.fahrer_name}</span>
              <span className="ml-auto text-red-400 font-mono">{f.leerfahrten_pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
