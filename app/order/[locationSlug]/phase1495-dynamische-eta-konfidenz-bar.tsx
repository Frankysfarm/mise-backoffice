'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Phase 1495 — Dynamische ETA-Konfidenz-Bar (Storefront)
// Zeigt eine animierte Konfidenz-Leiste für die aktuelle Lieferzeit-Schätzung
// mit Live-Updates alle 30s und farblicher Vertrauensanzeige.
// Hydration-safe. Nach Phase 1490.

interface Props {
  locationId: string | null;
  estimatedMinutes?: number | null;
  orderPlaced?: boolean;
}

interface EtaData {
  estimated_min: number;
  confidence_pct: number;
  range_low: number;
  range_high: number;
  load_label: 'niedrig' | 'normal' | 'hoch';
  last_updated: string;
}

const LOAD_CFG = {
  niedrig: { bar: 'bg-emerald-500', text: 'text-emerald-600', label: 'Geringe Auslastung', dot: 'bg-emerald-400' },
  normal:  { bar: 'bg-amber-400',   text: 'text-amber-600',   label: 'Normale Auslastung', dot: 'bg-amber-400'  },
  hoch:    { bar: 'bg-rose-500',    text: 'text-rose-600',    label: 'Hohe Auslastung',    dot: 'bg-rose-400'   },
};

function buildMock(baseMin: number | null | undefined): EtaData {
  const est = baseMin ?? 32;
  const conf = 75 + Math.floor(Math.random() * 20);
  return {
    estimated_min: est,
    confidence_pct: conf,
    range_low: Math.max(est - 5, 10),
    range_high: est + 8,
    load_label: conf > 85 ? 'niedrig' : conf > 70 ? 'normal' : 'hoch',
    last_updated: new Date().toISOString(),
  };
}

export function StorefrontPhase1495DynamischeEtaKonfidenzBar({ locationId, estimatedMinutes, orderPlaced }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<EtaData>(() => buildMock(estimatedMinutes));
  const [prevMin, setPrevMin] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/public/eta?location_id=${locationId}`
          : null;
        if (!url) return;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (typeof json?.estimated_min === 'number') {
            const newData: EtaData = {
              estimated_min: json.estimated_min,
              confidence_pct: json.confidence_pct ?? 80,
              range_low: json.range_low ?? json.estimated_min - 5,
              range_high: json.range_high ?? json.estimated_min + 10,
              load_label: json.load_label ?? 'normal',
              last_updated: new Date().toISOString(),
            };
            setData((prev) => {
              if (prev.estimated_min !== newData.estimated_min) {
                setPrevMin(prev.estimated_min);
                setFlash(true);
                setTimeout(() => { setFlash(false); setPrevMin(null); }, 1_500);
              }
              return newData;
            });
          }
        }
      } catch {}
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!mounted) return null;

  const cfg = LOAD_CFG[data.load_label];
  const confidencePct = Math.min(100, Math.max(0, data.confidence_pct));

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 space-y-2 transition-all duration-500',
      flash ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20' : 'border-border bg-muted/30',
    )}>
      {/* ETA headline */}
      <div className="flex items-center gap-2">
        <span className={cn('relative flex h-2 w-2 rounded-full', cfg.dot)}>
          {orderPlaced && (
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', cfg.dot)} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-foreground tabular-nums">
              {flash && prevMin !== null ? (
                <span className="line-through text-muted-foreground text-sm mr-1">{prevMin}</span>
              ) : null}
              {data.estimated_min}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">Min</span>
            <span className="text-[10px] text-muted-foreground ml-1">
              ({data.range_low}–{data.range_high} Min)
            </span>
          </div>
        </div>
        <span className={cn('text-[10px] font-bold', cfg.text)}>{cfg.label}</span>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Konfidenz
          </span>
          <span className={cn('text-[10px] font-black tabular-nums', cfg.text)}>
            {confidencePct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
