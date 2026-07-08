'use client';

import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Navigation, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Props {
  orderId: string;
  status: Phase | string;
  estimatedMinutes?: number | null;
  orderedAt?: string | null;
  driverName?: string | null;
}

function getPhaseConfig(status: string) {
  switch (status) {
    case 'bestätigt':
      return { label: 'Bestätigt', sublabel: 'Deine Bestellung wurde angenommen', icon: '✓', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', progress: 20 };
    case 'in_zubereitung':
      return { label: 'Wird zubereitet', sublabel: 'Die Küche arbeitet an deiner Bestellung', icon: '👨‍🍳', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', progress: 50 };
    case 'fertig':
      return { label: 'Bereit zur Abholung', sublabel: 'Fahrer wird gleich abgeholt', icon: '📦', color: 'text-matcha-600', bg: 'bg-matcha-50 border-matcha-200', progress: 70 };
    case 'unterwegs':
      return { label: 'Unterwegs zu dir', sublabel: 'Dein Fahrer ist auf dem Weg', icon: '🛵', color: 'text-matcha-700', bg: 'bg-matcha-100 border-matcha-300', progress: 85 };
    case 'geliefert':
      return { label: 'Geliefert!', sublabel: 'Guten Appetit!', icon: '🎉', color: 'text-matcha-600', bg: 'bg-matcha-50 border-matcha-200', progress: 100 };
    default:
      return { label: 'Bestellung', sublabel: 'Wird bearbeitet…', icon: '⏳', color: 'text-muted-foreground', bg: 'bg-muted border-border', progress: 10 };
  }
}

export function Phase778EtaDynamikLivePanel({ orderId, status, estimatedMinutes, orderedAt, driverName }: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!orderedAt) return;
    const update = () => {
      setElapsedSec(Math.floor((Date.now() - new Date(orderedAt).getTime()) / 1000));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [orderedAt]);

  const cfg = getPhaseConfig(status);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const estTotalSec = (estimatedMinutes ?? 35) * 60;
  const remainingSec = Math.max(0, estTotalSec - elapsedSec);
  const remainingMin = Math.ceil(remainingSec / 60);
  const isDelivered = status === 'geliefert';

  const countdownSec = remainingSec % 60;
  const countdownMin = Math.floor(remainingSec / 60);

  return (
    <div className={cn('rounded-2xl border-2 px-5 py-4 space-y-4', cfg.bg)}>
      {/* Status icon + label */}
      <div className="flex items-center gap-3">
        <span className="text-3xl" role="img" aria-label={cfg.label}>{cfg.icon}</span>
        <div>
          <div className={cn('font-display text-base font-black', cfg.color)}>{cfg.label}</div>
          <div className="text-xs text-muted-foreground">{cfg.sublabel}</div>
        </div>
        {!isDelivered && (
          <div className="ml-auto flex flex-col items-end">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500 animate-pulse" />
              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">Live</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-matcha-400 to-matcha-600 transition-all duration-1000"
            style={{ width: `${cfg.progress}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-bold text-muted-foreground">
          <span>Bestellung</span>
          <span>Zubereitung</span>
          <span>Unterwegs</span>
          <span>Geliefert</span>
        </div>
      </div>

      {/* ETA countdown */}
      {!isDelivered && (estimatedMinutes !== null && estimatedMinutes !== undefined) && (
        <div className="flex items-center justify-between rounded-xl bg-white/60 border border-white/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-matcha-600" />
            <div>
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Voraussichtlich in</div>
              <div className="font-mono text-xl font-black tabular-nums text-foreground">
                {remainingSec > 0
                  ? `${String(countdownMin).padStart(2, '0')}:${String(countdownSec).padStart(2, '0')}`
                  : '00:00'}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Vergangen</div>
            <div className="font-mono text-sm font-black tabular-nums text-muted-foreground">
              {elapsedMin}m
            </div>
          </div>
        </div>
      )}

      {/* Driver info */}
      {status === 'unterwegs' && driverName && (
        <div className="flex items-center gap-2 rounded-xl bg-white/60 border border-white/80 px-3 py-2">
          <MapPin className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="text-xs text-muted-foreground">Fahrer:</span>
          <span className="text-xs font-bold text-foreground">{driverName}</span>
          <Navigation className="h-3.5 w-3.5 text-matcha-600 ml-auto" />
        </div>
      )}

      {/* Delivered */}
      {isDelivered && (
        <div className="text-center text-sm font-bold text-matcha-700">
          Geliefert in {elapsedMin} Minuten 🎉
        </div>
      )}
    </div>
  );
}
