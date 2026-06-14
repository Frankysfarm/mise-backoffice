'use client';

/**
 * KundenHistorieKarte — Phase 168
 *
 * Zeigt dem Fahrer beim aktuellen Stopp eine kurze Kunden-Historie:
 *  - Stammkunde vs. Neukunde
 *  - Anzahl bisheriger Bestellungen an diesem Standort
 *  - Ø Bestellwert
 *  - Wann zuletzt bestellt
 *
 * Verwendet Supabase-Client direkt (Fahrer-App läuft Client-seitig).
 * Zeigt sich nur wenn Telefonnummer bekannt ist.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { euro } from '@/lib/utils';

type Props = {
  orderId: string;
  locationId: string | null;
};

type CustomerInfo = {
  orderCount: number;
  avgValue: number;
  isReturning: boolean;
  daysSinceLast: number | null;
};

export function KundenHistorieKarte({ orderId, locationId }: Props) {
  const [info, setInfo]       = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    const sb = createClient();

    (async () => {
      // 1. Fetch current order for customer phone
      const { data: order } = await sb
        .from('customer_orders')
        .select('kunde_telefon, location_id')
        .eq('id', orderId)
        .maybeSingle();

      if (!order?.kunde_telefon) { setLoading(false); return; }

      const locId = order.location_id ?? locationId ?? '';

      // 2. Fetch previous completed orders from same number + location
      const { data: prev } = await sb
        .from('customer_orders')
        .select('gesamtbetrag, bestellt_am')
        .eq('kunde_telefon', order.kunde_telefon)
        .eq('location_id', locId)
        .in('status', ['fertig', 'geliefert', 'abgeholt'])
        .neq('id', orderId)
        .order('bestellt_am', { ascending: false })
        .limit(25);

      const count = prev?.length ?? 0;
      const total = (prev ?? []).reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
      const lastAt = prev?.[0]?.bestellt_am ?? null;
      const days = lastAt
        ? Math.round((Date.now() - new Date(lastAt).getTime()) / 86_400_000)
        : null;

      setInfo({
        orderCount:    count,
        avgValue:      count > 0 ? total / count : 0,
        isReturning:   count > 0,
        daysSinceLast: days,
      });
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [orderId, locationId]);

  if (loading || !info) return null;

  return (
    <div
      className={`rounded-2xl p-4 space-y-3 ${
        info.isReturning
          ? 'bg-gradient-to-br from-matcha-900/60 to-matcha-800/60 border border-matcha-700/40'
          : 'bg-gradient-to-br from-blue-900/50 to-blue-800/50 border border-blue-700/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">
          {info.isReturning ? '⭐' : '👋'}
        </span>
        <div>
          <div
            className={`text-xs font-black uppercase tracking-wide ${
              info.isReturning ? 'text-matcha-300' : 'text-blue-300'
            }`}
          >
            {info.isReturning
              ? `Stammkunde · ${info.orderCount}. Bestellung`
              : 'Neukunde — Erster Besuch'}
          </div>
        </div>
      </div>

      {/* Details for returning customer */}
      {info.isReturning && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-xl px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">
              Bestellungen
            </div>
            <div className="text-xl font-black text-white tabular-nums">
              {info.orderCount}
            </div>
          </div>

          {info.avgValue > 0 && (
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">
                Ø Bestellwert
              </div>
              <div className="text-xl font-black text-white tabular-nums">
                {euro(info.avgValue)}
              </div>
            </div>
          )}

          {info.daysSinceLast !== null && (
            <div className="bg-white/5 rounded-xl px-3 py-2 col-span-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">
                Zuletzt bestellt
              </div>
              <div className="text-sm font-bold text-white">
                {info.daysSinceLast === 0
                  ? 'Heute'
                  : info.daysSinceLast === 1
                  ? 'Gestern'
                  : `vor ${info.daysSinceLast} Tagen`}
              </div>
            </div>
          )}
        </div>
      )}

      {!info.isReturning && (
        <p className="text-xs text-blue-300">
          Freundlich begrüßen und guten ersten Eindruck hinterlassen! 😊
        </p>
      )}
    </div>
  );
}
