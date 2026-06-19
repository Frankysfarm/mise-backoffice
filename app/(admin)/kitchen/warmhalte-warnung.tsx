'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Thermometer, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  fertig_am?: string | null;
};

interface Props {
  orders: Order[];
}

type WarmthLevel = 'warm' | 'kuehlend' | 'kalt';

function getWarmthLevel(fertigAm: string, now: number): { level: WarmthLevel; waitMin: number; warmthPct: number } {
  const waitMs = now - new Date(fertigAm).getTime();
  const waitMin = Math.floor(waitMs / 60_000);
  const MAX_WARM_MIN = 20;
  const warmthPct = Math.max(0, 100 - (waitMin / MAX_WARM_MIN) * 100);

  let level: WarmthLevel = 'warm';
  if (waitMin >= 15) level = 'kalt';
  else if (waitMin >= 8) level = 'kuehlend';

  return { level, waitMin, warmthPct };
}

function levelStyle(level: WarmthLevel) {
  switch (level) {
    case 'warm': return { bar: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200', badge: 'bg-matcha-100 text-matcha-800' };
    case 'kuehlend': return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800' };
    case 'kalt': return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-300', badge: 'bg-red-100 text-red-800' };
  }
}

export function KitchenWarmhalteWarnung({ orders }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  const waiting = orders.filter(
    (o) => (o.status === 'fertig') && o.fertig_am && o.typ === 'lieferung',
  );

  if (waiting.length === 0) return null;

  const withWarmth = waiting
    .map((o) => ({ o, ...getWarmthLevel(o.fertig_am!, now) }))
    .sort((a, b) => a.warmthPct - b.warmthPct);

  const kaltCount = withWarmth.filter(w => w.level === 'kalt').length;
  const kuehlendCount = withWarmth.filter(w => w.level === 'kuehlend').length;

  return (
    <Card className="overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        kaltCount > 0 ? 'bg-red-50' : kuehlendCount > 0 ? 'bg-amber-50' : 'bg-white',
      )}>
        <Thermometer className={cn('h-4 w-4 shrink-0', kaltCount > 0 ? 'text-red-500' : 'text-amber-500')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Warmhalte-Status · {waiting.length} wartend
        </span>
        {kaltCount > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" /> {kaltCount} kalt
          </span>
        )}
        {kuehlendCount > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-amber-400 text-white px-2 py-0.5 text-[10px] font-bold">
            <Clock className="h-2.5 w-2.5" /> {kuehlendCount} kühlend
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        {withWarmth.map(({ o, level, waitMin, warmthPct }) => {
          const s = levelStyle(level);
          return (
            <div key={o.id} className={cn('rounded-xl border px-3 py-2 space-y-1.5', s.bg)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-black truncate">#{o.bestellnummer}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{o.kunde_name}</span>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', s.badge)}>
                  {level === 'warm' ? '🔥 Warm' : level === 'kuehlend' ? '🌡️ Kühlend' : '❄️ Kalt'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', s.bar)}
                    style={{ width: `${warmthPct}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-black tabular-nums shrink-0', s.text)}>
                  {waitMin} Min
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-t bg-muted/30 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-matcha-500 inline-block" /> warm (&lt;8 Min)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> kühlend (8–15 Min)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> kalt (&gt;15 Min)</span>
      </div>
    </Card>
  );
}
