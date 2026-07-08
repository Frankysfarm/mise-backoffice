'use client';

import { useCallback, useEffect, useState } from 'react';
import { ThumbsUp, X } from 'lucide-react';

interface Props {
  locationId: string | null;
  bestellungId?: string;
  status?: string;
}

const ABGESCHLOSSENE_STATUS = ['delivered', 'completed', 'abgeschlossen', 'geliefert'];

export function Phase735FeedbackEinladung({ locationId, bestellungId, status }: Props) {
  const [sichtbar, setSichtbar] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  const [ausgeblendet, setAusgeblendet] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);

  useEffect(() => {
    if (!status) return;
    const abgeschlossen = ABGESCHLOSSENE_STATUS.some((s) => status.toLowerCase().includes(s));
    if (abgeschlossen) {
      const t = setTimeout(() => setSichtbar(true), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const absenden = useCallback(async (rating: number) => {
    setGewaehlt(rating);
    if (locationId && bestellungId) {
      try {
        await fetch('/api/delivery/driver/tour-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location_id: locationId, order_id: bestellungId, rating }),
        });
      } catch { /* silent */ }
    }
    setGesendet(true);
    setTimeout(() => setAusgeblendet(true), 2500);
  }, [locationId, bestellungId]);

  if (!sichtbar || ausgeblendet) return null;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ThumbsUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {gesendet ? (
            <div className="text-center py-1">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Vielen Dank für dein Feedback! 🎉
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {gewaehlt !== null && '★'.repeat(gewaehlt)}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold">Wie war deine Lieferung?</p>
              <p className="text-xs text-muted-foreground mb-3">Dein Feedback hilft uns besser zu werden.</p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => absenden(n)}
                    className="text-2xl transition-transform hover:scale-125 active:scale-110"
                    aria-label={`${n} Sterne`}
                  >
                    {n <= (gewaehlt ?? 0) ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {!gesendet && (
          <button
            onClick={() => setAusgeblendet(true)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
