'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Zap } from 'lucide-react';

interface Props {
  etaMin: number | null;
  status: string | null;
}

function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return 'Gleich da!';
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 5) return `${min} Min`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function EtaSekundenCountdown({ etaMin, status }: Props) {
  const [remainSec, setRemainSec] = useState<number | null>(
    etaMin != null ? etaMin * 60 : null,
  );

  useEffect(() => {
    if (etaMin == null) return;
    setRemainSec(etaMin * 60);
  }, [etaMin]);

  useEffect(() => {
    if (remainSec == null || remainSec <= 0) return;
    const iv = setInterval(() => {
      setRemainSec((prev) => (prev != null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(iv);
  }, [remainSec != null]);

  const isDelivered = status === 'geliefert' || status === 'delivered';
  const isUnterwegs = status === 'unterwegs' || status === 'out_for_delivery' || status === 'picked_up';

  if (isDelivered) return null;
  if (!isUnterwegs && (remainSec == null || remainSec > 10 * 60)) return null;

  const isNear = remainSec != null && remainSec <= 5 * 60;
  const isVeryNear = remainSec != null && remainSec <= 60;

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border-2 transition-all',
      isVeryNear
        ? 'border-emerald-400 bg-emerald-50 animate-pulse'
        : isNear
        ? 'border-matcha-400 bg-matcha-50'
        : 'border-border bg-card',
    )}>
      <div className={cn(
        'flex items-center gap-3 px-4 py-3',
        isVeryNear ? 'bg-emerald-500' : isNear ? 'bg-matcha-600' : 'bg-matcha-500',
      )}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 shrink-0">
          {isVeryNear ? (
            <Zap className="h-5 w-5 text-white animate-bounce" />
          ) : (
            <MapPin className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            {isVeryNear ? 'Fahrer ist gleich da!' : isNear ? 'Fahrer ist unterwegs' : 'Live-Countdown'}
          </div>
          <div className="font-display font-black text-2xl text-white tabular-nums leading-tight">
            {remainSec != null ? formatCountdown(remainSec) : '–'}
          </div>
        </div>
        {isNear && remainSec != null && remainSec > 0 && (
          <div className="shrink-0 text-right">
            <div className="text-[9px] text-white/70 uppercase font-bold">Sekunden</div>
            <div className="font-mono font-black text-xl text-white tabular-nums">
              {String(remainSec % 60).padStart(2, '0')}
            </div>
          </div>
        )}
      </div>

      {/* Pulse progress */}
      {remainSec != null && remainSec > 0 && etaMin != null && (
        <div className="px-4 py-2">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                isVeryNear ? 'bg-emerald-500' : 'bg-matcha-500',
              )}
              style={{ width: `${Math.max(0, 100 - (remainSec / (etaMin * 60)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>Bestellt</span>
            <span>Geliefert</span>
          </div>
        </div>
      )}
    </div>
  );
}
