'use client';

import { useEffect, useState } from 'react';
import { Clock, Truck, CheckCircle2 } from 'lucide-react';

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
  status?: string | null;
}

type DeliveryPhase = 'preparing' | 'out_for_delivery' | 'delivered';

interface EtaState {
  phase: DeliveryPhase;
  etaMin: number | null;
  displayLabel: string | null;
}

function phaseFromStatus(status: string | null | undefined): DeliveryPhase {
  if (!status) return 'preparing';
  if (['geliefert', 'delivered', 'completed'].includes(status)) return 'delivered';
  if (['unterwegs', 'out_for_delivery', 'picked_up'].includes(status)) return 'out_for_delivery';
  return 'preparing';
}

function etaMinFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  return mins;
}

function etaLabel(etaMin: number | null, displayLabel: string | null): string {
  if (displayLabel) return displayLabel;
  if (etaMin == null) return 'Wird berechnet…';
  if (etaMin <= 0) return 'Gleich da!';
  if (etaMin === 1) return 'ca. 1 Minute';
  return `ca. ${etaMin} Minuten`;
}

export function EtaLiveBanner({ orderId, initialEtaMin, status }: Props) {
  const [eta, setEta] = useState<EtaState>({
    phase: phaseFromStatus(status),
    etaMin: initialEtaMin ?? null,
    displayLabel: null,
  });

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/eta/${orderId}`);
        if (!res.ok || !mounted) return;
        const d = await res.json();
        if (!mounted) return;
        setEta({
          phase: phaseFromStatus(status),
          etaMin: etaMinFromIso(d.eta_latest),
          displayLabel: d.display_label ?? null,
        });
      } catch { /* silent */ }
    }

    poll();
    const iv = setInterval(poll, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId, status]);

  // Count down locally every minute
  useEffect(() => {
    if (eta.phase === 'delivered' || eta.etaMin == null || eta.etaMin <= 0) return;
    const iv = setInterval(() => {
      setEta((prev) => {
        if (prev.etaMin == null || prev.etaMin <= 0) return prev;
        return { ...prev, etaMin: prev.etaMin - 1, displayLabel: null };
      });
    }, 60_000);
    return () => clearInterval(iv);
  }, [eta.phase, eta.etaMin]);

  if (eta.phase === 'delivered') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
        <CheckCircle2 size={22} className="text-green-500 shrink-0" />
        <div>
          <div className="text-sm font-bold text-green-800">Geliefert!</div>
          <div className="text-xs text-green-600">Guten Appetit</div>
        </div>
      </div>
    );
  }

  const isOutForDelivery = eta.phase === 'out_for_delivery';

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${isOutForDelivery ? 'bg-matcha-50 border-matcha-200' : 'bg-amber-50 border-amber-200'}`}
    >
      <div className={`shrink-0 ${isOutForDelivery ? 'text-matcha-500' : 'text-amber-500'}`}>
        {isOutForDelivery ? <Truck size={22} className="animate-bounce" /> : <Clock size={22} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${isOutForDelivery ? 'text-matcha-800' : 'text-amber-800'}`}>
          {isOutForDelivery ? 'Unterwegs zu dir!' : 'Wird zubereitet'}
        </div>
        <div className={`text-xs mt-0.5 ${isOutForDelivery ? 'text-matcha-600' : 'text-amber-600'}`}>
          {etaLabel(eta.etaMin, eta.displayLabel)}
        </div>
      </div>
      <div className={`shrink-0 text-[10px] font-mono flex items-center gap-1 ${isOutForDelivery ? 'text-matcha-500' : 'text-amber-500'}`}>
        LIVE
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      </div>
    </div>
  );
}
