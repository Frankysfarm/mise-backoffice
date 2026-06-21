'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  onlineSeit: string | null;
  hasActiveBatch: boolean;
}

export function FahrerPausenEmpfehlung({ onlineSeit, hasActiveBatch }: Props) {
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Only show when driver is between tours (no active batch)
  if (dismissed || !onlineSeit || hasActiveBatch) return null;

  const shiftMin = Math.floor((now - new Date(onlineSeit).getTime()) / 60_000);

  // Recommend break after 3+ hours on shift
  if (shiftMin < 180) return null;

  const shiftHours = (shiftMin / 60).toFixed(1);
  const urgency = shiftMin >= 360 ? 'high' : shiftMin >= 240 ? 'medium' : 'low';

  const colors = {
    high:   { border: 'border-red-700/40',    bg: 'bg-red-900/20',    title: 'text-red-300',    body: 'text-red-200',    icon: '⚠️' },
    medium: { border: 'border-amber-700/40',  bg: 'bg-amber-900/20',  title: 'text-amber-300',  body: 'text-amber-200',  icon: '☕' },
    low:    { border: 'border-blue-700/40',   bg: 'bg-blue-900/20',   title: 'text-blue-300',   body: 'text-blue-200',   icon: '☕' },
  } as const;

  const c = colors[urgency];

  return (
    <section className={cn('rounded-2xl border p-4 space-y-2', c.bg, c.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{c.icon}</span>
          <div>
            <div className={cn('text-xs font-bold uppercase tracking-wide', c.title)}>
              Pausen-Empfehlung
            </div>
            <div className="text-sm font-bold text-white">
              {urgency === 'high'
                ? 'Lange Schicht — kurze Pause empfohlen!'
                : 'Zeit für eine kurze Pause'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/40 hover:text-white/80 text-lg leading-none shrink-0"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>
      <p className={cn('text-xs leading-relaxed', c.body)}>
        Du bist seit {shiftHours} Stunden im Einsatz. Nutze diese Wartezeit für eine kurze
        Pause — so bleibst du fit für die nächste Tour.
      </p>
    </section>
  );
}
