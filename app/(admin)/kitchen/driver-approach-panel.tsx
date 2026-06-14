'use client';

/**
 * DriverApproachPanel — Farbampel für ankommende Fahrer
 *
 * Zeigt für jede "fertig"-Bestellung, welcher Fahrer kommt und wann —
 * mit Ampel-Farbcodierung: Grün ≤5 Min, Gelb 5–15 Min, Rot >15 Min / nicht zugewiesen.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock } from 'lucide-react';

type ApproachOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  driverName: string | null;
  etaMin: number | null; // minutes until arrival at kitchen
};

// TODO: wire to real API when available
const MOCK_ORDERS: ApproachOrder[] = [
  { id: '1', bestellnummer: '2401', kunde_name: 'Müller, K.', driverName: 'Ahmed S.', etaMin: 3 },
  { id: '2', bestellnummer: '2402', kunde_name: 'Fischer, L.', driverName: 'Boris T.', etaMin: 9 },
  { id: '3', bestellnummer: '2403', kunde_name: 'Weber, M.', driverName: null, etaMin: null },
];

function colorClass(etaMin: number | null): string {
  if (etaMin == null) return 'bg-red-100 border-red-200';
  if (etaMin <= 5) return 'bg-matcha-100 border-matcha-200';
  if (etaMin <= 15) return 'bg-amber-100 border-amber-200';
  return 'bg-red-100 border-red-200';
}

function dotColor(etaMin: number | null): string {
  if (etaMin == null) return 'bg-red-400';
  if (etaMin <= 5) return 'bg-matcha-500';
  if (etaMin <= 15) return 'bg-amber-400';
  return 'bg-red-400';
}

function etaLabel(etaMin: number | null): string {
  if (etaMin == null) return 'Kein Fahrer';
  if (etaMin <= 0) return 'Jetzt hier!';
  return `in ${etaMin} Min`;
}

export function DriverApproachPanel({ locationId }: { locationId: string }) {
  const [orders, setOrders] = useState<ApproachOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await fetch('/api/delivery/admin/overview', { cache: 'no-store' });
      if (!res.ok) throw new Error('no data');
      const json = await res.json();

      // Map API pendingOrders to ApproachOrder if the shape matches
      const pending = (json.pendingOrders ?? []) as ApproachOrder[];
      if (pending.length > 0) {
        setOrders(pending);
        return;
      }
      throw new Error('empty');
    } catch {
      // TODO: wire to real API when available
      setOrders(MOCK_ORDERS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-matcha-200" />
      </div>
    );
  }

  if (orders.length === 0) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-50 border-b border-matcha-200">
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-matcha-700">
          Fahrer-Ankunft — Fertige Bestellungen
        </span>
        <span className="ml-auto text-[10px] text-matcha-500 font-bold">
          {orders.length} offen
        </span>
      </div>

      {/* Cards */}
      <div className="divide-y divide-black/5">
        {orders.map(ord => (
          <div
            key={ord.id}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 border-l-4',
              colorClass(ord.etaMin),
            )}
          >
            {/* Ampel-Dot */}
            <div className={cn('h-3 w-3 rounded-full shrink-0', dotColor(ord.etaMin))} />

            {/* Order info */}
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[11px] font-black text-black/60">
                #{ord.bestellnummer.slice(-4)}
              </span>
              <span className="ml-1.5 text-xs font-semibold text-black/70 truncate">
                {ord.kunde_name}
              </span>
            </div>

            {/* Driver name */}
            <div className="flex items-center gap-1 shrink-0">
              {ord.driverName ? (
                <span className="text-xs font-bold text-black/60">{ord.driverName}</span>
              ) : (
                <span className="text-[10px] font-bold text-red-500">Kein Fahrer</span>
              )}
            </div>

            {/* ETA badge */}
            <div className={cn(
              'flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black shrink-0',
              ord.etaMin != null && ord.etaMin <= 5
                ? 'bg-matcha-200 text-matcha-800'
                : ord.etaMin != null && ord.etaMin <= 15
                ? 'bg-amber-200 text-amber-800'
                : 'bg-red-200 text-red-800',
            )}>
              <Clock className="h-3 w-3" />
              {etaLabel(ord.etaMin)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
