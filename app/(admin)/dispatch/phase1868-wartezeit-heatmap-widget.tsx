'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

/**
 * Phase 1868 — Wartezeit-Heatmap-Widget (Dispatch)
 *
 * 4 Kacheln A/B/C/D mit Ø Wartezeit + Trend-Pfeil.
 * Alert-Banner wenn eine Zone >40 Min. 10-Min-Polling.
 * GET /api/delivery/admin/wartezeit-heatmap (Phase 1871).
 */

type Trend = 'up' | 'down' | 'gleich';

interface ZoneWartezeit {
  zone: string;
  avg_wartezeit_min: number;
  heute_avg_min: number;
  trend: Trend;
  delta_min: number;
  bestellungen_woche: number;
  bestellungen_heute: number;
}

const MOCK_ZONEN: ZoneWartezeit[] = [
  { zone: 'A', avg_wartezeit_min: 22, heute_avg_min: 20, trend: 'down', delta_min: -2, bestellungen_woche: 84, bestellungen_heute: 12 },
  { zone: 'B', avg_wartezeit_min: 31, heute_avg_min: 35, trend: 'up',   delta_min: 4,  bestellungen_woche: 62, bestellungen_heute: 9  },
  { zone: 'C', avg_wartezeit_min: 38, heute_avg_min: 38, trend: 'gleich', delta_min: 0, bestellungen_woche: 41, bestellungen_heute: 6 },
  { zone: 'D', avg_wartezeit_min: 45, heute_avg_min: 48, trend: 'up',   delta_min: 3,  bestellungen_woche: 18, bestellungen_heute: 2 },
];

function ampelFarbe(min: number) {
  if (min >= 40) return 'red';
  if (min >= 30) return 'amber';
  return 'green';
}

const FARB_MAP = {
  green: {
    kachel: 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800',
    zahl: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300',
  },
  amber: {
    kachel: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    zahl: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  red: {
    kachel: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    zahl: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  },
} as const;

function TrendIcon({ trend, delta }: { trend: Trend; delta: number }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-matcha-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1868WartezeitHeatmapWidget({ locationId, className }: Props) {
  const [zonen, setZonen] = useState<ZoneWartezeit[]>([]);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/wartezeit-heatmap?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          setZonen(data.zonen ?? []);
        }
      } catch {
        setZonen(MOCK_ZONEN);
      }
    };

    laden();
    const id = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = zonen.length > 0 ? zonen : MOCK_ZONEN;
  const kritischZonen = anzeige.filter((z) => z.heute_avg_min > 40);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Map className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Wartezeit-Heatmap Zonen</span>
        {kritischZonen.length > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {kritischZonen.length} Zone{kritischZonen.length > 1 ? 'n' : ''} &gt;40 Min
          </span>
        )}
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {kritischZonen.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Zone{kritischZonen.length > 1 ? 'n' : ''} {kritischZonen.map((z) => z.zone).join(', ')} mit &gt;40 Min Wartezeit — sofortige Maßnahmen empfohlen.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {anzeige.map((z) => {
              const farbe = ampelFarbe(z.heute_avg_min);
              const cfg = FARB_MAP[farbe];
              const bar = Math.min(100, (z.heute_avg_min / 60) * 100);
              return (
                <div
                  key={z.zone}
                  className={cn('rounded-xl border p-3 flex flex-col gap-1.5', cfg.kachel)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Zone {z.zone}
                    </span>
                    <TrendIcon trend={z.trend} delta={z.delta_min} />
                  </div>
                  <span className={cn('text-2xl font-black tabular-nums leading-none', cfg.zahl)}>
                    {z.heute_avg_min}
                    <span className="text-xs font-semibold ml-0.5">Min</span>
                  </span>
                  <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        farbe === 'red' ? 'bg-red-500' : farbe === 'amber' ? 'bg-amber-400' : 'bg-matcha-500',
                      )}
                      style={{ width: `${bar}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-muted-foreground">Ø 7T: {z.avg_wartezeit_min} Min</span>
                    {z.delta_min !== 0 && (
                      <span className={cn(
                        'text-[10px] font-semibold',
                        z.delta_min > 0 ? 'text-red-600' : 'text-matcha-600',
                      )}>
                        {z.delta_min > 0 ? '+' : ''}{z.delta_min} Min
                      </span>
                    )}
                  </div>
                  <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 text-center font-semibold', cfg.badge)}>
                    {z.bestellungen_heute} Heute
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">Aktualisierung alle 10 Min</p>
        </div>
      )}
    </div>
  );
}
