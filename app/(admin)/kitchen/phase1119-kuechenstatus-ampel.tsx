'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1119 — Küchenstatus-Ampel (Kitchen)
// 5-Min-Bestellrate aus letzten 30 Min + Trend + Kapazitäts-Ampel

interface Item { name?: string; title?: string; quantity?: number }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

type Level = 'niedrig' | 'mittel' | 'hoch' | 'peak';

type Segment = {
  label: string;
  bestellungen: number;
  rate: number; // orders/h
};

function computeSegments(orders: Order[]): Segment[] {
  const now = Date.now();
  const segments: Segment[] = [];
  for (let i = 5; i >= 0; i--) {
    const segStart = new Date(now - (i + 1) * 5 * 60 * 1000);
    const segEnd = new Date(now - i * 5 * 60 * 1000);
    const count = orders.filter(o => {
      if (!o.created_at) return false;
      const t = new Date(o.created_at).getTime();
      return t >= segStart.getTime() && t < segEnd.getTime();
    }).length;
    const minAgo = (i + 1) * 5;
    segments.push({
      label: `-${minAgo}Min`,
      bestellungen: count,
      rate: count * 12, // scale to orders/h (5-min window × 12)
    });
  }
  return segments;
}

function getLevel(rate: number): Level {
  if (rate >= 40) return 'peak';
  if (rate >= 25) return 'hoch';
  if (rate >= 12) return 'mittel';
  return 'niedrig';
}

function getTrend(segments: Segment[]): 'up' | 'down' | 'gleich' {
  if (segments.length < 4) return 'gleich';
  const first = segments.slice(0, 3).reduce((s, x) => s + x.bestellungen, 0);
  const last = segments.slice(3).reduce((s, x) => s + x.bestellungen, 0);
  const diff = last - first;
  if (diff > 1) return 'up';
  if (diff < -1) return 'down';
  return 'gleich';
}

const LEVEL_STYLES: Record<Level, { bg: string; text: string; label: string; bar: string }> = {
  niedrig: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', label: 'Niedrig', bar: 'bg-emerald-400' },
  mittel:  { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-300',   label: 'Mittel',  bar: 'bg-amber-400' },
  hoch:    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', label: 'Hoch',    bar: 'bg-orange-400' },
  peak:    { bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-300',       label: 'Peak!',   bar: 'bg-red-500' },
};

export function KitchenPhase1119KuehenstatusAmpel({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const { segments, currentRate, level, trend, currentCount } = useMemo(() => {
    const segs = computeSegments(orders);
    const last = segs[segs.length - 1];
    const rate = last.rate;
    const level = getLevel(rate);
    const trend = getTrend(segs);
    const currentCount = segs.slice(-2).reduce((s, x) => s + x.bestellungen, 0);
    return { segments: segs, currentRate: rate, level, trend, currentCount };
  }, [orders]);

  const st = LEVEL_STYLES[level];
  const maxRate = Math.max(...segments.map(s => s.bestellungen), 1);
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-emerald-500' : 'text-muted-foreground';

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', st.bg)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={cn('font-bold text-sm', st.text)}>Küchenstatus-Ampel</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', st.text, 'bg-white/60 dark:bg-white/10')}>
            {st.label}
          </span>
          {level === 'peak' && (
            <span className="animate-pulse text-[10px] font-black text-red-600 dark:text-red-400 uppercase">● Live</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
          <span className={cn('text-xs font-bold', st.text)}>{currentCount} / 10 Min</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/30 dark:border-white/10 pt-3">
          {/* Rate indicator */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Aktuelle Bestellrate</span>
            <span className={cn('font-bold', st.text)}>{Math.round(currentRate)} Bestellungen/h</span>
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-1 h-16">
            {segments.map((seg, i) => {
              const pct = Math.round((seg.bestellungen / maxRate) * 100);
              const isLast = i === segments.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-muted-foreground font-mono">{seg.bestellungen}</span>
                  <div className="w-full rounded-sm overflow-hidden bg-muted/30" style={{ height: '36px' }}>
                    <div
                      className={cn('w-full rounded-sm transition-all', isLast ? st.bar : 'bg-muted-foreground/30')}
                      style={{ height: `${Math.max(pct, 4)}%`, marginTop: `${100 - Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground whitespace-nowrap">{seg.label}</span>
                </div>
              );
            })}
          </div>

          {/* Recommendation */}
          <div className={cn('rounded-lg px-3 py-2 text-xs', st.bg, 'border border-white/40 dark:border-white/10')}>
            <span className={cn('font-bold', st.text)}>
              {level === 'peak' && '🚨 Alle verfügbaren Stationen aktivieren — maximale Auslastung!'}
              {level === 'hoch' && '⚡ Hohe Auslastung — Vorabzubereitung empfohlen.'}
              {level === 'mittel' && '✅ Moderate Auslastung — normaler Betrieb.'}
              {level === 'niedrig' && '😌 Ruhige Phase — gute Zeit für Vorbereitung.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
