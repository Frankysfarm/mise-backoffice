'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';

// Phase 5392 — Meine Vollständigkeit (Fahrer)
// vollstaendigkeit_pct; isOnline-Guard; WifiOff-Fallback;
// Coaching ≥95/≥88/<88%; 4xl+Rang; Dual-Balken Ich+Team-Ø;
// Ampel-Border emerald/amber/red; 30-Min-Poll; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  vollstaendigkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DRIVER: FahrerRow = {
  fahrer_id: 'me',
  fahrer_name: 'Ich',
  rang: 2,
  vollstaendigkeit_pct: 94.0,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
};

const MOCK_TEAM_AVG = 91.5;

function coaching(pct: number): { text: string; color: string } {
  if (pct >= 95) return { text: 'Exzellent! Halte diese Rate.', color: 'text-emerald-400' };
  if (pct >= 88) return { text: 'Gut. Ziel: 95% Vollständigkeit.', color: 'text-amber-400' };
  return { text: 'Kritisch! Mehr Lieferungen abschließen.', color: 'text-red-400' };
}

function borderColor(ampel: FahrerRow['ampel']): string {
  if (ampel === 'gruen') return 'border-emerald-600';
  if (ampel === 'gelb')  return 'border-amber-500';
  return 'border-red-600';
}

export function FahrerPhase5392MeineVollstaendigkeit({
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
      fetch(`/api/delivery/admin/fahrer-vollstaendigkeit-ranking?${params}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiResponse | null) => {
          if (!d) return;
          const me = d.fahrer.find(f => f.fahrer_id === driverId) ?? d.fahrer[0];
          if (me) { setMyRow(me); setTeamAvg(d.team_avg_pct); setGesamt(d.gesamt); }
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
        <span className="text-xs text-zinc-500">Vollständigkeit offline nicht verfügbar</span>
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(myRow.vollstaendigkeit_pct);

  return (
    <div className={`rounded-xl border-2 bg-zinc-950 p-3 space-y-3 text-sm font-mono ${borderColor(myRow.ampel)}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Meine Vollständigkeit</span>
        </div>
        <span className="text-[10px] text-zinc-500">Rang #{myRow.rang}/{gesamt}</span>
      </div>

      {/* Hauptwert */}
      <div className="text-center py-1">
        <div className={`text-4xl font-black tabular-nums ${myRow.ampel === 'gruen' ? 'text-emerald-400' : myRow.ampel === 'gelb' ? 'text-amber-400' : 'text-red-400'}`}>
          {myRow.vollstaendigkeit_pct}%
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5">Abschlussrate</div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
            <span>Ich</span>
            <span>{myRow.vollstaendigkeit_pct}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${myRow.ampel === 'gruen' ? 'bg-emerald-500' : myRow.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, myRow.vollstaendigkeit_pct)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
            <span>Team-Ø</span>
            <span>{teamAvg}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-zinc-500"
              style={{ width: `${Math.min(100, teamAvg)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Coaching */}
      <div className={`text-[11px] font-medium ${coachColor}`}>{coachText}</div>
    </div>
  );
}
