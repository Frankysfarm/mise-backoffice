'use client';

/**
 * BestellStatusLiveV2 — Phase 388
 * Erweitertes Live-Bestellstatus-Panel mit 4-Stufen-Pipeline.
 * Stages: Eingegangen → In Zubereitung → Unterwegs/Abholung bereit → Geliefert/Abgeholt
 */

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderStatus =
  | 'received'
  | 'in_preparation'
  | 'ready'
  | 'in_delivery'
  | 'delivered'
  | 'picked_up'
  // legacy statuses
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | 'abgeholt';

type OrderStatusData = {
  id: string;
  status: OrderStatus;
  driver_name?: string | null;
  eta_minutes?: number | null;
  bestaetigt_am?: string | null;
  fertig_am?: string | null;
  geliefert_am?: string | null;
  abgeholt_am?: string | null;
};

type ApiResponse = {
  order?: OrderStatusData;
  status?: OrderStatus;
  driver_name?: string | null;
  eta_minutes?: number | null;
};

const STAGE_INDEX: Record<string, number> = {
  neu: 0,
  received: 0,
  bestätigt: 1,
  in_preparation: 1,
  in_zubereitung: 1,
  fertig: 2,
  ready: 2,
  unterwegs: 3,
  in_delivery: 3,
  geliefert: 4,
  delivered: 4,
  abgeholt: 4,
  picked_up: 4,
};

function getStageIndex(status: string): number {
  return STAGE_INDEX[status] ?? 0;
}

type StageStatus = 'done' | 'active' | 'pending';

interface Stage {
  index: number;
  label: string;
  deliveryLabel: string;
  pickupLabel: string;
}

const STAGES: Stage[] = [
  { index: 0, label: 'Bestellung eingegangen', deliveryLabel: 'Bestellung eingegangen', pickupLabel: 'Bestellung eingegangen' },
  { index: 1, label: 'In Zubereitung', deliveryLabel: 'In Zubereitung', pickupLabel: 'In Zubereitung' },
  { index: 2, label: 'Unterwegs', deliveryLabel: 'Auf dem Weg', pickupLabel: 'Bereit zur Abholung' },
  { index: 3, label: 'Geliefert', deliveryLabel: 'Geliefert', pickupLabel: 'Abgeholt' },
];

function StageIcon({ status, animated }: { status: StageStatus; animated?: boolean }) {
  if (status === 'done') {
    return <CheckCircle2 className="h-5 w-5 text-matcha-600" />;
  }
  if (status === 'active') {
    if (animated) {
      return <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />;
    }
    return <Clock className="h-5 w-5 text-amber-500" />;
  }
  return <Clock className="h-5 w-5 text-stone-300" />;
}

interface Props {
  orderId: string;
  isDelivery: boolean;
}

export function BestellStatusLiveV2({ orderId, isDelivery }: Props) {
  const [data, setData] = useState<OrderStatusData>({
    id: orderId,
    status: 'in_preparation',
    driver_name: null,
    eta_minutes: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/storefront/order-status?order_id=${encodeURIComponent(orderId)}`,
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json: ApiResponse = await res.json();
      const order = json.order;
      if (order) {
        setData(order);
      } else if (json.status) {
        setData((prev) => ({
          ...prev,
          status: json.status!,
          driver_name: json.driver_name ?? null,
          eta_minutes: json.eta_minutes ?? null,
        }));
      }
    } catch {
      // Keep mock/previous state
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 15_000);
    return () => clearInterval(iv);
  }, [load]);

  const currentStageIndex = getStageIndex(data.status);

  function getStageStatus(stageIndex: number): StageStatus {
    if (stageIndex < currentStageIndex) return 'done';
    if (stageIndex === currentStageIndex) return 'active';
    return 'pending';
  }

  const isInDelivery = data.status === 'in_delivery' || data.status === 'unterwegs';
  const etaMin = data.eta_minutes;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-matcha-50 px-4 py-3 border-b border-matcha-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-matcha-700">Bestellstatus</h2>
          {loading && (
            <span className="text-[10px] text-matcha-400 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Aktualisierung…
            </span>
          )}
        </div>
        {isInDelivery && etaMin != null && (
          <p className="text-xs text-amber-600 font-semibold mt-0.5">
            Ankunft in ~{Math.round(etaMin)} Min
          </p>
        )}
        {isInDelivery && data.driver_name && (
          <p className="text-[10px] text-matcha-500 mt-0.5">
            Fahrer: {data.driver_name}
          </p>
        )}
      </div>

      {/* Pipeline */}
      <div className="p-4">
        <div className="space-y-0">
          {STAGES.map((stage, idx) => {
            const status = getStageStatus(stage.index);
            const label = isDelivery ? stage.deliveryLabel : stage.pickupLabel;
            const isLast = idx === STAGES.length - 1;

            return (
              <div key={stage.index} className="flex items-start gap-3">
                {/* Icon column */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white',
                      status === 'done'
                        ? 'border-matcha-500 bg-matcha-50'
                        : status === 'active'
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-stone-200 bg-stone-50',
                    )}
                  >
                    <StageIcon
                      status={status}
                      animated={status === 'active' && stage.index === 1}
                    />
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        'w-0.5 flex-1 mt-1 mb-1 min-h-[20px]',
                        status === 'done' ? 'bg-matcha-400' : 'bg-stone-200',
                      )}
                    />
                  )}
                </div>

                {/* Label column */}
                <div className="flex-1 pb-4">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      status === 'done'
                        ? 'text-matcha-700'
                        : status === 'active'
                        ? 'text-amber-700'
                        : 'text-stone-400',
                    )}
                  >
                    {label}
                  </p>
                  {/* Active stage extra info */}
                  {status === 'active' && stage.index === 3 && isDelivery && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      {etaMin != null ? `ETA: ~${Math.round(etaMin)} Min` : 'Unterwegs…'}
                    </p>
                  )}
                  {status === 'active' && stage.index === 2 && !isDelivery && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Bitte Bestellung abholen
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
