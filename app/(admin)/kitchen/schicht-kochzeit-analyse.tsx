'use client';

/**
 * KitchenSchichtKochzeitAnalyse — Phase 247
 * Analysiert die Kochzeit-Genauigkeit der aktuellen Schicht:
 * - Tatsächliche vs. geschätzte Zubereitungszeit
 * - Pünktlichkeitsquote (fertig_am ≤ ready_target)
 * - Farbkodierung nach Abweichung
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle2, TrendingDown, TrendingUp, Minus, Clock, Target } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
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

interface PrepResult {
  id: string;
  bestellnummer: string;
  estimatedMin: number;
  actualMin: number;
  deltaMin: number; // positiv = zu spät, negativ = zu früh
  onTime: boolean;
}

function getBarColor(delta: number): string {
  if (delta <= -2) return '#3b82f6';   // sehr früh (blau)
  if (delta <= 2)  return '#22c55e';   // pünktlich (grün)
  if (delta <= 6)  return '#eab308';   // leicht zu spät (gelb)
  if (delta <= 10) return '#f97316';   // zu spät (orange)
  return '#ef4444';                     // sehr zu spät (rot)
}

function TrendIcon({ delta }: { delta: number }) {
  if (Math.abs(delta) <= 2) return <Minus className="h-3 w-3 text-matcha-500" />;
  if (delta > 2) return <TrendingUp className="h-3 w-3 text-orange-500" />;
  return <TrendingDown className="h-3 w-3 text-blue-500" />;
}

export function KitchenSchichtKochzeitAnalyse({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const results = useMemo((): PrepResult[] => {
    const res: PrepResult[] = [];
    for (const t of timings) {
      if (t.status !== 'ready' && t.status !== 'picked_up') continue;
      if (!t.ready_target) continue;
      const order = orders.find(o => o.id === t.order_id);
      if (!order || !order.fertig_am || !order.bestellt_am) continue;

      const estimatedMin = t.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;
      const actualMin = Math.round(
        (new Date(order.fertig_am).getTime() - new Date(order.bestellt_am).getTime()) / 60_000,
      );
      if (actualMin <= 0 || actualMin > 120) continue;

      const targetMs = new Date(t.ready_target).getTime();
      const actualMs = new Date(order.fertig_am).getTime();
      const deltaMin = Math.round((actualMs - targetMs) / 60_000);

      res.push({
        id: t.id,
        bestellnummer: order.bestellnummer,
        estimatedMin,
        actualMin,
        deltaMin,
        onTime: deltaMin <= 3,
      });
    }
    return res.slice(-12); // letzte 12 abgeschlossene Bestellungen
  }, [orders, timings]);

  if (results.length < 2) return null;

  const onTimeCount = results.filter(r => r.onTime).length;
  const onTimePct = Math.round((onTimeCount / results.length) * 100);
  const avgDelta = Math.round(results.reduce((s, r) => s + r.deltaMin, 0) / results.length);
  const avgActual = Math.round(results.reduce((s, r) => s + r.actualMin, 0) / results.length);
  const avgEstimated = Math.round(results.reduce((s, r) => s + r.estimatedMin, 0) / results.length);

  const chartData = results.map(r => ({
    name: `#${r.bestellnummer.slice(-3)}`,
    delta: r.deltaMin,
    actual: r.actualMin,
  }));

  const pctColor =
    onTimePct >= 85 ? 'text-matcha-600' :
    onTimePct >= 70 ? 'text-amber-600' :
    'text-red-600';

  const pctBg =
    onTimePct >= 85 ? 'bg-matcha-50 border-matcha-200' :
    onTimePct >= 70 ? 'bg-amber-50 border-amber-200' :
    'bg-red-50 border-red-200';

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', pctBg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Kochzeit-Analyse · Schicht
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className={cn('h-3.5 w-3.5', pctColor)} />
          <span className={cn('text-sm font-black tabular-nums', pctColor)}>
            {onTimePct}% pünktlich
          </span>
        </div>
      </div>

      {/* KPI-Band */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/60 p-2.5 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
            Ø Actual
          </div>
          <div className="font-mono font-black text-lg leading-none">{avgActual}m</div>
        </div>
        <div className="rounded-xl bg-white/60 p-2.5 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
            Ø Ziel
          </div>
          <div className="font-mono font-black text-lg leading-none">{avgEstimated}m</div>
        </div>
        <div className="rounded-xl bg-white/60 p-2.5 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center justify-center gap-0.5">
            <TrendIcon delta={avgDelta} />
            Abweich.
          </div>
          <div className={cn(
            'font-mono font-black text-lg leading-none',
            avgDelta > 5 ? 'text-red-600' : avgDelta > 2 ? 'text-amber-600' : 'text-matcha-600',
          )}>
            {avgDelta > 0 ? '+' : ''}{avgDelta}m
          </div>
        </div>
      </div>

      {/* Balkendiagramm: Abweichung je Bestellung */}
      <div>
        <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Zeitabweichung je Bestellung (letzte {results.length} · grün = pünktlich)
        </div>
        <div style={{ height: 64 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8 }} />
              <Tooltip
                formatter={(v: any) => [`${(v as number) > 0 ? '+' : ''}${v} Min`, 'Abweichung']}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry.delta)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-matcha-500" /> Pünktlich (≤+2m)</span>
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Leicht spät (+3-6m)</span>
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Zu spät ({'>'}+6m)</span>
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Zu früh</span>
      </div>
    </div>
  );
}
