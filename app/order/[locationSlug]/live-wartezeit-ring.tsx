'use client';

import { useState, useEffect, useRef } from 'react';

type Props = {
  orderId: string;
  etaMinutes: number;
  locationId: string;
};

export function StorefrontLiveWartezeitRing({ orderId, etaMinutes, locationId }: Props) {
  const [currentEta, setCurrentEta] = useState<number>(etaMinutes);
  const [secondsLeft, setSecondsLeft] = useState<number>(etaMinutes * 60);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useRef<number>(Date.now());

  // Initialize
  useEffect(() => {
    setCurrentEta(etaMinutes);
    setSecondsLeft(etaMinutes * 60);
    startTimeRef.current = Date.now();
    setLoading(false);
  }, [etaMinutes]);

  // 1-second countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, currentEta * 60 - elapsed);
      setSecondsLeft(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentEta]);

  // Poll API every 60s for updated ETA
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/delivery/eta?order_id=${orderId}&location_id=${locationId}`
        );
        const json = await res.json() as { eta_min?: number; error?: string };
        if (res.ok && typeof json.eta_min === 'number') {
          setCurrentEta(json.eta_min);
          startTimeRef.current = Date.now();
          setSecondsLeft(json.eta_min * 60);
        }
      } catch {
        // silently ignore network errors; keep countdown with existing value
      }
    };

    const interval = setInterval(poll, 60_000);
    return () => clearInterval(interval);
  }, [orderId, locationId]);

  const minutesLeft = Math.ceil(secondsLeft / 60);
  const totalSeconds = currentEta * 60;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0; // 1 = full, 0 = empty

  // SVG ring config
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  // Color based on time remaining
  const isOverdue = secondsLeft === 0 && currentEta > 0;
  const isLow = minutesLeft < 10 && secondsLeft > 0;

  const ringColor = isOverdue
    ? '#ef4444' // red
    : isLow
    ? '#f59e0b' // amber
    : '#4a7c59'; // matcha green

  const textColor = isOverdue
    ? 'text-red-600'
    : isLow
    ? 'text-amber-600'
    : 'text-matcha-700';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 rounded-full border-4 border-matcha-200 border-t-matcha-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isOverdue ? (
            <span className={`text-2xl font-display font-bold ${textColor}`}>!</span>
          ) : (
            <>
              <span className={`text-4xl font-display font-bold tabular-nums leading-none ${textColor}`}>
                {minutesLeft}
              </span>
              <span className={`text-xs font-medium mt-0.5 ${textColor} opacity-80`}>
                Minuten
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-slate-500">
          {isOverdue
            ? 'Deine Bestellung sollte jeden Moment ankommen'
            : 'geschätzte Lieferzeit'}
        </p>
      </div>
    </div>
  );
}
