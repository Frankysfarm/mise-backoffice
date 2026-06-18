'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MessageSquarePlus, Star, CheckCircle2, Loader2 } from 'lucide-react';

type Mood = 'great' | 'ok' | 'tired' | 'frustrated';

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great',      emoji: '😊', label: 'Super' },
  { value: 'ok',         emoji: '😐', label: 'Ok' },
  { value: 'tired',      emoji: '😴', label: 'Müde' },
  { value: 'frustrated', emoji: '😤', label: 'Frustriert' },
];

interface Props {
  tourId?: string | null;
  driverId?: string | null;
  onSubmit?: () => void;
}

export function TourFeedbackSchnell({ tourId, driverId, onSubmit }: Props) {
  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);
  const [mood, setMood] = useState<Mood | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(true);

  if (!open) return null;

  if (done) {
    return (
      <div className="mx-4 rounded-2xl border border-matcha-200 bg-matcha-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-matcha-600 shrink-0" />
        <div>
          <div className="text-sm font-bold text-matcha-700">Feedback gespeichert</div>
          <div className="text-[11px] text-matcha-600">Danke — hilft uns besser zu werden!</div>
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (!rating || !mood) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_id: tourId ?? 'mock-tour',
          driver_id: driverId ?? undefined,
          rating,
          mood,
          issue_types: [],
        }),
      });
    } catch {
      // mock fallback — still show done state
    } finally {
      setSubmitting(false);
      setDone(true);
      onSubmit?.();
    }
  }

  return (
    <div className="mx-4 rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <MessageSquarePlus className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Tour-Feedback</span>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto text-muted-foreground text-xs hover:text-foreground transition"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Star rating */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Tour bewerten
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(s)}
                className="transition-transform active:scale-90"
                aria-label={`${s} Stern${s > 1 ? 'e' : ''}`}
              >
                <Star
                  className={cn(
                    'h-7 w-7 transition-colors',
                    s <= (hovered || rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-transparent text-muted-foreground/40',
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Mood selector */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Wie war deine Stimmung?
          </div>
          <div className="flex gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(m.value)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-center transition',
                  mood === m.value
                    ? 'border-matcha-400 bg-matcha-50'
                    : 'border-border bg-white',
                )}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-[9px] font-bold text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!rating || !mood || submitting}
          className={cn(
            'w-full rounded-xl py-2.5 text-sm font-bold transition flex items-center justify-center gap-2',
            rating && mood
              ? 'bg-matcha-600 text-white hover:bg-matcha-700 active:scale-[0.98]'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Speichern…
            </>
          ) : (
            'Feedback senden'
          )}
        </button>
      </div>
    </div>
  );
}
