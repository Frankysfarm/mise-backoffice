'use client';

import { useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface TourCompletionForecast {
  tourId: string;
  driverName: string;
  zone: string | null;
  stopsCompleted: number;
  stopsTotal: number;
  elapsedMin: number;
  avgMinPerStop: number | null;
  forecastCompleteAt: string | null;
  forecastRemainingMin: number | null;
  confidenceLevel: ConfidenceLevel;
  progressPct: number;
}

interface TourForecastSummary {
  activeTours: number;
  avgRemainingMin: number | null;
  soonestCompleteAt: string | null;
  latestCompleteAt: string | null;
}

interface ApiResponse {
  ok: boolean;
  tours: TourCompletionForecast[];
  summary: TourForecastSummary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const confidenceStyle: Record<ConfidenceLevel, { badge: string; label: string }> = {
  high:   { badge: 'bg-matcha-100 text-matcha-700',  label: 'Sicher' },
  medium: { badge: 'bg-amber-100 text-amber-700',    label: 'Mittel' },
  low:    { badge: 'bg-slate-100 text-slate-600',    label: 'Schätzung' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function progressColor(pct: number): string {
  if (pct >= 75) return 'bg-matcha-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-blue-400';
}

export function DispatchTourCompletionForecast({ locationId }: Props) {
  const [tours, setTours] = useState<TourCompletionForecast[]>([]);
  const [summary, setSummary] = useState<TourForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/tour-completion-forecast?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setTours(d.tours ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const hasTours = tours.length > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Timer className={cn('h-4 w-4', hasTours ? 'text-indigo-600' : 'text-muted-foreground')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Abschluss-Prognose
          </span>
          {summary && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              {summary.activeTours} aktiv
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Touren…
            </div>
          )}

          {!loading && summary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-center">
                <div className="text-2xl font-black tabular-nums text-indigo-700">{summary.activeTours}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mt-0.5">Aktive Touren</div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-center">
                <div className="text-2xl font-black tabular-nums text-amber-700">
                  {summary.avgRemainingMin !== null ? `${summary.avgRemainingMin}` : '—'}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-500 mt-0.5">Ø Verbleibend (Min)</div>
              </div>
              <div className="rounded-lg bg-matcha-50 border border-matcha-100 px-3 py-2 text-center">
                <div className="text-lg font-black tabular-nums text-matcha-700">
                  {summary.soonestCompleteAt ? formatTime(summary.soonestCompleteAt) : '—'}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-matcha-500 mt-0.5">Erste Rückkehr</div>
              </div>
            </div>
          )}

          {!loading && !hasTours && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <CheckCircle className="h-4 w-4 text-matcha-500" />
              Keine aktiven Touren gerade.
            </div>
          )}

          {!loading && hasTours && (
            <div className="space-y-2">
              {tours
                .slice()
                .sort((a, b) => (a.forecastRemainingMin ?? 999) - (b.forecastRemainingMin ?? 999))
                .map((tour) => {
                  const conf = confidenceStyle[tour.confidenceLevel];
                  const remainColor =
                    tour.forecastRemainingMin !== null && tour.forecastRemainingMin <= 10
                      ? 'text-matcha-600 font-black'
                      : tour.forecastRemainingMin !== null && tour.forecastRemainingMin <= 20
                      ? 'text-amber-600 font-bold'
                      : 'text-foreground font-bold';

                  return (
                    <div
                      key={tour.tourId}
                      className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                    >
                      {tour.stopsCompleted === tour.stopsTotal && tour.stopsTotal > 0 ? (
                        <CheckCircle className="h-4 w-4 text-matcha-500 mt-0.5 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                      )}

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold truncate">{tour.driverName}</span>
                          {tour.zone && (
                            <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                              Zone {tour.zone}
                            </span>
                          )}
                          <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', conf.badge)}>
                            {conf.label}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all duration-700', progressColor(tour.progressPct))}
                              style={{ width: `${tour.progressPct}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                            {tour.stopsCompleted}/{tour.stopsTotal} Stopps
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{tour.elapsedMin} Min vergangen</span>
                          {tour.avgMinPerStop !== null && (
                            <span>Ø {tour.avgMinPerStop} Min/Stopp</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {tour.forecastRemainingMin !== null ? (
                          <>
                            <div className={cn('text-sm tabular-nums', remainColor)}>
                              {tour.forecastRemainingMin === 0
                                ? 'Fertig'
                                : `${tour.forecastRemainingMin} Min`}
                            </div>
                            {tour.forecastCompleteAt && tour.forecastRemainingMin > 0 && (
                              <div className="text-[9px] text-muted-foreground tabular-nums">
                                ~{formatTime(tour.forecastCompleteAt)}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5 inline" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {!locationId && (
            <div className="text-sm text-muted-foreground">Bitte Filiale auswählen.</div>
          )}
        </div>
      )}
    </div>
  );
}
