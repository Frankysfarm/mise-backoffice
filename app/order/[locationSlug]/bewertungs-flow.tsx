'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Loader2, MessageSquare, Send, Star, ThumbsUp, X,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────── */

type RatingStep = 'rating' | 'comment' | 'submitted' | 'dismissed';

interface Props {
  orderId: string;
  bestellnummer: string;
  onDismiss?: () => void;
}

/* ── Component ──────────────────────────────────────────────────── */

export function BewertungsFlow({ orderId, bestellnummer, onDismiss }: Props) {
  const [step, setStep] = useState<RatingStep>('rating');
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in after a short delay
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    setStep('dismissed');
    setTimeout(() => onDismiss?.(), 300);
  }, [onDismiss]);

  const submitRating = useCallback(async () => {
    if (stars === 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/delivery/orders/${orderId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, comment: comment.trim() || null }),
      });
    } catch { /* silent */ }
    setSubmitting(false);
    setStep('submitted');
    setTimeout(() => onDismiss?.(), 3000);
  }, [orderId, stars, comment, onDismiss]);

  if (step === 'dismissed') return null;

  const quickLabels: Record<number, string> = {
    1: 'Sehr schlecht', 2: 'Schlecht', 3: 'Okay', 4: 'Gut', 5: 'Ausgezeichnet',
  };

  return (
    <div className={cn(
      'rounded-2xl border border-matcha-200 bg-white shadow-lg overflow-hidden transition-all duration-500',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
    )}>
      {/* Delivered banner */}
      <div className="flex items-center gap-2 bg-matcha-600 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-white" />
        <span className="text-xs font-bold text-white">Bestellung {bestellnummer} zugestellt!</span>
        <button onClick={dismiss} className="ml-auto text-white/70 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 'rating' && (
        <div className="px-4 py-5 text-center">
          <div className="text-sm font-bold mb-1">Wie war Ihre Lieferung?</div>
          <div className="text-xs text-muted-foreground mb-4">Ihre Bewertung hilft uns, besser zu werden</div>

          {/* Stars */}
          <div className="flex justify-center gap-1.5 mb-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setStars(s)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={cn(
                    'h-8 w-8 transition-colors',
                    (hovered || stars) >= s
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-200 fill-gray-200',
                  )}
                />
              </button>
            ))}
          </div>

          {/* Label */}
          {(hovered > 0 || stars > 0) && (
            <div className="text-xs font-medium text-amber-600 mb-4">
              {quickLabels[hovered || stars]}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={dismiss}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Überspringen
            </button>
            <button
              onClick={() => stars > 0 ? (stars <= 3 ? setStep('comment') : submitRating()) : undefined}
              disabled={stars === 0}
              className={cn(
                'flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors',
                stars > 0
                  ? 'bg-matcha-600 text-white hover:bg-matcha-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              )}
            >
              {stars > 3 ? 'Absenden' : stars > 0 ? 'Weiter' : 'Bewerten'}
            </button>
          </div>
        </div>
      )}

      {step === 'comment' && (
        <div className="px-4 py-5">
          <div className="flex items-center gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn('h-5 w-5', stars >= s ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200')}
              />
            ))}
            <span className="ml-1 text-xs text-muted-foreground">{quickLabels[stars]}</span>
          </div>

          <div className="text-xs font-medium mb-2">Was können wir verbessern?</div>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-300" />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ihr Feedback (optional)…"
              rows={3}
              maxLength={300}
              className="w-full rounded-xl border border-border pl-9 pr-3 py-2.5 text-xs resize-none outline-none focus:border-matcha-400 focus:ring-1 focus:ring-matcha-400/30"
            />
          </div>
          <div className="flex justify-end mt-1 text-[10px] text-muted-foreground mb-3">
            {comment.length}/300
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('rating')}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Zurück
            </button>
            <button
              onClick={submitRating}
              disabled={submitting}
              className="flex-1 rounded-xl bg-matcha-600 py-2.5 text-xs font-bold text-white hover:bg-matcha-700 transition-colors flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Absenden
            </button>
          </div>
        </div>
      )}

      {step === 'submitted' && (
        <div className="px-4 py-6 text-center">
          <ThumbsUp className="h-10 w-10 mx-auto mb-2 text-matcha-600" />
          <div className="text-sm font-bold text-matcha-700">Vielen Dank!</div>
          <div className="text-xs text-muted-foreground mt-1">Ihre Bewertung hilft uns, den Service zu verbessern.</div>
          <div className="mt-3 flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn('h-5 w-5 flex-1', stars >= s ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
