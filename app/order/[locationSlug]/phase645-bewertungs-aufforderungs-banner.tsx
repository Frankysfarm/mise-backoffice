'use client';

import { useState } from 'react';
import { Star, X, CheckCircle2 } from 'lucide-react';

interface Props {
  locationId: string;
  orderId?: string | null;
}

export function Phase645BewertungsAufforderungsBanner({ locationId, orderId }: Props) {
  const [sterne, setSterne] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [kommentar, setKommentar] = useState('');
  const [abgeschickt, setAbgeschickt] = useState(false);
  const [geschlossen, setGeschlossen] = useState(false);
  const [laden, setLaden] = useState(false);

  if (geschlossen) return null;

  async function absenden() {
    if (sterne === 0) return;
    setLaden(true);
    try {
      await fetch('/api/delivery/admin/rating-request-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          order_id: orderId ?? null,
          sterne,
          kommentar: kommentar.trim() || null,
        }),
      });
    } catch {
      // Fehler ignorieren — Bewertung ist optional
    } finally {
      setLaden(false);
      setAbgeschickt(true);
    }
  }

  if (abgeschickt) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Danke für deine Bewertung!
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Dein Feedback hilft uns besser zu werden.
          </p>
        </div>
        <button
          onClick={() => setGeschlossen(true)}
          className="ml-auto text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Star className="h-5 w-5 text-amber-500 fill-amber-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Wie war deine Lieferung?
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Nur 10 Sekunden — hilf uns, noch besser zu werden.
          </p>
        </div>
        <button
          onClick={() => setGeschlossen(true)}
          className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="flex gap-1 justify-center mb-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setSterne(n)}
              className="transition-transform hover:scale-110 active:scale-95"
              aria-label={`${n} Stern${n > 1 ? 'e' : ''}`}
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  n <= (hover || sterne)
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-amber-100 text-amber-300 dark:fill-amber-900 dark:text-amber-700'
                }`}
              />
            </button>
          ))}
        </div>

        {sterne > 0 && (
          <div className="space-y-2">
            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              placeholder="Optionaler Kommentar…"
              rows={2}
              maxLength={300}
              className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 px-3 py-2 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={absenden}
              disabled={laden}
              className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold py-2 transition-colors"
            >
              {laden ? 'Wird gespeichert…' : 'Bewertung abschicken'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
