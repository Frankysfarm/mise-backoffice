'use client';

/**
 * FahrerBewertungsDialog — Phase 201
 * Fahrer-spezifisches Bewertungsdialog im Storefront nach Zustellung.
 * Erscheint 5s nach Statuswechsel auf "geliefert", zeigt Fahrername,
 * 5-Sterne-Skala + 3 schnelle Fahrer-Eigenschaften.
 * Sendet rating über POST /api/delivery/orders/[orderId]/rate mit driverRating-Tag.
 */

import { useState, useEffect, useCallback } from 'react';
import { Star, X, ThumbsUp, CheckCircle2, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

const DRIVER_TAGS = [
  { id: 'schnell',      emoji: '⚡', label: 'Superschnell' },
  { id: 'freundlich',   emoji: '😊', label: 'Freundlich' },
  { id: 'sorgfältig',  emoji: '📦', label: 'Sorgfältig' },
  { id: 'pünktlich',   emoji: '⏱️', label: 'Pünktlich' },
  { id: 'kommunikativ', emoji: '💬', label: 'Gute Kommunikation' },
];

interface Props {
  orderId: string;
  driverName: string | null;
  triggered: boolean;
  onDismiss: () => void;
}

export function FahrerBewertungsDialog({ orderId, driverName, triggered, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'rate' | 'tags' | 'done'>('rate');
  const [stars, setStars] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!triggered) return;
    const t = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(t);
  }, [triggered]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  function toggleTag(id: string) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!stars) return;
    setSubmitting(true);
    try {
      // Hol Rating-Token
      const tokenRes = await fetch(`/api/delivery/orders/${orderId}/rate`);
      if (!tokenRes.ok) { setStep('done'); return; }
      const { token } = await tokenRes.json() as { token?: string };
      if (!token) { setStep('done'); return; }

      await fetch(`/api/delivery/orders/${orderId}/rate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          rating: stars,
          comment: selectedTags.size > 0
            ? `Fahrerbewertung: ${Array.from(selectedTags).join(', ')}`
            : undefined,
        }),
      });
    } catch { /* silent */ } finally {
      setSubmitting(false);
      setStep('done');
      setTimeout(dismiss, 2500);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5 animate-in slide-in-from-bottom-4 duration-300">

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>

        {step === 'done' ? (
          <div className="flex flex-col items-center py-4 gap-3">
            <CheckCircle2 className="h-10 w-10 text-matcha-500" />
            <p className="text-base font-bold text-stone-800">Danke für dein Feedback!</p>
            <p className="text-xs text-stone-500 text-center">
              Deine Bewertung hilft uns, den Service zu verbessern.
            </p>
          </div>
        ) : step === 'rate' ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                <Bike className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800">
                  {driverName ? `Wie war ${driverName.split(' ')[0]}?` : 'Wie war dein Fahrer?'}
                </p>
                <p className="text-xs text-stone-400">Bewerte nur den Fahrdienst</p>
              </div>
            </div>

            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setHoverStar(s)}
                  onMouseLeave={() => setHoverStar(0)}
                  onClick={() => setStars(s)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={cn(
                      'h-9 w-9 transition-colors',
                      s <= (hoverStar || stars)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-stone-200',
                    )}
                  />
                </button>
              ))}
            </div>

            <button
              disabled={!stars}
              onClick={() => setStep('tags')}
              className={cn(
                'w-full rounded-xl py-2.5 text-sm font-bold transition',
                stars
                  ? 'bg-matcha-700 text-white hover:bg-matcha-800'
                  : 'bg-stone-100 text-stone-400 cursor-not-allowed',
              )}
            >
              Weiter
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-stone-800 mb-1">Was hat besonders gepasst?</p>
            <p className="text-xs text-stone-400 mb-4">Optional — wähle so viele wie du möchtest</p>

            <div className="flex flex-wrap gap-2 mb-5">
              {DRIVER_TAGS.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    selectedTags.has(t.id)
                      ? 'border-matcha-500 bg-matcha-50 text-matcha-800'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
                  )}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={dismiss}
                className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition"
              >
                Überspringen
              </button>
              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 rounded-xl bg-matcha-700 py-2.5 text-sm font-bold text-white hover:bg-matcha-800 disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="animate-pulse">Sende…</span>
                ) : (
                  <>
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Absenden
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
