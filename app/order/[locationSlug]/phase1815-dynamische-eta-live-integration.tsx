'use client';

import { useEffect, useState } from 'react';
import { DynamischeEtaLiveTracker } from './components/dynamische-eta-live-tracker';

/**
 * Phase 1815 — DynamischeEtaLiveTracker-Integration (Storefront)
 *
 * Bindet die bestehende Komponente `components/dynamische-eta-live-tracker.tsx`
 * in die Storefront ein. Pollt /api/delivery/public/order-status alle 30s.
 * Mappt Bestellstatus → Phase (neu→eingegangen, in_zubereitung→zubereitung,
 * dispatched→unterwegs, delivered→zugestellt). Hydration-safe.
 */

type Phase = 'eingegangen' | 'zubereitung' | 'unterwegs' | 'zugestellt';

interface OrderStatus {
  status: string;
  lieferzeit_minuten?: number | null;
  bestellt_am?: string | null;
  fahrer_name?: string | null;
}

const STATUS_MAP: Record<string, Phase> = {
  neu: 'eingegangen',
  eingegangen: 'eingegangen',
  bestätigt: 'eingegangen',
  confirmed: 'eingegangen',
  accepted: 'eingegangen',
  in_zubereitung: 'zubereitung',
  zubereitung: 'zubereitung',
  preparing: 'zubereitung',
  in_preparation: 'zubereitung',
  bereit: 'unterwegs',
  dispatched: 'unterwegs',
  unterwegs: 'unterwegs',
  out_for_delivery: 'unterwegs',
  delivered: 'zugestellt',
  zugestellt: 'zugestellt',
};

interface Props {
  orderId: string | null;
  locationId: string;
  deliveryTimeMin?: number;
  className?: string;
}

export function StorefrontPhase1815DynamischeEtaLiveIntegration({ orderId, locationId, deliveryTimeMin = 35, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!orderId) return;

    async function poll() {
      try {
        const res = await globalThis.fetch(
          `/api/delivery/public/order-status?order_id=${orderId}&location_id=${locationId}`,
        );
        if (!res.ok) throw new Error('err');
        setOrderStatus(await res.json());
      } catch {
        // Mock: wenn API nicht verfügbar, zeige Zubereitung mit Standard-ETA
        setOrderStatus({
          status: 'in_zubereitung',
          lieferzeit_minuten: deliveryTimeMin,
          bestellt_am: new Date(Date.now() - 5 * 60_000).toISOString(),
          fahrer_name: null,
        });
      }
    }

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [orderId, locationId, deliveryTimeMin]);

  if (!mounted || !orderId || !orderStatus) return null;

  const phase: Phase = STATUS_MAP[orderStatus.status] ?? 'eingegangen';

  return (
    <div className={className}>
      <DynamischeEtaLiveTracker
        phase={phase}
        etaMinuten={orderStatus.lieferzeit_minuten ?? deliveryTimeMin}
        bestelltAm={orderStatus.bestellt_am ?? null}
        fahrerName={orderStatus.fahrer_name ?? null}
      />
    </div>
  );
}
