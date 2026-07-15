'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Phase 1740 — Ziel-Erreicht-Animation (Fahrer-App)
 *
 * Wenn Stopp als geliefert markiert: kurze Erfolgs-Animation
 * (SVG-Checkmark + Text "Geliefert!"); Auto-dismiss 3 Sek; isOnline-Guard.
 */

interface Props {
  isOnline: boolean;
  lastDeliveredAt: string | null;
}

const DISMISS_MS = 3000;

export function FahrerPhase1740ZielEreichtAnimation({ isOnline, lastDeliveredAt }: Props) {
  const [visible, setVisible] = useState(false);
  const prevRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOnline) { setVisible(false); return; }
    if (lastDeliveredAt && lastDeliveredAt !== prevRef.current) {
      prevRef.current = lastDeliveredAt;
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), DISMISS_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOnline, lastDeliveredAt]);

  if (!isOnline || !visible) return null;

  return (
    <div
      className="mx-4 mb-3 rounded-2xl bg-green-500 dark:bg-green-600 shadow-lg overflow-hidden"
      style={{ animation: 'slideInFade 0.35s ease-out' }}
    >
      <style>{`
        @keyframes slideInFade {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 60; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes scalePop {
          0%   { transform: scale(0.7); }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center gap-2 py-5 px-4">
        {/* SVG Checkmark */}
        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          style={{ animation: 'scalePop 0.4s ease-out 0.1s both' }}
        >
          <circle cx="28" cy="28" r="26" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
          <polyline
            points="16,28 24,36 40,20"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="60"
            strokeDashoffset="60"
            style={{ animation: 'checkDraw 0.45s ease-out 0.25s forwards' }}
          />
        </svg>

        <p className="text-xl font-black text-white tracking-tight">Geliefert!</p>
        <p className="text-sm text-white/80 font-medium">Super gemacht 🎉</p>
      </div>
    </div>
  );
}
