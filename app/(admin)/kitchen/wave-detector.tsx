'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, AlertTriangle } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  typ: string;
};

type WaveState = {
  count: number;
  firstAt: number;
  types: Record<string, number>;
};

export function KitchenWaveDetector({ orders }: { orders: Order[] }) {
  const [wave, setWave] = useState<WaveState | null>(null);
  const [dismissed, setDismissed] = useState<number>(0);
  const prevNewIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();
    const WAVE_WINDOW_MS = 5 * 60_000;

    // Recent new orders: arrived within last 5 min, still active
    const recent = orders.filter((o) => {
      if (!o.bestellt_am) return false;
      const age = now - new Date(o.bestellt_am).getTime();
      return age <= WAVE_WINDOW_MS && ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status);
    });

    if (recent.length < 3) {
      setWave(null);
      return;
    }

    const firstAt = Math.min(...recent.map((o) => new Date(o.bestellt_am!).getTime()));
    const types: Record<string, number> = {};
    for (const o of recent) {
      types[o.typ] = (types[o.typ] ?? 0) + 1;
    }

    // Check if this is actually new (not just unchanged)
    const currentIds = new Set(recent.map((o) => o.id));
    const hasNew = [...currentIds].some((id) => !prevNewIds.current.has(id));
    prevNewIds.current = currentIds;

    if (firstAt <= dismissed) return; // Already dismissed this wave

    if (hasNew && recent.length >= 3) {
      setWave({ count: recent.length, firstAt, types });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  if (!wave) return null;

  const windowMin = Math.ceil((Date.now() - wave.firstAt) / 60_000);
  const isHeavy = wave.count >= 6;
  const isMedium = wave.count >= 4;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-md',
      isHeavy
        ? 'border-red-400 bg-red-50 animate-pulse'
        : isMedium
        ? 'border-orange-400 bg-orange-50'
        : 'border-amber-300 bg-amber-50',
    )}>
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        isHeavy ? 'bg-red-500 text-white' : 'bg-orange-500 text-white',
      )}>
        {isHeavy ? <AlertTriangle className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-display text-sm font-black',
          isHeavy ? 'text-red-900' : 'text-orange-900',
        )}>
          {isHeavy ? '🔥 Bestellungswelle!' : '⚡ Erhöhter Andrang'}
          {' · '}
          <span className="tabular-nums">{wave.count}</span> Bestellungen in {windowMin} Min
        </div>
        <div className={cn(
          'text-[11px] mt-0.5 space-x-2',
          isHeavy ? 'text-red-700' : 'text-orange-700',
        )}>
          {Object.entries(wave.types).map(([typ, count]) => (
            <span key={typ} className="inline-flex items-center gap-1">
              <span>{typ === 'lieferung' ? '🛵' : typ === 'abholung' ? '🥡' : '🍽️'}</span>
              <span className="font-bold tabular-nums">{count}</span>
            </span>
          ))}
          <span className="opacity-70">— alle Stationen auf Bereitschaft!</span>
        </div>
      </div>
      <button
        onClick={() => {
          setDismissed(wave.firstAt);
          setWave(null);
        }}
        className={cn(
          'shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition',
          isHeavy ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-orange-300 text-orange-700 hover:bg-orange-100',
        )}
      >
        OK
      </button>
    </div>
  );
}
