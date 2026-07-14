'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, X } from 'lucide-react';

// Phase 1526 — Bewertungs-Einladungs-Banner (Storefront)
// Nach letzter Lieferung (Guard 2h): 1-Klick-Sterne-Widget (1–5 Sterne);
// localStorage-Guard 7 Tage; Hydration-safe; nach Phase1521.

interface Props {
  locationId: string;
  letzteBestellungIso?: string | null;
  onBewertungAbgegeben?: (sterne: number) => void;
  className?: string;
}

const LS_KEY_PREFIX = 'mise_bewertung_banner_';
const GUARD_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const GUARD_SEIT_LIEFERUNG_MS = 2 * 60 * 60 * 1000;

function shouldShow(locationId: string, letzteBestellungIso: string | null | undefined): boolean {
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}${locationId}`);
    if (raw) {
      const { ts } = JSON.parse(raw) as { ts: number };
      if (Date.now() - ts < GUARD_DURATION_MS) return false;
    }
    if (!letzteBestellungIso) return false;
    const seit = Date.now() - new Date(letzteBestellungIso).getTime();
    return seit >= GUARD_SEIT_LIEFERUNG_MS;
  } catch {
    return false;
  }
}

function markAsShown(locationId: string): void {
  try {
    localStorage.setItem(`${LS_KEY_PREFIX}${locationId}`, JSON.stringify({ ts: Date.now() }));
  } catch { /* noop */ }
}

function StarButton({
  value,
  hovered,
  selected,
  onHover,
  onClick,
}: {
  value: number;
  hovered: number;
  selected: number;
  onHover: (v: number) => void;
  onClick: (v: number) => void;
}) {
  const filled = value <= (hovered || selected);
  return (
    <button
      onClick={() => onClick(value)}
      onMouseEnter={() => onHover(value)}
      onMouseLeave={() => onHover(0)}
      className="p-0.5 transition-transform hover:scale-110 active:scale-95"
      aria-label={`${value} Stern${value > 1 ? 'e' : ''}`}
    >
      <Star
        className={cn(
          'w-7 h-7 transition-colors duration-100',
          filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600',
        )}
      />
    </button>
  );
}

export function StorefrontPhase1526BewertungsEinladungsBanner({
  locationId,
  letzteBestellungIso,
  onBewertungAbgegeben,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (shouldShow(locationId, letzteBestellungIso)) {
      setVisible(true);
    }
  }, [locationId, letzteBestellungIso]);

  function handleClose() {
    markAsShown(locationId);
    setVisible(false);
  }

  function handleStern(sterne: number) {
    setSelected(sterne);
    markAsShown(locationId);
    setSubmitted(true);
    onBewertungAbgegeben?.(sterne);
    setTimeout(() => setVisible(false), 2200);
  }

  if (!mounted || !visible) return null;

  return (
    <div className={cn(
      'rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 relative',
      className,
    )}>
      {/* Schließen */}
      {!submitted && (
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 dark:text-amber-600 dark:hover:text-amber-400 transition-colors"
          aria-label="Banner schließen"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {submitted ? (
        <div className="flex flex-col items-center gap-2 py-1">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(v => (
              <Star
                key={v}
                className={cn(
                  'w-6 h-6',
                  v <= selected ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600',
                )}
              />
            ))}
          </div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Danke für deine Bewertung!
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Dein Feedback hilft uns besser zu werden.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2 pr-6">
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Wie war deine Lieferung?
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3 leading-relaxed">
            Deine Meinung zählt — eine kurze Bewertung dauert 5 Sekunden.
          </p>
          <div className="flex items-center gap-1 justify-center">
            {[1, 2, 3, 4, 5].map(v => (
              <StarButton
                key={v}
                value={v}
                hovered={hovered}
                selected={selected}
                onHover={setHovered}
                onClick={handleStern}
              />
            ))}
          </div>
          <p className="text-[10px] text-amber-500 dark:text-amber-600 text-center mt-2">
            Ein Klick genügt
          </p>
        </>
      )}
    </div>
  );
}
