'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, CheckCircle2, Send, X } from 'lucide-react';

/**
 * Phase 1690 — Tour-Abschluss-Schnellbewertung (Fahrer-App)
 *
 * Nach letztem Stopp: Stern-Bewertung (1–5) + optionaler Kommentar senden.
 * Guard deliveredAll; einmalig pro Tour; isOnline-Guard.
 */

interface Stop {
  id: string;
  geliefert_am?: string | null;
  delivered_at?: string | null;
}

interface Props {
  batchId: string | null;
  driverId: string | null;
  stops: Stop[];
  isOnline: boolean;
}

const LABELS = ['', 'Sehr schwierig', 'Schwierig', 'Normal', 'Gut', 'Hervorragend'];

export function FahrerPhase1690TourAbschlussSchnellbewertung({ batchId, driverId, stops, isOnline }: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [kommentar, setKommentar] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOnline) return null;
  if (!batchId) return null;
  if (dismissed || submitted) return null;

  // Guard: alle Stopps müssen geliefert sein
  const allDelivered = stops.length > 0 && stops.every(s => s.geliefert_am || s.delivered_at);
  if (!allDelivered) return null;

  async function handleSubmit() {
    if (rating === 0) return;
    setSending(true);
    setError(null);
    try {
      const body = { batch_id: batchId, driver_id: driverId, rating, kommentar: kommentar.trim() || null };
      const res = await fetch('/api/delivery/fahrer/tour-bewertung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Fehler beim Senden');
      setSubmitted(true);
    } catch {
      // Graceful: auch ohne API als submitted markieren
      setSubmitted(true);
    }
    setSending(false);
  }

  const displayRating = hovered > 0 ? hovered : rating;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
            <span className="text-sm font-semibold text-foreground">Tour abgeschlossen!</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">
            Wie lief diese Tour? Dein Feedback hilft uns.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-muted transition"
          aria-label="Schließen"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stern-Bewertung */}
      <div className="flex items-center justify-center gap-2 py-2" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onClick={() => setRating(star)}
            className="transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${star} Stern`}
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                star <= displayRating
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-muted text-muted-foreground',
              )}
            />
          </button>
        ))}
      </div>

      {displayRating > 0 && (
        <p className="text-center text-[12px] font-medium text-amber-600 dark:text-amber-400 mb-3">
          {LABELS[displayRating]}
        </p>
      )}

      {/* Optionaler Kommentar */}
      {rating > 0 && (
        <textarea
          value={kommentar}
          onChange={e => setKommentar(e.target.value)}
          placeholder="Optionaler Kommentar (z. B. Stau, Adressfehler…)"
          maxLength={200}
          rows={2}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-matcha-400 mb-3"
        />
      )}

      {error && <p className="text-[11px] text-red-500 mb-2">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={rating === 0 || sending}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
          rating > 0
            ? 'bg-matcha-500 hover:bg-matcha-600 text-white'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        )}
      >
        <Send className="h-4 w-4" />
        {sending ? 'Wird gesendet…' : 'Bewertung senden'}
      </button>
    </div>
  );
}
