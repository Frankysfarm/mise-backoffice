'use client';

import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1087 — Bewertungs-Erinnerung (Storefront)
// After-Delivery-Overlay 2h nach Lieferung mit 1-Klick-Sterne-Bewertung

interface Props {
  orderId: string | null;
  orderedAt?: string | null;
}

// Zeigt Bewertungs-Overlay 2h nach Bestellaufgabe (≈ nach Lieferung + Settle-Zeit)
const DELAY_MS = 2 * 3600_000;

export function Phase1087BewertungsErinnerung({ orderId, orderedAt }: Props) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orderId || dismissed || submitted) return;

    const storageKey = `bewertung_done_${orderId}`;
    if (typeof window !== 'undefined' && localStorage.getItem(storageKey)) return;

    let delay = DELAY_MS;
    if (orderedAt) {
      const elapsed = Date.now() - new Date(orderedAt).getTime();
      delay = Math.max(0, DELAY_MS - elapsed);
    }

    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [orderId, dismissed, submitted, orderedAt]);

  async function submit(stars: number) {
    if (!orderId || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/order/item-bewertung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, stars, type: 'delivery' }),
      });
    } catch {
      // best-effort
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      if (typeof window !== 'undefined') localStorage.setItem(`bewertung_done_${orderId}`, '1');
    }
  }

  function dismiss() {
    setDismissed(true);
    setVisible(false);
  }

  if (!visible || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="relative px-5 pt-5 pb-3 text-center">
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-muted transition"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="text-3xl mb-1">🍽️</div>
          <h3 className="text-base font-bold">Wie war Ihre Lieferung?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ihre Meinung hilft uns und dem Fahrer.</p>
        </div>

        {/* Stars */}
        {!submitted ? (
          <div className="px-5 pb-5 space-y-4">
            <div
              className="flex items-center justify-center gap-2"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onClick={() => { setSelected(s); void submit(s); }}
                  disabled={submitting}
                  className="transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                  aria-label={`${s} Stern${s !== 1 ? 'e' : ''}`}
                >
                  <Star
                    className={cn(
                      'h-9 w-9 transition-colors',
                      (hovered || selected) >= s
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-muted text-muted-foreground/30'
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="text-center text-xs text-muted-foreground min-h-[1rem]">
              {submitting ? 'Wird gespeichert…' : hovered > 0 ? ['', 'Schlecht', 'Ausbaufähig', 'Okay', 'Gut', 'Ausgezeichnet'][hovered] : 'Tippen Sie auf einen Stern'}
            </div>
            <button
              onClick={dismiss}
              className="w-full text-xs text-muted-foreground hover:underline"
            >
              Überspringen
            </button>
          </div>
        ) : (
          <div className="px-5 pb-6 text-center space-y-2">
            <div className="text-2xl">🎉</div>
            <p className="font-bold text-sm">Vielen Dank!</p>
            <p className="text-xs text-muted-foreground">Ihr Feedback wurde gespeichert.</p>
            <button
              onClick={dismiss}
              className="mt-2 w-full rounded-lg bg-matcha-600 text-white text-sm font-bold py-2 hover:bg-matcha-700 transition"
            >
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
