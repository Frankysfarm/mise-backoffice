'use client';

/**
 * PostDeliveryRating — Phase 139
 * Vollbild-Overlay direkt nach Zustellung ("geliefert"-Status).
 * Erscheint automatisch sobald der Live-Status auf 'geliefert' springt.
 * Features: Sterne, Quick-Tags, optionaler Kommentar, Teilen-CTA.
 */

import { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_TAGS = [
  { id: 'fast',      emoji: '⚡', label: 'Schnell geliefert' },
  { id: 'friendly',  emoji: '😊', label: 'Freundlicher Fahrer' },
  { id: 'hot',       emoji: '🔥', label: 'Heiß & frisch' },
  { id: 'complete',  emoji: '✅', label: 'Vollständige Bestellung' },
  { id: 'careful',   emoji: '📦', label: 'Sorgfältig verpackt' },
  { id: 'accurate',  emoji: '📍', label: 'Pünktlich wie versprochen' },
];

const STAR_LABELS = ['', 'Leider enttäuscht', 'War okay', 'Zufrieden', 'Sehr gut!', 'Ausgezeichnet! 🏆'];

interface Props {
  orderId: string;
  bestellnummer?: string;
  /** Von außen gesetzt wenn Status auf 'geliefert' wechselt */
  triggered: boolean;
  onDismiss: () => void;
}

export function PostDeliveryRating({ orderId, bestellnummer, triggered, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'rating' | 'comment' | 'done'>('rating');
  const [stars, setStars] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (triggered) {
      // Kleine Verzögerung damit der Status-Wechsel zuerst sichtbar ist
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, [triggered]);

  if (!visible) return null;

  function toggleTag(id: string) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!stars) return;
    setSubmitting(true);
    setError(null);

    try {
      // Token für diese Bestellung holen
      const tokenRes = await fetch(`/api/delivery/orders/${orderId}/rate`);
      let token: string | undefined;
      if (tokenRes.ok) {
        const td = await tokenRes.json() as { token?: string };
        token = td.token;
      }

      if (!token) {
        setError('Bewertung konnte nicht gesendet werden.');
        setSubmitting(false);
        return;
      }

      const tagComment = Array.from(tags).map((id) => QUICK_TAGS.find((t) => t.id === id)?.label ?? '').filter(Boolean).join(', ');
      const fullComment = [tagComment, comment.trim()].filter(Boolean).join(' · ') || undefined;

      const res = await fetch(`/api/delivery/orders/${orderId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating: stars, comment: fullComment }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        setStep('done');
      } else {
        setError(data.error ?? 'Fehler beim Senden');
      }
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }

  function dismiss() {
    setVisible(false);
    onDismiss();
  }

  const displayStar = hoverStar || stars;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        {/* Griff-Bar (mobile) */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Close-Button */}
        <div className="flex justify-end px-4 pt-3 sm:pt-4 pb-0">
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-full hover:bg-gray-100 transition text-gray-400"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-7 pt-1">
          {step === 'done' ? (
            /* ── Danke-Screen ─────────────────────────────────────────── */
            <div className="text-center py-4">
              <div className="text-6xl mb-3 animate-in zoom-in-75 duration-500">🎉</div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Danke für dein Feedback!</h2>
              <p className="text-sm text-gray-500 mb-5">
                Deine Bewertung hilft uns, die Lieferung zu verbessern.
              </p>
              <div className="flex justify-center gap-1 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn('h-7 w-7', s <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-200')}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="w-full rounded-2xl bg-gray-900 text-white font-bold py-3 text-sm transition hover:bg-gray-700"
              >
                Schließen
              </button>
            </div>
          ) : step === 'comment' ? (
            /* ── Kommentar-Screen ─────────────────────────────────────── */
            <div>
              <div className="text-center mb-4">
                <div className="flex justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn('h-6 w-6', s <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-200')}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500">Optionaler Kommentar</p>
              </div>

              {/* Quick-Tags */}
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {QUICK_TAGS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition',
                      tags.has(t.id)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
                    )}
                  >
                    <span>{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Weitere Anmerkungen…"
                rows={3}
                maxLength={400}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 mb-4"
              />

              {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('rating')}
                  className="flex-1 rounded-2xl border border-gray-200 text-gray-600 font-semibold py-3 text-sm hover:bg-gray-50 transition"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-[2] rounded-2xl bg-gray-900 text-white font-bold py-3 text-sm transition hover:bg-gray-700 disabled:opacity-60"
                >
                  {submitting ? 'Senden…' : 'Absenden'}
                </button>
              </div>
            </div>
          ) : (
            /* ── Stern-Auswahl ────────────────────────────────────────── */
            <div>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🛵</div>
                <h2 className="text-xl font-black text-gray-900">Wie war deine Lieferung?</h2>
                {bestellnummer && (
                  <p className="text-xs text-gray-400 mt-1">Bestellung #{bestellnummer}</p>
                )}
              </div>

              {/* Sterne */}
              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStars(s)}
                    onMouseEnter={() => setHoverStar(s)}
                    onMouseLeave={() => setHoverStar(0)}
                    className="transition-transform hover:scale-125 active:scale-110 focus:outline-none"
                    aria-label={`${s} Stern${s !== 1 ? 'e' : ''}`}
                  >
                    <Star
                      className={cn(
                        'h-10 w-10 transition-colors',
                        s <= displayStar ? 'fill-amber-400 text-amber-400' : 'text-gray-200',
                      )}
                    />
                  </button>
                ))}
              </div>

              {/* Star-Label */}
              <p className={cn('text-center text-sm font-semibold h-5 mb-5', displayStar ? 'text-gray-700' : 'text-transparent')}>
                {STAR_LABELS[displayStar]}
              </p>

              <button
                type="button"
                onClick={() => { if (stars > 0) setStep('comment'); }}
                disabled={stars === 0}
                className="w-full rounded-2xl bg-gray-900 text-white font-bold py-3 text-sm transition hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Weiter
              </button>

              {stars === 0 && (
                <p className="text-center text-xs text-gray-400 mt-2">Wähle zuerst eine Bewertung</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
