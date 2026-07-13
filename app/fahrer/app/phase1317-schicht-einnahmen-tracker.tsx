'use client';

// Phase 1317 — Schicht-Einnahmen-Tracker (Fahrer-App)
// Trinkgeld + Liefergebühren kumulativ + 7-Tage-Vergleich.
// isOnline-Guard · 10-Min-Polling · nach Phase1312.

import { useEffect, useState } from 'react';
import { Banknote, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

interface TagesEinnahmen {
  datum: string;
  gesamt_eur: number;
  stopps: number;
}

interface EinnahmenData {
  heute_trinkgeld_eur: number;
  heute_liefergebuehren_eur: number;
  heute_gesamt_eur: number;
  heute_stopps: number;
  vergleich_7_tage: TagesEinnahmen[];
  ø_7_tage_eur: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const TAG_KÜRZEL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function FahrerPhase1317SchichtEinnahmenTracker({ driverId, isOnline }: Props) {
  const [data, setData] = useState<EinnahmenData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/schicht-einnahmen-tracker?driver_id=${driverId}`);
        if (!res.ok) throw new Error('fetch failed');
        setData(await res.json());
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [isOnline, driverId]);

  if (!isOnline) return null;

  if (loading && !data) {
    return (
      <div className="rounded-2xl border bg-card px-4 py-3 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade Einnahmen…
      </div>
    );
  }

  if (!data) return null;

  const TrendIcon = data.trend === 'besser' ? TrendingUp : data.trend === 'schlechter' ? TrendingDown : Minus;
  const trendColor =
    data.trend === 'besser' ? 'text-emerald-600 dark:text-emerald-400' :
    data.trend === 'schlechter' ? 'text-red-600 dark:text-red-400' :
    'text-muted-foreground';

  const maxGesamt = Math.max(...data.vergleich_7_tage.map((d) => d.gesamt_eur), 1);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border bg-card px-4 py-3 mb-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Banknote className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Schicht-Einnahmen</span>
        <div className={cn('ml-auto flex items-center gap-1 text-xs font-bold', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          {data.trend === 'besser' ? 'Über Ø' : data.trend === 'schlechter' ? 'Unter Ø' : 'Im Ø'}
        </div>
      </div>

      {/* Heute KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Heute gesamt</div>
          <div className="text-xl font-black tabular-nums text-foreground">{euro(data.heute_gesamt_eur)}</div>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Ø 7 Tage</div>
          <div className="text-xl font-black tabular-nums text-foreground">{euro(data.ø_7_tage_eur)}</div>
        </div>
      </div>

      {/* Aufschlüsselung */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Trinkgeld: <strong className="text-foreground">{euro(data.heute_trinkgeld_eur)}</strong></span>
        <span>Gebühren: <strong className="text-foreground">{euro(data.heute_liefergebuehren_eur)}</strong></span>
        <span>Stopps: <strong className="text-foreground">{data.heute_stopps}</strong></span>
      </div>

      {/* 7-Tage Balken-Sparkline */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">7-Tage-Verlauf</div>
        <div className="flex items-end gap-1 h-10">
          {data.vergleich_7_tage.map((d) => {
            const pct = (d.gesamt_eur / maxGesamt) * 100;
            const isToday = d.datum === todayKey;
            const dayName = TAG_KÜRZEL[new Date(d.datum + 'T12:00:00').getDay() === 0 ? 6 : new Date(d.datum + 'T12:00:00').getDay() - 1];
            return (
              <div key={d.datum} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end" style={{ height: 32 }}>
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-500',
                      isToday ? 'bg-matcha-500' : 'bg-muted-foreground/30'
                    )}
                    style={{ height: `${Math.max(4, pct)}%` }}
                  />
                </div>
                <span className={cn('text-[8px] font-bold tabular-nums', isToday ? 'text-matcha-600 dark:text-matcha-400' : 'text-muted-foreground')}>
                  {dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
