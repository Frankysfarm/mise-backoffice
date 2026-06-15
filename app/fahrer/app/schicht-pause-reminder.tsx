'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, UtensilsCrossed, X } from 'lucide-react';

interface Props {
  onlineSince: string | null;
}

const GENTLE_THRESHOLD_MIN  = 150; // 2,5 Stunden
const URGENT_THRESHOLD_MIN  = 270; // 4,5 Stunden
const DISMISS_RESET_MIN     = 30;  // Nach 30 Min Erinnerung wieder zeigen

export function SchichtPauseReminder({ onlineSince }: Props) {
  const [, setTick]         = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  if (!onlineSince) return null;

  const now = Date.now();
  const shiftStartMs = new Date(onlineSince).getTime();
  if (isNaN(shiftStartMs)) return null;

  const shiftMin = Math.floor((now - shiftStartMs) / 60_000);

  // Unter Schwellenwert: nichts anzeigen
  if (shiftMin < GENTLE_THRESHOLD_MIN) return null;

  // Wenn dismissed: prüfen ob Reset-Zeit abgelaufen
  if (dismissedAt !== null) {
    const dismissedMinAgo = (now - dismissedAt) / 60_000;
    if (dismissedMinAgo < DISMISS_RESET_MIN) return null;
  }

  const isUrgent = shiftMin >= URGENT_THRESHOLD_MIN;

  const hours = Math.floor(shiftMin / 60);
  const mins  = shiftMin % 60;

  const handleDismiss = () => setDismissedAt(now);

  if (isUrgent) {
    return (
      <div className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        'border-red-500/40 bg-red-500/15',
      )}>
        <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-red-300">
            Pflichtpause: Mehr als 4,5 Std Schicht!
          </p>
          <p className="mt-0.5 text-[11px] text-red-400">
            Bitte nach nächster Lieferung Pause machen
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-red-400 transition hover:bg-red-500/20"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border px-4 py-3',
      'border-amber-500/40 bg-amber-500/15',
    )}>
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-300">
          Du fährst seit{' '}
          <span className="font-black tabular-nums">
            {hours} Std{mins > 0 ? ` ${mins} Min` : ''}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-amber-400">
          Denk an eine kurze Pause nach der nächsten Lieferung
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-lg p-1 text-amber-400 transition hover:bg-amber-500/20"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
