'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Minus, Package, Euro, Zap, Clock } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  gesamtbetrag: number;
  typ: string;
  bestellt_am: string | null;
  geschaetzte_lieferung_min: number | null;
};

interface Props {
  orders: Order[];
  completedOrders: Order[];
}

type GoalEntry = {
  label: string;
  unit: string;
  current: number;
  target: number;
  icon: React.ElementType;
  formatValue: (v: number) => string;
};

function tagesZiel(stunde: number): { orders: number; umsatz: number; lieferungen: number; avgMinuten: number } {
  // Tagesziele skaliert nach Tageszeit
  if (stunde < 11) return { orders: 20, umsatz: 400, lieferungen: 15, avgMinuten: 32 };
  if (stunde < 14) return { orders: 60, umsatz: 1200, lieferungen: 45, avgMinuten: 30 };
  if (stunde < 18) return { orders: 35, umsatz: 700, lieferungen: 25, avgMinuten: 31 };
  return { orders: 80, umsatz: 1600, lieferungen: 60, avgMinuten: 28 };
}

function progressColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 75)  return 'bg-blue-500';
  if (pct >= 50)  return 'bg-amber-400';
  return 'bg-gray-300';
}

function trendIcon(pct: number) {
  if (pct >= 100) return <TrendingUp size={11} className="text-emerald-500" />;
  if (pct >= 60)  return <Minus size={11} className="text-amber-500" />;
  return <TrendingDown size={11} className="text-red-400" />;
}

export function TagesZielPanel({ orders, completedOrders }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const stunde = now.getHours();
  const ziele = tagesZiel(stunde);

  const allOrders = [...orders, ...completedOrders];
  const todayOrders = allOrders.filter(o => {
    if (!o.bestellt_am) return false;
    const d = new Date(o.bestellt_am);
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  });

  const totalOrders = todayOrders.length;
  const totalUmsatz = todayOrders.reduce((s, o) => s + (o.gesamtbetrag || 0), 0);
  const lieferungen = todayOrders.filter(o => o.typ === 'lieferung' && o.status === 'geliefert').length;
  const lieferZeiten = todayOrders
    .filter(o => o.geschaetzte_lieferung_min != null && o.status === 'geliefert')
    .map(o => o.geschaetzte_lieferung_min!);
  const avgMin = lieferZeiten.length > 0
    ? Math.round(lieferZeiten.reduce((a, b) => a + b, 0) / lieferZeiten.length)
    : 0;

  const goals: GoalEntry[] = [
    {
      label: 'Bestellungen',
      unit: `Ziel: ${ziele.orders}`,
      current: totalOrders,
      target: ziele.orders,
      icon: Package,
      formatValue: v => String(Math.round(v)),
    },
    {
      label: 'Umsatz',
      unit: `Ziel: ${ziele.umsatz} €`,
      current: totalUmsatz,
      target: ziele.umsatz,
      icon: Euro,
      formatValue: v => `${v.toFixed(0)} €`,
    },
    {
      label: 'Lieferungen',
      unit: `Ziel: ${ziele.lieferungen}`,
      current: lieferungen,
      target: ziele.lieferungen,
      icon: Zap,
      formatValue: v => String(Math.round(v)),
    },
    {
      label: 'Ø Lieferzeit',
      unit: `Ziel: ≤${ziele.avgMinuten} Min`,
      // For delivery time, lower is better → invert progress
      current: avgMin || ziele.avgMinuten,
      target: ziele.avgMinuten,
      icon: Clock,
      formatValue: v => v ? `${Math.round(v)} Min` : '—',
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target size={14} className="text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tagesziele
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {String(stunde).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')} Uhr
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {goals.map(g => {
          const isTime = g.label === 'Ø Lieferzeit';
          // For time goal, lower is better
          const pct = isTime
            ? (avgMin === 0 ? 0 : Math.min(100, Math.round((ziele.avgMinuten / (avgMin || ziele.avgMinuten)) * 100)))
            : Math.min(100, Math.round((g.current / g.target) * 100));
          const Icon = g.icon;

          return (
            <div key={g.label} className="rounded-lg bg-muted/40 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon size={11} className="text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{g.label}</span>
                </div>
                {trendIcon(pct)}
              </div>
              <div className="text-base font-bold text-foreground leading-none">
                {g.formatValue(g.current)}
              </div>
              <div className="text-[10px] text-muted-foreground">{g.unit}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', progressColor(pct))}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <div className="text-[10px] font-bold text-muted-foreground">{pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border text-[11px] text-muted-foreground">
        <TrendingUp size={10} className="text-blue-400 shrink-0" />
        {totalOrders >= ziele.orders
          ? <span className="text-emerald-600 font-semibold">Tages-Bestellziel erreicht!</span>
          : <span>{ziele.orders - totalOrders} Bestellungen bis zum Tagesziel</span>
        }
      </div>
    </div>
  );
}
