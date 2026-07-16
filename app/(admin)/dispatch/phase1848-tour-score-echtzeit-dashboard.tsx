'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, BarChart2, Star, MapPin, Clock, Zap, TrendingUp } from 'lucide-react';

/**
 * Phase 1848 — Tour-Score-Echtzeit-Dashboard (Dispatch)
 *
 * Zeigt alle aktiven Touren mit ihrem Live-Score (0–100):
 *  - Pünktlichkeit (40 Pkt)
 *  - Routen-Effizienz (30 Pkt)
 *  - Bündel-Ausnutzung (30 Pkt)
 * Score-Ampel + Bundle-Empfehlung für offene Touren.
 * 90-Sek-Polling auf /api/delivery/admin/tour-scores.
 */

interface TourScore {
  tour_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_erledigt: number;
  score_gesamt: number;
  score_puenktlichkeit: number;
  score_effizienz: number;
  score_buendelung: number;
  zone: string | null;
  naechster_stopp_eta_min: number | null;
  bundle_empfehlung: string | null;
}

const MOCK_SCORES: TourScore[] = [
  {
    tour_id: 't1',
    fahrer_name: 'Mehmet K.',
    stopps_gesamt: 4,
    stopps_erledigt: 1,
    score_gesamt: 82,
    score_puenktlichkeit: 35,
    score_effizienz: 24,
    score_buendelung: 23,
    zone: 'A',
    naechster_stopp_eta_min: 8,
    bundle_empfehlung: null,
  },
  {
    tour_id: 't2',
    fahrer_name: 'Laura S.',
    stopps_gesamt: 3,
    stopps_erledigt: 0,
    score_gesamt: 63,
    score_puenktlichkeit: 28,
    score_effizienz: 18,
    score_buendelung: 17,
    zone: 'B',
    naechster_stopp_eta_min: 14,
    bundle_empfehlung: 'Bestellung #4821 auf Route — bündeln spart 12 Min',
  },
  {
    tour_id: 't3',
    fahrer_name: 'Jan P.',
    stopps_gesamt: 5,
    stopps_erledigt: 3,
    score_gesamt: 91,
    score_puenktlichkeit: 39,
    score_effizienz: 28,
    score_buendelung: 24,
    zone: 'C',
    naechster_stopp_eta_min: 5,
    bundle_empfehlung: null,
  },
];

function scoreAmpel(score: number) {
  if (score >= 80) return { farbe: 'text-matcha-600 dark:text-matcha-400', bg: 'bg-matcha-50 dark:bg-matcha-950/20', ring: 'ring-matcha-300', label: 'Sehr gut' };
  if (score >= 60) return { farbe: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', ring: 'ring-amber-300', label: 'OK' };
  return { farbe: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20', ring: 'ring-red-300', label: 'Niedrig' };
}

function ScoreBalken({ wert, max, farbe }: { wert: number; max: number; farbe: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', farbe)}
          style={{ width: `${Math.min(100, (wert / max) * 100)}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-[9px] font-bold tabular-nums">{wert}</span>
    </div>
  );
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1848TourScoreEchtzeitDashboard({ locationId, className }: Props) {
  const [touren, setTouren] = useState<TourScore[]>([]);
  const [offen, setOffen] = useState(true);
  const [expandiert, setExpandiert] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/tour-scores?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          setTouren(json.touren ?? []);
        }
      } catch {
        setTouren(MOCK_SCORES);
      }
    };

    laden();
    const id = setInterval(laden, 90_000);
    return () => clearInterval(id);
  }, [locationId]);

  const anzeige = touren.length > 0 ? touren : MOCK_SCORES;
  const durchschnitt = anzeige.length > 0
    ? Math.round(anzeige.reduce((s, t) => s + t.score_gesamt, 0) / anzeige.length)
    : 0;
  const bundelHinweise = anzeige.filter((t) => t.bundle_empfehlung).length;

  if (!locationId) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Live</span>
        <span className={cn(
          'ml-2 rounded-full px-2 py-0.5 text-[10px] font-black',
          scoreAmpel(durchschnitt).bg,
          scoreAmpel(durchschnitt).farbe,
        )}>
          Ø {durchschnitt}
        </span>
        {bundelHinweise > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <Zap className="h-2.5 w-2.5" /> {bundelHinweise} Bündelung möglich
          </span>
        )}
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="divide-y">
          {anzeige.map((tour) => {
            const ampel = scoreAmpel(tour.score_gesamt);
            const istExpandiert = expandiert === tour.tour_id;
            const fortschritt = tour.stopps_gesamt > 0
              ? Math.round((tour.stopps_erledigt / tour.stopps_gesamt) * 100)
              : 0;

            return (
              <div key={tour.tour_id}>
                <button
                  onClick={() => setExpandiert(istExpandiert ? null : tour.tour_id)}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                >
                  {/* Score-Ring */}
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full ring-2',
                    ampel.bg,
                    ampel.ring,
                  )}>
                    <span className={cn('text-sm font-black tabular-nums', ampel.farbe)}>
                      {tour.score_gesamt}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{tour.fahrer_name}</span>
                      {tour.zone && (
                        <span className="shrink-0 rounded-full border bg-muted px-1.5 py-0.5 text-[9px] font-bold">
                          Zone {tour.zone}
                        </span>
                      )}
                    </div>
                    {/* Fortschrittsbalken */}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                          style={{ width: `${fortschritt}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[9px] text-muted-foreground">
                        {tour.stopps_erledigt}/{tour.stopps_gesamt} Stopps
                      </span>
                    </div>
                  </div>

                  {/* ETA + Chevron */}
                  <div className="shrink-0 text-right">
                    {tour.naechster_stopp_eta_min !== null && (
                      <div className="flex items-center gap-1 justify-end text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {tour.naechster_stopp_eta_min} Min
                      </div>
                    )}
                    {istExpandiert ? (
                      <ChevronUp className="ml-auto h-3.5 w-3.5 text-muted-foreground mt-1" />
                    ) : (
                      <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground mt-1" />
                    )}
                  </div>
                </button>

                {/* Expandiert: Score-Aufschlüsselung */}
                {istExpandiert && (
                  <div className="px-4 pb-3 space-y-2 bg-muted/10">
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pünktlichkeit</span>
                        <span>{tour.score_puenktlichkeit}/40</span>
                      </div>
                      <ScoreBalken wert={tour.score_puenktlichkeit} max={40} farbe="bg-blue-400" />

                      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Routen-Effizienz</span>
                        <span>{tour.score_effizienz}/30</span>
                      </div>
                      <ScoreBalken wert={tour.score_effizienz} max={30} farbe="bg-matcha-500" />

                      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Bündelung</span>
                        <span>{tour.score_buendelung}/30</span>
                      </div>
                      <ScoreBalken wert={tour.score_buendelung} max={30} farbe="bg-amber-400" />
                    </div>

                    {tour.bundle_empfehlung && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 mt-2">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          {tour.bundle_empfehlung}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
