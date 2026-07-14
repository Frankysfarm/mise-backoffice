'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, ChefHat, Bike, Package, Zap } from 'lucide-react';

interface Props {
  orderId: string;
  estimatedMinutes?: number | null;
  status: string;
  driverName?: string | null;
  createdAt?: string | null;
}

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  arcColor: string;
  icon: React.ReactNode;
  message: string;
}

function useStatusConfig(status: string, driverName?: string | null): StatusConfig {
  return useMemo(() => {
    switch (status) {
      case 'neu':
        return {
          label: 'Bestellung eingegangen',
          color: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          arcColor: '#3b82f6',
          icon: <Package className="h-6 w-6 text-blue-500" />,
          message: 'Deine Bestellung wurde erfolgreich aufgegeben.',
        };
      case 'bestätigt':
        return {
          label: 'Bestellung angenommen',
          color: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          arcColor: '#2563eb',
          icon: <Zap className="h-6 w-6 text-blue-600" />,
          message: 'Das Restaurant hat deine Bestellung bestätigt.',
        };
      case 'in_zubereitung':
        return {
          label: 'Wird zubereitet',
          color: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          arcColor: '#f97316',
          icon: <ChefHat className="h-6 w-6 text-orange-500" />,
          message: 'Die Küche ist am Arbeiten – gleich ist es fertig!',
        };
      case 'fertig':
        return {
          label: 'Fertig – Fahrer unterwegs',
          color: 'text-matcha-700',
          bgColor: 'bg-matcha-50',
          borderColor: 'border-matcha-200',
          arcColor: '#4d7c0f',
          icon: <Package className="h-6 w-6 text-matcha-600" />,
          message: 'Dein Essen ist fertig und wartet auf den Fahrer.',
        };
      case 'unterwegs':
        return {
          label: 'Auf dem Weg zu dir!',
          color: 'text-amber-700',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-300',
          arcColor: '#f59e0b',
          icon: <Bike className="h-6 w-6 text-amber-500" />,
          message: driverName
            ? `${driverName} ist auf dem Weg zu dir!`
            : 'Dein Fahrer ist unterwegs!',
        };
      case 'geliefert':
        return {
          label: 'Geliefert!',
          color: 'text-green-700',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          arcColor: '#22c55e',
          icon: <CheckCircle2 className="h-6 w-6 text-green-500" />,
          message: 'Guten Appetit! Deine Bestellung wurde geliefert.',
        };
      default:
        return {
          label: status,
          color: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          arcColor: '#9ca3af',
          icon: <Clock className="h-6 w-6 text-gray-400" />,
          message: 'Bitte warte einen Moment.',
        };
    }
  }, [status, driverName]);
}

// Progress fraction per status (0–1) for the arc indicator
function statusProgress(status: string): number {
  const map: Record<string, number> = {
    neu: 0.1,
    bestätigt: 0.25,
    in_zubereitung: 0.5,
    fertig: 0.7,
    unterwegs: 0.88,
    geliefert: 1,
  };
  return map[status] ?? 0.1;
}

// SVG arc helpers
const R = 52; // radius
const CIRCUMFERENCE = 2 * Math.PI * R;

function EtaArc({ progress, color }: { progress: number; color: string }) {
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
      {/* Track */}
      <circle
        cx="60"
        cy="60"
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        className="text-gray-200"
      />
      {/* Progress arc */}
      <circle
        cx="60"
        cy="60"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease' }}
      />
    </svg>
  );
}

export function Phase1002DynamischeEtaLiveCockpit({
  orderId,
  estimatedMinutes,
  status,
  driverName,
  createdAt,
}: Props) {
  const config = useStatusConfig(status, driverName);
  const progress = statusProgress(status);

  // Countdown state: remaining seconds based on estimatedMinutes
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => {
    if (estimatedMinutes == null) return null;
    if (!createdAt) return estimatedMinutes * 60;
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, estimatedMinutes * 60 - elapsed);
  });

  useEffect(() => {
    if (estimatedMinutes == null) {
      setRemainingSeconds(null);
      return;
    }
    // Re-sync whenever estimatedMinutes changes
    if (createdAt) {
      const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      setRemainingSeconds(Math.max(0, estimatedMinutes * 60 - elapsed));
    } else {
      setRemainingSeconds(estimatedMinutes * 60);
    }
  }, [estimatedMinutes, createdAt]);

  useEffect(() => {
    if (status === 'geliefert') return; // stop ticking once delivered
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, status]);

  function formatCountdown(seconds: number): string {
    if (seconds <= 0) return '0 Min';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} Sek`;
    if (s === 0) return `${m} Min`;
    return `${m}:${String(s).padStart(2, '0')} Min`;
  }

  const countdownDisplay =
    status === 'geliefert'
      ? null
      : remainingSeconds === null
        ? 'Wird berechnet...'
        : formatCountdown(remainingSeconds);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border shadow-sm transition-colors duration-500',
        config.bgColor,
        config.borderColor,
      )}
    >
      {/* Top section: arc + countdown */}
      <div className="flex items-center gap-4 px-4 pt-5">
        {/* Arc indicator */}
        <div className="relative h-[88px] w-[88px] flex-shrink-0">
          <EtaArc progress={progress} color={config.arcColor} />
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {config.icon}
          </div>
        </div>

        {/* Status text */}
        <div className="min-w-0 flex-1">
          <p className={cn('text-base font-bold leading-tight', config.color)}>
            {config.label}
          </p>

          {countdownDisplay && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">{countdownDisplay}</span>
            </div>
          )}

          {status === 'geliefert' && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm font-semibold text-green-700">Danke für deine Bestellung!</span>
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      <p className="px-4 pb-4 pt-2 text-sm text-gray-600">{config.message}</p>

      {/* Progress steps bar */}
      <div className="flex border-t border-gray-100 bg-white/60">
        {(['neu', 'in_zubereitung', 'unterwegs', 'geliefert'] as const).map((step, idx) => {
          const stepProgress = statusProgress(step);
          const isActive = progress >= stepProgress;
          const isCurrent =
            progress >= stepProgress &&
            (idx === 3 || progress < statusProgress((['neu', 'in_zubereitung', 'unterwegs', 'geliefert'] as const)[idx + 1]));

          return (
            <div
              key={step}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 px-1 py-2 text-center',
                idx !== 0 && 'border-l border-gray-100',
              )}
            >
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors duration-500',
                  isActive ? 'text-white' : 'bg-gray-100 text-gray-400',
                )}
                style={isActive ? { backgroundColor: config.arcColor } : {}}
              >
                {isActive ? '✓' : idx + 1}
              </div>
              <span
                className={cn(
                  'text-[9px] leading-none',
                  isCurrent ? 'font-bold text-gray-800' : isActive ? 'text-gray-600' : 'text-gray-400',
                )}
              >
                {step === 'neu' && 'Eingegangen'}
                {step === 'in_zubereitung' && 'Zubereitung'}
                {step === 'unterwegs' && 'Unterwegs'}
                {step === 'geliefert' && 'Geliefert'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
