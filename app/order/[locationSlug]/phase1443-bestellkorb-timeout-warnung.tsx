'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, RefreshCw, X } from 'lucide-react';

// Phase 1443 — Bestellkorb-Timeout-Warnung (Storefront)
// Wenn Bestellkorb >20 Min inaktiv: Einblendbanner "Korb läuft in X Min ab" + Verlängern-Button
// localStorage-Timer, Hydration-Safe

const TIMEOUT_MS = 20 * 60 * 1000;       // 20 Minuten Inaktivität
const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // Warnung ab 5 Min vor Ablauf
const STORAGE_KEY = 'bestellkorb_last_activity';
const DISMISSED_KEY = 'bestellkorb_timeout_dismissed';

interface Props {
  cartItemCount?: number;
  onCartExtend?: () => void;
  onCartClear?: () => void;
}

export function BestellkorbTimeoutWarnung({ cartItemCount = 0, onCartExtend, onCartClear }: Props) {
  const [mounted, setMounted] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydration-safe mount
  useEffect(() => { setMounted(true); }, []);

  const getLastActivity = useCallback((): number => {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      return val ? parseInt(val, 10) : Date.now();
    } catch {
      return Date.now();
    }
  }, []);

  const resetTimer = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      localStorage.removeItem(DISMISSED_KEY);
    } catch {}
    setRemainingMs(null);
    setDismissed(false);
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch {}
    setDismissed(true);
  }, []);

  // Activity tracking
  useEffect(() => {
    if (!mounted) return;
    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, handler));
  }, [mounted, resetTimer]);

  // Countdown tick
  useEffect(() => {
    if (!mounted || cartItemCount === 0) {
      setRemainingMs(null);
      return;
    }

    const tick = () => {
      const last = getLastActivity();
      const elapsed = Date.now() - last;
      const remaining = TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        // Korb abgelaufen
        setRemainingMs(0);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      if (remaining <= WARNING_THRESHOLD_MS) {
        try {
          const wasDismissed = localStorage.getItem(DISMISSED_KEY);
          if (!wasDismissed) setDismissed(false);
        } catch {}
        setRemainingMs(remaining);
      } else {
        setRemainingMs(null);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [mounted, cartItemCount, getLastActivity]);

  // Not mounted, empty cart, or no warning needed
  if (!mounted) return null;
  if (cartItemCount === 0) return null;
  if (remainingMs === null) return null;
  if (dismissed && remainingMs > 0) return null;

  const expired = remainingMs === 0;
  const remainingMin = Math.ceil(remainingMs / 60_000);

  const handleVerlaengern = () => {
    onCartExtend?.();
    resetTimer();
  };

  const handleLoeschen = () => {
    onCartClear?.();
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DISMISSED_KEY);
    } catch {}
    setRemainingMs(null);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm',
        'rounded-xl border shadow-lg px-4 py-3',
        'animate-in slide-in-from-bottom-4 duration-300',
        expired
          ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/90'
          : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/90',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5', expired ? 'text-red-500' : 'text-amber-500')}>
          {expired ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold', expired ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-200')}>
            {expired ? 'Korb abgelaufen' : `Korb läuft in ${remainingMin} Min ab`}
          </div>
          <div className={cn('text-[11px] mt-0.5', expired ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
            {expired
              ? 'Dein Warenkorb wurde nach 20 Min Inaktivität geleert.'
              : `Bei Inaktivität werden deine ${cartItemCount} Artikel entfernt.`}
          </div>
        </div>

        {!expired && (
          <button
            onClick={dismiss}
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!expired && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleVerlaengern}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold py-2 px-3 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Verlängern
          </button>
          <button
            onClick={handleLoeschen}
            className="flex items-center justify-center gap-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-xs font-semibold py-2 px-3 transition-colors"
          >
            Leeren
          </button>
        </div>
      )}

      {/* Fortschrittsbalken */}
      {!expired && (
        <div className="mt-2 h-1 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-10000"
            style={{ width: `${Math.round((remainingMs / WARNING_THRESHOLD_MS) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
