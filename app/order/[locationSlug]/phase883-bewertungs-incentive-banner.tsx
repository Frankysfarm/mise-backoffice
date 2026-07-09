'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, X, Gift, Trophy } from 'lucide-react';

/**
 * phase883 — Bewertungs-Incentive-Banner
 *
 * Gamification-Banner nach Lieferung: Punkte für Bewertung vergeben.
 * Zeigt sich wenn status='geliefert', sessionStorage-Guard pro Order-ID.
 */

interface Props {
  orderId: string | null;
  status: string | null;
}

const PUNKTE_FUER_BEWERTUNG = 50;
const GUARD_KEY = 'mise_bewertung_banner_dismissed';

function getDismissedOrders(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(GUARD_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function dismissOrder(orderId: string) {
  if (typeof window === 'undefined') return;
  try {
    const dismissed = getDismissedOrders();
    dismissed.add(orderId);
    sessionStorage.setItem(GUARD_KEY, JSON.stringify([...dismissed]));
  } catch {
    // ignore
  }
}

export function Phase883BewertungsIncentiveBanner({ orderId, status }: Props) {
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (status !== 'geliefert' || !orderId) {
      setVisible(false);
      return;
    }
    const dismissed = getDismissedOrders();
    if (dismissed.has(orderId)) {
      setVisible(false);
      return;
    }
    // Small delay so confetti plays first
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [status, orderId]);

  const dismiss = () => {
    if (orderId) dismissOrder(orderId);
    setVisible(false);
  };

  const submitRating = (stars: number) => {
    setRating(stars);
    setSubmitted(true);
    if (orderId) dismissOrder(orderId);
    // Auto-hide after 3s
    setTimeout(() => setVisible(false), 3500);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm',
        'animate-in slide-in-from-bottom-4 duration-500',
      )}
    >
      <div className="relative rounded-2xl border border-yellow-300 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 shadow-xl overflow-hidden">
        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-black/10 transition"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Confetti stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500" />

        <div className="px-5 py-4 space-y-3">
          {!submitted ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xl shadow">
                  🎉
                </div>
                <div>
                  <div className="text-sm font-black text-amber-900">Deine Lieferung ist da!</div>
                  <div className="text-[11px] text-amber-700">
                    Bewerte jetzt und erhalte{' '}
                    <span className="font-bold text-orange-600">+{PUNKTE_FUER_BEWERTUNG} Punkte</span>
                  </div>
                </div>
              </div>

              {/* Points badge */}
              <div className="flex items-center gap-2 rounded-xl bg-yellow-100 border border-yellow-200 px-3 py-2">
                <Gift className="h-4 w-4 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Treue-Punkte</div>
                  <div className="text-xs text-amber-700">
                    Bewertung = <span className="font-black text-orange-600">+{PUNKTE_FUER_BEWERTUNG} Punkte</span>
                    <span className="text-[9px] ml-1 text-amber-500">→ einlösbar für Rabatte</span>
                  </div>
                </div>
                <Trophy className="h-5 w-5 text-yellow-500 shrink-0" />
              </div>

              {/* Star rating */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 text-center">
                  Wie war deine Erfahrung?
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => submitRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className="transition-transform hover:scale-125 active:scale-110"
                      aria-label={`${star} Sterne`}
                    >
                      <Star
                        className={cn(
                          'h-8 w-8 transition-colors',
                          (hovered || rating) >= star
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-yellow-200',
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Skip */}
              <button
                onClick={dismiss}
                className="w-full text-center text-[10px] text-amber-500 hover:text-amber-700 transition"
              >
                Später vielleicht
              </button>
            </>
          ) : (
            /* Success state */
            <div className="py-2 text-center space-y-2">
              <div className="text-3xl">⭐</div>
              <div className="text-sm font-black text-amber-900">
                Danke für deine {rating}-Sterne-Bewertung!
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-white shadow">
                <Gift className="h-4 w-4" />
                +{PUNKTE_FUER_BEWERTUNG} Punkte gutgeschrieben!
              </div>
              <div className="text-[10px] text-amber-600">
                Punkte werden bei deiner nächsten Bestellung angezeigt.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
