'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, WifiOff } from 'lucide-react';

// Phase 5401 — Meine Liefergebiet-Effizienz (Fahrer)
// lieferungen_pro_km; isOnline-Guard; WifiOff-Fallback;
// Coaching ≥1.0/≥0.6/<0.6 L/km; 4xl+Rang; Dual-Balken Ich+Team-Ø;
// Ampel-Border teal/amber/red; 30-Min-Poll; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  lieferungen_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DRIVER: FahrerRow = {
  fahrer_id: 'me',
  fahrer_name: 'Ich',
  rang: 2,
  lieferungen_pro_km: 0.83,
  rank_delta: 1,
  ampel: 'gelb',
  alert_bottom: false,
};

const MOCK_TEAM_AVG = 0.75;

function coaching(lpkm: number): { text: string; color: string } {
  if (lpkm >= 1.0) return { text: 'Exzellent! Top-Gebiets-Effizienz.', color: 'text-teal-400' };
  if (lpkm >= 0.6) return { text: 'Gut. Ziel: 1.0 L/km.', color: 'text-amber-400' };
  return { text: 'Mehr Stopps pro Tour einplanen.', color: 'text-red-400' };
}

function borderColor(ampel: FahrerRow['ampel']): string {
  if (ampel === 'gruen') return 'border-teal-600';
  if (ampel === 'gelb')  return 'border-amber-500';
  return 'border-red-600';
}

function barFill(ampel: FahrerRow['ampel']): string {
  if (ampel === 'gruen') return 'bg-teal-500';
  if (ampel === 'gelb')  return 'bg-amber-400';
  return 'bg-red-500';
}

export function FahrerPhase5401MeineLiefergebietEffizienz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [myRow, setMyRow] = useState<FahrerRow>(MOCK_DRIVER);
  const [teamAvg, setTeamAvg] = useState(MOCK_TEAM_AVG);
  const [gesamt, setGesamt] = useState(4);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    const poll = () => {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      fetch(`/api/delivery/admin/fahrer-lieferungen-pro-km?${params}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiResponse | null) => {
          if (!d) return;
          const me = d.fahrer.find(f => f.fahrer_id === driverId) ?? d.fahrer[0];
          if (me) { setMyRow(me); setTeamAvg(d.team_avg); setGesamt(d.gesamt); }
        })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 30 * 60_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-zinc-600" />
        <span className="text-xs text-zinc-500">Gebiets-Effizienz offline nicht verfügbar</span>
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(myRow.lieferungen_pro_km);
  const maxVal = Math.max(myRow.lieferungen_pro_km, teamAvg, 1);

  return (
    <div className={`rounded-xl border-2 bg-zinc-950 p-3 space-y-3 text-sm font-mono ${borderColor(myRow.ampel)}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Meine Gebiets-Effizienz</span>
        </div>
        <span className="text-[10px] text-zinc-500">Rang #{myRow.rang}/{gesamt}</span>
      </div>

      {/* Hauptwert */}
      <div className="text-center py-1">
        <div className={`text-4xl font-black tabular-nums ${myRow.ampel === 'gruen' ? 'text-teal-400' : myRow.ampel === 'gelb' ? 'text-amber-400' : 'text-red-400'}`}>
          {myRow.lieferungen_pro_km.toFixed(2)}
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5">Lieferungen / km</div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
            <span>Ich</span>
            <span>{myRow.lieferungen_pro_km.toFixed(2)} L/km</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barFill(myRow.ampel)}`}
              style={{ width: `${Math.min(100, (myRow.lieferungen_pro_km / maxVal) * 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
            <span>Team-Ø</span>
            <span>{teamAvg.toFixed(2)} L/km</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-zinc-500"
              style={{ width: `${Math.min(100, (teamAvg / maxVal) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Coaching */}
      <div className={`text-[11px] font-medium ${coachColor}`}>{coachText}</div>
    </div>
  );
}
