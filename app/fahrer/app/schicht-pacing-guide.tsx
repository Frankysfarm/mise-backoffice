'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = { geliefert_am: string | null };

interface Props {
  stops: Stop[];
  startedAt: string | null;
  totalStops: number;
}

type Pace = 'ahead' | 'on-track' | 'behind';

export function FahrerSchichtPacingGuide({ stops, startedAt, totalStops }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  if (!startedAt || totalStops === 0) return null;

  const now = Date.now();
  const elapsedMs = now - new Date(startedAt).getTime();
  const elapsedMin = elapsedMs / 60_000;
  if (elapsedMin < 1) return null;

  const done = stops.filter(s => s.geliefert_am).length;
  const remaining = totalStops - done;

  const actualRate = done / elapsedMin;
  const expectedDoneByNow = (elapsedMin / 30) * (totalStops / Math.max(totalStops, 1));
  const expectedRate = totalStops > 0 ? (totalStops / (totalStops * 25)) : 0;

  const elapsedPct = Math.min(100, (done / totalStops) * 100);
  const expectedPct = Math.min(100, (elapsedMin / (totalStops * 25)) * 100);
  const gap = elapsedPct - expectedPct;

  const pace: Pace = gap > 10 ? 'ahead' : gap < -10 ? 'behind' : 'on-track';
  void actualRate; void expectedDoneByNow; void expectedRate;

  const CONFIG: Record<Pace, { label: string; sub: string; bg: string; bar: string; Icon: typeof TrendingUp }> = {
    'ahead':    { label: 'Voraus!',       sub: 'Gutes Tempo',      bg: 'bg-matcha-50 border-matcha-200',  bar: 'bg-matcha-500', Icon: TrendingUp },
    'on-track': { label: 'Im Plan',       sub: 'Weiter so!',       bg: 'bg-blue-50 border-blue-200',     bar: 'bg-blue-500',   Icon: Minus      },
    'behind':   { label: 'Rückstand',     sub: 'Tempo erhöhen',    bg: 'bg-amber-50 border-amber-200',   bar: 'bg-amber-500',  Icon: TrendingDown },
  };
  const cfg = CONFIG[pace];
  const { Icon } = cfg;

  const etaMin = remaining > 0 && done > 0
    ? Math.round((elapsedMin / done) * remaining)
    : null;

  return (
    <div className={cn('rounded-2xl border px-4 py-3', cfg.bg)}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cfg.bar, 'text-white')}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-foreground">{cfg.label}</div>
          <div className="text-[10px] text-muted-foreground">{cfg.sub}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-black tabular-nums text-foreground">
            {done}/{totalStops}
          </div>
          <div className="text-[10px] text-muted-foreground">Stopps</div>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
          style={{ width: `${Math.round(elapsedPct)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{Math.round(elapsedMin)} Min seit Start</span>
        {etaMin !== null && <span>~{etaMin} Min bis Abschluss</span>}
      </div>
    </div>
  );
}
