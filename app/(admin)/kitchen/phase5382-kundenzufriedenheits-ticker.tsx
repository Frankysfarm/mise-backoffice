'use client';

import { useEffect, useState } from 'react';
import { Star, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Phase 5382 — Kundenzufriedenheits-Ticker
// Star amber-400; Bester/r Rang+Sterne; Team-Ø; Niedrig-Alert <4.0;
// 30-Min-Polling; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sterne: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_sterne: 4.8, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sterne: 3.2, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 4.1,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5382KundenzufriedenheitsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kundenzufriedenheit-ranking?location_id=${locationId}`);
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

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Kundenzufriedenheits-Ticker…</div>;

  const best = data.fahrer.find(f => f.rang === 1);
  const niedrigAlerts = data.fahrer.filter(f => f.alert_niedrig);

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-400" />
        <span className="text-white font-semibold">Kundenzufriedenheit</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} niedrig
          </span>
        )}
      </div>

      {/* Bester */}
      {best && (
        <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-gray-400">Beste Bewertung</div>
            <div className="text-sm font-semibold text-white truncate">{best.fahrer_name}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-amber-400">{best.avg_sterne.toFixed(1)}<span className="text-xs ml-0.5">★</span></div>
            <div className="text-[9px] text-gray-500">Rang {best.rang}</div>
          </div>
        </div>
      )}

      {/* Team-Ø */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-400 text-[11px]">Team-Durchschnitt</span>
        <span className="text-amber-400 font-bold">{data.team_avg.toFixed(1)} ★</span>
      </div>

      {/* Niedrig-Alerts */}
      {niedrigAlerts.length > 0 && (
        <div className="space-y-1">
          {niedrigAlerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 text-[10px] bg-red-950 border border-red-800 rounded-lg px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-red-300 font-medium">{f.fahrer_name}</span>
              <span className="ml-auto text-red-400 font-mono">{f.avg_sterne.toFixed(1)}★</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
