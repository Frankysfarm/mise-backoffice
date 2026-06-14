'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  typ: string;
  gesamtbetrag?: number;
  createdAt?: Date | string;
  acceptedAt?: Date | string;
  estimatedTime?: number;
};

type Props = {
  orders: Order[];
};

const DONE_STATUSES = new Set(['geliefert', 'abgeholt', 'abgeschlossen', 'storniert', 'abgelehnt']);
const URGENT_WAIT_MS = 20 * 60 * 1_000; // 20 minutes

type KpiCard = {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  urgent?: boolean;
};

export function SchichtEchtzeitKPI({ orders }: Props) {
  const kpis = useMemo(() => {
    const now = Date.now();
    const active = orders.filter((o) => !DONE_STATUSES.has(o.status));

    const totalActive = active.length;

    const deliveryCount = active.filter(
      (o) => o.typ === 'lieferung' || o.typ === 'delivery',
    ).length;
    const pickupCount = active.filter(
      (o) => o.typ === 'abholung' || o.typ === 'takeaway' || o.typ === 'pickup',
    ).length;

    const prepTimes = active
      .map((o) => o.estimatedTime)
      .filter((t): t is number => typeof t === 'number' && t > 0);
    const avgPrepMin =
      prepTimes.length > 0
        ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
        : null;

    const urgentCount = active.filter((o) => {
      const ref = o.createdAt ?? o.acceptedAt;
      if (!ref) return false;
      const refMs = typeof ref === 'string' ? new Date(ref).getTime() : ref.getTime();
      return now - refMs > URGENT_WAIT_MS;
    }).length;

    return { totalActive, deliveryCount, pickupCount, avgPrepMin, urgentCount };
  }, [orders]);

  const { totalActive, deliveryCount, pickupCount, avgPrepMin, urgentCount } = kpis;

  const cards: KpiCard[] = [
    {
      icon: Package,
      label: 'Aktive Bestellungen',
      value: String(totalActive),
    },
    {
      icon: Truck,
      label: 'Lieferung / Abholung',
      value: `${deliveryCount}`,
      sub: `/ ${pickupCount} Abh.`,
    },
    {
      icon: Clock,
      label: 'Ø Zubereitungszeit',
      value: avgPrepMin !== null ? `${avgPrepMin} Min` : '—',
    },
    {
      icon: AlertTriangle,
      label: 'Dringend',
      value: String(urgentCount),
      urgent: urgentCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {cards.map(({ icon: Icon, label, value, sub, urgent }) => (
        <div
          key={label}
          className={cn(
            'flex flex-col gap-0.5 rounded-lg px-3 py-2.5',
            'bg-matcha-900/70 border border-matcha-700/50',
          )}
        >
          <div className="flex items-center gap-1.5">
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                urgent ? 'text-red-400' : 'text-matcha-400',
              )}
            />
            <span className="text-[10px] font-medium text-matcha-400/80 leading-tight truncate">
              {label}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={cn(
                'text-xl font-bold tabular-nums leading-none',
                urgent ? 'text-red-400' : 'text-matcha-50',
              )}
            >
              {value}
            </span>
            {sub && (
              <span className="text-xs text-matcha-400/70 leading-none">{sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
