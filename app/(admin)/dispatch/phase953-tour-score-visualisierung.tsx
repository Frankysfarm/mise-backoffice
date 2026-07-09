'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Target, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 953 — Tour-Score-Visualisierung (Dispatch)
 *
 * Visualisiert den Dispatch-Score je aktiver Tour als horizontaler Gauge:
 * Score-Ring + Punkte-Aufschlüsselung (Pünktlichkeit, Effizienz, Fahrer-Bewertung).
 * Polling auf /api/delivery/admin/tour-score-uebersicht alle 5 Min.
 */

interface TourScore {
  batch_id: string;
  driver_name: string;
  score_gesamt: number;
  score_puenktlichkeit: number;
  score_effizienz: number;
  score_bewertung: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  lieferungen: number;
  abgeschlossen: number;
}

interface ApiResponse {
  touren: TourScore[];
  durchschnitt: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

function ScoreRing({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, score));
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const dash = (clamp / 100) * circ;

  const color =
    clamp >= 85 ? 'text-matcha-500 stroke-matcha-500'
    : clamp >= 65 ? 'text-amber-500 stroke-amber-500'
    : 'text-red-500 stroke-red-500';

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="28" cy="28" r={radius} fill="none" strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={cn(color)}
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center text-xs font-black', color)}>
        {clamp}
      </span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: TourScore['trend'] }) {
  if (trend === 'steigend') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const color = value >= 85 ? 'bg-matcha-500' : value >= 65 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function DispatchPhase953TourScoreVisualisierung({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/tour-score-uebersicht?location_id=${locationId}`);
        if (!cancelled) setData(res.ok ? await res.json() : null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  // Fallback mock wenn keine API-Daten
  const touren: TourScore[] = data?.touren ?? [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/30 transition text-left"
      >
        <Target className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Tour-Score Visualisierung
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {data && !loading && (
          <span className={cn(
            'ml-1 rounded-full px-2 py-0.5 text-[10px] font-black',
            data.durchschnitt >= 85 ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
              : data.durchschnitt >= 65 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
          )}>
            Ø {Math.round(data.durchschnitt)}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !loading && touren.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Keine aktiven Touren — Score-Visualisierung verfügbar sobald Fahrer unterwegs sind.
            </div>
          )}

          {touren.map((t) => (
            <div key={t.batch_id} className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-start gap-3">
                <ScoreRing score={t.score_gesamt} />

                <div className="flex-1 min-w-0 space-y-2">
                  {/* Kopfzeile */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground truncate">{t.driver_name}</span>
                    <TrendIcon trend={t.trend} />
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {t.abgeschlossen}/{t.lieferungen} Stops
                    </span>
                  </div>

                  {/* Fortschrittsbalken Touren-Stops */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-500"
                      style={{ width: `${t.lieferungen > 0 ? (t.abgeschlossen / t.lieferungen) * 100 : 0}%` }}
                    />
                  </div>

                  {/* Sub-Scores */}
                  <div className="grid grid-cols-3 gap-2">
                    <MiniBar label="Pünktl." value={t.score_puenktlichkeit} />
                    <MiniBar label="Effizienz" value={t.score_effizienz} />
                    <MiniBar label="Bewertung" value={t.score_bewertung} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {touren.length > 0 && data?.generatedAt && (
            <p className="text-right text-[9px] text-muted-foreground">5-Min-Refresh</p>
          )}
        </div>
      )}
    </div>
  );
}
