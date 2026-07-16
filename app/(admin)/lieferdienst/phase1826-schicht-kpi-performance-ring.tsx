'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Loader2, Target, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * Phase 1826 — Schicht-KPI-Performance-Ring (Lieferdienst)
 *
 * Zeigt 4 KPI-Ringe (Umsatz, Bestellungen, Lieferzeit, Pünktlichkeit)
 * mit Ist-Wert vs. Tagesziel + Trend-Pfeil vs. gestrigem Schnittpunkt.
 * 3-Min-Polling. Mock-Fallback wenn API nicht verfügbar.
 */

interface KpiData {
  revenue: { value: number; target: number; unit: string; label: string };
  orders: { value: number; target: number; unit: string; label: string };
  deliveryMinutes: { value: number; target: number; unit: string; label: string };
  punctuality: { value: number; target: number; unit: string; label: string };
}

function pct(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function ringColor(p: number, lowerIsBetter = false) {
  const good = lowerIsBetter ? p >= 100 : p >= 90;
  const warn = lowerIsBetter ? p >= 80 : p >= 70;
  if (good) return { stroke: 'text-matcha-500', label: 'text-matcha-700 dark:text-matcha-400', badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300' };
  if (warn) return { stroke: 'text-amber-400', label: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 text-amber-700' };
  return { stroke: 'text-red-500', label: 'text-red-700 dark:text-red-400', badge: 'bg-red-100 text-red-700' };
}

function ScoreRing({
  label, value, target, unit, lowerIsBetter = false,
}: {
  label: string; value: number; target: number; unit: string; lowerIsBetter?: boolean;
}) {
  const p = pct(value, target);
  const c = ringColor(p, lowerIsBetter);
  const circ = 2 * Math.PI * 30;
  const dash = (p / 100) * circ;

  const displayVal = unit === '€'
    ? value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`
    : unit === '%' ? `${Math.round(value)}%`
    : unit === 'Min' ? `${Math.round(value)}`
    : `${Math.round(value)}`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 68 68" className="w-20 h-20 -rotate-90">
          <circle cx="34" cy="34" r="30" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
          <circle
            cx="34" cy="34" r="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className={cn('transition-all duration-700', c.stroke)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-base font-black leading-none', c.label)}>{displayVal}</span>
          <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-center leading-tight text-muted-foreground">
        {label}
      </span>
      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', c.badge)}>
        {p}% Ziel
      </span>
    </div>
  );
}

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'flat' }) => {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

function buildMock(): KpiData {
  const h = new Date().getHours();
  const progressFactor = Math.min(1, (h - 10) / 12);
  return {
    revenue: { value: Math.round(progressFactor * 2800 + Math.random() * 200), target: 3000, unit: '€', label: 'Umsatz' },
    orders: { value: Math.round(progressFactor * 90 + Math.random() * 8), target: 100, unit: 'Bst.', label: 'Bestellungen' },
    deliveryMinutes: { value: Math.round(24 + Math.random() * 6), target: 28, unit: 'Min', label: 'Lieferzeit Ø' },
    punctuality: { value: Math.round(78 + Math.random() * 12), target: 85, unit: '%', label: 'Pünktlichkeit' },
  };
}

interface Props {
  locationId?: string | null;
  className?: string;
}

export function LieferdienstPhase1826SchichtKpiPerformanceRing({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/analytics?locationId=${locationId ?? ''}&period=today`,
      );
      if (!res.ok) throw new Error('not ok');
      const json = await res.json();
      if (json?.revenue != null) {
        setData({
          revenue: { value: json.revenue ?? 0, target: json.revenueTarget ?? 3000, unit: '€', label: 'Umsatz' },
          orders: { value: json.orders ?? 0, target: json.ordersTarget ?? 100, unit: 'Bst.', label: 'Bestellungen' },
          deliveryMinutes: { value: json.avgDeliveryMin ?? 28, target: json.targetDeliveryMin ?? 28, unit: 'Min', label: 'Lieferzeit Ø' },
          punctuality: { value: json.punctualityPct ?? 80, target: json.targetPunctualityPct ?? 85, unit: '%', label: 'Pünktlichkeit' },
        });
        setTrend(json.revenueTrend === 'up' ? 'up' : json.revenueTrend === 'down' ? 'down' : 'flat');
        return;
      }
    } catch {
      // fall through to mock
    }
    setData(buildMock());
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 3 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const avgPct = data
    ? Math.round(
        (pct(data.revenue.value, data.revenue.target) +
          pct(data.orders.value, data.orders.target) +
          pct(data.punctuality.value, data.punctuality.target)) /
          3,
      )
    : 0;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Schicht-KPI-Performance
          </span>
          {data && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              avgPct >= 90 ? 'bg-matcha-100 text-matcha-700' : avgPct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
            )}>
              Ø {avgPct}%
            </span>
          )}
          <TrendIcon trend={trend} />
        </div>
        <div className="flex items-center gap-1">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4">
          {!data && loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade KPI-Daten…
            </div>
          )}
          {data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                <ScoreRing {...data.revenue} />
                <ScoreRing {...data.orders} />
                <ScoreRing {...data.deliveryMinutes} lowerIsBetter />
                <ScoreRing {...data.punctuality} />
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground border-t pt-3">
                <span>3-Min-Polling · Tagesziele</span>
                <span className="font-bold">{new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
