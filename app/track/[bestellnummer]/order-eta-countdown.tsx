'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Truck } from 'lucide-react';

type Props = {
  etaEarliest: string | null;
  etaLatest: string | null;
  status: string;
};

function pad2(n: number) {
  return String(Math.abs(Math.floor(n))).padStart(2, '0');
}

export function OrderEtaCountdown({ etaEarliest, etaLatest, status }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (status !== 'unterwegs' || !etaEarliest) return null;

  const now = Date.now();
  const etaMs = new Date(etaEarliest).getTime();
  const secsLeft = Math.floor((etaMs - now) / 1000);
  const isOverdue = secsLeft < 0;
  const absSecs = Math.abs(secsLeft);
  const mm = Math.floor(absSecs / 60);
  const ss = absSecs % 60;
  const isUrgent = secsLeft >= 0 && secsLeft < 300;

  return (
    <div className={cn(
      'mx-4 mb-4 rounded-2xl border-2 p-4 transition-all',
      isOverdue
        ? 'border-red-400/60 bg-red-500/10 animate-pulse'
        : isUrgent
          ? 'border-amber-400/60 bg-amber-500/10'
          : 'border-accent/40 bg-accent/5',
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
          isOverdue ? 'bg-red-500' : isUrgent ? 'bg-amber-400' : 'bg-accent',
        )}>
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
            {isOverdue ? 'Leicht verspätet' : 'Ankunft in'}
          </div>
          <div className={cn(
            'font-mono text-3xl font-black tabular-nums leading-none',
            isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-accent',
          )}>
            {isOverdue && <span className="text-2xl">–</span>}
            {mm}:{pad2(ss)}
          </div>
          {etaLatest && (
            <div className="text-[10px] text-muted-foreground mt-1">
              Fenster:{' '}
              {new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              –
              {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}{' '}
              Uhr
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
