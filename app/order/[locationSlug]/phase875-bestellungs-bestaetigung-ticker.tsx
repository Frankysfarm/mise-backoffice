'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  orderId: string | null;
  orderNumber?: string | number | null;
  status: string | null;
}

const CONFETTI_COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa'];
const CONFETTI_COUNT = 28;

function Confetti({ active }: { active: boolean }) {
  const pieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      x: 30 + Math.random() * 40,
      delay: Math.random() * 400,
      dur: 800 + Math.random() * 600,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + Math.random() * 5,
      rotate: Math.random() * 360,
    }))
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
      {pieces.current.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: i % 3 === 0 ? '50%' : 2,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.dur}ms`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

const CONFIRMED_STATUSES = new Set(['bestätigt', 'confirmed', 'neu', 'new']);

export function Phase875BestellungsBestaetigungsTicker({ orderId, orderNumber, status }: Props) {
  const [visible, setVisible] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [exiting, setExiting] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!orderId || !status) return;
    if (shownRef.current) return;
    if (!CONFIRMED_STATUSES.has(status)) return;

    const guardKey = `mise_ticker_${orderId}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(guardKey)) return;

    shownRef.current = true;
    setVisible(true);
    setConfetti(true);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(guardKey, '1');

    const confettiTimer = setTimeout(() => setConfetti(false), 2500);
    const hideTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => setVisible(false), 400);
    }, 4500);

    return () => { clearTimeout(confettiTimer); clearTimeout(hideTimer); };
  }, [orderId, status]);

  if (!visible) return null;

  const displayNum = orderNumber ?? (orderId ? `#${orderId.slice(-4).toUpperCase()}` : '');

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes ticker-slide-in {
          from { transform: translateY(-110%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes ticker-slide-out {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-110%); opacity: 0; }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
        }
        .animate-confetti-fall { animation: confetti-fall linear forwards; }
      `}</style>

      <div
        className={cn(
          'relative overflow-hidden rounded-xl border bg-matcha-50 dark:bg-matcha-950 border-matcha-200 dark:border-matcha-800 px-4 py-3 flex items-center gap-3 shadow-md',
          exiting ? '[animation:ticker-slide-out_0.4s_ease-in_forwards]' : '[animation:ticker-slide-in_0.35s_ease-out_forwards]'
        )}
        role="status"
        aria-live="polite"
      >
        <Confetti active={confetti} />
        <CheckCircle2 className="h-6 w-6 text-matcha-600 dark:text-matcha-400 shrink-0 z-10" />
        <div className="z-10">
          <p className="text-sm font-bold text-matcha-800 dark:text-matcha-200 leading-tight">
            Bestellung {displayNum} bestätigt!
          </p>
          <p className="text-xs text-matcha-600 dark:text-matcha-400 mt-0.5">
            Deine Bestellung wird jetzt vorbereitet.
          </p>
        </div>
      </div>
    </>
  );
}
