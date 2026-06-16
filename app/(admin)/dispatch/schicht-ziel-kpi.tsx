'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Clock, Bike, Euro } from 'lucide-react';

interface ShiftTarget {
  deliveriesDone: number;
  deliveriesTarget: number;
  revenueEur: number;
  revenueTargetEur: number;
  onTimeRatePct: number;
  onTimeTargetPct: number;
  avgDeliveryMin: number;
  avgDeliveryTargetMin: number;
}

const MOCK: ShiftTarget = {
  deliveriesDone: 0, deliveriesTarget: 40,
  revenueEur: 0, revenueTargetEur: 800,
  onTimeRatePct: 0, onTimeTargetPct: 85,
  avgDeliveryMin: 0, avgDeliveryTargetMin: 30,
};

function pct(done: number, target: number) {
  if (target === 0) return 0;
  return Math.min(100, Math.round((done / target) * 100));
}

function KpiBar({ label, done, target, unit, reverse, icon: Icon }: {
  label: string; done: number; target: number; unit: string;
  reverse?: boolean; icon: React.ElementType;
}) {
  const p = pct(done, target);
  const good = reverse ? done <= target : done >= target * 0.9;
  const warn = reverse ? done > target * 1.1 : done >= target * 0.7;
  const color = good ? 'bg-matcha-500' : warn ? 'bg-amber-400' : 'bg-red-400';
  const textColor = good ? 'text-matcha-700' : warn ? 'text-amber-700' : 'text-red-600';
  const Trend = done >= target * 0.9 ? TrendingUp : TrendingDown;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Icon size={11} className="text-gray-400" />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn('text-[11px] font-black tabular-nums', textColor)}>
            {unit === '€' ? `${done.toFixed(0)}€` : unit === 'Min' ? `${done.toFixed(0)} Min` : unit === '%' ? `${done.toFixed(0)}%` : done}
          </span>
          <span className="text-[9px] text-gray-400">/ {unit === '€' ? `${target}€` : unit === 'Min' ? `${target} Min` : unit === '%' ? `${target}%` : target}</span>
          <Trend size={10} className={textColor} />
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${reverse ? Math.max(0, 100 - p) : p}%` }}
        />
      </div>
    </div>
  );
}

export function DispatchSchichtZielKpi({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ShiftTarget>(MOCK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/shifts${params}&action=current_stats`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const s = json.stats ?? json;
        setData({
          deliveriesDone:      s.deliveries      ?? 0,
          deliveriesTarget:    40,
          revenueEur:          s.revenue         ?? 0,
          revenueTargetEur:    800,
          onTimeRatePct:       s.onTimeRatePct   ?? 0,
          onTimeTargetPct:     85,
          avgDeliveryMin:      s.avgDeliveryMin  ?? 0,
          avgDeliveryTargetMin: 30,
        });
      } catch {
        // keep mock
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const overallPct = pct(
    data.deliveriesDone + (data.onTimeRatePct / 100 * data.deliveriesTarget),
    data.deliveriesTarget * 2,
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <Target size={13} className="text-matcha-600" />
          <span className="text-xs font-semibold text-gray-700">Schicht-Ziel</span>
        </div>
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
          overallPct >= 90 ? 'bg-matcha-100 text-matcha-700' :
          overallPct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
        )}>
          {loading ? '…' : `${overallPct}%`}
        </span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <KpiBar label="Lieferungen" done={data.deliveriesDone} target={data.deliveriesTarget} unit="" icon={Bike} />
        <KpiBar label="Umsatz" done={data.revenueEur} target={data.revenueTargetEur} unit="€" icon={Euro} />
        <KpiBar label="Pünktlichkeit" done={data.onTimeRatePct} target={data.onTimeTargetPct} unit="%" icon={TrendingUp} />
        <KpiBar label="Ø Lieferzeit" done={data.avgDeliveryMin} target={data.avgDeliveryTargetMin} unit="Min" icon={Clock} reverse />
      </div>
    </div>
  );
}
