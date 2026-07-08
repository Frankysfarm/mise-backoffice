'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Euro, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EinnahmenDaten {
  einnahmen_bisher: number;
  trinkgeld_bisher: number;
  schicht_start: string | null;
  schicht_dauer_min: number;
  touren_bisher: number;
}

interface Props {
  driverId: string;
  locationId: string;
}

function euro(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function FahrerPhase667TagesEinnahmenPrognose({ driverId, locationId }: Props) {
  const [data, setData] = useState<EinnahmenDaten | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-einnahmen-tag?location_id=${locationId}&driver_id=${driverId}`
        );
        const json = await res.json() as EinnahmenDaten & { ok?: boolean };
        if (active && json.ok !== false) {
          setData({
            einnahmen_bisher: json.einnahmen_bisher ?? 0,
            trinkgeld_bisher: json.trinkgeld_bisher ?? 0,
            schicht_start: json.schicht_start ?? null,
            schicht_dauer_min: json.schicht_dauer_min ?? 0,
            touren_bisher: json.touren_bisher ?? 0,
          });
        }
      } catch {
        // noop
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 120_000);
    return () => { active = false; clearInterval(id); };
  }, [driverId, locationId]);

  if (loading && !data) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
        <span className="text-sm text-blue-200">Lade Einnahmen…</span>
      </div>
    );
  }

  if (!data || data.schicht_dauer_min < 5) return null;

  const gesamt = data.einnahmen_bisher + data.trinkgeld_bisher;
  const schichtZielMin = 480; // 8h Schicht
  const verbleibendeMin = Math.max(0, schichtZielMin - data.schicht_dauer_min);
  const euroProMin = data.schicht_dauer_min > 0 ? gesamt / data.schicht_dauer_min : 0;
  const prognoseGesamt = gesamt + euroProMin * verbleibendeMin;
  const fortschrittPct = Math.min(100, Math.round((data.schicht_dauer_min / schichtZielMin) * 100));

  const trendKlasse =
    euroProMin >= 0.5 ? 'text-emerald-400' :
    euroProMin >= 0.3 ? 'text-amber-400' :
    'text-red-400';

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-bold text-white">Einnahmen-Prognose heute</span>
      </div>

      {/* Bisher vs. Prognose */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Euro className="h-3 w-3 text-blue-300" />
            <span className="text-[10px] text-blue-200">Bisher</span>
          </div>
          <div className="text-base font-black tabular-nums text-white">{euro(gesamt)}</div>
          <div className="text-[9px] text-blue-300 mt-0.5">
            inkl. {euro(data.trinkgeld_bisher)} Trinkgeld
          </div>
        </div>
        <div className="rounded-lg bg-emerald-900/30 border border-emerald-700/30 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-300">Prognose</span>
          </div>
          <div className={cn('text-base font-black tabular-nums', trendKlasse)}>{euro(prognoseGesamt)}</div>
          <div className="text-[9px] text-emerald-400 mt-0.5">
            bei akt. Tempo
          </div>
        </div>
      </div>

      {/* Schicht-Fortschritt */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 text-[10px] text-blue-200">
            <Clock className="h-3 w-3" />
            <span>Schicht: {Math.floor(data.schicht_dauer_min / 60)}h {data.schicht_dauer_min % 60}m</span>
          </div>
          <span className="text-[10px] text-blue-300">{data.touren_bisher} Touren</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
            style={{ width: `${fortschrittPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-blue-300 mt-0.5">
          <span>0h</span>
          <span className="font-semibold">{fortschrittPct}%</span>
          <span>8h</span>
        </div>
      </div>

      <div className={cn('text-[10px] text-center font-semibold', trendKlasse)}>
        {euro(euroProMin * 60)}/h Ø Einnahmen
      </div>
    </div>
  );
}
