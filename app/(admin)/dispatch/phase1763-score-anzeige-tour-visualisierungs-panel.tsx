'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1763 — Score-Anzeige Tour-Visualisierungs-Panel (Dispatch)
 *
 * Zeigt für jeden aktiven Fahrer: Score + Tour-Fortschritt (Stopps erledigt / gesamt).
 * Balken-Visualisierung je Fahrer. 2-Min-Polling.
 * GET /api/delivery/admin/tour-score-live?location_id=<id>
 * Fallback: Mock-Daten.
 */

interface FahrerScore {
  fahrer_id: string;
  name: string;
  score: number;
  stopps_erledigt: number;
  stopps_gesamt: number;
  aktive_tour: boolean;
}

interface Props {
  locationId?: string | null;
  className?: string;
}

const MOCK: FahrerScore[] = [
  { fahrer_id: 'f1', name: 'Lukas M.', score: 92, stopps_erledigt: 3, stopps_gesamt: 5, aktive_tour: true },
  { fahrer_id: 'f2', name: 'Jana K.', score: 87, stopps_erledigt: 1, stopps_gesamt: 4, aktive_tour: true },
  { fahrer_id: 'f3', name: 'Tim B.',  score: 78, stopps_erledigt: 4, stopps_gesamt: 4, aktive_tour: false },
];

function scoreColor(s: number) {
  if (s >= 90) return 'text-green-600 dark:text-green-400';
  if (s >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function barColor(s: number) {
  if (s >= 90) return 'bg-green-500';
  if (s >= 75) return 'bg-amber-500';
  return 'bg-red-500';
}

export function DispatchPhase1763ScoreAnzeigeTourVisualisierungsPanel({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [fahrer, setFahrer] = useState<FahrerScore[]>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`);
        if (r.ok && !cancelled) {
          const j = await r.json();
          const liste: FahrerScore[] = j.fahrer ?? [];
          if (liste.length > 0) setFahrer(liste);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const avg = fahrer.length > 0
    ? Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length)
    : 0;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Score &amp; Tour-Visualisierung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-black', scoreColor(avg))}>Ø {avg}</span>
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {fahrer.map((f) => {
            const pct = f.stopps_gesamt > 0
              ? Math.round((f.stopps_erledigt / f.stopps_gesamt) * 100)
              : 0;
            return (
              <div key={f.fahrer_id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-saffron/20 flex items-center justify-center">
                      <span className="text-[10px] font-black text-saffron">
                        {f.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {f.aktive_tour ? 'Tour aktiv' : 'Abgeschlossen'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-lg font-black', scoreColor(f.score))}>{f.score}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">Score</div>
                  </div>
                </div>

                {/* Tour-Stopp-Visualisierung */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {f.stopps_erledigt}/{f.stopps_gesamt} Stopps
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor(f.score))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {/* Stopp-Punkte */}
                  <div className="flex items-center gap-1 pt-0.5">
                    {Array.from({ length: f.stopps_gesamt }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-2.5 w-2.5 rounded-full border',
                          i < f.stopps_erledigt
                            ? 'bg-green-500 border-green-600'
                            : 'bg-muted border-border',
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
