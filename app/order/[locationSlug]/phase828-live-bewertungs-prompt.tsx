'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string | null;
  locationId: string | null;
}

export function Phase828LiveBewertungsPrompt({ orderId, locationId }: Props) {
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkDelivered = useCallback(async () => {
    if (!orderId || dismissed || submitted) return;
    const storageKey = `bewertung_done_${orderId}`;
    if (sessionStorage.getItem(storageKey)) return;
    try {
      const res = await fetch(`/api/delivery/driver/public-profile?order_id=${orderId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      // Only show prompt when order is delivered (no active driver profile visible)
      if (json.status && ['geliefert', 'delivered', 'completed'].includes(String(json.status))) {
        setVisible(true);
      }
    } catch {
      // Fallback: check order status directly
      try {
        const res2 = await fetch(`/api/delivery/admin/orders?order_id=${orderId}&location_id=${locationId ?? ''}`, { cache: 'no-store' });
        if (!res2.ok) return;
        const json2 = await res2.json();
        const status = json2.status ?? json2.order?.status ?? '';
        if (['geliefert', 'delivered', 'completed'].includes(String(status))) {
          setVisible(true);
        }
      } catch {
        // silent
      }
    }
  }, [orderId, locationId, dismissed, submitted]);

  useEffect(() => {
    if (!orderId) return;
    checkDelivered();
    const iv = setInterval(checkDelivered, 30_000);
    return () => clearInterval(iv);
  }, [orderId, checkDelivered]);

  const handleSubmit = async () => {
    if (!orderId || rating === 0) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, location_id: locationId, rating, type: 'delivery' }),
      });
      sessionStorage.setItem(`bewertung_done_${orderId}`, '1');
      setSubmitted(true);
      setTimeout(() => setVisible(false), 3_000);
    } catch {
      // silent fail — still mark as done locally
      sessionStorage.setItem(`bewertung_done_${orderId}`, '1');
      setSubmitted(true);
      setTimeout(() => setVisible(false), 3_000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    if (orderId) sessionStorage.setItem(`bewertung_done_${orderId}`, '1');
    setDismissed(true);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-8 sm:pb-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h2 className="text-base font-black text-stone-900">Wie war deine Lieferung?</h2>
            <p className="text-xs text-stone-500 mt-0.5">Dein Feedback hilft unserem Team</p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-stone-100 transition-colors text-stone-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-2 px-5 py-6">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <p className="text-base font-bold text-stone-800">Danke für dein Feedback!</p>
            <p className="text-xs text-stone-500 text-center">Deine Bewertung wurde gespeichert.</p>
          </div>
        ) : (
          <>
            {/* Stars */}
            <div className="flex items-center justify-center gap-2 py-5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  className="transition-transform hover:scale-110 active:scale-95"
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(s)}
                >
                  <Star
                    className={cn(
                      'h-9 w-9 transition-colors',
                      s <= (hover || rating) ? 'text-amber-400 fill-amber-400' : 'text-stone-200 fill-stone-100'
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Label */}
            <div className="text-center h-5 mb-3">
              {(hover || rating) > 0 && (
                <span className="text-xs font-semibold text-stone-600">
                  {['', 'Sehr schlecht', 'Schlecht', 'Ok', 'Gut', 'Ausgezeichnet'][hover || rating]}
                </span>
              )}
            </div>

            {/* Buttons */}
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-semibold hover:bg-stone-50 transition-colors"
              >
                Überspringen
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all',
                  rating > 0 ? 'bg-matcha-600 hover:bg-matcha-700 active:scale-95' : 'bg-stone-200 cursor-not-allowed'
                )}
              >
                {submitting ? 'Sende…' : 'Absenden'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
