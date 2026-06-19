'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, Clock, Bike, Star, TrendingUp } from 'lucide-react';

type TrafficLight = 'green' | 'amber' | 'red' | 'unknown';

interface KpiMetric {
  label: string;
  value: string | null;
  light: TrafficLight;
  icon: React.ElementType;
  sublabel: string;
}

interface Props {
  locationId?: string;
}

interface LiveData {
  eta_min: number | null;
  load: string | null;
  active_orders: number | null;
  drivers_online: number | null;
  queue_signal: string | null;
  eta_extension_min: number | null;
}

export function LiveKpiAmpel({ locationId }: Props) {
  const [data, setData] = useState<LiveData | null>(null);
  const [avgDeliveryMin, setAvgDeliveryMin] = useState<number | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    const poll = async () => {
      try {
        const [etaRes, healthRes] = await Promise.all([
          fetch(`/api/delivery/eta/live?location_id=${locationId}`, { cache: 'no-store' }),
          fetch(`/api/delivery/admin/health?location_id=${locationId}`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (!mounted) return;
        if (etaRes.ok) {
          const d = await etaRes.json();
          setData(d);
        }
        if (healthRes?.ok) {
          const h = await healthRes.json();
          if (h?.avg_delivery_min != null) setAvgDeliveryMin(h.avg_delivery_min);
        }
      } catch {}
    };

    poll();
    const iv = setInterval(poll, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  function etaLight(etaMin: number | null): TrafficLight {
    if (etaMin == null) return 'unknown';
    if (etaMin <= 30) return 'green';
    if (etaMin <= 45) return 'amber';
    return 'red';
  }

  function loadLight(load: string | null): TrafficLight {
    if (!load) return 'unknown';
    if (load === 'quiet' || load === 'normal') return 'green';
    if (load === 'busy') return 'amber';
    return 'red'; // surge / overloaded
  }

  function driversLight(count: number | null, orders: number | null): TrafficLight {
    if (count == null) return 'unknown';
    if (orders == null || orders === 0) return 'green';
    const ratio = orders / Math.max(1, count);
    if (ratio <= 3) return 'green';
    if (ratio <= 5) return 'amber';
    return 'red';
  }

  function deliveryTimeLight(min: number | null): TrafficLight {
    if (min == null) return 'unknown';
    if (min <= 30) return 'green';
    if (min <= 45) return 'amber';
    return 'red';
  }

  const metrics: KpiMetric[] = [
    {
      label: 'ETA-Schätzung',
      value: data?.eta_min != null ? `${data.eta_min} Min` : null,
      light: etaLight(data?.eta_min ?? null),
      icon: Clock,
      sublabel: data?.eta_extension_min ? `+${data.eta_extension_min} Min Puffer` : 'Lieferzeit',
    },
    {
      label: 'Auslastung',
      value: data?.load ? ({ quiet: 'Ruhig', normal: 'Normal', busy: 'Ausgelastet', surge: 'Überlastet' }[data.load] ?? data.load) : null,
      light: loadLight(data?.load ?? null),
      icon: TrendingUp,
      sublabel: data?.active_orders != null ? `${data.active_orders} aktive Bestellungen` : 'Küchen-Last',
    },
    {
      label: 'Fahrer',
      value: data?.drivers_online != null ? `${data.drivers_online} online` : null,
      light: driversLight(data?.drivers_online ?? null, data?.active_orders ?? null),
      icon: Bike,
      sublabel: data?.active_orders != null ? `${data.active_orders} Aufträge` : 'Verfügbarkeit',
    },
    {
      label: 'Ø Lieferzeit',
      value: avgDeliveryMin != null ? `${Math.round(avgDeliveryMin)} Min` : null,
      light: deliveryTimeLight(avgDeliveryMin),
      icon: Star,
      sublabel: 'Heute gemessen',
    },
  ];

  const lightStyle: Record<TrafficLight, { dot: string; text: string; bg: string; border: string }> = {
    green:   { dot: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50',  border: 'border-matcha-200' },
    amber:   { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
    red:     { dot: 'bg-red-500 animate-pulse', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    unknown: { dot: 'bg-stone-300',  text: 'text-stone-600',  bg: 'bg-stone-50',   border: 'border-stone-200' },
  };

  const overallLight: TrafficLight = metrics.some((m) => m.light === 'red')
    ? 'red'
    : metrics.some((m) => m.light === 'amber')
    ? 'amber'
    : metrics.every((m) => m.light === 'green')
    ? 'green'
    : 'unknown';

  const overallLabel: Record<TrafficLight, string> = {
    green: 'Alles grün',
    amber: 'Aufmerksamkeit',
    red: 'Eingreifen nötig',
    unknown: 'Lädt…',
  };

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider">Live-KPI Ampel</span>
        </div>
        <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', lightStyle[overallLight].bg, lightStyle[overallLight].border)}>
          <div className={cn('h-2 w-2 rounded-full shrink-0', lightStyle[overallLight].dot)} />
          <span className={lightStyle[overallLight].text}>{overallLabel[overallLight]}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        {metrics.map((m) => {
          const s = lightStyle[m.light];
          const Icon = m.icon;
          return (
            <div key={m.label} className={cn('flex items-center gap-3 p-4', s.bg)}>
              {/* Ampel-Dot */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className={cn('h-3 w-3 rounded-full', s.dot)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={cn('h-3 w-3 shrink-0', s.text)} />
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide', s.text)}>
                    {m.label}
                  </span>
                </div>
                {m.value ? (
                  <div className="text-base font-black tabular-nums text-foreground leading-tight">
                    {m.value}
                  </div>
                ) : (
                  <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
                )}
                <div className="text-[9px] text-muted-foreground mt-0.5">{m.sublabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
