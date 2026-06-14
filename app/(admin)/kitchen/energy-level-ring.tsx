'use client';

/**
 * KitchenEnergyLevelRing
 *
 * Zeigt die aktuelle Küchen-Auslastung als farbkodierter Ring (SVG-Gauge).
 * Der "Energie-Score" (0–100) ergibt sich aus:
 *  - Anzahl aktiver Bestellungen (Gewichtung 50%)
 *  - Anteil überfälliger Bestellungen (Gewichtung 30%)
 *  - Durchschnittliche Wartezeit seit Bestellung (Gewichtung 20%)
 *
 * Farbkodierung:
 *  0–40   → Grün  "Ruhig"
 *  41–70  → Amber "Beschäftigt"
 *  71–100 → Rot   "Überlastet"
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Activity, ChefHat, TrendingUp } from 'lucide-react';

type ActiveOrder = {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type EnergyState = {
  score: number;           // 0–100
  activeCount: number;
  overdueCount: number;
  avgWaitMin: number;
  level: 'quiet' | 'busy' | 'overloaded';
  trend: 'up' | 'down' | 'stable';
};

function computeEnergy(orders: ActiveOrder[]): EnergyState {
  const active = orders.filter(o =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status),
  );
  const now = Date.now();

  const overdue = active.filter(o => {
    if (!o.bestellt_am || !o.geschaetzte_zubereitung_min) return false;
    const dueAt = new Date(o.bestellt_am).getTime() + o.geschaetzte_zubereitung_min * 60_000;
    return now > dueAt;
  });

  const waitMins = active
    .filter(o => o.bestellt_am)
    .map(o => (now - new Date(o.bestellt_am!).getTime()) / 60_000);
  const avgWait = waitMins.length > 0
    ? waitMins.reduce((s, v) => s + v, 0) / waitMins.length
    : 0;

  // Score berechnen (0–100)
  const countScore   = Math.min(100, (active.length / 12) * 100);
  const overdueScore = active.length > 0 ? (overdue.length / active.length) * 100 : 0;
  const waitScore    = Math.min(100, (avgWait / 30) * 100);

  const score = Math.round(countScore * 0.5 + overdueScore * 0.3 + waitScore * 0.2);

  const level: EnergyState['level'] =
    score > 70 ? 'overloaded' : score > 40 ? 'busy' : 'quiet';

  return {
    score,
    activeCount: active.length,
    overdueCount: overdue.length,
    avgWaitMin: Math.round(avgWait),
    level,
    trend: 'stable',
  };
}

const LEVEL_CONFIG = {
  quiet:      { label: 'Ruhig',       ring: '#4CAF50', bg: 'bg-matcha-50',  text: 'text-matcha-800',  badge: 'bg-matcha-100 text-matcha-700'  },
  busy:       { label: 'Beschäftigt', ring: '#F59E0B', bg: 'bg-amber-50',   text: 'text-amber-800',   badge: 'bg-amber-100 text-amber-700'     },
  overloaded: { label: 'Überlastet',  ring: '#EF4444', bg: 'bg-red-50',     text: 'text-red-800',     badge: 'bg-red-100 text-red-700'         },
};

function CircleGauge({ score, color }: { score: number; color: string }) {
  const r = 36;
  const cx = 48;
  const cy = 48;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="8"
        className="text-black/8" />
      {/* Progress ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="20" fontWeight="900" fontFamily="monospace">
        {score}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="9" fontWeight="600" opacity="0.8">
        / 100
      </text>
    </svg>
  );
}

interface Props {
  locationFilter?: string;
}

export function KitchenEnergyLevelRing({ locationFilter }: Props) {
  const [energy, setEnergy] = useState<EnergyState | null>(null);
  const prevScoreRef = useRef<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from('customer_orders')
        .select('id, status, bestellt_am, geschaetzte_zubereitung_min, location_id')
        .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
        .not('bestellt_am', 'is', null);

      if (cancelled || !data) return;

      const filtered = locationFilter && locationFilter !== 'all'
        ? (data as ActiveOrder[]).filter((o: any) => o.location_id === locationFilter)
        : (data as ActiveOrder[]);

      const newEnergy = computeEnergy(filtered);

      if (prevScoreRef.current !== null) {
        const diff = newEnergy.score - prevScoreRef.current;
        newEnergy.trend = diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable';
      }
      prevScoreRef.current = newEnergy.score;
      setEnergy(newEnergy);
    }

    load();
    const iv = setInterval(load, 30_000);

    const ch = supabase
      .channel('energy-ring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilter]);

  if (!energy) return null;

  const cfg = LEVEL_CONFIG[energy.level];

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-4', cfg.bg)}>
      <CircleGauge score={energy.score} color={cfg.ring} />

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Activity className={cn('h-4 w-4 shrink-0', cfg.text)} />
          <span className={cn('font-display text-sm font-bold uppercase tracking-wider', cfg.text)}>
            Küchen-Energie
          </span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', cfg.badge)}>
            {cfg.label}
          </span>
          {energy.trend !== 'stable' && (
            <TrendingUp className={cn(
              'h-3.5 w-3.5 shrink-0',
              energy.trend === 'up' ? 'text-red-500' : 'text-matcha-600 rotate-180',
            )} />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className={cn('font-black text-2xl tabular-nums leading-none', cfg.text)}>
              {energy.activeCount}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Aktiv</div>
          </div>
          <div className="text-center">
            <div className={cn(
              'font-black text-2xl tabular-nums leading-none',
              energy.overdueCount > 0 ? 'text-red-600' : cfg.text,
            )}>
              {energy.overdueCount}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Überfällig</div>
          </div>
          <div className="text-center">
            <div className={cn('font-black text-2xl tabular-nums leading-none', cfg.text)}>
              {energy.avgWaitMin}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Ø Min</div>
          </div>
        </div>

        {energy.level === 'overloaded' && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-100 border border-red-200 px-2.5 py-1.5">
            <ChefHat className="h-3 w-3 text-red-600 shrink-0" />
            <span className="text-[10px] font-bold text-red-700">
              Überkapazität — Prioritäten prüfen
            </span>
          </div>
        )}
        {energy.level === 'busy' && energy.overdueCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-200 px-2.5 py-1.5">
            <ChefHat className="h-3 w-3 text-amber-700 shrink-0" />
            <span className="text-[10px] font-bold text-amber-700">
              {energy.overdueCount} Bestellung{energy.overdueCount !== 1 ? 'en' : ''} überfällig
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
