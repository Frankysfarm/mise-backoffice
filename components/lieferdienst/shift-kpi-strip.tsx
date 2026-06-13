'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Package, Bike, Target, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  acceptedAt?: Date | null;
  completedAt?: Date | null;
  deliveredAt?: Date | null;
  estimatedDelivery?: Date | null;
  typ?: string;
  createdAt?: Date;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);
}

function KPITile({
  icon: Icon,
  label,
  value,
  sub,
  color,
  highlight,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition-all',
      highlight ? 'border-accent/40 bg-accent/10' : 'border-border bg-card',
    )}>
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
        highlight ? 'bg-accent/20' : 'bg-muted',
      )}>
        <Icon className={cn('h-4 w-4', color ?? (highlight ? 'text-accent' : 'text-muted-foreground'))} />
      </div>
      <div className="min-w-0">
        <div className={cn(
          'font-black text-lg leading-none tabular-nums',
          color ?? (highlight ? 'text-accent' : 'text-foreground'),
        )}>
          {value}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground truncate mt-0.5">
          {label}
        </div>
        {sub && (
          <div className="text-[9px] text-muted-foreground truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}

type Props = {
  orders: Order[];
  driversOnline?: number;
  schichtStart?: Date;
};

export function ShiftKPIStrip({ orders, driversOnline = 0, schichtStart }: Props) {
  useTick();

  const now = new Date();
  const schichtMin = schichtStart ? Math.max(1, Math.floor((now.getTime() - schichtStart.getTime()) / 60_000)) : null;
  const schichtHours = schichtMin ? Math.floor(schichtMin / 60) : null;
  const schichtRestMin = schichtMin ? schichtMin % 60 : null;
  const schichtLabel = schichtHours != null && schichtMin != null
    ? schichtHours > 0 ? `${schichtHours}h ${schichtRestMin}m` : `${schichtMin}m`
    : null;

  const activeOrders = orders.filter(o => !['geliefert', 'abgeholt', 'storniert'].includes(o.status));
  const completedToday = orders.filter(o => ['geliefert', 'abgeholt'].includes(o.status));
  const deliveredCount = orders.filter(o => o.status === 'geliefert').length;

  // Orders per hour (if schichtStart given)
  const ordersPerHour = schichtMin != null && schichtMin > 0
    ? Math.round((completedToday.length / schichtMin) * 60 * 10) / 10
    : null;

  // Average delivery time
  const deliveryTimes = completedToday
    .filter(o => o.acceptedAt && o.deliveredAt)
    .map(o => (o.deliveredAt!.getTime() - o.acceptedAt!.getTime()) / 60_000);
  const avgDeliveryMin = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : null;

  const pendingCount = orders.filter(o => ['neu', 'bestätigt'].includes(o.status)).length;
  const cookingCount = orders.filter(o => o.status === 'in_zubereitung').length;
  const enRouteCount = orders.filter(o => o.status === 'unterwegs').length;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-accent" />
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Schicht-KPIs</span>
        {schichtLabel && (
          <span className="ml-auto text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {schichtLabel} Schicht
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        <KPITile
          icon={CheckCircle2}
          label="Abgeschlossen"
          value={completedToday.length}
          sub={ordersPerHour != null ? `${ordersPerHour}/h` : undefined}
          highlight={completedToday.length > 0}
        />
        <KPITile
          icon={Package}
          label="Aktiv"
          value={activeOrders.length}
          sub={`${pendingCount} wartend · ${cookingCount} kochen`}
          color={activeOrders.length > 8 ? 'text-orange-600' : undefined}
        />
        {driversOnline > 0 && (
          <KPITile
            icon={Bike}
            label="Fahrer online"
            value={driversOnline}
            sub={enRouteCount > 0 ? `${enRouteCount} unterwegs` : undefined}
            color="text-blue-600"
          />
        )}
        {avgDeliveryMin != null && (
          <KPITile
            icon={Clock}
            label="Ø Lieferzeit"
            value={`${avgDeliveryMin}m`}
            color={avgDeliveryMin > 45 ? 'text-red-600' : avgDeliveryMin > 30 ? 'text-amber-600' : 'text-green-600'}
          />
        )}
        {deliveredCount > 0 && (
          <KPITile
            icon={Target}
            label="Geliefert"
            value={deliveredCount}
          />
        )}
      </div>

      {/* Status bar */}
      {activeOrders.length > 0 && (
        <div className="flex gap-1 h-1.5">
          {pendingCount > 0 && (
            <div
              className="rounded-full bg-blue-400"
              style={{ flex: pendingCount }}
              title={`${pendingCount} wartend`}
            />
          )}
          {cookingCount > 0 && (
            <div
              className="rounded-full bg-orange-400"
              style={{ flex: cookingCount }}
              title={`${cookingCount} kochen`}
            />
          )}
          {enRouteCount > 0 && (
            <div
              className="rounded-full bg-green-400"
              style={{ flex: enRouteCount }}
              title={`${enRouteCount} unterwegs`}
            />
          )}
        </div>
      )}
    </div>
  );
}
