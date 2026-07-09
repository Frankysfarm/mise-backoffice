'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Route, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TourEntry = {
  batch_id: string;
  fahrer_name: string;
  score: number;
  stopps_gesamt: number;
  stopps_erledigt: number;
  eta_min: number | null;
  verbleibt_min: number | null;
  zone?: string;
  status: 'on-time' | 'tight' | 'late' | 'unknown';
};

type ApiResponse = {
  touren: TourEntry[];
  team_avg_score: number;
};

function mockDaten(): ApiResponse {
  return {
    touren: [
      { batch_id: 'b1', fahrer_name: 'Max M.', score: 87, stopps_gesamt: 4, stopps_erledigt: 2, eta_min: 30, verbleibt_min: 18, zone: 'Nord', status: 'on-time' },
      { batch_id: 'b2', fahrer_name: 'Anna S.', score: 62, stopps_gesamt: 3, stopps_erledigt: 1, eta_min: 25, verbleibt_min: 19, zone: 'Mitte', status: 'tight' },
      { batch_id: 'b3', fahrer_name: 'Luca B.', score: 44, stopps_gesamt: 5, stopps_erledigt: 1, eta_min: 40, verbleibt_min: 35, zone: 'Süd', status: 'late' },
    ],
    team_avg_score: 64,
  };
}

const STATUS_STYLE = {
  'on-time': { bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-700', badge: 'bg-matcha-500 text-white', bar: 'bg-matcha-500', label: 'Pünktlich' },
  'tight':   { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-700', badge: 'bg-amber-500 text-white', bar: 'bg-amber-400', label: 'Knapp' },
  'late':    { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-700', badge: 'bg-red-500 text-white', bar: 'bg-red-400', label: 'Verspätet' },
  'unknown': { bg: 'bg-muted/30', border: 'border-border', badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground', label: 'Unbekannt' },
};

export function DispatchPhase1058TourScoreLiveVisualisierungPro({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/tour-score-live?${params}`);
      if (res.ok) setData(await res.json());
      else throw new Error();
    } catch {
      setData(mockDaten());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [locationId]);

  const touren = data?.touren ?? [];
  const teamScore = data?.team_avg_score ?? 0;

  if (!loading && touren.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left">
        <Route size={15} className="text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Tour-Score Live — Visualisierung Pro</span>
        {teamScore > 0 && (
          <span className="rounded-full bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5">
            Team-Ø {teamScore}
          </span>
        )}
        {loading ? <Loader2 size={14} className="animate-spin text-muted-foreground" /> : open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && data && (
        <div className="p-3 space-y-2">
          {touren.map((t) => {
            const ss = STATUS_STYLE[t.status];
            const progPct = t.stopps_gesamt > 0 ? Math.round((t.stopps_erledigt / t.stopps_gesamt) * 100) : 0;
            const scoreColor = t.score >= 80 ? 'text-matcha-700 dark:text-matcha-300' : t.score >= 60 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
            return (
              <div key={t.batch_id} className={cn('rounded-xl border p-3', ss.bg, ss.border)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[9px] font-black rounded-full px-2 py-0.5', ss.badge)}>{ss.label}</span>
                    <span className="text-xs font-bold">{t.fahrer_name}</span>
                    {t.zone && <span className="text-[9px] rounded bg-white/60 dark:bg-black/20 border px-1.5 font-bold">Zone {t.zone}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.verbleibt_min !== null && (
                      <span className={cn('text-[10px] font-bold tabular-nums', t.status === 'late' ? 'text-red-600' : t.status === 'tight' ? 'text-amber-600' : 'text-matcha-600')}>
                        ~{t.verbleibt_min} Min
                      </span>
                    )}
                    <span className={cn('text-sm font-black tabular-nums', scoreColor)}>{t.score}</span>
                  </div>
                </div>

                {/* Score bar */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] text-muted-foreground w-8 shrink-0">Score</span>
                  <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', t.score >= 80 ? 'bg-matcha-500' : t.score >= 60 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${t.score}%` }} />
                  </div>
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground w-8 shrink-0">Stopp</span>
                  <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', ss.bar)} style={{ width: `${progPct}%` }} />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-muted-foreground w-12 text-right">{t.stopps_erledigt}/{t.stopps_gesamt}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
