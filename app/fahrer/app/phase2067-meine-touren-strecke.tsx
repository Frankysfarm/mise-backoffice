'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react';

interface FahrerRoutenEffizienz {
  driver_id: string;
  km_gesamt: number;
  touren_count: number;
  avg_km_pro_bestellung: number;
  effizienz_score: number;
  alert: boolean;
}

interface RoutenEffizienzData {
  fahrer: FahrerRoutenEffizienz[];
  team_avg_km: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_EIGENE: FahrerRoutenEffizienz = {
  driver_id: 'self',
  km_gesamt: 42,
  touren_count: 7,
  avg_km_pro_bestellung: 6.0,
  effizienz_score: 82,
  alert: false,
};
const MOCK_TEAM_AVG = 7.4;

const POLL_MS = 30 * 60 * 1000;

function effizienzColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

export function FahrerPhase2067MeineTourenStrecke({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [eigene, setEigene] = useState<FahrerRoutenEffizienz | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-routen-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: RoutenEffizienzData = await res.json();
        if (!cancelled) {
          const mine = json.fahrer.find(f => f.driver_id === driverId) ?? null;
          setEigene(mine);
          setTeamAvg(json.team_avg_km);
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
  const besserAlsTeam = e.avg_km_pro_bestellung <= team;
  const maxKm = 20;
  const barPct = Math.min((e.km_gesamt / maxKm) * 100, 100);

  return (
    <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100"
      >
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-green-400" />
          Meine Touren-Strecke
          <span className="text-xs font-normal text-gray-400">heute</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Km counter */}
          <div className="flex items-end gap-1 pt-1">
            <span className="text-3xl font-black tabular-nums text-green-300">{e.km_gesamt}</span>
            <span className="text-sm text-gray-400 mb-1">km heute</span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-700"
                style={{ width: `${barPct}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 text-right">{e.touren_count} Tour{e.touren_count !== 1 ? 'en' : ''}</div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className={cn('text-sm font-bold tabular-nums', effizienzColor(e.effizienz_score))}>
                {e.avg_km_pro_bestellung} km
              </div>
              <div className="text-[9px] text-gray-400">Ø km/Bestellung</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className={cn('text-sm font-bold tabular-nums', besserAlsTeam ? 'text-green-400' : 'text-amber-400')}>
                {team} km
              </div>
              <div className="text-[9px] text-gray-400">Team-Ø km/Auftrag</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className={cn('text-sm font-bold tabular-nums', effizienzColor(e.effizienz_score))}>
                {e.effizienz_score}
              </div>
              <div className="text-[9px] text-gray-400">Effizienz-Score</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className={cn('flex items-center justify-center gap-1 text-sm font-bold', besserAlsTeam ? 'text-green-400' : 'text-amber-400')}>
                {besserAlsTeam
                  ? <TrendingDown className="w-3.5 h-3.5" />
                  : <TrendingUp className="w-3.5 h-3.5" />
                }
                {besserAlsTeam ? 'Unter Ø' : 'Über Ø'}
              </div>
              <div className="text-[9px] text-gray-400">vs. Team</div>
            </div>
          </div>

          {/* Info badge */}
          {besserAlsTeam ? (
            <div className="rounded-lg bg-green-950/40 border border-green-900/50 px-3 py-2 text-xs text-green-200">
              Kurze Wege — du belieferst effizient. Weiter so!
            </div>
          ) : (
            <div className="rounded-lg bg-amber-950/40 border border-amber-900/50 px-3 py-2 text-xs text-amber-200">
              Längere Wege als der Team-Ø — prüfe, ob eine Zone mit weniger Strecke passt.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
