'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, Bike, Euro, Target, AlertTriangle, CheckCircle2, Minus } from 'lucide-react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface KpiData {
  bestellungen: number;
  umsatz: number;
  avg_lieferzeit: number;
  puenktlichkeit: number;
  aktive_fahrer: number;
  storno_rate: number;
}

const MOCK_DATA: KpiData = {
  bestellungen: 47,
  umsatz: 1284.5,
  avg_lieferzeit: 28,
  puenktlichkeit: 91,
  aktive_fahrer: 6,
  storno_rate: 3.2,
};

const TARGETS: KpiData = {
  bestellungen: 50,
  umsatz: 1500,
  avg_lieferzeit: 30,
  puenktlichkeit: 90,
  aktive_fahrer: 6,
  storno_rate: 5,
};

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SPARKLINES: Record<keyof KpiData, number[]> = {
  bestellungen:   [32, 38, 41, 44, 43, 47],
  umsatz:         [820, 950, 1020, 1100, 1210, 1284.5],
  avg_lieferzeit: [32, 30, 29, 31, 28, 28],
  puenktlichkeit: [85, 87, 90, 88, 92, 91],
  aktive_fahrer:  [4, 5, 6, 6, 6, 6],
  storno_rate:    [5, 4.5, 4, 3.8, 3.5, 3.2],
};

type KpiField = keyof KpiData;

interface KpiConfig {
  key: KpiField;
  label: string;
  icon: React.ReactNode;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

const KPI_CONFIG: KpiConfig[] = [
  { key: 'bestellungen',   label: 'Bestellungen',    icon: <Target className="w-4 h-4" />,       format: v => `${v}`,          higherIsBetter: true  },
  { key: 'umsatz',         label: 'Umsatz',           icon: <Euro className="w-4 h-4" />,         format: v => `${v.toFixed(0)} €`, higherIsBetter: true  },
  { key: 'avg_lieferzeit', label: 'Ø Lieferzeit',     icon: <Clock className="w-4 h-4" />,        format: v => `${v} Min`,      higherIsBetter: false },
  { key: 'puenktlichkeit', label: 'Pünktlichkeit',    icon: <CheckCircle2 className="w-4 h-4" />, format: v => `${v}%`,         higherIsBetter: true  },
  { key: 'aktive_fahrer',  label: 'Aktive Fahrer',    icon: <Bike className="w-4 h-4" />,         format: v => `${v}`,          higherIsBetter: true  },
  { key: 'storno_rate',    label: 'Storno-Rate',      icon: <AlertTriangle className="w-4 h-4" />,format: v => `${v.toFixed(1)}%`, higherIsBetter: false },
];

function getTrend(values: number[], higherIsBetter: boolean): 'up' | 'down' | 'flat' {
  if (values.length < 2) return 'flat';
  const diff = values[values.length - 1] - values[values.length - 2];
  if (Math.abs(diff) < 0.01) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function isGood(value: number, target: number, higherIsBetter: boolean): boolean {
  return higherIsBetter ? value >= target : value <= target;
}

export function SchichtKpiErweitert() {
  const [data, setData] = useState<KpiData>(MOCK_DATA);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/overview');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // keep mock data on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-3 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-emerald-600" />
        <h2 className="font-bold text-gray-800 text-sm">Schicht KPIs</h2>
        {loading && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-auto" />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {KPI_CONFIG.map(cfg => {
          const value = data[cfg.key];
          const target = TARGETS[cfg.key];
          const good = isGood(value, target, cfg.higherIsBetter);
          const sparkValues = SPARKLINES[cfg.key];
          const trend = getTrend(sparkValues, cfg.higherIsBetter);
          const trendGood = trend === 'up' ? cfg.higherIsBetter : trend === 'down' ? !cfg.higherIsBetter : true;

          return (
            <div key={cfg.key} className={cn(
              'rounded-lg border p-2.5 flex flex-col gap-1',
              good ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
            )}>
              <div className="flex items-center justify-between">
                <div className={cn('flex items-center gap-1', good ? 'text-emerald-600' : 'text-red-500')}>
                  {cfg.icon}
                  <span className="text-xs font-medium">{cfg.label}</span>
                </div>
                <span className={cn('text-xs', trendGood ? 'text-green-500' : trend === 'flat' ? 'text-gray-400' : 'text-red-500')}>
                  {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                </span>
              </div>

              <div className="flex items-end justify-between gap-1">
                <div>
                  <p className={cn('text-lg font-bold leading-none', good ? 'text-emerald-700' : 'text-red-600')}>
                    {cfg.format(value)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Ziel: {cfg.format(target)}</p>
                </div>
                <Sparkline values={sparkValues} color={good ? '#10b981' : '#ef4444'} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
