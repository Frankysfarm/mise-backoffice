'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Loader2, Award } from 'lucide-react';

/**
 * Phase 1679 — Fahrer-Routen-Effizienz-Rangliste (Dispatch)
 *
 * Phase1677-API: /api/delivery/admin/fahrer-routen-effizienz-index
 * km/Stopp je Fahrer als Balken + Top-3-Badge + Trend; 15-Min-Polling.
 */

interface FahrerEffizienz {
  fahrer_id: string;
  fahrer_name: string;
  km_je_stopp: number;
  km_je_stopp_vorwoche: number | null;
  trend: 'besser' | 'gleich' | 'schlechter';
  delta_pct: number;
  gesamtkm_heute: number;
  stopps_heute: number;
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerEffizienz[];
  team_ø_km_je_stopp: number;
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  km_je_stopp: 1.8, km_je_stopp_vorwoche: 2.1, trend: 'besser',     delta_pct: -14.3, gesamtkm_heute: 32.4, stopps_heute: 18, rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Lisa B.', km_je_stopp: 2.0, km_je_stopp_vorwoche: 1.9, trend: 'gleich',     delta_pct: 5.3,   gesamtkm_heute: 28.0, stopps_heute: 14, rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tom K.',  km_je_stopp: 2.6, km_je_stopp_vorwoche: 2.3, trend: 'schlechter', delta_pct: 13.0,  gesamtkm_heute: 36.4, stopps_heute: 14, rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Jan S.',  km_je_stopp: 3.1, km_je_stopp_vorwoche: null, trend: 'gleich',    delta_pct: 0,     gesamtkm_heute: 24.8, stopps_heute: 8,  rang: 4 },
  ],
  team_ø_km_je_stopp: 2.375,
};

function kmBarColor(km: number, teamAvg: number) {
  if (km <= teamAvg * 0.85) return 'bg-matcha-400';
  if (km <= teamAvg * 1.10) return 'bg-amber-400';
  return 'bg-red-500';
}

function kmTextColor(km: number, teamAvg: number) {
  if (km <= teamAvg * 0.85) return 'text-matcha-700 dark:text-matcha-300';
  if (km <= teamAvg * 1.10) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function TrendIcon({ t }: { t: FahrerEffizienz['trend'] }) {
  if (t === 'besser')      return <TrendingDown className="h-3 w-3 text-matcha-500" />;
  if (t === 'schlechter')  return <TrendingUp   className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

const RANG_BADGE: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  2: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export function DispatchPhase1679FahrerRoutenEffizienzRangliste({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-routen-effizienz-index${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setData(MOCK);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  const displayed = data ?? MOCK;
  const maxKm = Math.max(...displayed.fahrer.map(f => f.km_je_stopp), 0.1);

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Route className="h-4 w-4 shrink-0 text-saffron-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Routen-Effizienz-Rangliste
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {displayed.fahrer.map(f => {
            const barPct = maxKm > 0 ? Math.round((f.km_je_stopp / maxKm) * 100) : 0;
            const barColor = kmBarColor(f.km_je_stopp, displayed.team_ø_km_je_stopp);
            const textColor = kmTextColor(f.km_je_stopp, displayed.team_ø_km_je_stopp);
            const rangBadge = RANG_BADGE[f.rang];

            return (
              <div key={f.fahrer_id} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {rangBadge ? (
                      <span className={cn('inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold shrink-0', rangBadge)}>
                        {f.rang <= 3 && <Award className="h-2.5 w-2.5" />}#{f.rang}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[9px] shrink-0 w-6 text-right">#{f.rang}</span>
                    )}
                    <span className="font-medium text-foreground truncate max-w-[110px]">{f.fahrer_name}</span>
                  </div>
                  <div className="flex items-center gap-1 tabular-nums shrink-0 ml-2">
                    <TrendIcon t={f.trend} />
                    <span className={cn('font-bold', textColor)}>{f.km_je_stopp.toFixed(1)} km</span>
                    <span className="text-muted-foreground text-[9px]">/Stopp</span>
                    <span className="text-muted-foreground text-[9px]">· {f.stopps_heute} Stopps</span>
                  </div>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor)}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })}

          <p className="text-[9px] text-muted-foreground pt-1 flex justify-between">
            <span>Ø Team: {displayed.team_ø_km_je_stopp.toFixed(2)} km/Stopp · niedriger = effizienter</span>
            <span>15-Min-Refresh</span>
          </p>
        </div>
      )}
    </div>
  );
}
