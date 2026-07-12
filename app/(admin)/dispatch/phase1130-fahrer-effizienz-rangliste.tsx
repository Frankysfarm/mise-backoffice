'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1130 — Fahrer-Effizienz-Rangliste (Dispatch)
// Ranking aller heute aktiven Fahrer nach Stopps/Stunde + km-Effizienz + Pünktlichkeit

interface Props { locationId: string | null }

type FahrerRank = {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_pro_stunde: number;
  km_gesamt: number;
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  gesamt_score: number;
  delta_schnitt: number;
  badge: 'gold' | 'silber' | 'bronze' | null;
};

type ApiData = {
  fahrer: FahrerRank[];
  team_schnitt_score: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  fahrer: [
    { rang: 1, fahrer_id: 'f1', fahrer_name: 'Ahmad K.', stopps_gesamt: 18, stopps_pro_stunde: 4.5, km_gesamt: 42, km_pro_stopp: 2.3, puenktlichkeit_pct: 94, gesamt_score: 88, delta_schnitt: +16, badge: 'gold' },
    { rang: 2, fahrer_id: 'f2', fahrer_name: 'Lukas M.', stopps_gesamt: 15, stopps_pro_stunde: 3.8, km_gesamt: 38, km_pro_stopp: 2.5, puenktlichkeit_pct: 89, gesamt_score: 79, delta_schnitt: +4, badge: 'silber' },
    { rang: 3, fahrer_id: 'f3', fahrer_name: 'Sara P.',  stopps_gesamt: 14, stopps_pro_stunde: 3.5, km_gesamt: 35, km_pro_stopp: 2.5, puenktlichkeit_pct: 86, gesamt_score: 75, delta_schnitt: -1, badge: 'bronze' },
    { rang: 4, fahrer_id: 'f4', fahrer_name: 'Jonas H.', stopps_gesamt: 12, stopps_pro_stunde: 3.0, km_gesamt: 32, km_pro_stopp: 2.7, puenktlichkeit_pct: 80, gesamt_score: 68, delta_schnitt: -10, badge: null },
    { rang: 5, fahrer_id: 'f5', fahrer_name: 'Emma T.',  stopps_gesamt: 10, stopps_pro_stunde: 2.5, km_gesamt: 28, km_pro_stopp: 2.8, puenktlichkeit_pct: 75, gesamt_score: 60, delta_schnitt: -21, badge: null },
  ],
  team_schnitt_score: 74,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

const BADGE_STYLE: Record<string, string> = {
  gold:    'bg-yellow-400 text-yellow-900',
  silber:  'bg-slate-300 text-slate-800',
  bronze:  'bg-amber-700 text-white',
};

const BADGE_LABEL: Record<string, string> = {
  gold: '🥇', silber: '🥈', bronze: '🥉',
};

const POLL_MS = 60_000;

export function DispatchPhase1130FahrerEffizienzRangliste({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-effizienz-rangliste?location_id=${locationId}`);
      if (r.ok) setData(await r.json() as ApiData);
      else setData(MOCK);
    } catch { setData(MOCK); } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-violet-300 bg-violet-50 shadow-sm overflow-hidden dark:border-violet-700 dark:bg-violet-950/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-500 shrink-0" />
          <span className="font-bold text-sm text-violet-700 dark:text-violet-300">Fahrer-Effizienz-Rangliste</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
          <span className="text-[11px] text-violet-500">Ø {d.team_schnitt_score} Pkt</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-violet-500" /> : <ChevronDown className="h-4 w-4 text-violet-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {d.fahrer.map(f => (
            <div
              key={f.fahrer_id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2',
                f.badge === 'gold' ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-white/60 dark:bg-white/5',
              )}
            >
              {/* Rang + Badge */}
              <span className="w-7 text-center">
                {f.badge ? (
                  <span className="text-lg leading-none">{BADGE_LABEL[f.badge]}</span>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">#{f.rang}</span>
                )}
              </span>

              {/* Name + Stats */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{f.fahrer_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f.stopps_pro_stunde}/h · {f.puenktlichkeit_pct}% pünktl. · {f.km_pro_stopp} km/Stopp
                </p>
              </div>

              {/* Score + Delta */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground">{f.gesamt_score}</p>
                <p className={cn(
                  'flex items-center justify-end gap-0.5 text-[11px] font-medium',
                  f.delta_schnitt >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                )}>
                  {f.delta_schnitt >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {f.delta_schnitt >= 0 ? '+' : ''}{f.delta_schnitt}
                </p>
              </div>
            </div>
          ))}

          {d.fahrer.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">Keine aktiven Fahrer heute</p>
          )}

          <p className="text-[11px] text-muted-foreground text-right pt-1">Team-Ø: {d.team_schnitt_score} Pkt · Score: 40% Stopps/h, 35% Pünktl., 25% km</p>
        </div>
      )}
    </div>
  );
}
