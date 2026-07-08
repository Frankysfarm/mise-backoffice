'use client';

import { useMemo, useState, useEffect } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Order {
  id: string;
  created_at: string;
  status?: string | null;
}

interface Props {
  orders: Order[];
  zielProStunde?: number;
}

const ZIEL_DEFAULT = 8;

function bestellrateJetzt(orders: Order[]): number {
  const jetzt = Date.now();
  const vor60min = jetzt - 60 * 60 * 1000;
  return orders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return t >= vor60min && t <= jetzt;
  }).length;
}

function bestellrateVorherigStunde(orders: Order[]): number {
  const jetzt = Date.now();
  const vor120min = jetzt - 120 * 60 * 1000;
  const vor60min = jetzt - 60 * 60 * 1000;
  return orders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return t >= vor120min && t < vor60min;
  }).length;
}

type Ampel = 'gruen' | 'amber' | 'rot';

function calcAmpel(rate: number, ziel: number): Ampel {
  const pct = ziel > 0 ? rate / ziel : 0;
  if (pct >= 0.85) return 'gruen';
  if (pct >= 0.6) return 'amber';
  return 'rot';
}

const AMPEL_CFG: Record<Ampel, { label: string; dot: string; ring: string; text: string }> = {
  gruen: {
    label: 'Gut — im Zielbereich',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-400/50',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    label: 'Etwas langsam',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/50',
    text: 'text-amber-700 dark:text-amber-300',
  },
  rot: {
    label: 'Weit unter Ziel',
    dot: 'bg-red-500',
    ring: 'ring-red-400/50',
    text: 'text-red-700 dark:text-red-300',
  },
};

export function KitchenPhase642SchichtTempoAmpel({
  orders,
  zielProStunde = ZIEL_DEFAULT,
}: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const { rateJetzt, rateVorher, ampel, trend } = useMemo(() => {
    const rj = bestellrateJetzt(orders);
    const rv = bestellrateVorherigStunde(orders);
    const a = calcAmpel(rj, zielProStunde);
    const diff = rj - rv;
    const t = diff > 0 ? 'up' : diff < 0 ? 'down' : 'gleich';
    return { rateJetzt: rj, rateVorher: rv, ampel: a, trend: t };
  }, [orders, zielProStunde]);

  const cfg = AMPEL_CFG[ampel];
  const pct = zielProStunde > 0 ? Math.min(100, Math.round((rateJetzt / zielProStunde) * 100)) : 0;

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
      ? 'text-red-500 dark:text-red-400'
      : 'text-gray-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground">Schicht-Tempo</span>
        <div
          className={`ml-auto h-3 w-3 rounded-full ring-2 ${cfg.dot} ${cfg.ring}`}
        />
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div>
          <div className="text-3xl font-black tabular-nums text-foreground leading-none">
            {rateJetzt}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Best. / letzter Stunde
          </div>
        </div>
        <div className="pb-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
            <span className={trendColor}>
              {trend === 'up' && `+${rateJetzt - rateVorher}`}
              {trend === 'down' && `${rateJetzt - rateVorher}`}
              {trend === 'gleich' && '='}
            </span>
            <span>vs. Vorstunde ({rateVorher})</span>
          </div>
        </div>
        <div className="ml-auto text-right pb-1">
          <div className="text-xs text-muted-foreground">Ziel</div>
          <div className="text-sm font-bold tabular-nums text-foreground">
            {zielProStunde} /h
          </div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            ampel === 'gruen'
              ? 'bg-emerald-500'
              : ampel === 'amber'
              ? 'bg-amber-400'
              : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className={`text-xs font-semibold ${cfg.text}`}>
        {cfg.label} — {pct}% des Ziels
      </div>
    </div>
  );
}
