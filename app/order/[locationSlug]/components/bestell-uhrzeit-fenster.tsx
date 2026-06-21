'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  etaMinutes: number;
  isDelivery: boolean;
  className?: string;
}

function toTimeStr(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function BestellUhrzeitFenster({ etaMinutes, isDelivery, className }: Props) {
  const [nowMs] = React.useState(() => Date.now());

  if (etaMinutes <= 0) return null;

  // ±5 min window around the ETA midpoint
  const midMs = nowMs + etaMinutes * 60_000;
  const earliestMs = midMs - 5 * 60_000;
  const latestMs   = midMs + 5 * 60_000;

  const earliest = toTimeStr(earliestMs);
  const latest   = toTimeStr(latestMs);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-matcha-200 bg-matcha-50 px-4 py-3',
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
        <Clock className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">
          {isDelivery ? 'Voraussichtliche Lieferzeit' : 'Voraussichtliche Abholzeit'}
        </div>
        <div className="text-base font-black text-matcha-900 tabular-nums">
          {earliest} – {latest} Uhr
        </div>
      </div>
    </div>
  );
}
