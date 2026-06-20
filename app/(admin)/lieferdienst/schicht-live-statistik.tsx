'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Users, Clock, Target, Euro, Zap,
} from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface OverviewData {
  totalOrders: number;
  totalRevenue: number;
  slaRate: number;
  avgDeliveryMin: number;
  yesterdayOrders: number | null;
  yesterdayRevenue: number | null;
  yesterdaySlaRate: number | null;
  yesterdayAvgDeliveryMin: number | null;
  active_tours?: { id: string }[];
  drivers?: { status: string }[];
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function delta(now: number, prev: number | null, lowerIsBetter = false) {
  if (prev == null || prev === 0) return null;
  const diff = now - prev;
  const pct = Math.round((diff / prev) * 100);
  const positive = lowerIsBetter ? diff < 0 : diff > 0;
  return { pct, positive, diff };
}

function DeltaBadge({ d }: { d: ReturnType<typeof delta> }) {
  if (!d) return <span className="text-[9px] text-muted-foreground">kein Vortag</span>;
  const Icon = d.diff === 0 ? Minus : d.positive ? TrendingUp : TrendingDown;
  const color = d.positive ? 'text-matcha-600' : 'text-red-500';
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', color)}>
      <Icon size={10} />
      {d.pct > 0 ? '+' : ''}{d.pct}%
    </span>
  );
}

type Kpi = {
  label: string;
  value: string;
  sub: string;
  delta: ReturnType<typeof delta>;
  icon: typeof Euro;
  color: string;
};

export function SchichtLiveStatistik({ locationId }: Props) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAt, setLastAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/overview?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setData(d);
        setLastAt(new Date());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!locationId) return null;
  if (!data && !loading) return null;

  const activeTours = data?.active_tours?.length ?? 0;
  const activeDrivers = data?.drivers?.filter((d: { status: string }) => d.status === 'active' || d.status === 'on_shift').length ?? 0;

  const kpis: Kpi[] = data ? [
    {
      label: 'Bestellungen',
      value: String(data.totalOrders),
      sub: data.yesterdayOrders != null ? `vs. ${data.yesterdayOrders} gestern` : 'Schicht',
      delta: delta(data.totalOrders, data.yesterdayOrders),
      icon: Target,
      color: 'text-blue-600',
    },
    {
      label: 'Umsatz',
      value: fmtEur(data.totalRevenue),
      sub: data.yesterdayRevenue != null ? `vs. ${fmtEur(data.yesterdayRevenue)}` : 'Schicht',
      delta: delta(data.totalRevenue, data.yesterdayRevenue),
      icon: Euro,
      color: 'text-matcha-600',
    },
    {
      label: 'SLA',
      value: `${Math.round(data.slaRate)}%`,
      sub: data.yesterdaySlaRate != null ? `vs. ${Math.round(data.yesterdaySlaRate)}% gestern` : 'Pünktlichkeit',
      delta: delta(data.slaRate, data.yesterdaySlaRate),
      icon: TrendingUp,
      color: data.slaRate >= 85 ? 'text-matcha-600' : data.slaRate >= 70 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${Math.round(data.avgDeliveryMin)} Min`,
      sub: data.yesterdayAvgDeliveryMin != null ? `vs. ${Math.round(data.yesterdayAvgDeliveryMin)} Min` : 'Ø heute',
      delta: delta(data.avgDeliveryMin, data.yesterdayAvgDeliveryMin, true),
      icon: Clock,
      color: data.avgDeliveryMin <= 25 ? 'text-matcha-600' : data.avgDeliveryMin <= 35 ? 'text-amber-600' : 'text-red-600',
    },
  ] : [];

  const health = data ? (
    data.slaRate >= 85 && data.avgDeliveryMin <= 30 ? 'gut' :
    data.slaRate >= 70 || data.avgDeliveryMin <= 40 ? 'ok' : 'kritisch'
  ) : 'ok';

  const headerColor = health === 'gut' ? 'bg-matcha-600' : health === 'ok' ? 'bg-amber-500' : 'bg-red-600';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2', headerColor)}>
        <Zap className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Schicht Live-Statistik
        </span>
        <div className="ml-auto flex items-center gap-2">
          {activeTours > 0 && (
            <span className="text-[10px] bg-white/20 text-white font-bold rounded-full px-2 py-0.5">
              {activeTours} Touren
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-white/70 hover:text-white transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-px bg-border">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="bg-background p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={12} className={k.color} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {k.label}
                    </span>
                  </div>
                  <div className={cn('text-xl font-black tabular-nums', k.color)}>
                    {k.value}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground truncate">{k.sub}</span>
                    <DeltaBadge d={k.delta} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Users size={10} />
              <span>{activeDrivers > 0 ? `${activeDrivers} Fahrer aktiv` : 'Fahrer unbekannt'}</span>
            </div>
            {lastAt && (
              <span className="text-[9px] text-muted-foreground">
                {lastAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
          <RefreshCw size={14} className="animate-spin" />
          Lade Statistiken…
        </div>
      )}
    </div>
  );
}
