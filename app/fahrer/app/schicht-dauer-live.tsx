'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onlineSeit: string | null;
  stopsHeute: number;
  className?: string;
}

function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
}

export function FahrerSchichtDauerLive({ onlineSeit, stopsHeute, className }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!onlineSeit) return null;

  const startMs = new Date(onlineSeit).getTime();
  const elapsedMs = Math.max(0, now - startMs);
  const elapsedMin = Math.floor(elapsedMs / 60_000);

  const stopRate = elapsedMin > 0 ? (stopsHeute / (elapsedMin / 60)).toFixed(1) : '—';

  const intensity =
    elapsedMin >= 360 ? 'high' :
    elapsedMin >= 180 ? 'medium' : 'low';

  const style = {
    low:    { ring: 'border-matcha-300',  bg: 'bg-matcha-50',  text: 'text-matcha-700',  badge: 'bg-matcha-100 text-matcha-800' },
    medium: { ring: 'border-amber-300',   bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100  text-amber-800'  },
    high:   { ring: 'border-red-300',     bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-100    text-red-800'    },
  }[intensity];

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-2xl border px-4 py-3',
      style.ring, style.bg, className,
    )}>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', style.badge)}>
        <Timer className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-[10px] font-bold uppercase tracking-wider', style.text)}>
          Schicht läuft
        </div>
        <div className={cn('text-lg font-black tabular-nums leading-none mt-0.5', style.text)}>
          {fmtDuration(elapsedMs)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] font-bold text-stone-500 tabular-nums">
          {stopsHeute} {stopsHeute === 1 ? 'Stopp' : 'Stopps'}
        </div>
        <div className="text-[9px] text-stone-400 tabular-nums">
          {stopRate} / Std.
        </div>
      </div>
    </div>
  );
}
