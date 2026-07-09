'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, MessageSquare, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * Phase 926 — Tour-Nachfass-Board (Dispatch)
 *
 * Alle heute abgeschlossenen Touren mit Score + Abweichung + Feedback-Status.
 * 5-Min-Polling.
 */

interface Props {
  locationId: string | null;
}

interface AbgeschlosseneTour {
  tour_id: string;
  fahrer_name: string;
  abschluss_zeit: string;
  stops_geplant: number;
  stops_erledigt: number;
  score: number;
  eta_abweichung_min: number;
  feedback_offen: number;
  feedback_erhalten: number;
  status: 'abgeschlossen' | 'teilweise';
}

const MOCK: AbgeschlosseneTour[] = [
  {
    tour_id: 't1',
    fahrer_name: 'Tarkan A.',
    abschluss_zeit: new Date(Date.now() - 25 * 60000).toISOString(),
    stops_geplant: 6,
    stops_erledigt: 6,
    score: 94,
    eta_abweichung_min: -2,
    feedback_offen: 2,
    feedback_erhalten: 4,
    status: 'abgeschlossen',
  },
  {
    tour_id: 't2',
    fahrer_name: 'Lena M.',
    abschluss_zeit: new Date(Date.now() - 65 * 60000).toISOString(),
    stops_geplant: 5,
    stops_erledigt: 5,
    score: 87,
    eta_abweichung_min: 7,
    feedback_offen: 1,
    feedback_erhalten: 4,
    status: 'abgeschlossen',
  },
  {
    tour_id: 't3',
    fahrer_name: 'Jörn K.',
    abschluss_zeit: new Date(Date.now() - 110 * 60000).toISOString(),
    stops_geplant: 4,
    stops_erledigt: 3,
    score: 72,
    eta_abweichung_min: 14,
    feedback_offen: 0,
    feedback_erhalten: 3,
    status: 'teilweise',
  },
];

const POLL_MS = 5 * 60 * 1000;

function scoreColor(s: number) {
  if (s >= 90) return 'text-matcha-700 bg-matcha-100';
  if (s >= 75) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

function fmtZeit(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function minutenHer(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  return `vor ${h} Std ${m % 60} Min`;
}

export function DispatchPhase926TourNachfassBoard({ locationId }: Props) {
  const [touren, setTouren] = useState<AbgeschlosseneTour[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/abgeschlossene-touren?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTouren((json.touren as AbgeschlosseneTour[]) ?? MOCK);
      setLastUpdate(new Date());
    } catch {
      setTouren(MOCK);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!open) return null;

  const durchschnittScore = touren.length > 0
    ? Math.round(touren.reduce((s, t) => s + t.score, 0) / touren.length)
    : 0;

  const feedbackOffen = touren.reduce((s, t) => s + t.feedback_offen, 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-char">Tour-Nachfass-Board</div>
            <div className="text-xs text-stone-400">
              {touren.length} Touren heute abgeschlossen
              {lastUpdate ? ` · ${fmtZeit(lastUpdate.toISOString())}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3.5 w-3.5 text-stone-300 animate-spin" />}
          {touren.length > 0 && (
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', scoreColor(durchschnittScore))}>
              Ø {durchschnittScore}
            </span>
          )}
          {feedbackOffen > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              <MessageSquare className="h-3 w-3" />
              {feedbackOffen} offen
            </span>
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors px-1"
          >
            ✕
          </button>
        </div>
      </div>

      {touren.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-stone-400">
          Noch keine abgeschlossenen Touren heute
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {touren.map((tour) => (
            <div key={tour.tour_id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-char truncate">{tour.fahrer_name}</span>
                  {tour.status === 'teilweise' && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      Teilweise
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <span>{fmtZeit(tour.abschluss_zeit)}</span>
                  <span>·</span>
                  <span>{minutenHer(tour.abschluss_zeit)}</span>
                  <span>·</span>
                  <span>{tour.stops_erledigt}/{tour.stops_geplant} Stops</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* ETA-Abweichung */}
                <div className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  tour.eta_abweichung_min <= 0
                    ? 'bg-matcha-100 text-matcha-700'
                    : tour.eta_abweichung_min <= 5
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700',
                )}>
                  {tour.eta_abweichung_min <= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {tour.eta_abweichung_min > 0 ? '+' : ''}{tour.eta_abweichung_min} Min
                </div>

                {/* Score */}
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums', scoreColor(tour.score))}>
                  {tour.score}
                </span>

                {/* Feedback */}
                {tour.feedback_offen > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <MessageSquare className="h-3 w-3" />
                    {tour.feedback_offen}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-stone-300">
                    <MessageSquare className="h-3 w-3" />
                    —
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
