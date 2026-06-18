'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Package, Clock, CheckCircle2, Truck, Euro } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface LiveStats {
  deliveries_today: number;
  avg_delivery_min: number;
  on_time_rate: number;
  active_drivers: number;
  revenue_today: number;
}

const MOCK: LiveStats = {
  deliveries_today: 24,
  avg_delivery_min: 28,
  on_time_rate: 87,
  active_drivers: 3,
  revenue_today: 890,
};

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

function avgDeliveryColor(min: number): string {
  if (min < 25) return 'text-green-700';
  if (min <= 35) return 'text-amber-700';
  return 'text-red-700';
}

function onTimeColor(rate: number): string {
  if (rate > 90) return 'text-green-700';
  if (rate >= 70) return 'text-amber-700';
  return 'text-red-700';
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}

function KpiCard({ icon, label, value, valueClass }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn('text-2xl font-black tabular-nums', valueClass ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

export function SchichtLiveKpiPanel() {
  const [stats, setStats] = useState<LiveStats>(MOCK);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/delivery/stats/live?location_id=${LOCATION_ID}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          setUpdatedAt(new Date());
        }
      } catch {
        setStats(MOCK);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Schicht-Live-KPIs</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Aktualisiert {timeStr}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3">
        <KpiCard
          icon={<Package className="h-3.5 w-3.5" />}
          label="Lieferungen heute"
          value={String(stats.deliveries_today)}
        />
        <KpiCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Ø Lieferzeit"
          value={`${stats.avg_delivery_min} Min`}
          valueClass={avgDeliveryColor(stats.avg_delivery_min)}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Pünktlichkeitsrate"
          value={`${stats.on_time_rate}%`}
          valueClass={onTimeColor(stats.on_time_rate)}
        />
        <KpiCard
          icon={<Truck className="h-3.5 w-3.5" />}
          label="Aktive Fahrer"
          value={String(stats.active_drivers)}
        />
        <KpiCard
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Umsatz heute"
          value={`${stats.revenue_today.toLocaleString('de-DE')} €`}
        />
      </div>
    </Card>
  );
}
