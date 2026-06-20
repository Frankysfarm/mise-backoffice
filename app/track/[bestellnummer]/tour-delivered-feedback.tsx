'use client';
/**
 * TourDeliveredFeedback
 * Quick customer satisfaction prompt shown after order is delivered.
 * Posts to /api/delivery/reviews or similar via a simple thumbs up/down.
 */
import { useState } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  isDelivered: boolean;
}

export function TourDeliveredFeedback({ orderId, isDelivered }: Props) {
  const [selected, setSelected] = useState<'up' | 'down' | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isDelivered || submitted) {
    if (submitted) {
      return (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 py-3 px-4">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700">Danke für dein Feedback!</p>
        </div>
      );
    }
    return null;
  }

  const submit = async (rating: 'up' | 'down') => {
    setSelected(rating);
    try {
      await fetch('/api/delivery/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          rating:   rating === 'up' ? 5 : 2,
          source:   'tracking_page_quick',
        }),
      });
    } catch { /* ignore */ }
    setTimeout(() => setSubmitted(true), 800);
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-center space-y-3">
      <p className="text-sm font-bold text-foreground">Wie war deine Lieferung?</p>
      <div className="flex justify-center gap-4">
        <button
          onClick={() => submit('up')}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-2xl border-2 px-5 py-3 transition-all',
            selected === 'up'
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-border bg-background hover:border-emerald-400 hover:bg-emerald-50/50'
          )}
        >
          <ThumbsUp className={cn('h-6 w-6', selected === 'up' ? 'text-emerald-600' : 'text-muted-foreground')} />
          <span className="text-xs font-semibold text-foreground">Super!</span>
        </button>
        <button
          onClick={() => submit('down')}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-2xl border-2 px-5 py-3 transition-all',
            selected === 'down'
              ? 'border-red-500 bg-red-50'
              : 'border-border bg-background hover:border-red-400 hover:bg-red-50/50'
          )}
        >
          <ThumbsDown className={cn('h-6 w-6', selected === 'down' ? 'text-red-600' : 'text-muted-foreground')} />
          <span className="text-xs font-semibold text-foreground">Problem</span>
        </button>
      </div>
    </div>
  );
}
