'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Star, CheckCircle2, X } from 'lucide-react';

/**
 * Phase 1022 — Bewertungs-Schnell-Widget (Storefront)
 *
 * Kompakte 1-5-Sterne-Bewertung direkt nach Lieferung.
 * Erscheint 2 Min nach status=geliefert, kann weggeklickt werden.
 * Kein API-Aufruf notwendig (nur lokal persistiert).
 * Props: orderId, status, deliveredAt.
 */

interface Props {
  orderId: string | null;
  status: string | null;
  className?: string;
}

const REASONS = ['Schnell', 'Freundlicher Fahrer', 'Heiß geliefert', 'Alles komplett'];

export function Phase1022BewertungsSchnellWidget({ orderId, status, className }: Props) {
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status !== 'geliefert' && status !== 'delivered') return;
    if (!orderId) return;
    // Check if already rated for this order
    const key = `bewertung_${orderId}`;
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return;
    // Show 2 minutes after delivery
    const timer = setTimeout(() => setVisible(true), 2 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [status, orderId]);

  if (!visible || dismissed || submitted) return null;

  function toggleReason(r: string) {
    setSelectedReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  function handleSubmit() {
    if (rating === 0) return;
    if (orderId && typeof window !== 'undefined') {
      localStorage.setItem(`bewertung_${orderId}`, String(rating));
    }
    // Fire-and-forget feedback submission (best-effort)
    fetch('/api/delivery/driver/bewertung', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, rating, reasons: selectedReasons }),
    }).catch(() => {});
    setSubmitted(true);
    setTimeout(() => setVisible(false), 3000);
  }

  if (submitted) {
    return (
      <div className={cn('rounded-2xl border bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700 px-4 py-5 text-center', className)}>
        <CheckCircle2 className="h-8 w-8 text-matcha-500 mx-auto mb-2" />
        <div className="text-base font-black text-matcha-700 dark:text-matcha-300">Danke für dein Feedback!</div>
        <div className="text-sm text-muted-foreground mt-0.5">Wir arbeiten ständig an uns.</div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border bg-card shadow-md overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
        <div className="text-sm font-bold">Wie war deine Lieferung?</div>
        <button onClick={() => setDismissed(true)} className="p-0.5 rounded hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Sterne */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  'h-9 w-9 transition-colors',
                  (hover || rating) >= n
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/40',
                )}
              />
            </button>
          ))}
        </div>

        {/* Schnell-Gründe (nur bei ≥4 Sternen) */}
        {rating >= 4 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {REASONS.map(r => (
              <button
                key={r}
                onClick={() => toggleReason(r)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition',
                  selectedReasons.includes(r)
                    ? 'bg-matcha-100 border-matcha-400 text-matcha-700 dark:bg-matcha-900/30 dark:border-matcha-600 dark:text-matcha-300'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Absenden */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className={cn(
            'w-full rounded-xl py-2.5 text-sm font-bold transition',
            rating > 0
              ? 'bg-matcha-600 hover:bg-matcha-700 text-white'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          Bewertung abgeben
        </button>
      </div>
    </div>
  );
}
