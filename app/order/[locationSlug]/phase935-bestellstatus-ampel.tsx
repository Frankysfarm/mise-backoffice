'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Truck, ChefHat, Package } from 'lucide-react';

/**
 * Phase 935 — Bestellstatus-Ampel (Storefront)
 *
 * Kompakte Ampel: Grün/Amber/Rot + pulsierendes Icon je Bestellstatus.
 * 30s-Polling aus Tracking-API. Nur für aktive Delivery-Bestellungen.
 */

interface Props {
  orderId: string | null;
  status: string | null;
  isDelivery: boolean;
}

type AmpelColor = 'gruen' | 'amber' | 'rot';

interface StatusConfig {
  color: AmpelColor;
  label: string;
  sublabel: string;
  Icon: typeof Clock;
  pulse: boolean;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  neu: { color: 'amber', label: 'Bestellung eingegangen', sublabel: 'Wird bestätigt…', Icon: Clock, pulse: true },
  bestätigt: { color: 'amber', label: 'Bestätigt', sublabel: 'Küche bereitet vor…', Icon: ChefHat, pulse: true },
  in_zubereitung: { color: 'amber', label: 'In Zubereitung', sublabel: 'Küche arbeitet daran', Icon: ChefHat, pulse: true },
  fertig: { color: 'gruen', label: 'Bereit zur Abholung', sublabel: 'Wird gleich abgeholt', Icon: Package, pulse: true },
  dispatched: { color: 'gruen', label: 'Fahrer unterwegs', sublabel: 'Auf dem Weg zu dir', Icon: Truck, pulse: true },
  in_delivery: { color: 'gruen', label: 'Unterwegs', sublabel: 'Fahrer bringt deine Bestellung', Icon: Truck, pulse: true },
  unterwegs: { color: 'gruen', label: 'Unterwegs', sublabel: 'Fahrer bringt deine Bestellung', Icon: Truck, pulse: true },
  abgeholt: { color: 'gruen', label: 'Abgeholt', sublabel: 'Auf dem Weg zu dir', Icon: Truck, pulse: false },
  geliefert: { color: 'gruen', label: 'Geliefert!', sublabel: 'Guten Appetit!', Icon: CheckCircle2, pulse: false },
  storniert: { color: 'rot', label: 'Storniert', sublabel: 'Bestellung wurde storniert', Icon: Clock, pulse: false },
  cancelled: { color: 'rot', label: 'Abgebrochen', sublabel: 'Bestellung wurde abgebrochen', Icon: Clock, pulse: false },
};

const INACTIVE_STATUSES = new Set(['geliefert', 'storniert', 'cancelled']);

const COLOR_CLASSES: Record<AmpelColor, { dot: string; bg: string; text: string; border: string }> = {
  gruen: { dot: 'bg-matcha-500', bg: 'bg-matcha-50', text: 'text-matcha-800', border: 'border-matcha-200' },
  amber: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  rot: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
};

const POLL_MS = 30 * 1000;

export function Phase935BestellstatusAmpel({ orderId, status: initialStatus, isDelivery }: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setStatus(initialStatus); }, [initialStatus]);

  useEffect(() => {
    if (!orderId || !isDelivery) return;
    if (status && INACTIVE_STATUSES.has(status)) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.status) setStatus(json.status);
        }
      } catch {}
    };

    timerRef.current = setInterval(poll, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [orderId, isDelivery, status]);

  if (!isDelivery || !status) return null;
  if (INACTIVE_STATUSES.has(status) && status === 'geliefert') return null; // handled by other component

  const cfg = STATUS_MAP[status] ?? STATUS_MAP['neu'];
  const colors = COLOR_CLASSES[cfg.color];
  const { Icon } = cfg;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3',
      colors.bg, colors.border,
    )}>
      {/* Ampel-Punkt */}
      <span className="relative flex-shrink-0">
        <span className={cn('block w-3 h-3 rounded-full', colors.dot)} />
        {cfg.pulse && (
          <span
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-60',
              colors.dot,
            )}
          />
        )}
      </span>

      {/* Icon */}
      <Icon className={cn('w-4 h-4 shrink-0', colors.text)} />

      {/* Text */}
      <div className="min-w-0">
        <div className={cn('text-sm font-semibold leading-tight', colors.text)}>
          {cfg.label}
        </div>
        <div className="text-[11px] text-stone-500 leading-tight">{cfg.sublabel}</div>
      </div>
    </div>
  );
}
