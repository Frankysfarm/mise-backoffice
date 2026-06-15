'use client';

/**
 * FahrerBewertungsDialog — Phase 201
 * Fahrer-spezifischer Bewertungsdialog erscheint nach Lieferung wenn
 * Fahrername bekannt ist. Zeigt Fahrer-Avatar, Quick-Tags und
 * schickt eine Danke-Bewertung an die existing /api/delivery/reviews API.
 *
 * Triggered von success-state.tsx wenn liveStatus === 'geliefert' && driverName.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Star, ThumbsUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DRIVER_TAGS = [
  { id: 'friendly',   emoji: '😊', label: 'Freundlich' },
  { id: 'fast',       emoji: '⚡', label: 'Schnell' },
  { id: 'careful',    emoji: '🤝', label: 'Sorgfältig' },
  { id: 'punctual',   emoji: '⏰', label: 'Pünktlich' },
  { id: 'contactless',emoji: '📦', label: 'Kontaktlos' },
  { id: 'polite',     emoji: '🎩', label: 'Höflich' },
];

interface Props {
  orderId: string;
  driverName: string;
  /** Triggered from outside when status changes to 'geliefert' */
  triggered: boolean;
  onDismiss: () => void;
}

export function FahrerBewertungsDialog({ orderId, driverName, triggered, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [stars, setStars] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (triggered && !submittedRef.current) {
      const t = setTimeout(() => setVisible(true), 2_500);
      return () => clearTimeout(t);
    }
  }, [triggered]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  function toggleTag(id: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (stars === 0 || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          stars,
          tags: [...selectedTags],
          comment: null,
          source: 'driver_rating',
          driver_name: driverName,
        }),
      });
    } catch {
      // fire-and-forget — rating loss is acceptable
    } finally {
      submittedRef.current = true;
      setSubmitting(false);
      setDone(true);
      setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 2_000);
    }
  }

  const initials = driverName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => { setVisible(false); onDismiss(); }}
      />

      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Close */}
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 transition"
        >
          <X size={14} />
        </button>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Check size={24} className="text-emerald-600" />
            </div>
            <p className="text-center font-bold text-zinc-800">Danke für deine Bewertung!</p>
            <p className="text-center text-sm text-zinc-500">
              {driverName} freut sich über dein Feedback ❤️
            </p>
          </div>
        ) : (
          <>
            {/* Driver avatar */}
            <div className="mb-4 flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-matcha-400 to-matcha-600 text-xl font-black text-white shadow">
                {initials}
              </div>
              <div className="text-center">
                <p className="font-bold text-zinc-800">Bewerte deinen Fahrer</p>
                <p className="text-sm text-zinc-500">{driverName}</p>
              </div>
            </div>

            {/* Stars */}
            <div className="mb-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setStars(s)}
                  onMouseEnter={() => setHoverStar(s)}
                  onMouseLeave={() => setHoverStar(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    className={cn(
                      'transition-colors',
                      s <= (hoverStar || stars)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-zinc-200 text-zinc-200',
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Quick tags */}
            {stars > 0 && (
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {DRIVER_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold border transition',
                      selectedTags.has(tag.id)
                        ? 'border-matcha-500 bg-matcha-50 text-matcha-700'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                    )}
                  >
                    <span>{tag.emoji}</span>
                    {tag.label}
                  </button>
                ))}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={submit}
              disabled={stars === 0 || submitting}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition',
                stars > 0
                  ? 'bg-matcha-600 text-white hover:bg-matcha-700'
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed',
              )}
            >
              <ThumbsUp size={16} />
              {submitting ? 'Senden…' : 'Bewertung abschicken'}
            </button>

            {stars === 0 && (
              <p className="mt-2 text-center text-[11px] text-zinc-400">
                Wähle zuerst eine Sternebewertung
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
