'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, Bike, Clock, Euro, TrendingUp, Zap } from 'lucide-react';

type Props = {
  locationId: string;
};

type Metrics = {
  queue: { neu: number; zubereitung: number; bereit: number; unterwegs: number };
  drivers: { online: number; idle: number; active: number };
  throughput: { deliveriesLast30min: number; perHourRate: number };
  sla: { onTimePct: number | null };
  revenue: { today: number };
  signal: { type: string };
};

const SIGNAL_COLOR: Record<string, string> = {
  normal:   'bg-matcha-500',
  busy:     'bg-amber-400',
  surge:    'bg-red-500 animate-pulse',
  critical: 'bg-red-600 animate-pulse',
  quiet:    'bg-blue-400',
};

export function LiveMetricsStrip({ locationId }: Props) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/ops-snapshot?location_id=${locationId}`);
        if (res.ok && !cancelled) setMetrics(await res.json());
      } catch {}
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!metrics) return null;

  const { queue, drivers, throughput, sla, revenue, signal } = metrics;
  const totalActive = queue.neu + queue.zubereitung + queue.bereit + queue.unterwegs;
  const signalDot = SIGNAL_COLOR[signal.type] ?? SIGNAL_COLOR.normal;

  const chips: { icon: React.ElementType; label: string; value: string; color: string; title: string }[] = [
    {
      icon: Activity,
      label: 'Aktiv',
      value: String(totalActive),
      color: totalActive > 8 ? 'text-red-600' : totalActive > 4 ? 'text-amber-600' : 'text-matcha-700',
      title: `${queue.neu} neu · ${queue.zubereitung} kochend · ${queue.bereit} bereit · ${queue.unterwegs} unterwegs`,
    },
    {
      icon: Bike,
      label: 'Fahrer',
      value: `${drivers.idle}/${drivers.online}`,
      color: drivers.idle === 0 && drivers.online > 0 ? 'text-amber-600' : 'text-matcha-700',
      title: `${drivers.online} online · ${drivers.active} auf Tour · ${drivers.idle} frei`,
    },
    {
      icon: TrendingUp,
      label: '30-Min',
      value: `${throughput.deliveriesLast30min}`,
      color: 'text-blue-700',
      title: `${throughput.deliveriesLast30min} Lieferungen in den letzten 30 Min (${throughput.perHourRate}/h)`,
    },
    ...(sla.onTimePct !== null
      ? [{
          icon: Clock,
          label: 'SLA',
          value: `${sla.onTimePct}%`,
          color: sla.onTimePct >= 80 ? 'text-matcha-700' : sla.onTimePct >= 60 ? 'text-amber-600' : 'text-red-600',
          title: `Pünktlichkeitsrate heute`,
        }]
      : []),
    {
      icon: Euro,
      label: 'Heute',
      value: revenue.today.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
      color: 'text-violet-700',
      title: 'Umsatz heute',
    },
    {
      icon: Zap,
      label: throughput.perHourRate > 0 ? `${throughput.perHourRate}/h` : 'Rate',
      value: throughput.perHourRate > 0 ? `${throughput.perHourRate}/h` : '—',
      color: 'text-indigo-700',
      title: 'Durchschnittliche Lieferungen pro Stunde',
    },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap px-6 py-2 border-b border-stone-200 bg-stone-50/60">
      {/* Signal dot */}
      <div className="flex items-center gap-1.5 mr-1" title={`Betriebsstatus: ${signal.type}`}>
        <span className={cn('h-2.5 w-2.5 rounded-full', signalDot)} />
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
          {signal.type === 'surge' ? 'Surge' : signal.type === 'critical' ? 'Kritisch' :
           signal.type === 'busy' ? 'Ausgelastet' : signal.type === 'quiet' ? 'Ruhig' : 'Normal'}
        </span>
      </div>

      <div className="h-4 w-px bg-stone-300 mx-0.5" />

      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <div
            key={chip.label}
            title={chip.title}
            className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg px-2.5 py-1"
          >
            <Icon className={cn('h-3 w-3 shrink-0', chip.color)} />
            <span className={cn('text-[11px] font-black tabular-nums', chip.color)}>
              {chip.value}
            </span>
            <span className="text-[10px] text-stone-400 font-medium">{chip.label}</span>
          </div>
        );
      })}
    </div>
  );
}
