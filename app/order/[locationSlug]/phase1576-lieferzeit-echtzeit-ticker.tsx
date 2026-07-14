'use client';

import React, { useEffect, useState } from 'react';

interface TickerStatus {
  status: 'bestaetigt' | 'zubereitung' | 'unterwegs' | 'geliefert' | 'unbekannt';
  eta_min: number | null;
  fahrer_name: string | null;
  nachricht: string;
}

interface Props {
  orderId: string | null;
  locationId: string;
}

const STATUS_NACHRICHTEN: Record<string, string[]> = {
  bestaetigt: ['Ihre Bestellung ist eingegangen.', 'Bestellung wird vorbereitet…', 'Küche wurde informiert.'],
  zubereitung: ['Ihre Bestellung wird gerade zubereitet…', 'Frisch für Sie gekocht!', 'Fast fertig in der Küche…'],
  unterwegs: ['Ihr Fahrer ist auf dem Weg!', 'Bestellung ist unterwegs zu Ihnen.', 'Noch wenige Minuten…'],
  geliefert: ['Guten Appetit! Bestellung zugestellt.'],
  unbekannt: ['Status wird geladen…'],
};

export function StorefrontPhase1576LieferzeitEchtzeitTicker({ orderId, locationId }: Props) {
  const [tick, setTick] = useState<TickerStatus | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedOrder = typeof window !== 'undefined' ? localStorage.getItem('lastOrderId') : null;
    if (!orderId && !storedOrder) return;
  }, [orderId]);

  useEffect(() => {
    if (!mounted) return;
    const oid = orderId ?? (typeof window !== 'undefined' ? localStorage.getItem('lastOrderId') : null);
    if (!oid) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/bestellstatus?order_id=${oid}&location_id=${locationId}`);
        if (res.ok) {
          setTick(await res.json());
        } else {
          setTick({ status: 'zubereitung', eta_min: 25, fahrer_name: null, nachricht: '' });
        }
      } catch {
        setTick({ status: 'zubereitung', eta_min: 25, fahrer_name: null, nachricht: '' });
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [mounted, orderId, locationId]);

  // Rotate message text every 8 seconds
  useEffect(() => {
    if (!tick) return;
    const msgs = STATUS_NACHRICHTEN[tick.status] ?? STATUS_NACHRICHTEN.unbekannt;
    if (msgs.length <= 1) return;
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % msgs.length), 8000);
    return () => clearInterval(id);
  }, [tick]);

  if (!mounted || !tick || tick.status === 'geliefert') return null;

  const msgs = STATUS_NACHRICHTEN[tick.status] ?? STATUS_NACHRICHTEN.unbekannt;
  const msg = msgs[msgIdx % msgs.length];

  const statusColor: Record<string, string> = {
    bestaetigt: 'bg-blue-50 border-blue-200 text-blue-700',
    zubereitung: 'bg-amber-50 border-amber-200 text-amber-700',
    unterwegs: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    unbekannt: 'bg-gray-50 border-gray-200 text-gray-600',
  };
  const cls = statusColor[tick.status] ?? statusColor.unbekannt;

  return (
    <div className={`rounded-xl border px-4 py-3 mb-3 flex items-center gap-3 ${cls}`}>
      <span className="animate-pulse text-lg">
        {tick.status === 'unterwegs' ? '🛵' : tick.status === 'zubereitung' ? '🍳' : '📋'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{msg}</div>
        {tick.eta_min && (
          <div className="text-xs opacity-80 mt-0.5">
            Voraussichtliche Lieferzeit: ca. {tick.eta_min} Min
            {tick.fahrer_name && ` · Fahrer: ${tick.fahrer_name}`}
          </div>
        )}
      </div>
    </div>
  );
}
