'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface Order {
  id: string;
  fertig_am?: string | null;
  zubereitung_start?: string | null;
  status?: string;
}

interface Props {
  orders: Order[];
}

const GAUGE_RADIUS = 52;
const GAUGE_CIRCUMFERENCE = Math.PI * GAUGE_RADIUS; // half circle

function ordersPerHourInWindow(orders: Order[], nowMs: number, windowMin: number): number {
  const cutoff = nowMs - windowMin * 60_000;
  const count = orders.filter(
    (o) => o.fertig_am && new Date(o.fertig_am).getTime() >= cutoff,
  ).length;
  return Math.round((count / windowMin) * 60);
}

function avgPrepMin(orders: Order[]): number | null {
  const timed = orders
    .filter((o) => o.fertig_am && o.zubereitung_start)
    .map((o) => (new Date(o.fertig_am!).getTime() - new Date(o.zubereitung_start!).getTime()) / 60_000);
  if (timed.length === 0) return null;
  return Math.round(timed.reduce((a, b) => a + b, 0) / timed.length);
}

export function KitchenProduktionsPulsmesser({ orders }: Props) {
  const now = Date.now();

  const rate15 = ordersPerHourInWindow(orders, now, 15);
  const rate30 = ordersPerHourInWindow(orders, now, 30);
  const rate60 = ordersPerHourInWindow(orders, now, 60);

  const maxRate = 40; // target capacity per hour
  const currentRate = rate15;
  const fillPct = Math.min(1, currentRate / maxRate);

  // Gauge color
  const gaugeColor =
    currentRate >= maxRate * 0.9
      ? '#ef4444' // overload
      : currentRate >= maxRate * 0.7
      ? '#f59e0b' // high
      : currentRate >= maxRate * 0.4
      ? '#4d7c35' // healthy
      : '#94a3b8'; // low

  // Semi-circle stroke
  const strokeOffset = GAUGE_CIRCUMFERENCE * (1 - fillPct);

  const avgPrep = avgPrepMin(orders);

  const trend = rate15 > rate30 ? 'up' : rate15 < rate30 ? 'down' : 'flat';

  const loadLabel =
    currentRate >= maxRate * 0.9
      ? 'Überlastet'
      : currentRate >= maxRate * 0.7
      ? 'Hohe Last'
      : currentRate >= maxRate * 0.4
      ? 'Normalbetrieb'
      : 'Niedriges Volumen';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
          <Zap className="h-3.5 w-3.5 text-matcha-600" />
        </div>
        <div>
          <div className="text-xs font-black text-stone-800">Produktions-Pulsmesser</div>
          <div className="text-[10px] text-stone-400">Bestellungen / Stunde · live</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-matcha-50 px-2 py-1">
          <div className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
          <span className="text-[10px] font-bold text-matcha-700">Live</span>
        </div>
      </div>

      {/* Gauge + stats */}
      <div className="flex items-center gap-4 px-4 py-4">
        {/* Semi-circle gauge */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="68" viewBox="0 0 120 68">
            {/* Background arc */}
            <path
              d="M 8 64 A 52 52 0 0 1 112 64"
              fill="none"
              stroke="#e7e5e4"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Progress arc using stroke-dashoffset */}
            <path
              d="M 8 64 A 52 52 0 0 1 112 64"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
            />
            {/* Center text */}
            <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="900" fill={gaugeColor} fontFamily="inherit">
              {currentRate}
            </text>
            <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#a8a29e" fontFamily="inherit">
              /Std
            </text>
          </svg>
          {/* Load label below gauge */}
          <div
            className="mt-0.5 text-center text-[10px] font-black"
            style={{ color: gaugeColor }}
          >
            {loadLabel}
          </div>
        </div>

        {/* Stats column */}
        <div className="flex-1 space-y-2.5">
          {/* Trend */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full',
                trend === 'up'
                  ? 'bg-matcha-100 text-matcha-600'
                  : trend === 'down'
                  ? 'bg-red-100 text-red-500'
                  : 'bg-stone-100 text-stone-400',
              )}
            >
              {trend === 'up' ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : trend === 'down' ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
            </div>
            <div>
              <div className="text-[10px] text-stone-500">Trend (letzte 30 Min)</div>
              <div
                className={cn(
                  'text-xs font-bold',
                  trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-stone-500',
                )}
              >
                {trend === 'up' ? 'Steigernd ↑' : trend === 'down' ? 'Sinkend ↓' : 'Stabil →'}
              </div>
            </div>
          </div>

          {/* Rate rows */}
          {[
            { label: 'Ø letzte 15 Min', value: rate15 },
            { label: 'Ø letzte 30 Min', value: rate30 },
            { label: 'Ø letzte 60 Min', value: rate60 },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[10px] text-stone-400">{label}</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-20 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-matcha-400 transition-all duration-700"
                    style={{ width: `${Math.min(100, (value / maxRate) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-stone-600 w-8 text-right tabular-nums">
                  {value}/h
                </span>
              </div>
            </div>
          ))}

          {/* Avg prep time */}
          {avgPrep !== null && (
            <div className="flex items-center justify-between pt-1 border-t border-stone-100">
              <span className="text-[10px] text-stone-400">Ø Zubereitungszeit</span>
              <span
                className={cn(
                  'text-xs font-black tabular-nums',
                  avgPrep <= 15 ? 'text-matcha-600' : avgPrep <= 25 ? 'text-amber-600' : 'text-red-500',
                )}
              >
                {avgPrep} Min
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
