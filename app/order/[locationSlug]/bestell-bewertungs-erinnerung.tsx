'use client';

/**
 * BewertungsErinnerung — Phase 475
 * Zeigt einen persistenten Bewertungs-Prompt 15 Minuten nach Lieferung
 * als Floating-Toast (unten rechts), falls noch nicht bewertet.
 * Speichert Bewertung via POST /api/delivery/customer/rating.
 */

import { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const RATED_KEY = 'mise_order_rated';
const SHOW_AFTER_MS = 15 * 60 * 1000; // 15 Minuten

interface Props {
  orderId: string;
  deliveredAt: string | null; // ISO timestamp when order was delivered
  locationSlug: string;
}

function alreadyRated(orderId: string): boolean {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem(RATED_KEY) ?? '[]');
    return stored.includes(orderId);
  } catch {
    return false;
  }
}

function markRated(orderId: string) {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem(RATED_KEY) ?? '[]');
    if (!stored.includes(orderId)) {
      stored.push(orderId);
      // Keep only last 50
      if (stored.length > 50) stored.splice(0, stored.length - 50);
      localStorage.setItem(RATED_KEY, JSON.stringify(stored));
    }
  } catch {
    // ignore
  }
}

export function BewertungsErinnerung({ orderId, deliveredAt, locationSlug }: Props) {
  const [visible, setVisible] = useState(false);
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId || !deliveredAt) return;
    if (alreadyRated(orderId)) return;

    const deliveredMs = new Date(deliveredAt).getTime();
    const showAt = deliveredMs + SHOW_AFTER_MS;
    const now = Date.now();
    const delay = Math.max(0, showAt - now);

    // Cap at 30 minutes: if delivery was more than 30 min ago, show in 5s
    const actualDelay = delay > 30 * 60 * 1000 ? 5_000 : delay;

    const t = setTimeout(() => setVisible(true), actualDelay);
    return () => clearTimeout(t);
  }, [orderId, deliveredAt]);

  const dismiss = () => {
    setVisible(false);
    markRated(orderId);
  };

  const submit = async () => {
    if (!stars || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/customer/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, stars, source: 'erinnerung', location_slug: locationSlug }),
      });
    } catch {
      // ignore
    }
    markRated(orderId);
    setSubmitted(true);
    setTimeout(() => setVisible(false), 2500);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-matcha-600 to-emerald-600 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-white">Wie war deine Lieferung?</div>
          <div className="text-[10px] text-matcha-100">Dein Feedback hilft uns sehr</div>
        </div>
        <button onClick={dismiss} className="text-white/70 hover:text-white transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        {submitted ? (
          <div className="text-center py-2">
            <div className="text-2xl mb-1">🎉</div>
            <div className="text-sm font-bold text-matcha-700">Danke für dein Feedback!</div>
          </div>
        ) : (
          <>
            {/* Stars */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setStars(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      s <= (hovered || stars) ? 'fill-amber-400 text-amber-400' : 'text-gray-300',
                    )}
                  />
                </button>
              ))}
            </div>

            {stars > 0 && (
              <div className="text-center text-xs text-muted-foreground">
                {['', 'Leider enttäuscht 😔', 'War okay 😐', 'Gut 😊', 'Sehr gut! 👍', 'Ausgezeichnet! 🏆'][stars]}
              </div>
            )}

            <button
              onClick={submit}
              disabled={!stars || submitting}
              className="w-full rounded-xl bg-matcha-600 py-2.5 text-sm font-bold text-white hover:bg-matcha-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {submitting ? 'Wird gesendet…' : 'Bewertung abschicken'}
            </button>

            <button onClick={dismiss} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition">
              Kein Interesse
            </button>
          </>
        )}
      </div>
    </div>
  );
}
