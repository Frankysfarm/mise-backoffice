'use client';

/**
 * BewertungsWidgetStorefront — Phase 483
 * Inline 5-Sterne-Bewertungs-Widget für die Bestellbestätigung (Storefront).
 * Erscheint nach Lieferung (prop: triggered=true) mit animierter Danke-Bestätigung.
 * Nutzt POST /api/delivery/customer/rating (Phase 478 API).
 */

import { useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_TAGS = [
  { id: 'fast',     emoji: '⚡', label: 'Schnell' },
  { id: 'hot',      emoji: '🔥', label: 'Heiß & frisch' },
  { id: 'friendly', emoji: '😊', label: 'Freundlich' },
  { id: 'complete', emoji: '✅', label: 'Vollständig' },
];

const STAR_LABELS = ['', 'Leider enttäuscht', 'War okay', 'Zufrieden', 'Sehr gut!', 'Ausgezeichnet! 🏆'];

interface Props {
  orderId: string;
  ratingToken?: string | null;
  /** Startet das Widget — zeige nach Lieferungsbestätigung */
  triggered?: boolean;
  className?: string;
}

export function BewertungsWidgetStorefront({ orderId, ratingToken, triggered = true, className }: Props) {
  const [stars, setStars]       = useState(0);
  const [hover, setHover]       = useState(0);
  const [tags, setTags]         = useState<Set<string>>(new Set());
  const [submitting, setSub]    = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  if (!triggered) return null;

  function toggleTag(id: string) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!stars || submitting) return;
    setSub(true);
    setError(null);

    try {
      const res = await fetch('/api/delivery/customer/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id:     orderId,
          stars,
          comment:      tags.size > 0 ? [...tags].join(', ') : null,
          rating_token: ratingToken ?? null,
          source:       'storefront_widget',
        }),
      });

      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? 'Fehler beim Senden');
        setSub(false);
        return;
      }

      setDone(true);
    } catch {
      setError('Verbindungsfehler – bitte erneut versuchen.');
      setSub(false);
    }
  }

  if (done) {
    return (
      <div className={cn(
        'rounded-2xl border border-matcha-200 bg-matcha-50 px-5 py-6 text-center animate-in fade-in zoom-in-95 duration-300',
        className,
      )}>
        <CheckCircle2 className="mx-auto h-10 w-10 text-matcha-500 mb-3" />
        <p className="text-base font-bold text-matcha-800">Danke für dein Feedback! 🙏</p>
        <p className="mt-1 text-sm text-matcha-600">Deine Bewertung hilft uns, noch besser zu werden.</p>
      </div>
    );
  }

  const displayed = hover || stars;

  return (
    <div className={cn(
      'rounded-2xl border border-border bg-card px-5 py-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
      className,
    )}>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Wie war deine Lieferung?</p>
        {displayed > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground transition-all">{STAR_LABELS[displayed]}</p>
        )}
      </div>

      {/* Stars */}
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
            aria-label={`${n} Stern${n > 1 ? 'e' : ''}`}
            className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                n <= (hover || stars) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
              )}
            />
          </button>
        ))}
      </div>

      {/* Quick tags — only show if star selected */}
      {stars > 0 && (
        <div className="flex flex-wrap justify-center gap-2 animate-in fade-in duration-200">
          {QUICK_TAGS.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleTag(t.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                tags.has(t.id)
                  ? 'border-matcha-400 bg-matcha-100 text-matcha-800'
                  : 'border-border bg-muted/50 text-muted-foreground hover:border-matcha-300',
              )}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-center text-xs text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={!stars || submitting}
        className={cn(
          'w-full rounded-xl py-2.5 text-sm font-bold transition-all',
          stars && !submitting
            ? 'bg-matcha-500 text-white hover:bg-matcha-600 active:scale-[0.98]'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        )}
      >
        {submitting ? 'Sende…' : 'Bewertung abgeben'}
      </button>
    </div>
  );
}
