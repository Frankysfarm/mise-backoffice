'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface ZonenItem {
  zone: string;
  avg_lieferzeit_min: number;
  bestellungen_heute: number;
  auslastung_pct: number;
}

interface ZonenData {
  zonen: ZonenItem[];
  team_avg_lieferzeit_min: number;
}

interface Props {
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_DATA: ZonenData = {
  zonen: [
    { zone: 'A', avg_lieferzeit_min: 22, bestellungen_heute: 18, auslastung_pct: 72 },
    { zone: 'B', avg_lieferzeit_min: 31, bestellungen_heute: 12, auslastung_pct: 48 },
  ],
  team_avg_lieferzeit_min: 32,
};

const POLL_MS = 60 * 60 * 1000;

export function FahrerPhase2073MeineLieblingszone({ locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ZonenData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/lieferzonen-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: ZonenData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK_DATA);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!isOnline) return null;

  const d = data ?? MOCK_DATA;
  const sorted = [...d.zonen].sort((a, b) => b.bestellungen_heute - a.bestellungen_heute);
  const favorit = sorted[0] ?? null;
  const teamAvg = d.team_avg_lieferzeit_min;

  if (!favorit) return null;

  const besserAlsTeam = favorit.avg_lieferzeit_min <= teamAvg;
  const barPct = Math.min((favorit.bestellungen_heute / 30) * 100, 100);

  return (
    <div className="rounded-2xl bg-gray-900/80 border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100"
      >
        <span className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Meine Lieblingszone
          <span className="text-xs font-normal text-gray-400">heute</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Zone badge */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-yellow-950/60 border border-yellow-800">
              <span className="text-2xl font-black text-yellow-300">{favorit.zone}</span>
            </div>
            <div>
              <div className="text-xs text-gray-400">Häufigste Zone heute</div>
              <div className="text-lg font-black text-gray-100">Zone {favorit.zone}</div>
              <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold">
                <Star className="w-3 h-3" />
                Du kennst diese Zone gut!
              </div>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold tabular-nums text-yellow-300">{favorit.bestellungen_heute}</div>
              <div className="text-[9px] text-gray-400">Aufträge</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className={cn('text-sm font-bold tabular-nums', besserAlsTeam ? 'text-green-400' : 'text-amber-400')}>
                {favorit.avg_lieferzeit_min} Min
              </div>
              <div className="text-[9px] text-gray-400">Ø Lieferzeit</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold tabular-nums text-gray-300">{favorit.auslastung_pct}%</div>
              <div className="text-[9px] text-gray-400">Auslastung</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Auftragsanteil heute</span>
              <span>{favorit.bestellungen_heute} von ~30</span>
            </div>
            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-yellow-500 transition-all duration-700"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>

          {/* Zone tip */}
          <div className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2',
            besserAlsTeam
              ? 'bg-green-950/40 border border-green-900/50'
              : 'bg-amber-950/40 border border-amber-900/50',
          )}>
            <MapPin className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', besserAlsTeam ? 'text-green-400' : 'text-amber-400')} />
            <p className={cn('text-xs', besserAlsTeam ? 'text-green-200' : 'text-amber-200')}>
              {besserAlsTeam
                ? `Zone ${favorit.zone} läuft super — ${favorit.avg_lieferzeit_min} Min Lieferzeit, unter Team-Ø (${teamAvg} Min).`
                : `Zone ${favorit.zone} ist deine Stärke, aber Lieferzeit liegt über Team-Ø (${teamAvg} Min). Optimiere die Route!`
              }
            </p>
          </div>

          {/* All zones mini list */}
          {sorted.length > 1 && (
            <div className="space-y-1">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Alle Zonen heute</div>
              {sorted.map(z => (
                <div key={z.zone} className="flex items-center gap-2 text-xs text-gray-300">
                  <span className="w-6 font-bold text-gray-400">Z{z.zone}</span>
                  <div className="flex-1 h-1 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-500"
                      style={{ width: `${Math.min((z.bestellungen_heute / 30) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-gray-400 text-[10px]">{z.bestellungen_heute} Auftr.</span>
                  <span className={cn('tabular-nums text-[10px] font-bold', z.avg_lieferzeit_min <= teamAvg ? 'text-green-400' : 'text-amber-400')}>
                    {z.avg_lieferzeit_min} Min
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
