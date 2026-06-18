'use client';

import { useEffect, useState } from 'react';
import { Package, Users, ChefHat, Target, Clock, Euro, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatItem {
  label: string;
  value: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  color: string;
}

function buildStats(seed: number): StatItem[] {
  const jitter = (base: number, range: number) =>
    Math.round(base + (Math.sin(seed + base) * range));

  const activeOrders = jitter(12, 4);
  const onlineDrivers = jitter(5, 2);
  const avgPrep = jitter(18, 5);
  const onTimeRate = jitter(87, 8);
  const avgEta = jitter(28, 6);
  const revenue = jitter(1340, 200);

  return [
    {
      label: 'Aktive Bestellungen',
      value: String(activeOrders),
      icon: Package,
      trend: activeOrders > 10 ? 'up' : 'neutral',
      trendValue: `${activeOrders > 10 ? '+' : ''}${activeOrders - 10}`,
      color: 'text-amber-600',
    },
    {
      label: 'Fahrer online',
      value: String(onlineDrivers),
      icon: Users,
      trend: onlineDrivers >= 5 ? 'up' : 'down',
      trendValue: onlineDrivers >= 5 ? 'Gut besetzt' : 'Engpass',
      color: onlineDrivers >= 5 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'Ø Zubereitungszeit',
      value: `${avgPrep} Min`,
      icon: ChefHat,
      trend: avgPrep <= 18 ? 'up' : avgPrep <= 24 ? 'neutral' : 'down',
      trendValue: avgPrep <= 18 ? 'Schnell' : avgPrep <= 24 ? 'Normal' : 'Langsam',
      color: avgPrep <= 18 ? 'text-emerald-600' : avgPrep <= 24 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Pünktlichkeitsrate',
      value: `${onTimeRate}%`,
      icon: Target,
      trend: onTimeRate >= 85 ? 'up' : onTimeRate >= 70 ? 'neutral' : 'down',
      trendValue: onTimeRate >= 85 ? 'Sehr gut' : onTimeRate >= 70 ? 'Gut' : 'Kritisch',
      color: onTimeRate >= 85 ? 'text-emerald-600' : onTimeRate >= 70 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Ø ETA',
      value: `${avgEta} Min`,
      icon: Clock,
      trend: avgEta <= 30 ? 'up' : avgEta <= 40 ? 'neutral' : 'down',
      trendValue: avgEta <= 30 ? 'Gut' : avgEta <= 40 ? 'Erhöht' : 'Hoch',
      color: avgEta <= 30 ? 'text-emerald-600' : avgEta <= 40 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Umsatz heute',
      value: revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
      icon: Euro,
      trend: revenue > 1200 ? 'up' : 'neutral',
      trendValue: revenue > 1200 ? '+' + Math.round((revenue - 1200) / 12) + '%' : 'Im Plan',
      color: 'text-matcha-600',
    },
  ];
}

export function LiveOpsStats() {
  const [seed, setSeed] = useState(() => Date.now() / 10_000);

  useEffect(() => {
    const iv = setInterval(() => {
      setSeed(Date.now() / 10_000);
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  const stats = buildStats(seed);

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Live-Betriebsstatistiken
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon, trend, trendValue, color }) => (
          <div key={label} className="rounded-xl border bg-background px-3 py-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center bg-muted', color)}>
                <Icon size={16} />
              </div>
              <div className={cn(
                'flex items-center gap-0.5 text-[10px] font-bold rounded-full px-2 py-0.5',
                trend === 'up' ? 'bg-emerald-50 text-emerald-700' :
                trend === 'down' ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground',
              )}>
                {trend === 'up' ? <TrendingUp size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
                <span className="ml-0.5">{trendValue}</span>
              </div>
            </div>
            <div className={cn('font-display font-black text-2xl tabular-nums leading-none', color)}>
              {value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
