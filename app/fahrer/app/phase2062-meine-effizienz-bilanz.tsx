'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface FahrerPausenzeit {
  driver_id: string;
  avg_idle_min: number;
  aktiv_min: number;
  gesamt_min: number;
  effizienz_pct: number;
  alert: boolean;
}

interface SchichtPausenzeitData {
  fahrer: FahrerPausenzeit[];
  team_avg_idle_min: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_EIGENE: FahrerPausenzeit = {
  driver_id: 'self',
  avg_idle_min: 8.2,
  aktiv_min: 210,
  gesamt_min: 270,
  effizienz_pct: 78,
  alert: false,
};
const MOCK_TEAM_AVG = 11.7;

const TIPPS: Record<string, string> = {
  hoch: 'Lange Pausen heute — wechsle in eine Zone mit mehr Bestellungen oder melde dich bereit.',
  mittel: 'Gute Auslastung. Bleib in der Nähe des Restaurants für noch schnellere Abholungen.',
  gut: 'Starke Effizienz! Du bist heute besonders aktiv — weiter so!',
};

const POLL_MS = 30 * 60 * 1000;

function ringStrokeDashoffset(pct: number, r = 36) {
  const circ = 2 * Math.PI * r;
  return circ * (1 - pct / 100);
}

function effizienzColor(pct: number) {
  if (pct >= 75) return { stroke: '#22c55e', text: 'text-green-400' };
  if (pct >= 50) return { stroke: '#f59e0b', text: 'text-amber-400' };
  return { stroke: '#ef4444', text: 'text-red-400' };
}

export function FahrerPhase2062MeineEffizienzBilanz({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [eigene, setEigene] = useState<FahrerPausenzeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-pausenzeit?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: SchichtPausenzeitData = await res.json();
        if (!cancelled) {
          const mine = json.fahrer.find(f => f.driver_id === driverId) ?? null;
          setEigene(mine);
          setTeamAvg(json.team_avg_idle_min);
        }
      } catch {
        if (!cancelled) {
          setEigene(MOCK_EIGENE);
          setTeamAvg(MOCK_TEAM_AVG);
        }
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId]);

  if (!isOnline) return null;

  const e = eigene ?? MOCK_EIGENE;
  const team = teamAvg ?? MOCK_TEAM_AVG;

  const tipKey = e.effizienz_pct >= 75 ? 'gut' : e.avg_idle_min > 15 ? 'hoch' : 'mittel';
  const colors = effizienzColor(e.effizienz_pct);
  const r = 36;
  const circ = 2 * Math.PI * r;

  return (
    <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100"
      >
        <span className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-400" />
          Meine Effizienz-Bilanz
          <span className="text-xs font-normal text-gray-400">heute</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Effizienz-Ring + KPIs */}
          <div className="flex items-center gap-4">
            {/* SVG Ring */}
            <div className="relative shrink-0">
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r={r} fill="none" stroke="#374151" strokeWidth="8" />
                <circle
                  cx="44"
                  cy="44"
                  r={r}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={ringStrokeDashoffset(e.effizienz_pct, r)}
                  transform="rotate(-90 44 44)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-lg font-black tabular-nums', colors.text)}>{e.effizienz_pct}%</span>
                <span className="text-[9px] text-gray-500">Effizienz</span>
              </div>
            </div>

            {/* KPI grid */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
                <div className="text-sm font-bold text-green-400 tabular-nums">{e.aktiv_min} Min</div>
                <div className="text-[9px] text-gray-400">Aktiv-Zeit</div>
              </div>
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
                <div className={cn('text-sm font-bold tabular-nums', e.avg_idle_min > 15 ? 'text-red-400' : 'text-amber-300')}>
                  Ø {e.avg_idle_min} Min
                </div>
                <div className="text-[9px] text-gray-400">Idle-Ø</div>
              </div>
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
                <div className="text-sm font-bold text-gray-300 tabular-nums">{e.gesamt_min} Min</div>
                <div className="text-[9px] text-gray-400">Schicht gesamt</div>
              </div>
              <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
                <div className={cn('text-sm font-bold tabular-nums', e.avg_idle_min < team ? 'text-green-400' : 'text-amber-400')}>
                  {team} Min
                </div>
                <div className="text-[9px] text-gray-400">Team-Ø Idle</div>
              </div>
            </div>
          </div>

          {/* Tipp */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-950/40 border border-blue-900/50 px-3 py-2">
            <Lightbulb className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-200">{TIPPS[tipKey]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
