'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1745 — Eigene Reaktionszeit-Anzeige (Fahrer-App)
 *
 * Wie schnell startet der Fahrer nach Dispatch-Zuweisung?
 * Ø heute + Vergleich Gesamtteam; isOnline-Guard; 20-Min-Polling.
 */

interface ApiResponse {
  eigene_avg_sek: number;
  eigene_avg_min: number;
  team_avg_sek: number;
  team_avg_min: number;
  touren_heute: number;
  besser_als_team: boolean;
  differenz_sek: number;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

function sekLabel(sek: number): string {
  if (sek < 60) return `${sek}s`;
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} Min`;
}

const MOCK: ApiResponse = {
  eigene_avg_sek: 95,
  eigene_avg_min: 1.6,
  team_avg_sek: 156,
  team_avg_min: 2.6,
  touren_heute: 4,
  besser_als_team: true,
  differenz_sek: 61,
};

export function FahrerPhase1745EigeneReaktionstanzAnzeige({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    const load = () => {
      fetch(`/api/delivery/driver/eigene-reaktionszeit?driver_id=${driverId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 20 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const gut = data.eigene_avg_sek <= 120;
  const okay = data.eigene_avg_sek <= 300;

  const chipColor = gut
    ? 'bg-matcha-50 border-matcha-200 text-matcha-700'
    : okay
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="mx-4 mb-3 rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-bold text-char">Reaktionszeit</span>
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', chipColor)}>
            {sekLabel(data.eigene_avg_sek)}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-3 py-2.5 text-center">
              <div className="text-[9px] font-black uppercase text-stone-400 mb-1">Meine Ø Reaktionszeit</div>
              <div className={cn('text-xl font-black tabular-nums',
                gut ? 'text-matcha-700' : okay ? 'text-amber-600' : 'text-red-600')}>
                {sekLabel(data.eigene_avg_sek)}
              </div>
              <div className="text-[9px] text-stone-400 mt-0.5">{data.touren_heute} Touren heute</div>
            </div>
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-3 py-2.5 text-center">
              <div className="text-[9px] font-black uppercase text-stone-400 mb-1">Team-Durchschnitt</div>
              <div className="text-xl font-black tabular-nums text-stone-600">
                {sekLabel(data.team_avg_sek)}
              </div>
              <div className="text-[9px] text-stone-400 mt-0.5">alle Fahrer heute</div>
            </div>
          </div>

          <div className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2.5 border',
            data.besser_als_team
              ? 'bg-matcha-50 border-matcha-200 text-matcha-700'
              : 'bg-amber-50 border-amber-200 text-amber-700',
          )}>
            {data.besser_als_team
              ? <TrendingDown className="w-4 h-4 shrink-0" />
              : <TrendingUp className="w-4 h-4 shrink-0" />}
            <span className="text-xs font-bold">
              {data.besser_als_team
                ? `${sekLabel(data.differenz_sek)} schneller als Team-Schnitt`
                : `${sekLabel(data.differenz_sek)} langsamer als Team-Schnitt`}
            </span>
          </div>

          <div className="text-[9px] text-stone-400">
            Reaktionszeit: Zeit zwischen Dispatch-Zuweisung und Tour-Start.
          </div>
        </div>
      )}
    </div>
  );
}
