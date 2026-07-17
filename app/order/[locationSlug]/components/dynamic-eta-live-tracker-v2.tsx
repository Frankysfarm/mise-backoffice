'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, ChefHat, CheckCircle2, Bike, Check } from 'lucide-react';

type OrderStatus = 'received' | 'in_preparation' | 'ready_for_pickup' | 'on_route' | 'delivered';

interface OrderStatusData {
  status: OrderStatus;
  eta_min: number | null;
  phase_label: string;
  driver_name: string | null;
  updated_at: string;
}

const MOCK_STATUS: OrderStatusData = {
  status: 'in_preparation' as const,
  eta_min: 25,
  phase_label: 'Wird zubereitet',
  driver_name: null as string | null,
  updated_at: new Date().toISOString(),
};

const PHASES: { key: OrderStatus; label: string; Icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { key: 'received', label: 'Bestellung eingegangen', Icon: Package },
  { key: 'in_preparation', label: 'Wird zubereitet', Icon: ChefHat },
  { key: 'ready_for_pickup', label: 'Abholbereit', Icon: CheckCircle2 },
  { key: 'on_route', label: 'Fahrer unterwegs', Icon: Bike },
  { key: 'delivered', label: 'Geliefert!', Icon: CheckCircle2 },
];

const STATUS_ORDER: OrderStatus[] = ['received', 'in_preparation', 'ready_for_pickup', 'on_route', 'delivered'];

interface Props {
  orderId: string;
  initialEtaMin?: number;
  className?: string;
}

function EtaRing({ etaMin, pulse }: { etaMin: number | null; pulse: boolean }) {
  const size = 80;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const maxEta = 60;
  const fraction = etaMin != null ? Math.max(0, Math.min(1, 1 - etaMin / maxEta)) : 0;
  const dashoffset = circumference * (1 - fraction);

  return (
    <div className={`relative inline-flex items-center justify-center ${pulse ? 'animate-pulse' : ''}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e7e5e4"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#4d7c0f"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {etaMin != null ? (
          <>
            <span className="text-xl font-bold text-stone-800 leading-none">{etaMin}</span>
            <span className="text-xs text-stone-500">Min</span>
          </>
        ) : (
          <span className="text-xs text-stone-500 text-center leading-tight px-1">Berechne...</span>
        )}
      </div>
    </div>
  );
}

export function DynamicEtaLiveTrackerV2({ orderId, initialEtaMin, className = '' }: Props) {
  const [data, setData] = useState<OrderStatusData>({
    ...MOCK_STATUS,
    eta_min: initialEtaMin ?? MOCK_STATUS.eta_min,
  });
  const [usedMock, setUsedMock] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/public/bestell-status?order_id=${orderId}`);
      if (!res.ok) throw new Error('fetch failed');
      const json: OrderStatusData = await res.json();
      setData(json);
      setUsedMock(false);
    } catch {
      setData(prev => prev.status === MOCK_STATUS.status ? { ...MOCK_STATUS, eta_min: initialEtaMin ?? MOCK_STATUS.eta_min } : prev);
      setUsedMock(true);
    }
  }, [orderId, initialEtaMin]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const activeIndex = STATUS_ORDER.indexOf(data.status);
  const pulse = data.eta_min != null && data.eta_min <= 5;

  return (
    <div className={`rounded-2xl border border-stone-200 bg-white shadow-sm text-stone-800 ${className}`}>
      {usedMock && (
        <div className="rounded-t-2xl bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-700">
          Live-Tracking vorübergehend nicht verfügbar
        </div>
      )}

      <div className="px-5 py-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider mb-0.5">Lieferzeit</p>
            <p className="text-base font-semibold text-matcha-700">
              {data.phase_label}
            </p>
            {data.status === 'on_route' && data.driver_name && (
              <p className="text-sm text-stone-500 mt-0.5">
                Fahrer: <span className="text-stone-700 font-medium">{data.driver_name}</span>
              </p>
            )}
          </div>
          <EtaRing etaMin={data.eta_min} pulse={pulse} />
        </div>

        <div className="space-y-0">
          {PHASES.map((phase, idx) => {
            const isPast = idx < activeIndex;
            const isActive = idx === activeIndex;
            const isFuture = idx > activeIndex;

            return (
              <div key={phase.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isPast
                        ? 'bg-matcha-600 border-matcha-600'
                        : isActive
                        ? 'bg-white border-matcha-600'
                        : 'bg-white border-stone-200'
                    }`}
                  >
                    {isPast ? (
                      <Check size={13} className="text-white" />
                    ) : (
                      <phase.Icon
                        size={13}
                        className={isActive ? 'text-matcha-700' : 'text-stone-300'}
                      />
                    )}
                  </div>
                  {idx < PHASES.length - 1 && (
                    <div
                      className={`w-0.5 h-6 mt-0.5 ${isPast ? 'bg-matcha-600' : 'bg-stone-200'}`}
                    />
                  )}
                </div>
                <div className="pb-1 pt-1">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      isActive
                        ? 'text-matcha-700'
                        : isPast
                        ? 'text-stone-400'
                        : isFuture
                        ? 'text-stone-300'
                        : ''
                    }`}
                  >
                    {phase.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
