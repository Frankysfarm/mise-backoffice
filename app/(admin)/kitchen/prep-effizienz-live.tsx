'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChefHat, Clock, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type EffRow = {
  bestellnummer: string;
  targetMin: number;
  actualMin: number;
  diffMin: number;
  pct: number;
  label: 'zu früh' | 'pünktlich' | 'zu spät';
};

export function KitchenPrepEffizienzLive({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  // Bestellungen die gerade in Zubereitung oder fertig sind — letzte 90 Min
  const window90 = 90 * 60_000;
  const relevant = orders.filter(o =>
    ['in_zubereitung', 'fertig', 'unterwegs'].includes(o.status) &&
    o.bestellt_am &&
    now - new Date(o.bestellt_am).getTime() < window90
  );

  if (relevant.length === 0) return null;

  // Aktive Bestellungen mit timing
  const rows: EffRow[] = [];
  let totalDiff = 0;
  let countWithData = 0;

  for (const o of relevant) {
    const timing = timings.find(t => t.order_id === o.id);
    const targetMin = timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? null;
    if (!targetMin || !o.bestellt_am) continue;

    let actualMin: number;
    if (o.fertig_am) {
      const startMs = timing?.cook_start_at
        ? new Date(timing.cook_start_at).getTime()
        : new Date(o.bestellt_am).getTime();
      actualMin = (new Date(o.fertig_am).getTime() - startMs) / 60_000;
    } else if (timing?.cook_start_at) {
      actualMin = (now - new Date(timing.cook_start_at).getTime()) / 60_000;
    } else {
      continue;
    }

    if (actualMin <= 0) continue;

    const diffMin = actualMin - targetMin;
    const pct = Math.round((actualMin / targetMin) * 100);
    const label: EffRow['label'] =
      diffMin < -1 ? 'zu früh' : diffMin <= 2 ? 'pünktlich' : 'zu spät';

    rows.push({ bestellnummer: o.bestellnummer, targetMin, actualMin, diffMin, pct, label });
    totalDiff += diffMin;
    countWithData++;
  }

  if (rows.length === 0) return null;

  const avgDiff = countWithData > 0 ? totalDiff / countWithData : 0;
  const onTime = rows.filter(r => r.label === 'pünktlich').length;
  const late = rows.filter(r => r.label === 'zu spät').length;
  const early = rows.filter(r => r.label === 'zu früh').length;
  const slaRate = Math.round((onTime / rows.length) * 100);

  const overallHealth = slaRate >= 80 ? 'gut' : slaRate >= 50 ? 'okay' : 'kritisch';
  const healthStyle = {
    gut:      { bg: 'bg-matcha-50',  border: 'border-matcha-200',  text: 'text-matcha-700',  badge: 'bg-matcha-100 text-matcha-700'   },
    okay:     { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700'     },
    kritisch: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700'         },
  }[overallHealth];

  const TrendIcon = avgDiff < -0.5 ? TrendingDown : avgDiff > 1 ? TrendingUp : Minus;
  const trendColor = avgDiff < -0.5 ? 'text-blue-500' : avgDiff > 1 ? 'text-red-500' : 'text-matcha-500';

  return (
    <div className={cn('rounded-xl border p-3 space-y-3', healthStyle.bg, healthStyle.border)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap size={14} className={healthStyle.text} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', healthStyle.text)}>
          Prep-Effizienz Live
        </span>
        <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold', healthStyle.badge)}>
          SLA {slaRate}%
        </span>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Pünktlich', value: onTime, color: 'text-matcha-700' },
          { label: 'Zu spät', value: late, color: 'text-red-600' },
          { label: 'Zu früh', value: early, color: 'text-blue-600' },
          { label: 'Ø Abw.', value: `${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(1)}m`, color: trendColor },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-white/60 border border-white/80 px-2 py-1.5 text-center">
            <div className={cn('text-base font-black tabular-nums', k.color)}>{k.value}</div>
            <div className="text-[9px] text-muted-foreground font-medium">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Trend-Indikator */}
      <div className="flex items-center gap-1.5">
        <TrendIcon size={12} className={trendColor} />
        <span className={cn('text-[11px] font-semibold', trendColor)}>
          {avgDiff < -0.5 ? 'Küche ist schneller als Ziel' :
           avgDiff > 1 ? `Ø ${avgDiff.toFixed(1)} Min über Ziel` :
           'Küche im Ziel-Bereich'}
        </span>
      </div>

      {/* Bestellungs-Zeilen (max 6) */}
      <div className="space-y-1">
        {rows.slice(0, 6).map(r => {
          const rowColor =
            r.label === 'pünktlich' ? 'text-matcha-700' :
            r.label === 'zu früh'   ? 'text-blue-600' :
                                       'text-red-600';
          const barFill =
            r.label === 'pünktlich' ? 'bg-matcha-400' :
            r.label === 'zu früh'   ? 'bg-blue-400' :
                                       'bg-red-400';
          const barW = Math.min(100, Math.max(4, r.pct));

          return (
            <div key={r.bestellnummer} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">
                #{r.bestellnummer}
              </span>
              <div className="flex-1 h-2 rounded-full bg-white/60 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-500', barFill)}
                  style={{ width: `${barW}%` }} />
              </div>
              <span className={cn('text-[10px] font-bold tabular-nums w-14 text-right shrink-0', rowColor)}>
                {r.actualMin.toFixed(1)}m / {r.targetMin}m
              </span>
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-muted-foreground">
        {rows.length} Bestellungen · letzte 90 Min · aktualisiert alle 15 Sek
      </div>
    </div>
  );
}
