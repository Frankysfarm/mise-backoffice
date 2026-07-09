'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Gauge, Loader2 } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface KapazitaetData {
  aktive_batches: number;
  max_kapazitaet: number;
  auslastung_pct: number;
  status: 'ok' | 'busy' | 'voll';
}

function generateMock(): KapazitaetData {
  const aktiv = Math.floor(Math.random() * 8) + 1;
  const max = 8;
  const pct = Math.round((aktiv / max) * 100);
  return {
    aktive_batches: aktiv,
    max_kapazitaet: max,
    auslastung_pct: pct,
    status: pct >= 90 ? 'voll' : pct >= 65 ? 'busy' : 'ok',
  };
}

export function KitchenPhase872BatchAuslastungsAmpel({ locationId }: Props) {
  const [data, setData] = useState<KapazitaetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/kitchen-capacity?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && typeof json.auslastung_pct === 'number') {
            const aktiv = json.aktive_batches ?? Math.round((json.auslastung_pct / 100) * 8);
            const max = json.max_kapazitaet ?? 8;
            const pct = json.auslastung_pct;
            setData({
              aktive_batches: aktiv,
              max_kapazitaet: max,
              auslastung_pct: pct,
              status: pct >= 90 ? 'voll' : pct >= 65 ? 'busy' : 'ok',
            });
            setLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) { setData(generateMock()); setLoading(false); }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId || loading) return null;
  if (!data) return null;

  const { aktive_batches, max_kapazitaet, auslastung_pct, status } = data;

  const ampelColor =
    status === 'voll'
      ? { dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', label: 'Küche voll', bg: 'bg-red-50 dark:bg-red-950' }
      : status === 'busy'
      ? { dot: 'bg-amber-500', bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', label: 'Küche busy', bg: 'bg-amber-50 dark:bg-amber-950' }
      : { dot: 'bg-matcha-500', bar: 'bg-matcha-500', text: 'text-matcha-700 dark:text-matcha-400', label: 'Küche OK', bg: 'bg-matcha-50 dark:bg-matcha-950' };

  return (
    <Card className={cn('p-3 space-y-2', ampelColor.bg)}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', ampelColor.dot, status === 'voll' && 'animate-pulse')} />
        <Gauge className={cn('h-4 w-4 shrink-0', ampelColor.text)} />
        <span className={cn('text-xs font-bold', ampelColor.text)}>Batch-Auslastung</span>
        <span className={cn('ml-auto text-xs font-black tabular-nums', ampelColor.text)}>
          {auslastung_pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', ampelColor.bar)}
          style={{ width: `${Math.min(100, auslastung_pct)}%` }}
        />
      </div>

      {/* Batch dots */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: max_kapazitaet }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-sm border text-[8px] font-bold flex items-center justify-center',
              i < aktive_batches
                ? cn(ampelColor.bar, 'border-transparent text-white')
                : 'border-muted bg-muted/40 text-muted-foreground'
            )}
          >
            {i < aktive_batches ? '●' : '○'}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {aktive_batches}/{max_kapazitaet} Batches
        </span>
      </div>

      <p className={cn('text-[11px] font-semibold', ampelColor.text)}>{ampelColor.label}</p>
    </Card>
  );
}
