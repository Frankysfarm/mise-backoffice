'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ShiftSnapshot {
  ordersCompleted: number;
  ordersTarget: number;
  avgDeliveryMin: number;
  avgDeliveryTargetMin: number;
  revenueEur: number;
  revenueTargetEur: number;
  onTimeRate: number;
  cancelRate: number;
  activeDrivers: number;
  vsLastShiftPct: number;
}

const MOCK: ShiftSnapshot = {
  ordersCompleted: 38,
  ordersTarget: 45,
  avgDeliveryMin: 26,
  avgDeliveryTargetMin: 28,
  revenueEur: 1420,
  revenueTargetEur: 1800,
  onTimeRate: 0.84,
  cancelRate: 0.03,
  activeDrivers: 5,
  vsLastShiftPct: +12,
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function Delta({ pct }: { pct: number }) {
  const pos = pct >= 0;
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', pos ? 'text-matcha-600' : 'text-red-600')}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{pct}%
    </span>
  );
}

interface KPI { label: string; value: string; target?: string; good: boolean; delta?: number }

export function SchichtKurzauswertung({ locationId }: { locationId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShiftSnapshot | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch('/api/delivery/admin/shift-performance-prediction?action=snapshot')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? MOCK))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [open, locationId]);

  const kpis: KPI[] = data ? [
    {
      label: 'Bestellungen',
      value: data.ordersCompleted.toString(),
      target: `Ziel ${data.ordersTarget}`,
      good: data.ordersCompleted >= data.ordersTarget * 0.85,
      delta: Math.round(((data.ordersCompleted / data.ordersTarget) - 1) * 100),
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avgDeliveryMin} Min`,
      target: `Ziel ≤${data.avgDeliveryTargetMin} Min`,
      good: data.avgDeliveryMin <= data.avgDeliveryTargetMin,
    },
    {
      label: 'Umsatz',
      value: fmtEur(data.revenueEur),
      target: `Ziel ${fmtEur(data.revenueTargetEur)}`,
      good: data.revenueEur >= data.revenueTargetEur * 0.85,
      delta: Math.round(((data.revenueEur / data.revenueTargetEur) - 1) * 100),
    },
    {
      label: 'Pünktlich',
      value: `${Math.round(data.onTimeRate * 100)}%`,
      target: 'Ziel ≥85%',
      good: data.onTimeRate >= 0.85,
    },
    {
      label: 'Storno-Rate',
      value: `${(data.cancelRate * 100).toFixed(1)}%`,
      target: 'Ziel <5%',
      good: data.cancelRate < 0.05,
    },
    {
      label: 'Aktive Fahrer',
      value: data.activeDrivers.toString(),
      good: data.activeDrivers >= 3,
    },
  ] : [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-saffron-dark shrink-0" />
          <span className="text-sm font-bold text-char">Schicht-Kurzauswertung</span>
          {data && (
            <Delta pct={data.vsLastShiftPct} />
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100">
          {loading && (
            <div className="flex items-center gap-2 px-5 py-4 text-sm text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Auswertung…
            </div>
          )}

          {!loading && data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5">
                {kpis.map(kpi => (
                  <div
                    key={kpi.label}
                    className={cn(
                      'rounded-xl border p-3',
                      kpi.good ? 'bg-matcha-50 border-matcha-200' : 'bg-red-50 border-red-200',
                    )}
                  >
                    <div className={cn(
                      'text-xl font-black tabular-nums',
                      kpi.good ? 'text-matcha-700' : 'text-red-700',
                    )}>
                      {kpi.value}
                    </div>
                    <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
                    {kpi.target && (
                      <div className="text-[10px] text-stone-400 mt-0.5">{kpi.target}</div>
                    )}
                    {kpi.delta !== undefined && (
                      <Delta pct={kpi.delta} />
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 pb-4 flex items-center gap-2">
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  data.vsLastShiftPct > 0 ? 'bg-matcha-500' : 'bg-amber-500',
                )} />
                <span className="text-[11px] text-stone-400">
                  vs. letzte Schicht:
                  <span className={cn('font-bold ml-1', data.vsLastShiftPct >= 0 ? 'text-matcha-600' : 'text-red-600')}>
                    {data.vsLastShiftPct >= 0 ? '+' : ''}{data.vsLastShiftPct}%
                  </span>
                  {!locationId && ' · Demo-Daten'}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
