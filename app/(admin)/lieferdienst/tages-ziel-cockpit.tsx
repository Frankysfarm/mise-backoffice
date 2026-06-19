'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, Euro, Clock, CheckCircle2, Zap, RefreshCw, AlertTriangle } from 'lucide-react';

interface GoalData {
  targetOrders: number;
  targetRevenue: number;
  actualOrders: number;
  actualRevenue: number;
  actualDeliveries: number;
  avgDeliveryMin: number;
  onTimePct: number;
  shiftHoursElapsed: number;
  shiftHoursTotal: number;
  pace: 'ahead' | 'on_track' | 'behind';
  projectedOrders: number;
  projectedRevenue: number;
}

function CircleGauge({
  pct,
  size = 80,
  color,
  label,
  value,
}: {
  pct: number;
  size: number;
  color: string;
  label: string;
  value: string;
}) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, pct / 100));

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.07} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.07}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="text-center -mt-[44%]">
        <div className="text-base font-black tabular-nums" style={{ color }}>{value}</div>
        <div className="text-[8px] text-matcha-500 font-bold uppercase mt-0.5">{label}</div>
      </div>
    </div>
  );
}

const MOCK: GoalData = {
  targetOrders: 60,
  targetRevenue: 1500,
  actualOrders: 0,
  actualRevenue: 0,
  actualDeliveries: 0,
  avgDeliveryMin: 0,
  onTimePct: 0,
  shiftHoursElapsed: 0,
  shiftHoursTotal: 8,
  pace: 'on_track',
  projectedOrders: 0,
  projectedRevenue: 0,
};

function generateMock(): GoalData {
  const now = new Date();
  const shiftStart = new Date(); shiftStart.setHours(10, 0, 0, 0);
  const hoursElapsed = Math.max(0, (now.getTime() - shiftStart.getTime()) / 3_600_000);
  const targetOrders = 60;
  const targetRevenue = 1500;
  const ordersPerHour = 7 + Math.random() * 4;
  const actualOrders = Math.round(ordersPerHour * hoursElapsed);
  const actualRevenue = actualOrders * (22 + Math.random() * 6);
  const projectedOrders = Math.round(ordersPerHour * 8);
  const projectedRevenue = projectedOrders * 24;

  const pace: GoalData['pace'] = projectedOrders >= targetOrders * 1.05 ? 'ahead'
    : projectedOrders >= targetOrders * 0.9 ? 'on_track' : 'behind';

  return {
    targetOrders,
    targetRevenue,
    actualOrders,
    actualRevenue,
    actualDeliveries: Math.max(0, actualOrders - 2),
    avgDeliveryMin: 26 + Math.random() * 10,
    onTimePct: 75 + Math.random() * 22,
    shiftHoursElapsed: hoursElapsed,
    shiftHoursTotal: 8,
    pace,
    projectedOrders,
    projectedRevenue,
  };
}

export function TagesZielCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<GoalData>(MOCK);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/shift-goals${locationId ? `?location_id=${locationId}` : ''}`).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        setData({
          targetOrders: d.targetOrders ?? 60,
          targetRevenue: d.targetRevenue ?? 1500,
          actualOrders: d.actualOrders ?? 0,
          actualRevenue: d.actualRevenue ?? 0,
          actualDeliveries: d.actualDeliveries ?? 0,
          avgDeliveryMin: d.avgDeliveryMin ?? 0,
          onTimePct: d.onTimePct ?? 0,
          shiftHoursElapsed: d.shiftHoursElapsed ?? 0,
          shiftHoursTotal: d.shiftHoursTotal ?? 8,
          pace: d.pace ?? 'on_track',
          projectedOrders: d.projectedOrders ?? 0,
          projectedRevenue: d.projectedRevenue ?? 0,
        });
      } else {
        setData(generateMock());
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);

    const supabase = createClient();
    const ch = supabase
      .channel('tages-ziel-cockpit')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders' },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === 'geliefert' || row.status === 'abgeschlossen') {
            setPulse(true);
            setTimeout(() => setPulse(false), 1500);
            load();
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, [load]);

  const ordersPct = data.targetOrders > 0 ? (data.actualOrders / data.targetOrders) * 100 : 0;
  const revenuePct = data.targetRevenue > 0 ? (data.actualRevenue / data.targetRevenue) * 100 : 0;
  const timePct = data.shiftHoursTotal > 0 ? (data.shiftHoursElapsed / data.shiftHoursTotal) * 100 : 0;

  const paceStyle = data.pace === 'ahead'
    ? { label: 'Über Plan', icon: TrendingUp, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
    : data.pace === 'on_track'
    ? { label: 'Im Plan', icon: CheckCircle2, cls: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
    : { label: 'Unter Plan', icon: AlertTriangle, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  const PaceIcon = paceStyle.icon;

  const gaugeColor = (pct: number) => pct >= 90 ? '#4ade80' : pct >= 70 ? '#facc15' : '#f87171';

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all duration-500',
      pulse ? 'border-matcha-500/60 shadow-[0_0_16px_rgba(74,200,138,0.15)]' : 'border-matcha-700/40',
      'bg-card',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-700/40 bg-muted/20">
        <Target className="h-4 w-4 text-matcha-400 shrink-0" />
        <span className="text-sm font-bold text-matcha-100">Tagesziel-Cockpit</span>
        <span className={cn('ml-1 inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5', paceStyle.cls)}>
          <PaceIcon className="h-2.5 w-2.5" />
          {paceStyle.label}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {pulse && (
            <span className="text-[10px] text-accent font-bold animate-pulse flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block" />
              Live
            </span>
          )}
          <button onClick={load} disabled={loading} className="p-1 rounded hover:bg-matcha-800 text-matcha-500 disabled:opacity-40">
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-3 gap-4 px-4 py-4">
        <div className="flex flex-col items-center gap-2">
          <CircleGauge
            pct={ordersPct}
            size={84}
            color={gaugeColor(ordersPct)}
            label="Bestellungen"
            value={`${data.actualOrders}/${data.targetOrders}`}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <CircleGauge
            pct={revenuePct}
            size={84}
            color={gaugeColor(revenuePct)}
            label="Umsatz"
            value={`€${Math.round(data.actualRevenue)}`}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <CircleGauge
            pct={timePct}
            size={84}
            color="#60a5fa"
            label="Schichtzeit"
            value={`${Math.round(data.shiftHoursElapsed * 10) / 10}h`}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-0 divide-x divide-matcha-800/40 border-t border-matcha-800/40">
        {[
          { label: 'Ø Lieferzeit', value: data.avgDeliveryMin > 0 ? `${Math.round(data.avgDeliveryMin)} Min` : '–', icon: Clock, accent: data.avgDeliveryMin > 35 ? 'text-red-400' : data.avgDeliveryMin > 0 ? 'text-emerald-400' : 'text-matcha-400' },
          { label: 'Pünktlichkeit', value: data.onTimePct > 0 ? `${Math.round(data.onTimePct)}%` : '–', icon: CheckCircle2, accent: data.onTimePct >= 90 ? 'text-emerald-400' : data.onTimePct >= 75 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Prognose', value: data.projectedOrders > 0 ? `${data.projectedOrders} Best.` : '–', icon: Zap, accent: data.projectedOrders >= data.targetOrders ? 'text-emerald-400' : 'text-amber-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="flex flex-col items-center py-2.5 px-2 text-center">
            <Icon className={cn('h-3 w-3 mb-0.5', accent)} />
            <span className={cn('text-sm font-black tabular-nums', accent)}>{value}</span>
            <span className="text-[9px] text-matcha-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Projection note */}
      {data.pace !== 'on_track' && data.projectedRevenue > 0 && (
        <div className={cn(
          'px-4 py-2 border-t border-matcha-800/40 text-[11px] font-medium',
          data.pace === 'ahead' ? 'text-emerald-400 bg-emerald-950/20' : 'text-amber-400 bg-amber-950/20',
        )}>
          {data.pace === 'ahead'
            ? `Prognose: €${Math.round(data.projectedRevenue)} bis Schichtende (+${Math.round(((data.projectedRevenue / data.targetRevenue) - 1) * 100)}% über Ziel)`
            : `Prognose: €${Math.round(data.projectedRevenue)} — ${Math.round((1 - data.projectedRevenue / data.targetRevenue) * 100)}% unter Tagesziel`}
        </div>
      )}
    </div>
  );
}
