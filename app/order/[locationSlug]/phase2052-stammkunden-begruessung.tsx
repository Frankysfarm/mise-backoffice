'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Sparkles } from 'lucide-react';

interface Props {
  locationId: string;
  customerName?: string | null;
  orderCount?: number;
  className?: string;
}

const MIN_ORDERS = 3;

export function StorefrontPhase2052StammkundenBegruessung({
  locationId,
  customerName,
  orderCount,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;
  if (dismissed) return null;
  if (!locationId) return null;
  if (!customerName) return null;
  if ((orderCount ?? 0) < MIN_ORDERS) return null;

  const firstName = customerName.split(' ')[0];

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 rounded-xl px-4 py-3',
      'bg-gradient-to-r from-purple-950 to-pink-950 border border-purple-700',
      className,
    )}>
      <div className="flex items-center gap-2 text-sm text-purple-200">
        <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
        <span>
          <span className="font-bold text-white">Willkommen zurück, {firstName}!</span>
          {' '}Schön, dass du wieder da bist.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded-full text-purple-400 hover:text-purple-200 hover:bg-purple-800 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
