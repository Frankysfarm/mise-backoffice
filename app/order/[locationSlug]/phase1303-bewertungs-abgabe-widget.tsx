/**
 * Phase 1303 — Bewertungs-Abgabe-Widget (Storefront)
 * Nach Bestellabschluss: Inline-Sterne-Bewertung (1–5) + optionaler Kommentar
 * + POST /api/delivery/customer/bewertung-abgeben.
 * Integration: storefront.tsx nach Phase1280.
 */
'use client';

import { useState } from 'react';
import { Star, Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  locationId: string;
}

type State = 'idle' | 'submitting' | 'done' | 'error';

export function Phase1303BewertungsAbgabeWidget({ orderId, locationId }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [kommentar, setKommentar] = useState('');
  const [state, setState] = useState<State>('idle');

  const displayRating = hovered ?? rating ?? 0;

  async function submit() {
    if (!rating || state === 'submitting') return;
    setState('submitting');
    try {
      await fetch('/api/delivery/customer/bewertung-abgeben', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, location_id: locationId, rating, kommentar: kommentar || undefined }),
      });
      setState('done');
    } catch {
      setState('done');
    }
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 px-4 py-3 text-emerald-700 dark:text-emerald-300">
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">Danke für deine Bewertung!</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card px-4 py-4">
      <p className="text-sm font-bold mb-2 text-center">Wie war deine Lieferung?</p>

      {/* Sterne */}
      <div className="flex justify-center gap-1.5 mb-3" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovered(n)}
            aria-label={`${n} Stern${n > 1 ? 'e' : ''}`}
            className="focus:outline-none"
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                n <= displayRating ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-muted-foreground/40'
              )}
            />
          </button>
        ))}
      </div>

      {/* Kommentar */}
      {rating !== null && (
        <textarea
          value={kommentar}
          onChange={e => setKommentar(e.target.value)}
          placeholder="Optionaler Kommentar…"
          rows={2}
          maxLength={300}
          className="w-full rounded-xl border bg-muted/40 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring mb-3"
        />
      )}

      <button
        type="button"
        disabled={!rating || state === 'submitting'}
        onClick={submit}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold hover:opacity-90 active:opacity-80 transition disabled:opacity-40"
      >
        <Send className="h-4 w-4" />
        {state === 'submitting' ? 'Wird gesendet…' : 'Bewertung abgeben'}
      </button>
    </div>
  );
}
