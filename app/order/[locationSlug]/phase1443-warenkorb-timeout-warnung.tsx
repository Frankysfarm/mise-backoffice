'use client';

import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, Clock, RefreshCw, X } from 'lucide-react';

const TIMEOUT_MS = 20 * 60_000; // 20 Min
const WARN_AT_MS = 5 * 60_000;  // Warnung wenn ≤5 Min verbleiben
const STORAGE_KEY = 'mise_cart_last_active';
const DISMISSED_KEY = 'mise_cart_timeout_dismissed';

interface Props {
  cartItemCount?: number;
  onExtend?: () => void;
  onDismiss?: () => void;
}

function fmtSec(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function WarenkorbTimeoutWarnung({ cartItemCount = 0, onExtend, onDismiss }: Props) {
  const [remainMs, setRemainMs] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset timer on user activity
  const resetTimer = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Hydration-safe init
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) localStorage.setItem(STORAGE_KEY, Date.now().toString());

    const dimKey = localStorage.getItem(DISMISSED_KEY);
    if (dimKey === stored) {
      setDismissed(true);
    }

    const tick = () => {
      const last = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
      const elapsed = Date.now() - last;
      const remain = Math.max(0, TIMEOUT_MS - elapsed);
      setRemainMs(remain);
      setVisible(remain <= WARN_AT_MS && remain > 0);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);

    const events = ['click', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, []);

  const handleExtend = () => {
    resetTimer();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DISMISSED_KEY);
    }
    setDismissed(false);
    setVisible(false);
    onExtend?.();
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) localStorage.setItem(DISMISSED_KEY, stored);
    }
    setDismissed(true);
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || dismissed || cartItemCount === 0 || remainMs === null) return null;

  const isUrgent = remainMs <= 60_000;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mx-auto px-4 animate-in slide-in-from-bottom-4 duration-300`}
    >
      <div className={`rounded-xl border-2 shadow-lg px-4 py-3 flex items-start gap-3 ${
        isUrgent ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'
      }`}>
        <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${
          isUrgent ? 'bg-red-500' : 'bg-amber-400'
        } text-white`}>
          <ShoppingCart className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold ${isUrgent ? 'text-red-900' : 'text-amber-900'}`}>
            Korb läuft ab in
            <span className="ml-1 font-mono text-base font-black tabular-nums">
              {fmtSec(remainMs)}
            </span>
          </div>
          <div className={`text-xs mt-0.5 ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
            Dein Warenkorb ({cartItemCount} Artikel) wird zurückgesetzt.
          </div>

          <button
            onClick={handleExtend}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition ${
              isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            <RefreshCw className="h-3 w-3" />
            Zeit verlängern
          </button>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Schließen"
          className={`shrink-0 rounded-lg p-1 transition ${
            isUrgent ? 'text-red-400 hover:text-red-700 hover:bg-red-100' : 'text-amber-400 hover:text-amber-700 hover:bg-amber-100'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
