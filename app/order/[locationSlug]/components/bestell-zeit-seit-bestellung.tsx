'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  bestelltAt?: string | null;
  status: string;
  className?: string;
}

export function BestellZeitSeitBestellung({ bestelltAt, status, className }: Props) {
  const mountedAt = React.useRef(Date.now());
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (status === 'delivered' || status === 'geliefert') return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [status]);

  const startMs = bestelltAt ? new Date(bestelltAt).getTime() : mountedAt.current;
  const elapsedMin = Math.max(0, Math.floor((now - startMs) / 60_000));

  if (status === 'delivered' || status === 'geliefert' || status === 'abgeholt') return null;

  const hours = Math.floor(elapsedMin / 60);
  const mins = elapsedMin % 60;
  const label = hours > 0 ? `${hours}h ${mins}min` : `${mins} Min`;

  const isRed   = elapsedMin >= 45;
  const isAmber = elapsedMin >= 30;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold',
        isRed
          ? 'bg-red-50 border border-red-200 text-red-700'
          : isAmber
          ? 'bg-amber-50 border border-amber-200 text-amber-700'
          : 'bg-matcha-50 border border-matcha-200 text-matcha-700',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full shrink-0',
          isRed ? 'bg-red-500 animate-pulse' : isAmber ? 'bg-amber-400 animate-pulse' : 'bg-matcha-500',
        )}
      />
      <span>
        Bestellung vor <span className="font-black tabular-nums">{label}</span> aufgegeben
      </span>
    </div>
  );
}
