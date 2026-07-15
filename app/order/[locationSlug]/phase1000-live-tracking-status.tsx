'use client';

import { useEffect, useState } from 'react';
import { MapPin, Package, ChefHat, Bike, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'eingegangen' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

type Props = {
  orderId: string | null;
  initialStatus?: Status;
  locationId: string | null;
};

type StepDef = {
  key: Status;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: StepDef[] = [
  { key: 'eingegangen',    label: 'Bestellt',          sublabel: 'Bestellung eingegangen',      icon: Package },
  { key: 'in_zubereitung', label: 'In Zubereitung',   sublabel: 'Die Küche bereitet zu',        icon: ChefHat },
  { key: 'fertig',         label: 'Fertig',            sublabel: 'Bereit zur Abholung',          icon: CheckCircle2 },
  { key: 'unterwegs',      label: 'Unterwegs',         sublabel: 'Fahrer ist auf dem Weg',       icon: Bike },
  { key: 'geliefert',      label: 'Geliefert',         sublabel: 'Guten Appetit! 🍽️',            icon: MapPin },
];

const STATUS_INDEX: Record<Status, number> = {
  eingegangen: 0,
  in_zubereitung: 1,
  fertig: 2,
  unterwegs: 3,
  geliefert: 4,
};

const ETA_LABELS: Partial<Record<Status, string>> = {
  eingegangen: 'Wird bestätigt…',
  in_zubereitung: 'Zubereitungszeit ca. 15–20 Min',
  fertig: 'Fahrer wird zugeteilt',
  unterwegs: 'Lieferung in ca. 10–20 Min',
  geliefert: 'Danke für Ihre Bestellung!',
};

export function Phase1000LiveTrackingStatus({ orderId, initialStatus = 'eingegangen', locationId }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId || !locationId) return;

    const poll = async () => {
      try {
        const r = await fetch(
          `/api/delivery/customer/tracking?order_id=${encodeURIComponent(orderId)}&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!r.ok) return;
        const d = await r.json();
        if (d.status) setStatus(d.status as Status);
        if (typeof d.etaMin === 'number') setEtaMin(d.etaMin);
      } catch {}
    };

    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [orderId, locationId]);

  const currentIdx = STATUS_INDEX[status] ?? 0;
  const isDelivered = status === 'geliefert';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-4 py-3 text-white',
        isDelivered ? 'bg-matcha-600' : 'bg-stone-800',
      )}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-black">
              {isDelivered ? '✓ Bestellung geliefert' : 'Bestellung verfolgen'}
            </div>
            <div className="text-[11px] opacity-75 mt-0.5">
              {ETA_LABELS[status] ?? ''}
            </div>
          </div>
          {etaMin !== null && !isDelivered && (
            <div className="flex items-center gap-1 bg-white/20 rounded-xl px-3 py-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-sm font-black tabular-nums">~{etaMin} Min</span>
            </div>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Progress line */}
          <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-stone-100" />
          <div
            className="absolute left-[15px] top-3 w-0.5 bg-matcha-500 transition-all duration-700"
            style={{ height: `${(currentIdx / (STEPS.length - 1)) * 100}%` }}
          />

          <div className="space-y-4 relative">
            {STEPS.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 z-10 transition-all duration-500',
                    done  ? 'bg-matcha-500 border-matcha-500 text-white' :
                    active ? 'bg-white border-matcha-500 text-matcha-600 shadow-md' :
                    'bg-white border-stone-200 text-stone-300',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className={cn(
                      'text-sm font-bold transition-colors',
                      done || active ? 'text-foreground' : 'text-stone-300',
                    )}>
                      {step.label}
                    </div>
                    {active && (
                      <div className="text-[11px] text-muted-foreground">
                        {step.sublabel}
                      </div>
                    )}
                  </div>
                  {active && (
                    <div className="ml-auto flex h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
