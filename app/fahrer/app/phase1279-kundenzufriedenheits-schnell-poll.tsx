'use client';

// Phase 1279 — Kunden-Zufriedenheits-Schnell-Poll (Fahrer-App)
// Nach jeder Lieferung: "War der Kunde zufrieden?" Daumen oben/unten + optionaler Kommentar
// POST /api/delivery/driver/kundenzufriedenheit · isOnline-Guard

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  isOnline: boolean;
  orderId?: string;
  locationId?: string;
}

type Rating = 'positiv' | 'negativ' | null;

export function FahrerPhase1279KundenzufriedenheitsSchnellPoll({ driverId, isOnline, orderId, locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [rating, setRating] = useState<Rating>(null);
  const [kommentar, setKommentar] = useState('');
  const [showKommentar, setShowKommentar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOnline) return null;

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/kundenzufriedenheit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          location_id: locationId ?? '',
          order_id: orderId,
          rating,
          kommentar: kommentar.trim() || undefined,
        }),
      });
    } catch {
      // best-effort
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  function reset() {
    setRating(null);
    setKommentar('');
    setShowKommentar(false);
    setSubmitted(false);
  }

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-4 w-4" />
          <span className="font-semibold text-sm">Kundenzufriedenheits-Poll</span>
          {submitted && (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">Abgesendet ✓</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Danke für dein Feedback!</p>
              <button
                onClick={reset}
                className="mt-1 text-xs text-sky-600 dark:text-sky-400 underline"
              >
                Weiteres Feedback senden
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium text-center">
                War der Kunde zufrieden?
              </p>

              {/* Thumbs */}
              <div className="flex justify-center gap-6">
                <button
                  onClick={() => setRating('positiv')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl px-6 py-4 border-2 transition-all',
                    rating === 'positiv'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 scale-105'
                      : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-emerald-300 hover:text-emerald-500',
                  )}
                >
                  <ThumbsUp className="h-8 w-8" />
                  <span className="text-xs font-semibold">Ja</span>
                </button>

                <button
                  onClick={() => setRating('negativ')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl px-6 py-4 border-2 transition-all',
                    rating === 'negativ'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 scale-105'
                      : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-red-300 hover:text-red-500',
                  )}
                >
                  <ThumbsDown className="h-8 w-8" />
                  <span className="text-xs font-semibold">Nein</span>
                </button>
              </div>

              {/* Optional comment */}
              {rating && (
                <div className="space-y-2">
                  <button
                    className="text-xs text-sky-600 dark:text-sky-400 underline w-full text-center"
                    onClick={() => setShowKommentar(v => !v)}
                  >
                    {showKommentar ? 'Kommentar ausblenden' : '+ Kommentar hinzufügen (optional)'}
                  </button>
                  {showKommentar && (
                    <textarea
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-sky-400"
                      rows={2}
                      placeholder="Optionaler Kommentar..."
                      value={kommentar}
                      onChange={e => setKommentar(e.target.value.slice(0, 200))}
                    />
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all',
                      'bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-60',
                    )}
                  >
                    {submitting ? (
                      <span className="animate-pulse">Wird gesendet...</span>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Absenden
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
