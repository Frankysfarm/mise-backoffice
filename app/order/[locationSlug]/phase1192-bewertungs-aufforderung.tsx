'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star, Send, CheckCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1192 — Bewertungs-Aufforderung nach Lieferung (Storefront)
// Auto-erscheinendes 5-Sterne-Panel sobald Status=geliefert + optionaler Kommentar + POST /api/delivery/customer/bewertung

interface Props {
  orderId: string;
  locationId: string;
}

type TrackingData = {
  status: string;
  driver_name?: string | null;
};

export function Phase1192BewertungsAufforderung({ orderId, locationId }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sterne, setSterne] = useState(0);
  const [hover, setHover] = useState(0);
  const [kommentar, setKommentar] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [driverName, setDriverName] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (visible || dismissed) return;
    try {
      const r = await fetch(`/api/delivery/customer/tracking?order_id=${encodeURIComponent(orderId)}`);
      if (!r.ok) return;
      const d = await r.json() as TrackingData;
      if (d.status === 'geliefert' || d.status === 'delivered') {
        setDriverName(d.driver_name ?? null);
        setVisible(true);
      }
    } catch {
      // ignore
    }
  }, [orderId, visible, dismissed]);

  useEffect(() => {
    void checkStatus();
    const id = setInterval(() => void checkStatus(), 30000);
    return () => clearInterval(id);
  }, [checkStatus]);

  async function handleSend() {
    if (sterne === 0 || sending) return;
    setSending(true);
    try {
      await fetch('/api/delivery/customer/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          location_id: locationId,
          stars: sterne,
          comment: kommentar.trim() || null,
          source: 'storefront_post_delivery',
        }),
      });
    } catch {
      // best effort
    } finally {
      setSending(false);
      setDone(true);
    }
  }

  if (!visible || dismissed) return null;

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40 p-4 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
        <div>
          <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">Danke für deine Bewertung!</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Dein Feedback hilft uns, besser zu werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <p className="font-bold text-sm text-amber-700 dark:text-amber-300">
            Wie war deine Lieferung?
          </p>
          {driverName && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Fahrer: {driverName}</p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-1 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-center gap-1 py-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setSterne(s)}
              className="transition-transform hover:scale-110 active:scale-95"
              aria-label={`${s} Sterne`}
            >
              <Star
                className={cn(
                  'h-8 w-8 transition-colors',
                  (hover || sterne) >= s
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-amber-200 dark:text-amber-700',
                )}
              />
            </button>
          ))}
        </div>

        {sterne > 0 && (
          <textarea
            value={kommentar}
            onChange={e => setKommentar(e.target.value)}
            placeholder="Optionaler Kommentar…"
            rows={2}
            maxLength={300}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-sm resize-none',
              'border-amber-200 dark:border-amber-700',
              'bg-white dark:bg-black/20',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-amber-400',
            )}
          />
        )}

        <button
          onClick={() => void handleSend()}
          disabled={sterne === 0 || sending}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all',
            sterne > 0
              ? 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95'
              : 'bg-amber-200 dark:bg-amber-900 text-amber-400 dark:text-amber-600 cursor-not-allowed',
          )}
        >
          {sending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Send className="h-4 w-4" /> Bewertung absenden</>}
        </button>
      </div>
    </div>
  );
}
