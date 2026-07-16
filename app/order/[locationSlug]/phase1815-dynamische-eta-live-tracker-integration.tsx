'use client';

import { useCallback, useEffect, useState } from 'react';
import { DynamischeEtaLiveTracker } from './components/dynamische-eta-live-tracker';

/**
 * Phase 1815 — DynamischeEtaLiveTracker Integration (Storefront)
 *
 * Wrapper, der den bestehenden DynamischeEtaLiveTracker aus components/ einbindet.
 * Ruft /api/delivery/public/kuechen-status ab und mappt Bestellstatus → Phase.
 * Status-Mapping: neu/pending/confirmed→eingegangen · in_zubereitung/preparing→zubereitung
 *                 dispatched/on_the_way→unterwegs · delivered/zugestellt→zugestellt
 * Props: orderId, etaMinuten (aus orderSuccess.eta), bestelltAm (aus orderSuccess.orderedAt)
 * Hydration-safe; 30s-Polling; nur bei aktiver Lieferbestellung.
 */

type Phase = 'eingegangen' | 'zubereitung' | 'unterwegs' | 'zugestellt';

const STATUS_MAP: Record<string, Phase> = {
  neu: 'eingegangen',
  pending: 'eingegangen',
  new: 'eingegangen',
  confirmed: 'eingegangen',
  accepted: 'eingegangen',
  in_zubereitung: 'zubereitung',
  preparing: 'zubereitung',
  in_progress: 'zubereitung',
  ready: 'zubereitung',
  dispatched: 'unterwegs',
  on_the_way: 'unterwegs',
  picked_up: 'unterwegs',
  out_for_delivery: 'unterwegs',
  delivered: 'zugestellt',
  zugestellt: 'zugestellt',
  completed: 'zugestellt',
};

interface OrderStatusData {
  status?: string;
  lieferzeit_minuten?: number | null;
  bestellt_am?: string | null;
  fahrer_name?: string | null;
}

interface Props {
  orderId: string | null;
  locationId: string;
  etaMinuten?: number | null;
  bestelltAm?: string | null;
  className?: string;
}

export function StorefrontPhase1815DynamischeEtaLiveTrackerIntegration({
  orderId,
  locationId,
  etaMinuten: etaMinutenProp,
  bestelltAm: bestelltAmProp,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [orderData, setOrderData] = useState<OrderStatusData | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const laden = useCallback(async () => {
    if (!orderId || !locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/public/kuechen-status?order_id=${encodeURIComponent(orderId)}&location_id=${encodeURIComponent(locationId)}`
      );
      if (!res.ok) throw new Error('api');
      const json = (await res.json()) as OrderStatusData;
      setOrderData(json);
    } catch {
      // Fallback: nutze Props-Werte mit Default-Phase
      setOrderData({ status: 'preparing', lieferzeit_minuten: etaMinutenProp ?? null, bestellt_am: bestelltAmProp ?? null });
    }
  }, [orderId, locationId, etaMinutenProp, bestelltAmProp]);

  useEffect(() => {
    if (!mounted || !orderId) return;
    laden();
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [mounted, orderId, laden]);

  if (!mounted || !orderId) return null;

  const rawStatus = orderData?.status ?? 'preparing';
  const phase: Phase = STATUS_MAP[rawStatus] ?? 'zubereitung';
  const etaMinuten = orderData?.lieferzeit_minuten ?? etaMinutenProp ?? null;
  const bestelltAm = orderData?.bestellt_am ?? bestelltAmProp ?? null;
  const fahrerName = orderData?.fahrer_name ?? null;

  return (
    <div className={className}>
      <DynamischeEtaLiveTracker
        phase={phase}
        etaMinuten={etaMinuten}
        bestelltAm={bestelltAm}
        fahrerName={fahrerName}
      />
    </div>
  );
}
